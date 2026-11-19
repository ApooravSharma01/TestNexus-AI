export function buildReport({
  analysis,
  impact,
  risk,
  selection,
  intelligence,
  selectedTests,
  rejectedTestIds,
  registry,
  execution,
  diagnosis
}) {
  const fullRegressionCount = registry.length;
  const deterministicIds = new Set((selection.tests || []).map((test) => test.id));
  const deterministicCount = deterministicIds.size;
  const intelligentCount = selectedTests.length;
  const addedTestIds = selectedTests
    .filter((test) => !deterministicIds.has(test.id))
    .map((test) => test.id);
  const impactedFeatureIds = new Set((impact.features || []).map((feature) => feature.id));
  const skippedTests = registry
    .filter((test) => !selectedTests.some((selected) => selected.id === test.id))
    .map((test) => ({
      id: test.id,
      title: test.title,
      featureId: test.featureId,
      critical: test.critical
    }));

  return {
    generatedAt: new Date().toISOString(),
    pullRequest: {
      number: analysis.number,
      title: analysis.title,
      state: analysis.state
    },
    totals: analysis.totals || null,
    changedFiles: (analysis.files || []).map((file) => ({
      path: file.path,
      previousPath: file.previousPath,
      status: file.status,
      category: file.category,
      additions: file.additions,
      deletions: file.deletions,
      hunks: (file.hunks || []).map((hunk) => ({
        heading: hunk.heading,
        addedLines: hunk.addedLines.slice(0, 40),
        removedLines: hunk.removedLines.slice(0, 40)
      }))
    })),
    risk,
    impact,
    selectionReason: selection.reason,
    intelligence: {
      mode: intelligence.mode,
      explanation: intelligence.explanation,
      addedTestIds
    },
    missedCriticalTests: skippedTests.filter((test) => {
      return test.critical && impactedFeatureIds.has(test.featureId);
    }),
    comparison: {
      fullRegressionCount,
      deterministicCount,
      intelligentCount,
      testsSaved: fullRegressionCount - intelligentCount
    },
    rejectedTestIds,
    selectedTests: selectedTests.map((test) => ({
      id: test.id,
      title: test.title,
      featureId: test.featureId,
      critical: test.critical,
      file: test.file
    })),
    skippedTests,
    execution,
    diagnosis
  };
}

export function renderMarkdown(report) {
  const selected = report.selectedTests.map((test) => `- ${test.id}: ${test.title}`).join("\n") || "- None";
  const skipped = report.skippedTests.map((test) => `- ${test.id}: ${test.title}`).join("\n") || "- None";
  const failures = (report.diagnosis || []).map((finding) => {
    return `- ${finding.title}: ${finding.kind}. ${finding.summary}`;
  }).join("\n") || "- None";

  return [
    `# Pull request ${report.pullRequest.number}: ${report.pullRequest.title}`,
    "",
    `Risk: ${report.risk.level} (${report.risk.score}/100)`,
    `Mode: ${report.intelligence.mode}`,
    "",
    report.intelligence.explanation,
    "",
    `Full suite: ${report.comparison.fullRegressionCount}`,
    `Deterministic selection: ${report.comparison.deterministicCount}`,
    `Final selection: ${report.comparison.intelligentCount}`,
    `Tests not run: ${report.comparison.testsSaved}`,
    "",
    "## Selected",
    selected,
    "",
    "## Skipped",
    skipped,
    "",
    "## Failures",
    failures
  ].join("\n");
}
