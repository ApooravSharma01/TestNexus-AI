import { useRef } from "react";

import { formatDate } from "../format.js";
import { Logo } from "./Logo.jsx";

export function Header({ mode, generatedAt, onLoadFile }) {
  const inputRef = useRef(null);

  function handleChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      onLoadFile(file);
    }

    event.target.value = "";
  }

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
          <button type="button" className="button" onClick={() => inputRef.current?.click()}>
            Load report
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleChange}
          />
        </div>
      </div>
    </header>
  );
}
