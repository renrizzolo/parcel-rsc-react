"use client";
import { RouterProvider } from "@renr/parcel-rsc-router";
import { flatRoutes } from "../routes";

export function AppProvider({ children }: { children: React.ReactNode }) {
  return <RouterProvider routes={flatRoutes}>{children}</RouterProvider>;
}
