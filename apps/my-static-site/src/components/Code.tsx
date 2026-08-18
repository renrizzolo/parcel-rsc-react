import { type Highlighter } from "shiki";

// store on globalThis to survive dev module reloads
const globalForShiki = globalThis as unknown as {
  shikiHighlighterPromise?: Promise<Highlighter>;
};

function getHighlighter(): Promise<Highlighter> {
  if (!globalForShiki.shikiHighlighterPromise) {
    globalForShiki.shikiHighlighterPromise = (async () => {
      const { createHighlighter } = await import("shiki");
      return createHighlighter({
        langs: ["javascript", "typescript", "json", "tsx"],
        themes: ["github-dark"],
      });
    })();
  }
  return globalForShiki.shikiHighlighterPromise;
}

async function highlightCode(code: string, lang = "typescript") {
  try {
    const highlighter = await getHighlighter();
    return highlighter.codeToHtml(code, {
      lang,
      theme: "github-dark",
    });
  } catch (err) {
    console.error("Error highlighting code:", err);
    return null;
  }
}

export async function Code({ code }: { code: string }) {
  const highlightedCode = await highlightCode(code, "typescript");

  return <div dangerouslySetInnerHTML={{ __html: highlightedCode || "" }} />;
}
