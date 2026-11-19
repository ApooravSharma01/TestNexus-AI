import test from "node:test";
import assert from "node:assert/strict";

import { inspectPullRequest } from "../../src/commands/inspect-pull-request.js";

test("should return the mapped pull request summary", async () => {
  const summary = await inspectPullRequest(12, {
    service: {
      getPullRequestWithFiles: async (pullNumber) => ({
        number: pullNumber,
        title: "Add login validation",
        state: "open",
        changedFiles: [
          {
            path: "src/auth/login.js",
            previousPath: null,
            status: "modified",
            additions: 10,
            deletions: 2
          }
        ]
      })
    }
  });

  assert.equal(summary.number, 12);
  assert.equal(summary.changedFiles[0].path, "src/auth/login.js");
});
