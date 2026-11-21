import { AppError } from "../utils/app-error.js";
import { readJson } from "../utils/read-json.js";

const requiredFields = ["id", "label", "workflow", "ref"];

export function validateSuites(suites) {
  if (!Array.isArray(suites) || suites.length === 0) {
    throw new AppError("registry/suites.json must contain at least one suite", 500, "SUITE_REGISTRY_INVALID");
  }

  const seen = new Set();

  for (const suite of suites) {
    for (const field of requiredFields) {
      if (!suite[field]) {
        throw new AppError(`Suite is missing "${field}"`, 500, "SUITE_REGISTRY_INVALID");
      }
    }

    if (!suite.repository?.owner || !suite.repository?.name) {
      throw new AppError(`Suite ${suite.id} needs repository.owner and repository.name`, 500, "SUITE_REGISTRY_INVALID");
    }

    if (seen.has(suite.id)) {
      throw new AppError(`Duplicate suite id ${suite.id}`, 500, "SUITE_REGISTRY_INVALID");
    }

    seen.add(suite.id);
  }

  return suites;
}

export async function loadSuites() {
  return validateSuites(await readJson("registry/suites.json"));
}

// What the dashboard may see. Nothing here can start a run on its own.
export function describeSuite(suite) {
  return {
    id: suite.id,
    label: suite.label,
    description: suite.description || "",
    repository: `${suite.repository.owner}/${suite.repository.name}`,
    workflow: suite.workflow,
    ref: suite.ref,
    filter: suite.inputs?.grep || ""
  };
}
