import type { PageProps } from "@parcel/rsc";
import { Counter } from "../components/Counter.js";
import Layout from "../Layout.js";
import { Suspense } from "react";
import { Code } from "../components/Code.js";

export default function Index({ currentPage }: PageProps) {
  return (
    <Layout currentPage={currentPage}>
      <h1>Parcel Static React App</h1>
      <p>
        This page is a React Server Component that is statically rendered at
        build time. Edit <code>pages/index.tsx</code> to get started.
      </p>
      <p>
        Here is a client component: <Counter />
      </p>
      <p>Here is some code highlighted on the server at build time:</p>
      <Suspense fallback={<>Loading...</>}>
        <Code />
      </Suspense>
    </Layout>
  );
}
