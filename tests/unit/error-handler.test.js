import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../../src/utils/app-error.js";
import { handleError } from "../../src/utils/error-handler.js";

test("should handle operational application errors", () => {
  const error = new AppError(
    "GitHub API unavailable",
    503,
    "GITHUB_UNAVAILABLE"
  );

  const result = handleError(error);

  assert.equal(result.success, false);
  assert.equal(result.error.code, "GITHUB_UNAVAILABLE");
  assert.equal(result.error.message, "GitHub API unavailable");
});

test("should hide unexpected internal error details", () => {
  const error = new Error("Database password exposed");

  const result = handleError(error);

  assert.equal(result.success, false);
  assert.equal(result.error.code, "INTERNAL_ERROR");
  assert.equal(
    result.error.message,
    "An unexpected error occurred."
  );
});
