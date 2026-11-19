import { Octokit } from "@octokit/rest";
import { env } from "../../config/environment.js";
import { AppError } from "../../utils/app-error.js";

export function createGitHubClient(token = env.githubToken) {
  if (!token) {
    throw new AppError(
      "GitHub authentication token is missing",
      500,
      "GITHUB_TOKEN_MISSING"
    );
  }

  return new Octokit({
    auth: token
  });
}
