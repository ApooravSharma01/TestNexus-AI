export function explainSelection({ impact, risk, tests }) {
  const featureNames = impact.features.map((feature) => feature.name);
  const sentences = [`Risk is ${risk.level} (${risk.score}/100).`];

  if (risk.reasons.length > 0) {
    sentences.push(risk.reasons.join(" "));
  }

  if (featureNames.length > 0) {
    sentences.push(`Impacted features: ${featureNames.join(", ")}.`);
  } else {
    sentences.push("No mapped feature was impacted.");
  }

  if (tests.length > 0) {
    sentences.push(`Selected ${tests.length} tests: ${tests.map((test) => test.id).join(", ")}.`);
  } else {
    sentences.push("No regression tests were selected.");
  }

  return sentences.join(" ");
}
