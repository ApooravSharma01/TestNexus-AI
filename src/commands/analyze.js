import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { runPipeline } from "../core/pipeline.js";
import { createPlaywrightRunner } from "../execution/playwright-runner.js";
import { completeWithAi } from "../intelligence/ai-client.js";
import { createIntelligenceEngine } from "../intelligence/intelligence-engine.js";
import { renderMarkdown } from "../reporting/report-builder.js";
import { env } from "../config/environment.js";
import { createPullRequestService } from "../integrations/github/pull-request-service.js";
import { loadProject } from "../projects/project-registry.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../utils/logger.js";
import { fromRoot } from "../utils/project-root.js";
import { readJson } from "../utils/read-json.js";
import { handleError } from "../utils/error-handler.js";

const valueFlags = ["--pr", "--project", "--repo", "--out", "--markdown"];

function readArguments(argv) {
  const args = argv.slice(2);
  const valueOf = (flag) => {
    const index = args.indexOf(flag);
    return index === -1 ? null : args[index + 1];
  };
  const valuesUsed = new Set(valueFlags.map(valueOf).filter(Boolean));
  const fixture = args.find((arg) => arg.endsWith(".json") && !valuesUsed.has(arg));
  const pullNumber = valueOf("--pr");

  return {
    execute: args.includes("--execute"),
    pullNumber: pullNumber === null ? null : Number(pullNumber),
    project: valueOf("--project"),
    repo: valueOf("--repo"),
    out: valueOf("--out") || "reports/latest.json",
    markdown: valueOf("--markdown"),
    fixture: fixture || "tests/fixtures/login-change.json"
  };
}

function parseRepo(text) {
  const [owner, name, ...extra] = text.split("/");

  if (!owner || !name || extra.length > 0) {
    throw new AppError('--repo must look like "owner/name"', 400, "INVALID_REPOSITORY");
  }

  return { owner, name };
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
  const project = options.project ? await loadProject(options.project) : null;

  if (options.execute && project && project.execution !== "local") {
    throw new AppError(
      `${project.name} tests need its full stack, so they run in GitHub Actions. Use the Run suite buttons or the workflow instead of --execute.`,
      400,
      "PROJECT_EXECUTION_NOT_LOCAL"
    );
  }

  const repository = options.repo ? parseRepo(options.repo) : project?.repository;
  const summary = options.pullNumber
    ? await createPullRequestService({
      owner: repository?.owner,
      repo: repository?.name
    }).getPullRequestWithFiles(options.pullNumber)
    : await readJson(options.fixture);
  const report = await runPipeline({
    summary,
    registry: project?.registry,
    features: project?.features,
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
  const where = repository ? `${repository.owner}/${repository.name}` : "";

  report.run = {
    command: args.length > 0 ? `npm run analyze -- ${args.join(" ")}` : "npm run analyze",
    source: options.pullNumber
      ? `GitHub pull request ${where}#${options.pullNumber}`
      : options.fixture
  };

  if (project) {
    report.project = { id: project.id, name: project.name };
  }

  const outputPath = fromRoot(options.out);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2));

  if (options.markdown) {
    const markdownPath = fromRoot(options.markdown);

    await mkdir(dirname(markdownPath), { recursive: true });
    await writeFile(markdownPath, renderMarkdown(report));
  }

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
