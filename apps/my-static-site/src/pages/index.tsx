import type { PageProps } from "@parcel/rsc";
import { Counter } from "../components/Counter.js";
import Layout from "../Layout.js";
import { Suspense } from "react";
import { Code } from "../components/Code.js";
import counterDocs from "../../docgen/Counter.json" assert { type: "json" };

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
      <p>Here is some generated documentation for the count component:</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Path</th>
            <th>File Name</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{counterDocs.name}</td>
            <td>{counterDocs.path}</td>
            <td>{counterDocs.fileName}</td>
          </tr>
        </tbody>
        <thead>
          <tr>
            <th>Prop Name</th>
            <th>Description</th>
            <th>Type</th>
            <th>Default Value</th>
            <th>Required</th>
          </tr>
        </thead>
        <tbody>
          {counterDocs.props &&
            Object.entries(counterDocs.props).map(([propName, propInfo]) => (
              <tr key={propName}>
                <td>{propName}</td>
                <td>{propInfo.description}</td>
                <td>
                  <Code code={propInfo.type.name} />
                </td>
                <td>{propInfo.defaultValue?.value}</td>
                <td>{propInfo.required ? "Yes" : "No"}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <p>Here is some code highlighted on the server at build time:</p>
      <Suspense fallback={<>Loading...</>}>
        <Code code={'import { fetchRSC } from "@parcel/rsc/client";'} />
      </Suspense>
    </Layout>
  );
}
