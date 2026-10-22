"use client-entry";

import { hydrate } from "@parcel/rsc/client";
import type { ReactNode } from "react";

export const updateRoot: (value: ReactNode, cb?: () => void) => void =
  hydrate();
