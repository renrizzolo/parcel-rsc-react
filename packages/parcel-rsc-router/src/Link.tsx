"use client";

import React, { type HTMLAttributeAnchorTarget } from "react";
import { RoutePath } from "./types.js";
import { useRouter } from "./Router.js";

const PREFETCH_DELAY_MS = 50;

export function Link({
  to,
  children,
  hash,
  target,
  search,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  onTouchStart,
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
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const cancelPrefetch = React.useCallback(() => {
    if (hoverTimeoutRef.current !== null) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const handlePrefetch = React.useCallback(() => {
    cancelPrefetch();
    if (prefetch && (!target || target === "_self") && prefetchRoute) {
      void prefetchRoute(to);
    }
  }, [cancelPrefetch, prefetch, target, prefetchRoute, to]);

  const schedulePrefetch = React.useCallback(() => {
    cancelPrefetch();
    if (prefetch && (!target || target === "_self") && prefetchRoute) {
      hoverTimeoutRef.current = setTimeout(() => {
        hoverTimeoutRef.current = null;
        void prefetchRoute(to);
      }, PREFETCH_DELAY_MS);
    }
  }, [cancelPrefetch, prefetch, target, prefetchRoute, to]);

  React.useEffect(() => {
    return cancelPrefetch;
  }, [cancelPrefetch]);

  return (
    <a
      href={href}
      onMouseEnter={(e) => {
        if (onMouseEnter) {
          onMouseEnter(e);
        }
        schedulePrefetch();
      }}
      onMouseLeave={(e) => {
        if (onMouseLeave) {
          onMouseLeave(e);
        }
        cancelPrefetch();
      }}
      onFocus={(e) => {
        if (onFocus) {
          onFocus(e);
        }
        schedulePrefetch();
      }}
      onBlur={(e) => {
        if (onBlur) {
          onBlur(e);
        }
        cancelPrefetch();
      }}
      onPointerDown={(e) => {
        if (onPointerDown) {
          onPointerDown(e);
        }
        handlePrefetch();
      }}
      onTouchStart={(e) => {
        if (onTouchStart) {
          onTouchStart(e);
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
