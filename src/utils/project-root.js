import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function fromRoot(...parts) {
  return join(projectRoot, ...parts);
}
