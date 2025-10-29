import { routesByPage } from "../../routes";

export default function Home() {
  return Object.values(routesByPage).map((route) => route.slug);
}
