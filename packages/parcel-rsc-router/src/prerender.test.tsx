import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageProps } from "./types.js";

const renderHTMLMock = vi.fn(
  async (_element: unknown, _options?: { component?: ComponentType }) =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("<html></html>"));
        controller.close();
      },
    })
);

const renderRSCMock = vi.fn(
  (_element: unknown) =>
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("0:null\n"));
        controller.close();
      },
    })
);

vi.mock("@parcel/rsc/server", () => ({
  renderHTML: renderHTMLMock,
  renderRSC: renderRSCMock,
}));

const { prerenderStaticSite } = await import("./prerender.js");

const tempDirs: string[] = [];

afterEach(async () => {
  renderHTMLMock.mockClear();
  renderRSCMock.mockClear();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
});

describe("prerenderStaticSite", () => {
  it("resolves bootstrapScript from a wrapped layout component (e.g. compiled MDX pages)", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "rsc-prerender-"));
    tempDirs.push(outDir);

    const MDXLayout: ComponentType<{ children?: React.ReactNode }> & {
      bootstrapScript?: string;
    } = ({ children }) => <main>{children}</main>;
    MDXLayout.bootstrapScript = 'import("/client/entry.js")';

    // Mirrors Parcel's compiled MDX default export: a plain wrapper around MDXLayout.
    function MdxPage(props: PageProps) {
      return (
        <MDXLayout>
          <h1>{props.currentPage.name}</h1>
        </MDXLayout>
      );
    }

    await prerenderStaticSite({
      routes: [
        {
          path: "/",
          slug: "index",
          html: "/index.html",
          rsc: "/index.rsc",
        },
      ],
      pages: {
        "/index.html": {
          default: MdxPage,
        },
      },
      outDir,
      staticDir: path.join(outDir, "nonexistent-static"),
    });

    expect(renderHTMLMock).toHaveBeenCalledTimes(1);
    const options = renderHTMLMock.mock.calls[0]?.[1];
    expect(options?.component).toBe(MDXLayout);
  });

  it("uses PageComponent directly when it carries bootstrapScript itself", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "rsc-prerender-"));
    tempDirs.push(outDir);

    const DirectPage: ComponentType<PageProps> & {
      bootstrapScript?: string;
    } = ({ currentPage }) => <div>{currentPage.name}</div>;
    DirectPage.bootstrapScript = 'import("/client/direct.js")';

    await prerenderStaticSite({
      routes: [
        {
          path: "/",
          slug: "index",
          html: "/index.html",
          rsc: "/index.rsc",
        },
      ],
      pages: {
        "/index.html": {
          default: DirectPage,
        },
      },
      outDir,
      staticDir: path.join(outDir, "nonexistent-static"),
    });

    expect(renderHTMLMock).toHaveBeenCalledTimes(1);
    const options = renderHTMLMock.mock.calls[0]?.[1];
    expect(options?.component).toBe(DirectPage);
  });
});
