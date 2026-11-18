import test from "node:test";
import assert from "node:assert/strict";
import { env } from "../../src/config/environment.js";

test("environment configuration should contain valid defaults", () => {
  assert.equal(env.environment, "development");
  assert.equal(env.port, 3000);
  assert.equal(env.logLevel, "info");
});

test("environment configuration should be immutable", () => {
  assert.equal(Object.isFrozen(env), true);
});
