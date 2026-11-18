import test from "node:test";
import assert from "node:assert/strict";
import { logger } from "../../src/utils/logger.js";

test("logger should produce a structured info log", (context) => {
  let output = "";

  context.mock.method(console, "log", (message) => {
    output = message;
  });

  logger.info("Test message", { component: "unit-test" });

  const entry = JSON.parse(output);

  assert.equal(entry.level, "INFO");
  assert.equal(entry.message, "Test message");
  assert.equal(entry.component, "unit-test");
  assert.ok(entry.timestamp);
});
