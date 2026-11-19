export function validateSelection(testIds, registry) {
  const known = new Set(registry.map((test) => test.id));
  const accepted = [];
  const rejected = [];

  for (const testId of testIds) {
    if (known.has(testId) && !accepted.includes(testId)) {
      accepted.push(testId);
    } else if (!known.has(testId)) {
      rejected.push(testId);
    }
  }

  return { accepted, rejected };
}
