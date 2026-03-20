import path from "path";
import { generateRoutes } from "../src/generate-routes";

const pagesPattern = "src/pages/**/*.(js|jsx|ts|tsx|md|mdx)";
const rootDir = path.resolve(__dirname, "");

generateRoutes(pagesPattern, rootDir).catch((err) => {
  console.error(err);
  process.exit(1);
});
