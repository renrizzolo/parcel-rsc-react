import { type PageProps } from "@parcel/rsc";
import { routeTree } from "../../../routes";
import { NavTree } from "../../components/Nav";
import Layout from "../../Layout";

export default function Index({ currentPage }: PageProps) {
  return (
    <Layout currentPage={currentPage}>
      <h1>Blog Index Page</h1>

      {routeTree.children
        .find((n) => n.slug === "blog")!
        .children.map((child) => (
          <NavTree key={child.path} node={child} currentPage={currentPage} />
        ))}
    </Layout>
  );
}
