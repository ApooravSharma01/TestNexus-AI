export function measureSelection(selectedIds, relevantIds, criticalIds) {
  const selected = new Set(selectedIds);
  const relevant = new Set(relevantIds);
  const critical = new Set(criticalIds);
  const truePositives = [...selected].filter((id) => relevant.has(id)).length;
  const precision = selected.size === 0 ? (relevant.size === 0 ? 1 : 0) : truePositives / selected.size;
  const recall = relevant.size === 0 ? 1 : truePositives / relevant.size;
  const matchedCritical = [...critical].filter((id) => selected.has(id)).length;
  const criticalRecall = critical.size === 0 ? 1 : matchedCritical / critical.size;

  return {
    precision,
    recall,
    criticalRecall,
    falseNegatives: [...relevant].filter((id) => !selected.has(id))
  };
}

export function summarizeEvaluation(cases) {
  const totals = cases.reduce((summary, item) => {
    summary.precision += item.metrics.precision;
    summary.recall += item.metrics.recall;
    summary.criticalRecall += item.metrics.criticalRecall;
    return summary;
  }, { precision: 0, recall: 0, criticalRecall: 0 });
  const count = cases.length || 1;

  return {
    cases,
    averagePrecision: totals.precision / count,
    averageRecall: totals.recall / count,
    averageCriticalRecall: totals.criticalRecall / count
  };
}
