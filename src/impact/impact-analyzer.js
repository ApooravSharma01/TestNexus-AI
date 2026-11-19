function pathsOf(file) {
  return [file.path, file.previousPath].filter(Boolean);
}

function featureMatches(feature, file) {
  return pathsOf(file).some((filePath) => {
    return feature.paths.some((prefix) => filePath === prefix || filePath.startsWith(prefix));
  });
}

export function analyzeImpact(analysis, features) {
  const impacted = [];
  const unmatchedSourceFiles = [];

  for (const file of analysis.files) {
    const matches = features.filter((feature) => featureMatches(feature, file));

    if (matches.length === 0 && file.category === "source") {
      unmatchedSourceFiles.push(file.path);
    }

    for (const feature of matches) {
      let entry = impacted.find((item) => item.id === feature.id);

      if (!entry) {
        entry = {
          id: feature.id,
          name: feature.name,
          critical: feature.critical,
          files: []
        };
        impacted.push(entry);
      }

      if (!entry.files.includes(file.path)) {
        entry.files.push(file.path);
      }
    }
  }

  return {
    features: impacted,
    unmatchedSourceFiles,
    documentationOnly: analysis.signals.documentationOnly
  };
}
