"use client";

import React, { type HTMLAttributeAnchorTarget } from "react";
import { RouteData, RoutePath } from "./types.js";
import { navigate } from "./rsc.js";

export function Link({
  to,
  children,
  hash,
  onClick,
  target,
  search,
  routes,
  ...props
}: {
  to: RoutePath;
  hash?: string;
  search?: Record<string, string>;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  target?: HTMLAttributeAnchorTarget;
  // TODO we will get routes from context, but for now we pass it in
  routes: RouteData[];
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const href = `${to}${hash ? `#${hash}` : ""}${search ? `?${new URLSearchParams(search)}` : ""}`;
  console.log("Link href", href);
  return (
    <a
      href={href}
      onClick={(e) => {
        if (onClick) {
          onClick(e);
        }

        if (
          (!target || target === "_self") &&
          e.button === 0 && // left clicks only
          !e.metaKey && // open in new tab (mac)
          !e.ctrlKey && // open in new tab (windows)
          !e.altKey && // download
          !e.shiftKey &&
          !e.defaultPrevented
        ) {
          // Intercept link clicks to perform RSC navigation.
          e.preventDefault();

          void navigate(href, routes, () => {
            // add to history on a successful navigation
            window.history.pushState(null, "", href);
          });
        }
      }}
      {...props}
    >
      {children}
    </a>
  );
}
