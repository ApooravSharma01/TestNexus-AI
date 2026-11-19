import test from "node:test";
import assert from "node:assert/strict";
import { createGitHubClient } from "../../src/integrations/github/github-client.js";
import { AppError } from "../../src/utils/app-error.js";

test("should create an authenticated GitHub client", () => {
  const client = createGitHubClient("test-token");

  assert.ok(client.rest.pulls.get);
  assert.ok(client.rest.pulls.listFiles);
  assert.ok(client.rest.repos.get);
});

test("should reject missing GitHub authentication token", () => {
  assert.throws(
    () => createGitHubClient(""),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "GITHUB_TOKEN_MISSING");
      return true;
    }
  );
});
