export function scoreRisk(analysis, impact) {
  if (analysis.signals.documentationOnly) {
    return {
      score: 0,
      level: "low",
      reasons: ["Only documentation files changed."],
      factors: []
    };
  }

  let score = 0;
  const reasons = [];
  const factors = [];

  function add(label, points, reason) {
    score += points;
    reasons.push(reason);
    factors.push({ label, points });
  }

  const criticalFeature = impact.features.some((feature) => feature.critical);

  if (criticalFeature) {
    add("Critical feature changed", 40, "A critical feature changed (+40).");
  } else if (impact.features.length > 0) {
    add("Product feature changed", 20, "A product feature changed (+20).");
  }

  if (impact.unmatchedSourceFiles.length > 0) {
    add("Source outside feature map", 25, "A source file is outside the feature map (+25).");
  }

  if (analysis.files.some((file) => file.category === "source" && file.status === "removed")) {
    add("Source file removed", 15, "A source file was removed (+15).");
  }

  const churnPoints = Math.min(20, Math.floor(analysis.totals.churn / 5));

  if (churnPoints > 0) {
    add("Change size", churnPoints, `Change size added ${churnPoints} points.`);
  }

  if (analysis.signals.configurationChanged) {
    add("Configuration changed", 10, "Configuration changed (+10).");
  }

  score = Math.min(100, score);

  return {
    score,
    level: score >= 60 ? "high" : score >= 25 ? "medium" : "low",
    reasons,
    factors
  };
}
