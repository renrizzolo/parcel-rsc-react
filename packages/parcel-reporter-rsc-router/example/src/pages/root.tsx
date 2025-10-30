import { routesByPage } from "../../routes.js";

export default function Home() {
  return Object.values(routesByPage).map((route) => route.path);
}
