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
  onMouseEnter,
  onFocus,
  prefetch = true,
  ...props
}: {
  to: RoutePath;
  hash?: string;
  search?: Record<string, string>;
  children: React.ReactNode;
  target?: HTMLAttributeAnchorTarget;
  prefetch?: boolean;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate, prefetch: prefetchRoute } = useRouter();
  const href = `${to}${hash ? `#${hash}` : ""}${search ? `?${new URLSearchParams(search)}` : ""}`;

  const handlePrefetch = React.useCallback(() => {
    if (prefetch && (!target || target === "_self") && prefetchRoute) {
      void prefetchRoute(to);
    }
  }, [prefetch, target, prefetchRoute, to]);

  return (
    <a
      href={href}
      onMouseEnter={(e) => {
        if (onMouseEnter) {
          onMouseEnter(e);
        }
        handlePrefetch();
      }}
      onFocus={(e) => {
        if (onFocus) {
          onFocus(e);
        }
        handlePrefetch();
      }}
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
