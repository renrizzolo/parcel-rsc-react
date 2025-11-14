import { createHighlighter, type Highlighter } from "shiki";

export async function Code() {
  const highlightedCode = await highlightCode(
    `import { fetchRSC } from "@parcel/rsc/client";`,
    "typescript"
  );

  return <div dangerouslySetInnerHTML={{ __html: highlightedCode || "" }} />;
}

let highlighter: Highlighter | null = null;

//  TODO how to stop parcel from bundling this into the server build?
async function highlightCode(code: string, lang = "typescript") {
  console.log("Highlighting code...");
  try {
    if (!highlighter) {
      highlighter = await createHighlighter({
        langs: ["javascript", "typescript", "json", "tsx"],
        themes: ["github-dark"],
      });
    }

    const html = highlighter.codeToHtml(code, {
      lang,
      theme: "github-dark",
    });
    console.log("Highlighted code:", html);
    return html;
  } catch (err) {
    console.error("Error highlighting code:", err);
  }
}
