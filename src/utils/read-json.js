import { readFile } from "node:fs/promises";

import { fromRoot } from "./project-root.js";

export async function readJson(relativePath) {
  const contents = await readFile(fromRoot(relativePath), "utf8");
  return JSON.parse(contents);
}
