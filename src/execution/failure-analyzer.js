const INFRASTRUCTURE_PATTERN = /timeout|timed out|ECONNREFUSED|net::|browserType\.launch|Executable doesn't exist/i;

export function classifyFailure(errorMessage) {
  if (INFRASTRUCTURE_PATTERN.test(errorMessage || "")) {
    return {
      kind: "infrastructure",
      summary: "The failure happened before a product assertion. Check the browser, network, or timeout."
    };
  }

  return {
    kind: "product",
    summary: "The test reached an assertion and the product behavior did not match."
  };
}

export async function diagnoseFailures(execution, { complete } = {}) {
  const findings = (execution?.results || [])
    .filter((result) => result.status === "failed")
    .map((result) => {
      const classification = classifyFailure(result.error);

      return {
        title: result.title,
        error: result.error,
        kind: classification.kind,
        summary: classification.summary
      };
    });

  if (!complete || findings.length === 0) {
    return findings;
  }

  try {
    const note = await complete(JSON.stringify(findings.map((finding) => ({
      title: finding.title,
      kind: finding.kind,
      error: finding.error
    }))));

    return findings.map((finding) => ({
      ...finding,
      aiNote: note
    }));
  } catch {
    return findings;
  }
}
