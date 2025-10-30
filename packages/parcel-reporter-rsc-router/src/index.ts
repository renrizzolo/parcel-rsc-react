import { Reporter } from "@parcel/plugin";

export { generateRoutes } from "./generate-routes";

export default new Reporter({
  async report({ event }) {
    if (event.type === "buildStart") {
      // TODO
    }
  },
});
