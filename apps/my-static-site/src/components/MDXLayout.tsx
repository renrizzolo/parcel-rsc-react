import { PageProps } from "@renr/parcel-rsc-router";
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
