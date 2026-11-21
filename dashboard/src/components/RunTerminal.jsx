import { useState } from "react";

import { duration } from "../format.js";

const SOURCES = [
  { id: "local", label: "Local" },
  { id: "actions", label: "GitHub Actions" },
  { id: "jenkins", label: "Jenkins" }
];

function line(text, tone = "") {
  return { text, tone };
}

function localLines(report) {
  const { pullRequest, risk, impact, comparison, execution, selectedTests, skippedTests } = report;
  const command = report.run?.command || "npm run analyze";
  const lines = [
    line(`$ ${command}`, "command"),
    line(""),
    line(`pull request #${pullRequest.number}  ${pullRequest.title}`),
    line(`risk          ${risk.level}  ${risk.score}/100`)
  ];

  for (const factor of risk.factors || []) {
    lines.push(line(`  +${factor.points}  ${factor.label}`, "muted"));
  }

  if (!risk.factors?.length) {
    for (const reason of risk.reasons) {
      lines.push(line(`  ${reason}`, "muted"));
    }
  }

  lines.push(line(""));
  const features = impact.features.map((feature) => feature.name).join(", ") || "none";
  lines.push(line(`impact        ${features}`));

  for (const file of impact.features.flatMap((feature) => feature.files)) {
    lines.push(line(`  ${file}`, "muted"));
  }

  lines.push(line(""));
  lines.push(line(`selected      ${selectedTests.length}`));

  for (const test of selectedTests) {
    const result = execution?.results?.find((item) => item.title === test.title);
    const status = result ? result.status : "selected";
    lines.push(line(`  ${status.padEnd(8)} ${test.id}  ${test.title}`, status === "failed" ? "bad" : "good"));
  }

  lines.push(line(""));
  lines.push(line(`skipped       ${skippedTests.length}`, "muted"));

  for (const test of skippedTests) {
    lines.push(line(`  ${test.id}  ${test.title}`, "muted"));
  }

  lines.push(line(""));

  if (execution) {
    const tone = execution.failed > 0 ? "bad" : "good";
    lines.push(line(
      `playwright    ${execution.passed} passed, ${execution.failed} failed, ${duration(execution.durationMs)}`,
      tone
    ));
  } else {
    lines.push(line("playwright    not run", "muted"));
  }

  lines.push(line(
    `saved         ${comparison.testsSaved} of ${comparison.fullRegressionCount} tests`
  ));
  lines.push(line(""));
  lines.push(line("$", "prompt"));

  const note = report.run
    ? `Produced from ${report.run.source}.`
    : "This report does not record the command that produced it.";

  return { command, lines, note };
}

function actionsLines() {
  const command = "npm run analyze -- --project openoms --repo ApooravSharma01/openoms --pr <number>";
  const lines = [
    line("# ApooravSharma01/openoms/.github/workflows/order-creation-e2e.yml", "muted"),
    line("- name: Analyze the pull request", "command"),
    line("  run: |"),
    line("    npm run analyze -- --project openoms \\"),
    line("      --repo ${{ github.repository }} --pr $PR_NUMBER"),
    line(""),
    line("- name: Run only the selected tests", "command"),
    line("  run: npx playwright test --grep \"$SELECTED\""),
    line(""),
    line("# The same workflow also starts from the Run suite buttons.", "muted"),
    line("$", "prompt")
  ];

  return {
    command,
    lines,
    note: "Connected on ApooravSharma01/openoms. TestNexus picks the tests for each pull request, then Playwright runs only those."
  };
}

function jenkinsLines(report) {
  const command = "npm run analyze -- --pr ${CHANGE_ID} --execute";
  const lines = [
    line("// Jenkinsfile", "muted"),
    line("stage('Intelligent regression') {", "command"),
    line("  when { changeRequest() }"),
    line("  steps {"),
    line(`    sh '${command}'`),
    line("  }"),
    line("}"),
    line(""),
    line(`// CHANGE_ID is the pull request number, here #${report.pullRequest.number}`, "muted"),
    line("$", "prompt")
  ];

  return {
    command,
    lines,
    note: "Jenkins is not connected. This is the stage to add to the pipeline."
  };
}

const BUILDERS = {
  local: localLines,
  actions: actionsLines,
  jenkins: jenkinsLines
};

export function RunTerminal({ report }) {
  const [source, setSource] = useState("local");
  const [copied, setCopied] = useState(false);
  const view = BUILDERS[source](report);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(view.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="terminal">
      <header className="terminal-bar">
        <span className="terminal-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <div className="tabs" role="tablist" aria-label="Where this command runs">
          {SOURCES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={source === item.id}
              className={`tab ${source === item.id ? "is-active" : ""}`}
              onClick={() => setSource(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" className="terminal-copy" onClick={copyCommand}>
          {copied ? "Copied" : "Copy"}
        </button>
      </header>
      <pre className="terminal-body">
        {view.lines.map((entry, index) => (
          <span key={`${source}-${index}`} className={entry.tone ? `term-${entry.tone}` : undefined}>
            {entry.text}
            {"\n"}
          </span>
        ))}
      </pre>
      <p className="terminal-note">{view.note}</p>
    </section>
  );
}
