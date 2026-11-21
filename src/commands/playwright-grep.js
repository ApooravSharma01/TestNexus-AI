import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { buildGrepPattern } from "../execution/playwright-runner.js";
import { handleError } from "../utils/error-handler.js";
import { fromRoot } from "../utils/project-root.js";

// npm run playwright-grep -- reports/openoms.json reports/openoms-grep.txt
// Writes one regex for Playwright's --grep into the second file. The file is
// empty when no test is needed. A file is used instead of printing because
// other tools may write to the terminal first and spoil the pattern.
try {
  const reportPath = process.argv[2] || "reports/latest.json";
  const outputPath = fromRoot(process.argv[3] || "reports/selected-grep.txt");
  const report = JSON.parse(await readFile(fromRoot(reportPath), "utf8"));

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildGrepPattern(report.selectedTests || []));
} catch (error) {
  console.error(JSON.stringify(handleError(error)));
  process.exitCode = 1;
}
