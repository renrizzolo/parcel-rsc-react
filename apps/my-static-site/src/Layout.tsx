import "@cumulo/core/theme.css";
import { Container, Panel, ThemeScript, vars } from "@cumulo/core";
import { cx, style } from "@cumulo/css";
import { PageProps } from "@renr/parcel-rsc-router";
import { Nav } from "./components/Nav";
import { AppProvider } from "./appProvider";
import "./client";
import "./styles.css";
import { ThemeToggle } from "@cumulo/core/components/ThemeToggle";

const headerBarStyle = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: vars.spacing.sm,
  marginBottom: vars.spacing.sm,
});

export default function Layout({
  children,
  title,
  currentPage,
}: {
  children: React.ReactNode;
  title?: string;
  currentPage: PageProps["currentPage"];
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <title>{title ?? "Parcel Static React App"}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <AppProvider>
        <body>
          <Container size="lg" padding="md">
            <Panel
              as="header"
              divider="bottom"
              padding="sm"
              className={cx(headerBarStyle)}
            >
              <Nav currentPage={currentPage} />
              <ThemeToggle />
            </Panel>
            <Panel as="main" padding="md">
              {children}
            </Panel>
          </Container>
        </body>
      </AppProvider>
    </html>
  );
}
