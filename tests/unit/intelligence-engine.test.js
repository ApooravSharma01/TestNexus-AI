import test from "node:test";
import assert from "node:assert/strict";

import { completeWithAi } from "../../src/intelligence/ai-client.js";
import { createIntelligenceEngine } from "../../src/intelligence/intelligence-engine.js";

const registry = [
  { id: "AUTH-LOGIN-001", title: "login", featureId: "authentication", critical: true },
  { id: "CHECKOUT-001", title: "checkout", featureId: "checkout", critical: true }
];

const reviewInput = {
  analysis: { files: [{ path: "src/auth/login.js", status: "modified", category: "source" }] },
  impact: { features: [{ name: "Authentication" }] },
  risk: { score: 42, level: "medium", reasons: ["A critical feature changed (+40)."] },
  tests: [registry[0]],
  registry
};

test("should keep the deterministic tests when AI is not configured", async () => {
  const engine = createIntelligenceEngine();
  const result = await engine.review(reviewInput);

  assert.equal(result.mode, "deterministic");
  assert.deepEqual(result.testIds, ["AUTH-LOGIN-001"]);
});

test("should add a known test from the AI response and ignore an unknown id", async () => {
  const engine = createIntelligenceEngine({
    complete: async () => JSON.stringify({
      explanation: "Checkout shares the login session.",
      additionalTestIds: ["CHECKOUT-001", "MADE-UP"]
    })
  });
  const result = await engine.review(reviewInput);

  assert.equal(result.mode, "ai");
  assert.deepEqual(result.testIds, ["AUTH-LOGIN-001", "CHECKOUT-001"]);
  assert.equal(result.explanation, "Checkout shares the login session.");
});

test("should keep the deterministic selection when the AI response is invalid", async () => {
  const engine = createIntelligenceEngine({
    complete: async () => "not json"
  });
  const result = await engine.review(reviewInput);

  assert.equal(result.mode, "deterministic");
  assert.deepEqual(result.testIds, ["AUTH-LOGIN-001"]);
});

test("should read the message content from an AI response", async () => {
  const content = await completeWithAi("select tests", {
    apiKey: "test-key",
    model: "test-model",
    baseUrl: "https://example.test/v1",
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.model, "test-model");
      assert.equal(options.headers.Authorization, "Bearer test-key");

      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "{\"additionalTestIds\":[]}" } }]
        })
      };
    }
  });

  assert.equal(content, "{\"additionalTestIds\":[]}");
});
