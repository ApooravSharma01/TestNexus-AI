import { formatDate } from "../format.js";
import { LoadReportButton } from "./LoadReportButton.jsx";
import { Logo } from "./Logo.jsx";

export function Header({ mode, generatedAt, onLoadFile }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <Logo />
          <span className="brand-name">TestNexus AI</span>
          <span className="brand-divider" aria-hidden="true">/</span>
          <span className="brand-page">Regression control</span>
        </div>
        <div className="topbar-actions">
          {mode && (
            <span className={`pill ${mode === "ai" ? "tone-accent" : "tone-neutral"}`}>
              {mode === "ai" ? "AI-assisted" : "Deterministic"}
            </span>
          )}
          {generatedAt && <span className="topbar-meta">Generated {formatDate(generatedAt)}</span>}
          <LoadReportButton onLoadFile={onLoadFile} />
        </div>
      </div>
    </header>
  );
}
