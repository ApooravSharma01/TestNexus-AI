import { useCallback, useEffect, useState } from "react";

import { ChangedFiles } from "./components/ChangedFiles.jsx";
import { CriticalBanner } from "./components/CriticalBanner.jsx";
import { Explanation } from "./components/Explanation.jsx";
import { Failures } from "./components/Failures.jsx";
import { Header } from "./components/Header.jsx";
import { ImpactedFeatures } from "./components/ImpactedFeatures.jsx";
import { PullRequests } from "./components/PullRequests.jsx";
import { QualityPanel } from "./components/QualityPanel.jsx";
import { RiskBreakdown } from "./components/RiskBreakdown.jsx";
import { RiskGauge } from "./components/RiskGauge.jsx";
import { RunSwitcher } from "./components/RunSwitcher.jsx";
import { RunTerminal } from "./components/RunTerminal.jsx";
import { SelectionFunnel } from "./components/SelectionFunnel.jsx";
import { StatCard } from "./components/StatCard.jsx";
import { SuiteRunner } from "./components/SuiteRunner.jsx";
import { Tabs } from "./components/Tabs.jsx";
import { TestResults } from "./components/TestResults.jsx";
import { capitalize, duration, estimateTimeSaved, percent, riskTone } from "./format.js";
import { useAutomation } from "./useAutomation.js";

const TABS = ["suites", "pull-requests", "analysis"];

function currentTab() {
  const hash = window.location.hash.slice(1);
  return TABS.includes(hash) ? hash : "suites";
}

// The active tab lives in the URL hash, so reloads and shared links keep the section.
function useHashTab() {
  const [tab, setTab] = useState(currentTab);

  useEffect(() => {
    function onChange() {
      setTab(currentTab());
    }

    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const select = useCallback((next) => {
    window.location.hash = next;
  }, []);

  return [tab, select];
}

function isReport(value) {
  return Boolean(value?.pullRequest && value?.risk && value?.comparison && value?.selectedTests);
}

function runsFromHistory(history) {
  const runs = [];

  if (isReport(history.latest)) {
    runs.push({
      id: "latest",
      name: "Latest run",
      report: history.latest,
      metrics: null
    });
  }

  for (const run of history.runs || []) {
    if (isReport(run.report)) {
      runs.push({
        id: run.name,
        name: run.name,
        report: run.report,
        metrics: run.metrics
      });
    }
  }

  return runs;
}

function Analysis({ active, evaluation, error }) {
  const report = active.report;
  const { pullRequest, risk, comparison, execution, totals } = report;
  const executed = execution && execution.passed + execution.failed > 0;
  const savedMs = estimateTimeSaved(report);
  const impactedIds = new Set((report.impact?.features || []).map((feature) => feature.id));
  const untouchedCritical = (report.skippedTests || []).filter((test) => {
    return test.critical && !impactedIds.has(test.featureId);
  });

  return (
    <>
      {error && <p className="notice tone-bad">{error}</p>}
      <RunSwitcher runs={active.runs} activeId={active.id} onSelect={active.onSelect} />
      <CriticalBanner tests={report.missedCriticalTests || []} />

      <section className="hero">
        <div className="hero-meta">
          <span className="pr-number">Pull request #{pullRequest.number}</span>
          <span className={`pill tone-${pullRequest.state === "open" ? "good" : "neutral"}`}>
            {capitalize(pullRequest.state)}
          </span>
        </div>
        <h1>{pullRequest.title}</h1>
        {totals && (
          <p className="hero-stats">
            {totals.files} {totals.files === 1 ? "file" : "files"} changed
            <span className="dot" aria-hidden="true" />
            <span className="text-good mono">+{totals.additions}</span>
            <span className="text-bad mono">-{totals.deletions}</span>
          </p>
        )}
      </section>

      <section className="kpis">
        <article className="stat-card stat-risk">
          <RiskGauge score={risk.score} level={risk.level} />
          <div>
            <p className="stat-label">Regression risk</p>
            <p className={`stat-value text-${riskTone(risk.level)}`}>{capitalize(risk.level)}</p>
            <p className="stat-detail">
              {risk.factors?.length || risk.reasons.length} {(risk.factors?.length || risk.reasons.length) === 1 ? "factor" : "factors"}
            </p>
          </div>
        </article>
        <StatCard
          label="Tests selected"
          value={`${comparison.intelligentCount} / ${comparison.fullRegressionCount}`}
          detail={`${percent(comparison.intelligentCount, comparison.fullRegressionCount)} of the suite`}
          tone="accent"
        />
        <StatCard
          label="Execution saved"
          value={percent(comparison.testsSaved, comparison.fullRegressionCount)}
          detail={savedMs
            ? `${comparison.testsSaved} tests not run, about ${duration(savedMs)}`
            : `${comparison.testsSaved} tests not run`}
          tone="good"
        />
        {executed ? (
          <StatCard
            label="Pass rate"
            value={percent(execution.passed, execution.passed + execution.failed)}
            detail={`${execution.passed} passed, ${execution.failed} failed in ${duration(execution.durationMs)}`}
            tone={execution.failed > 0 ? "bad" : "good"}
          />
        ) : (
          <StatCard
            label="Impacted features"
            value={report.impact.features.length}
            detail={`${report.impact.features.filter((feature) => feature.critical).length} critical`}
          />
        )}
      </section>

      <QualityPanel evaluation={evaluation} runName={active.name} runMetrics={active.metrics} />
      <RunTerminal report={report} />

      <div className="grid-2">
        <SelectionFunnel
          comparison={comparison}
          mode={report.intelligence.mode}
          addedCount={report.intelligence.addedTestIds?.length || 0}
        />
        <RiskBreakdown risk={risk} />
      </div>

      <div className="grid-2">
        <Explanation report={report} />
        <ImpactedFeatures impact={report.impact} />
      </div>

      <TestResults report={report} />
      {untouchedCritical.length > 0 && (
        <p className="coverage-note">
          {untouchedCritical.length === 1
            ? `${untouchedCritical[0].id} is critical and was not run because its feature did not change.`
            : `${untouchedCritical.length} critical tests were not run because their features did not change.`}
        </p>
      )}

      {report.diagnosis?.length > 0 && <Failures diagnosis={report.diagnosis} />}
      {report.changedFiles?.length > 0 && <ChangedFiles files={report.changedFiles} totals={totals} />}
    </>
  );
}

export function App() {
  const [runs, setRuns] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState("");
  const [tab, selectTab] = useHashTab();
  const automation = useAutomation();

  useEffect(() => {
    fetch("/history.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("No history yet.");
        }
        return response.json();
      })
      .then((history) => {
        const nextRuns = runsFromHistory(history);

        if (nextRuns.length === 0) {
          throw new Error("No report found. Run npm run analyze, then npm run dashboard:sync.");
        }

        setRuns(nextRuns);
        setActiveId(nextRuns[0].id);
        setEvaluation(history.evaluation);
      })
      .catch(() => {
        fetch("/sample-report.json")
          .then((response) => {
            if (!response.ok) {
              throw new Error("No report found. Run npm run analyze, then npm run dashboard:sync.");
            }
            return response.json();
          })
          .then((report) => {
            setRuns([{ id: "sample", name: "Sample", report, metrics: null }]);
            setActiveId("sample");
          })
          .catch((loadError) => setError(loadError.message));
      });
  }, []);

  function loadFile(file) {
    file.text()
      .then((text) => {
        const parsed = JSON.parse(text);

        if (!isReport(parsed)) {
          throw new Error("That file is not a TestNexus report.");
        }

        const loaded = {
          id: `file-${parsed.pullRequest.number}`,
          name: "Loaded file",
          report: parsed,
          metrics: null
        };

        setRuns((current) => [loaded, ...current.filter((run) => run.id !== loaded.id)]);
        setActiveId(loaded.id);
        setError("");
      })
      .catch((loadError) => {
        setError(loadError instanceof SyntaxError ? "That file is not valid JSON." : loadError.message);
      });
  }

  const active = runs.find((run) => run.id === activeId);
  const report = active?.report;
  const tabs = [
    { id: "suites", label: "Suites", count: automation.suites.length },
    { id: "pull-requests", label: "Pull requests", count: automation.pullRequests.length },
    { id: "analysis", label: "Analysis" }
  ];

  return (
    <>
      {/* The report's mode and date only describe the Analysis tab, so they are not shown elsewhere. */}
      <Header
        mode={tab === "analysis" ? report?.intelligence.mode : undefined}
        generatedAt={tab === "analysis" ? report?.generatedAt : undefined}
        onLoadFile={loadFile}
      />
      <main className="page">
        <Tabs tabs={tabs} active={tab} onSelect={selectTab} />

        {tab === "suites" && <SuiteRunner automation={automation} />}
        {tab === "pull-requests" && <PullRequests automation={automation} />}
        {tab === "analysis" && (active ? (
          <Analysis
            active={{ ...active, runs, id: activeId, onSelect: setActiveId }}
            evaluation={evaluation}
            error={error}
          />
        ) : (
          <p className={error ? "notice tone-bad" : "muted"}>{error || "Loading report..."}</p>
        ))}
      </main>
      <footer className="site-footer">
        <p>
          Made with <span role="img" aria-label="love">❤️</span> by <strong>Apoorav Sharma</strong>, Software Test Engineer
        </p>
      </footer>
    </>
  );
}
