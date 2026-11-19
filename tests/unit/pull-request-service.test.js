import test from "node:test";
import assert from "node:assert/strict";

import { createPullRequestService } from "../../src/integrations/github/pull-request-service.js";
import { AppError } from "../../src/utils/app-error.js";

function createMockClient() {
  return {
    rest: {
      repos: {
        get: async () => ({
          data: { name: "testnexus-ai" }
        })
      },
      pulls: {
        get: async () => ({
          data: {
            number: 12,
            title: "Add login validation",
            state: "open"
          }
        }),
        listFiles: async () => ({ data: [] })
      }
    },
    paginate: async () => [
      {
        filename: "src/auth/login.js",
        status: "modified",
        additions: 10,
        deletions: 2
      }
    ]
  };
}

test("should retrieve repository information", async () => {
  const service = createPullRequestService({
    client: createMockClient(),
    owner: "test-owner",
    repo: "testnexus-ai"
  });

  const result = await service.getRepository();

  assert.equal(result.name, "testnexus-ai");
});

test("should retrieve pull request metadata", async () => {
  const service = createPullRequestService({
    client: createMockClient(),
    owner: "test-owner",
    repo: "testnexus-ai"
  });

  const result = await service.getPullRequest(12);

  assert.equal(result.number, 12);
  assert.equal(result.title, "Add login validation");
  assert.equal(result.state, "open");
});

test("should retrieve changed files", async () => {
  const service = createPullRequestService({
    client: createMockClient(),
    owner: "test-owner",
    repo: "testnexus-ai"
  });

  const files = await service.getChangedFiles(12);

  assert.equal(files.length, 1);
  assert.equal(files[0].filename, "src/auth/login.js");
  assert.equal(files[0].additions, 10);
});

test("should reject invalid pull request numbers", async () => {
  const service = createPullRequestService({
    client: createMockClient(),
    owner: "test-owner",
    repo: "testnexus-ai"
  });

  await assert.rejects(
    service.getPullRequest(0),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "INVALID_PULL_NUMBER");
      return true;
    }
  );
});

test("should combine pull request metadata and changed files", async () => {
  const service = createPullRequestService({
    client: createMockClient(),
    owner: "test-owner",
    repo: "testnexus-ai"
  });

  const result = await service.getPullRequestWithFiles(12);

  assert.equal(result.number, 12);
  assert.equal(result.title, "Add login validation");
  assert.equal(result.changedFiles.length, 1);
  assert.equal(result.changedFiles[0].path, "src/auth/login.js");
});

function createFailingClient(status) {
  const failure = Object.assign(new Error("GitHub request failed"), { status });

  return {
    rest: {
      repos: {
        get: async () => {
          throw failure;
        }
      },
      pulls: {
        get: async () => {
          throw failure;
        },
        listFiles: async () => {
          throw failure;
        }
      }
    },
    paginate: async () => {
      throw failure;
    }
  };
}

test("should reject a missing repository configuration", () => {
  assert.throws(
    () => createPullRequestService({
      client: createMockClient(),
      owner: "",
      repo: ""
    }),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "GITHUB_REPOSITORY_NOT_CONFIGURED");
      return true;
    }
  );
});

test("should translate a missing GitHub resource into a not-found error", async () => {
  const service = createPullRequestService({
    client: createFailingClient(404),
    owner: "test-owner",
    repo: "testnexus-ai"
  });

  await assert.rejects(
    service.getPullRequest(12),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "GITHUB_RESOURCE_NOT_FOUND");
      assert.equal(error.statusCode, 404);
      return true;
    }
  );
});

test("should translate a rejected GitHub login into an authentication error", async () => {
  const service = createPullRequestService({
    client: createFailingClient(401),
    owner: "test-owner",
    repo: "testnexus-ai"
  });

  await assert.rejects(
    service.getRepository(),
    (error) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, "GITHUB_AUTHENTICATION_FAILED");
      assert.equal(error.statusCode, 401);
      return true;
    }
  );
});
