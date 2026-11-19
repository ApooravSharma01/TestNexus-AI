import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { runPipeline } from "../core/pipeline.js";
import { createPlaywrightRunner } from "../execution/playwright-runner.js";
import { completeWithAi } from "../intelligence/ai-client.js";
import { createIntelligenceEngine } from "../intelligence/intelligence-engine.js";
import { renderMarkdown } from "../reporting/report-builder.js";
import { env } from "../config/environment.js";
import { createPullRequestService } from "../integrations/github/pull-request-service.js";
import { logger } from "../utils/logger.js";
import { fromRoot } from "../utils/project-root.js";
import { readJson } from "../utils/read-json.js";
import { handleError } from "../utils/error-handler.js";

function readArguments(argv) {
  const args = argv.slice(2);
  const execute = args.includes("--execute");
  const prIndex = args.indexOf("--pr");
  const fixture = args.find((arg) => arg.endsWith(".json"));

  return {
    execute,
    pullNumber: prIndex === -1 ? null : Number(args[prIndex + 1]),
    fixture: fixture || "tests/fixtures/login-change.json"
  };
}

function createEngine() {
  if (!env.aiApiKey) {
    return createIntelligenceEngine();
  }

  return createIntelligenceEngine({
    complete: (prompt) => completeWithAi(prompt, {
      apiKey: env.aiApiKey,
      model: env.aiModel,
      baseUrl: env.aiBaseUrl
    })
  });
}

export async function analyzeChanges(argv = process.argv) {
  const options = readArguments(argv);
  const args = argv.slice(2);
  const summary = options.pullNumber
    ? await createPullRequestService().getPullRequestWithFiles(options.pullNumber)
    : await readJson(options.fixture);
  const report = await runPipeline({
    summary,
    intelligence: createEngine(),
    execute: options.execute ? createPlaywrightRunner() : null,
    explainFailure: env.aiApiKey
      ? (prompt) => completeWithAi(prompt, {
        apiKey: env.aiApiKey,
        model: env.aiModel,
        baseUrl: env.aiBaseUrl
      })
      : null
  });

  report.run = {
    command: args.length > 0 ? `npm run analyze -- ${args.join(" ")}` : "npm run analyze",
    source: options.pullNumber ? `GitHub pull request #${options.pullNumber}` : options.fixture
  };

  const outputPath = fromRoot("reports/latest.json");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2));

  return report;
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("analyze.js");

if (isDirectRun) {
  try {
    const report = await analyzeChanges();
    logger.info("Regression analysis complete", {
      risk: report.risk,
      comparison: report.comparison
    });
    console.log(renderMarkdown(report));
  } catch (error) {
    console.error(JSON.stringify(handleError(error)));
    process.exitCode = 1;
  }
}
