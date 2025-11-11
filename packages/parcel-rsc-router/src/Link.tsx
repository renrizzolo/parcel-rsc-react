"use client";

import React, { type HTMLAttributeAnchorTarget } from "react";
import { RoutePath } from "./types.js";
import { useRouter } from "./Router.js";

export function Link({
  to,
  children,
  hash,
  target,
  search,
  onClick,
  ...props
}: {
  to: RoutePath;
  hash?: string;
  search?: Record<string, string>;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  target?: HTMLAttributeAnchorTarget;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useRouter();
  const href = `${to}${hash ? `#${hash}` : ""}${search ? `?${new URLSearchParams(search)}` : ""}`;

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
          navigate(href);
        }
      }}
      {...props}
    >
      {children}
    </a>
  );
}
