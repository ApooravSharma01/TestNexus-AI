import { AppError } from "../utils/app-error.js";
import { readJson } from "../utils/read-json.js";

// The id becomes part of a file path, so only plain names are accepted.
const projectIdPattern = /^[a-z0-9-]+$/;

export async function loadProject(id) {
  if (!projectIdPattern.test(id || "")) {
    throw new AppError(`Invalid project id "${id}"`, 400, "INVALID_PROJECT_ID");
  }

  const base = `registry/projects/${id}`;
  let project;

  try {
    project = await readJson(`${base}/project.json`);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new AppError(`Unknown project "${id}"`, 404, "PROJECT_NOT_FOUND");
    }

    throw error;
  }

  if (!project.repository?.owner || !project.repository?.name) {
    throw new AppError(`Project ${id} needs repository.owner and repository.name`, 500, "PROJECT_INVALID");
  }

  return {
    ...project,
    features: await readJson(`${base}/feature-map.json`),
    registry: await readJson(`${base}/tests.json`)
  };
}
