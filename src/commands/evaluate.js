import { runPipeline } from "../core/pipeline.js";
import { measureSelection, summarizeEvaluation } from "../reporting/evaluation.js";
import { logger } from "../utils/logger.js";
import { readJson } from "../utils/read-json.js";
import { handleError } from "../utils/error-handler.js";

export async function evaluateSelections() {
  const cases = await readJson("tests/fixtures/evaluations.json");
  const measured = [];

  for (const item of cases) {
    const report = await runPipeline({ summary: item.summary });
    const metrics = measureSelection(
      report.selectedTests.map((test) => test.id),
      item.relevantTestIds,
      item.criticalTestIds
    );

    measured.push({
      name: item.name,
      selectedTestIds: report.selectedTests.map((test) => test.id),
      testsSaved: report.comparison.testsSaved,
      metrics
    });
  }

  return summarizeEvaluation(measured);
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("evaluate.js");

if (isDirectRun) {
  try {
    const evaluation = await evaluateSelections();
    logger.info("Selection evaluation complete", {
      averagePrecision: evaluation.averagePrecision,
      averageRecall: evaluation.averageRecall,
      averageCriticalRecall: evaluation.averageCriticalRecall
    });

    for (const item of evaluation.cases) {
      console.log([
        item.name,
        `precision ${item.metrics.precision}`,
        `recall ${item.metrics.recall}`,
        `critical recall ${item.metrics.criticalRecall}`,
        `saved ${item.testsSaved}`
      ].join(" | "));
    }
  } catch (error) {
    console.error(JSON.stringify(handleError(error)));
    process.exitCode = 1;
  }
}
