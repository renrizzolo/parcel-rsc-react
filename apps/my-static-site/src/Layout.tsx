import { PageProps } from "@parcel/rsc";
import { Nav } from "./components/Nav";
import { AppProvider } from "./appProvider";
import "./client";
// TODO - this creates a unique css file per page, but there doesn't seem to be a good way to
// handle global css with parcel react-static.
import "./styles.css";

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
    <html lang="en">
      <head>
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
          <Nav currentPage={currentPage} />
          <hr />
          {children}
        </body>
      </AppProvider>
    </html>
  );
}
