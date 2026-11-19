import { explainSelection } from "./explanation.js";

export function buildSelectionPrompt({ analysis, impact, risk, tests, registry }) {
  return JSON.stringify({
    changedFiles: analysis.files.map((file) => ({
      path: file.path,
      status: file.status,
      category: file.category
    })),
    impactedFeatures: impact.features.map((feature) => feature.name),
    risk,
    deterministicTestIds: tests.map((test) => test.id),
    registry: registry.map((test) => ({
      id: test.id,
      title: test.title,
      featureId: test.featureId,
      critical: test.critical
    }))
  });
}

function parseAiContent(content) {
  const jsonText = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  const parsed = JSON.parse(jsonText);

  return {
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "",
    additionalTestIds: Array.isArray(parsed.additionalTestIds) ? parsed.additionalTestIds : []
  };
}

export function createIntelligenceEngine({ complete } = {}) {
  return {
    async review({ analysis, impact, risk, tests, registry }) {
      const deterministicIds = tests.map((test) => test.id);
      const fallback = explainSelection({ impact, risk, tests });

      if (!complete || tests.length === 0) {
        return {
          mode: "deterministic",
          explanation: fallback,
          testIds: deterministicIds
        };
      }

      try {
        const content = await complete(buildSelectionPrompt({
          analysis,
          impact,
          risk,
          tests,
          registry
        }));
        const parsed = parseAiContent(content);
        const known = new Set(registry.map((test) => test.id));
        const testIds = [...deterministicIds];

        for (const testId of parsed.additionalTestIds) {
          if (known.has(testId) && !testIds.includes(testId)) {
            testIds.push(testId);
          }
        }

        return {
          mode: "ai",
          explanation: parsed.explanation || fallback,
          testIds
        };
      } catch {
        return {
          mode: "deterministic",
          explanation: `${fallback} The AI response could not be used, so the deterministic selection was kept.`,
          testIds: deterministicIds
        };
      }
    }
  };
}
