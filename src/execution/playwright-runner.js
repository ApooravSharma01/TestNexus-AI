import { spawn } from "node:child_process";

import { AppError } from "../utils/app-error.js";
import { projectRoot } from "../utils/project-root.js";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectSpecs(suite, specs = []) {
  for (const spec of suite.specs || []) {
    specs.push(spec);
  }

  for (const child of suite.suites || []) {
    collectSpecs(child, specs);
  }

  return specs;
}

export function parsePlaywrightReport(report) {
  const specs = (report.suites || []).flatMap((suite) => collectSpecs(suite));
  const results = specs.map((spec) => {
    const attempt = spec.tests?.[0]?.results?.at(-1);
    const status = attempt?.status || (spec.ok ? "passed" : "failed");

    return {
      title: spec.title,
      status,
      durationMs: attempt?.duration || 0,
      error: attempt?.error?.message || ""
    };
  });

  return {
    passed: results.filter((result) => result.status === "passed").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    durationMs: results.reduce((total, result) => total + result.durationMs, 0),
    results
  };
}

function runPlaywrightCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", ...args], {
      cwd: projectRoot
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", () => {
      resolve({ stdout, stderr });
    });
  });
}

// One regex that matches exactly the given test titles, for Playwright's --grep.
export function buildGrepPattern(tests) {
  return tests.map((test) => `${escapeRegex(test.title)}$`).join("|");
}

export function createPlaywrightRunner({ runCommand = runPlaywrightCommand } = {}) {
  return async function runSelectedTests(tests) {
    if (tests.length === 0) {
      return {
        passed: 0,
        failed: 0,
        skipped: 0,
        durationMs: 0,
        results: []
      };
    }

    const pattern = buildGrepPattern(tests);
    const command = await runCommand([
      "test",
      "--reporter=json",
      "--grep",
      pattern
    ]);
    const jsonStart = command.stdout.indexOf("{");

    if (jsonStart === -1) {
      throw new AppError(
        `Playwright did not produce a report. ${command.stderr.trim().split("\n").at(-1) || ""}`.trim(),
        500,
        "PLAYWRIGHT_RUN_FAILED"
      );
    }

    return parsePlaywrightReport(JSON.parse(command.stdout.slice(jsonStart)));
  };
}
