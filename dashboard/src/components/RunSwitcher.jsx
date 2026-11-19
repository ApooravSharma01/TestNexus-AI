export function RunSwitcher({ runs, activeId, onSelect }) {
  if (runs.length < 2) {
    return null;
  }

  return (
    <nav className="run-switcher" aria-label="Analyzed changes">
      {runs.map((run) => (
        <button
          key={run.id}
          type="button"
          className={`run-chip ${run.id === activeId ? "is-active" : ""}`}
          aria-pressed={run.id === activeId}
          onClick={() => onSelect(run.id)}
        >
          <span className="run-chip-name">{run.name}</span>
          <span className="run-chip-meta">#{run.report.pullRequest.number}</span>
        </button>
      ))}
    </nav>
  );
}
