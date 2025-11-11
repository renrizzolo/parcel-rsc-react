import { PageProps } from "@parcel/rsc";
import { Nav } from "./components/Nav";
import "./client";
import "./page.css";
import { AppProvider } from "./appProvider";

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
