function sameFile(changedPath, testFile) {
  return changedPath === testFile;
}

export function mapTests(analysis, impact, registry) {
  const featureIds = new Set(impact.features.map((feature) => feature.id));
  const selectedIds = new Set();

  for (const test of registry) {
    if (featureIds.has(test.featureId)) {
      selectedIds.add(test.id);
    }
  }

  for (const file of analysis.files) {
    for (const test of registry) {
      if (sameFile(file.path, test.file) || sameFile(file.previousPath, test.file)) {
        selectedIds.add(test.id);
      }
    }
  }

  return registry.filter((test) => selectedIds.has(test.id));
}
