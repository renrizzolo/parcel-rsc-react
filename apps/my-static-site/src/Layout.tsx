import { PageProps } from "@parcel/rsc";
import { Nav } from "./components/Nav";
import "./page.css";

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
      <body>
        <Nav currentPage={currentPage} />
        <hr />
        {children}
      </body>
    </html>
  );
}
