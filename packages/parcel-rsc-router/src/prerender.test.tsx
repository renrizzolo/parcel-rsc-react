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

  it("does not probe page components outside React when bootstrapComponent is explicitly provided", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "rsc-prerender-"));
    tempDirs.push(outDir);

    const ExplicitLayout: ComponentType<{ children?: React.ReactNode }> & {
      bootstrapScript?: string;
    } = ({ children }) => <main>{children}</main>;
    ExplicitLayout.bootstrapScript = 'import("/client/explicit.js")';

    const PageSpy = vi.fn(({ currentPage }: PageProps) => (
      <ExplicitLayout>{currentPage.name}</ExplicitLayout>
    ));

    await prerenderStaticSite({
      routes: [
        { path: "/", slug: "index", html: "/index.html", rsc: "/index.rsc" },
      ],
      pages: {
        "/index.html": { default: PageSpy },
      },
      bootstrapComponent: ExplicitLayout,
      outDir,
      staticDir: path.join(outDir, "nonexistent-static"),
    });

    expect(PageSpy).not.toHaveBeenCalled();
    expect(renderHTMLMock).toHaveBeenCalledTimes(1);
    expect(renderHTMLMock.mock.calls[0]?.[1]?.component).toBe(ExplicitLayout);
  });

  it("does not invoke the first wrapped page twice during fallback discovery and handles async pages", async () => {
    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "rsc-prerender-"));
    tempDirs.push(outDir);

    const Layout: ComponentType<{ children?: React.ReactNode }> & {
      bootstrapScript?: string;
    } = ({ children }) => <main>{children}</main>;
    Layout.bootstrapScript = 'import("/client/layout.js")';

    const SyncPage = vi.fn(({ currentPage }: PageProps) => (
      <Layout>
        <h1>{currentPage.name}</h1>
      </Layout>
    ));

    let asyncPageCalls = 0;
    async function AsyncPage({ currentPage }: PageProps) {
      asyncPageCalls += 1;
      return (
        <Layout>
          <h1>{currentPage.name}</h1>
        </Layout>
      );
    }

    await prerenderStaticSite({
      routes: [
        { path: "/", slug: "index", html: "/index.html", rsc: "/index.rsc" },
        {
          path: "/async",
          slug: "async",
          html: "/async.html",
          rsc: "/async.rsc",
        },
      ],
      pages: {
        "/index.html": { default: SyncPage },
        "/async.html": { default: AsyncPage as unknown as ComponentType<PageProps> },
      },
      outDir,
      staticDir: path.join(outDir, "nonexistent-static"),
    });

    // Probed only once for fallback discovery, then reused during render.
    expect(SyncPage).toHaveBeenCalledTimes(1);
    // Async page is never invoked outside React's render lifecycle.
    expect(asyncPageCalls).toBe(0);
    expect(renderHTMLMock).toHaveBeenCalledTimes(2);
    expect(renderHTMLMock.mock.calls[0]?.[1]?.component).toBe(Layout);
    expect(renderHTMLMock.mock.calls[1]?.[1]?.component).toBe(Layout);
  });
});
