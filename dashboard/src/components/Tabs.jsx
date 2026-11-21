// Top-level sections. The active tab is kept in the URL hash, so a link like #pull-requests opens that section.
export function Tabs({ tabs, active, onSelect }) {
  return (
    <nav className="tabs-bar" aria-label="Dashboard sections">
      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`tab${active === tab.id ? " is-active" : ""}`}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
