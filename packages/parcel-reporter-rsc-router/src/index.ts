import { Reporter } from "@parcel/plugin";

export default new Reporter({
  async report({ event }) {
    if (event.type === "buildStart") {
      // TODO
    }
  },
});
