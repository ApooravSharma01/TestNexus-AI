import { env } from "../../config/environment.js";
import { AppError } from "../../utils/app-error.js";
import { logger } from "../../utils/logger.js";
import { createGitHubClient } from "./github-client.js";
import { mapPullRequest } from "./pull-request-mapper.js";

export function createPullRequestService({
  client,
  owner = env.githubOwner,
  repo = env.githubRepo
} = {}) {
  const github = client || createGitHubClient();

  if (!owner || !repo) {
    throw new AppError(
      "GitHub repository owner or name is missing",
      500,
      "GITHUB_REPOSITORY_NOT_CONFIGURED"
    );
  }

  function validatePullNumber(pullNumber) {
    if (!Number.isInteger(pullNumber) || pullNumber <= 0) {
      throw new AppError(
        "Pull request number must be a positive integer",
        400,
        "INVALID_PULL_NUMBER"
      );
    }
  }

  async function executeGitHubRequest(operation) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const statusCode = error.status || 500;

      const code =
        statusCode === 404
          ? "GITHUB_RESOURCE_NOT_FOUND"
          : statusCode === 401 || statusCode === 403
            ? "GITHUB_AUTHENTICATION_FAILED"
            : "GITHUB_API_ERROR";

      logger.error("GitHub API request failed", {
        statusCode,
        code,
        reason: error.message
      });

      throw new AppError(
        statusCode === 404
          ? "Requested GitHub resource was not found"
          : statusCode === 401 || statusCode === 403
            ? "GitHub authentication or permission failed"
            : "GitHub API request failed",
        statusCode,
        code
      );
    }
  }

  async function getRepository() {
    return executeGitHubRequest(async () => {
      const response = await github.rest.repos.get({
        owner,
        repo
      });

      return response.data;
    });
  }

  async function getPullRequest(pullNumber) {
    validatePullNumber(pullNumber);

    return executeGitHubRequest(async () => {
      const response = await github.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
      });

      return response.data;
    });
  }

  async function getChangedFiles(pullNumber) {
    validatePullNumber(pullNumber);

    return executeGitHubRequest(async () => {
      return github.paginate(github.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100
      });
    });
  }

  async function getPullRequestWithFiles(pullNumber) {
    const [pullRequest, changedFiles] = await Promise.all([
      getPullRequest(pullNumber),
      getChangedFiles(pullNumber)
    ]);

    return mapPullRequest({ pullRequest, changedFiles });
  }

  return Object.freeze({
    getRepository,
    getPullRequest,
    getChangedFiles,
    getPullRequestWithFiles
  });
}
