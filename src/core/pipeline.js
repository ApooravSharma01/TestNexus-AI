import { analyzePullRequest } from "../analyzers/change-analyzer.js";
import { diagnoseFailures } from "../execution/failure-analyzer.js";
import { analyzeImpact } from "../impact/impact-analyzer.js";
import { createIntelligenceEngine } from "../intelligence/intelligence-engine.js";
import { buildReport } from "../reporting/report-builder.js";
import { mapTests } from "../test-intelligence/mapper.js";
import { scoreRisk } from "../test-intelligence/risk-engine.js";
import { validateSelection } from "../test-intelligence/selection-validator.js";
import { selectTests } from "../test-intelligence/selector.js";
import { readJson } from "../utils/read-json.js";

export async function runPipeline({
  summary,
  registry,
  features,
  intelligence,
  execute,
  explainFailure
} = {}) {
  const testRegistry = registry || await readJson("registry/tests.json");
  const featureMap = features || await readJson("registry/feature-map.json");
  const engine = intelligence || createIntelligenceEngine();
  const analysis = analyzePullRequest(summary);
  const impact = analyzeImpact(analysis, featureMap);
  const mappedTests = mapTests(analysis, impact, testRegistry);
  const risk = scoreRisk(analysis, impact);
  const selection = selectTests({
    registry: testRegistry,
    impact,
    mappedTests
  });
  const reviewed = await engine.review({
    analysis,
    impact,
    risk,
    tests: selection.tests,
    registry: testRegistry
  });
  const validation = validateSelection(reviewed.testIds, testRegistry);
  const selectedTests = testRegistry.filter((test) => validation.accepted.includes(test.id));
  const execution = execute ? await execute(selectedTests) : null;
  const diagnosis = execution
    ? await diagnoseFailures(execution, { complete: explainFailure })
    : [];

  return buildReport({
    analysis,
    impact,
    risk,
    selection,
    intelligence: reviewed,
    selectedTests,
    rejectedTestIds: validation.rejected,
    registry: testRegistry,
    execution,
    diagnosis
  });
}
