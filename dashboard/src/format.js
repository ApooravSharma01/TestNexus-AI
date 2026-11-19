export function percent(part, whole) {
  if (!whole) {
    return "0%";
  }

  return `${Math.round((part / whole) * 100)}%`;
}

export function duration(ms) {
  if (!ms) {
    return "0 ms";
  }

  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function riskTone(level) {
  return { low: "good", medium: "warn", high: "bad" }[level] || "neutral";
}

export function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

export function ratioPercent(value) {
  return `${Math.round(value * 100)}%`;
}

export function estimateTimeSaved(report) {
  const durations = (report.execution?.results || [])
    .map((result) => result.durationMs)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (durations.length === 0 || !report.comparison?.testsSaved) {
    return null;
  }

  const average = durations.reduce((total, value) => total + value, 0) / durations.length;
  return Math.round(average * report.comparison.testsSaved);
}
