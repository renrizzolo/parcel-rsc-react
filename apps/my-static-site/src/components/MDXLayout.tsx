import type { PageProps } from "@parcel/rsc";
import type { ReactNode } from "react";
import AppLayout from "../Layout";

export default function Layout({
  children,
  currentPage,
}: {
  children: ReactNode;
  currentPage: PageProps["currentPage"];
}) {
  return (
    <AppLayout
      title={currentPage.tableOfContents?.[0].title}
      currentPage={currentPage}
    >
      {children}
    </AppLayout>
  );
}
