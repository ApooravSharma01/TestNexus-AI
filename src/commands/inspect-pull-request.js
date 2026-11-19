import { pathToFileURL } from "node:url";

import { createPullRequestService } from "../integrations/github/pull-request-service.js";
import { handleError } from "../utils/error-handler.js";
import { logger } from "../utils/logger.js";

export async function inspectPullRequest(pullNumber, dependencies = {}) {
  const service = dependencies.service || createPullRequestService();
  return service.getPullRequestWithFiles(pullNumber);
}

function isExecutedDirectly() {
  const entry = process.argv[1];

  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(entry).href;
}

if (isExecutedDirectly()) {
  const pullNumber = Number(process.argv[2]);

  try {
    const summary = await inspectPullRequest(pullNumber);
    logger.info("Pull request change summary", summary);
  } catch (error) {
    console.error(JSON.stringify(handleError(error)));
    process.exitCode = 1;
  }
}
