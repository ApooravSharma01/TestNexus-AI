export function selectTests({ registry, impact, mappedTests }) {
  const selectedIds = new Set(mappedTests.map((test) => test.id));

  if (impact.unmatchedSourceFiles.length > 0) {
    for (const test of registry) {
      if (test.critical) {
        selectedIds.add(test.id);
      }
    }

    return {
      tests: registry.filter((test) => selectedIds.has(test.id)),
      reason: "A source file is outside the feature map, so every critical test is included."
    };
  }

  if (selectedIds.size === 0) {
    return {
      tests: [],
      reason: "No mapped feature changed, so no regression tests were selected."
    };
  }

  return {
    tests: registry.filter((test) => selectedIds.has(test.id)),
    reason: "Tests were selected for the impacted features."
  };
}
