// "use client-entry";

import { hydrate } from "@parcel/rsc/client";

//TODO https://github.com/microsoft/TypeScript/issues/42873#issuecomment-1416128545
export const updateRoot: ReturnType<typeof hydrate> = hydrate({
  onHmrReload() {
    console.log("HMR Reload triggered");
  },
});
