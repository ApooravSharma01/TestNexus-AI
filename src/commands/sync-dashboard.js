import { mkdir, readFile, writeFile } from "node:fs/promises";

import { runPipeline } from "../core/pipeline.js";
import { measureSelection, summarizeEvaluation } from "../reporting/evaluation.js";
import { fromRoot } from "../utils/project-root.js";
import { readJson } from "../utils/read-json.js";

async function readLatestReport() {
  try {
    return JSON.parse(await readFile(fromRoot("reports/latest.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function syncDashboard() {
  const cases = await readJson("tests/fixtures/evaluations.json");
  const runs = [];

  for (const item of cases) {
    const report = await runPipeline({ summary: item.summary });
    report.run = {
      command: "npm run evaluate",
      source: `labeled case "${item.name}"`
    };
    const metrics = measureSelection(
      report.selectedTests.map((test) => test.id),
      item.relevantTestIds,
      item.criticalTestIds
    );

    runs.push({
      name: item.name,
      metrics,
      testsSaved: report.comparison.testsSaved,
      report
    });
  }

  const summary = summarizeEvaluation(runs);
  const latest = await readLatestReport();
  const history = {
    latest,
    runs,
    evaluation: {
      averagePrecision: summary.averagePrecision,
      averageRecall: summary.averageRecall,
      averageCriticalRecall: summary.averageCriticalRecall,
      cases: summary.cases.map((item) => ({
        name: item.name,
        metrics: item.metrics,
        testsSaved: item.testsSaved
      }))
    }
  };
  const publicDirectory = fromRoot("dashboard/public");

  await mkdir(publicDirectory, { recursive: true });
  await writeFile(fromRoot("dashboard/public/history.json"), JSON.stringify(history, null, 2));
  await writeFile(
    fromRoot("dashboard/public/sample-report.json"),
    JSON.stringify(latest || runs[0].report, null, 2)
  );

  return history;
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("sync-dashboard.js");

if (isDirectRun) {
  const history = await syncDashboard();
  console.log(`Dashboard updated with ${history.runs.length} labeled runs.`);
}
