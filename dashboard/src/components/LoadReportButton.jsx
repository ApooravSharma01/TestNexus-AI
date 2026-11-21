import { useRef } from "react";

// Opens a file picker for a TestNexus report (JSON) and hands the chosen file to the app.
export function LoadReportButton({ onLoadFile, className = "button", children = "Load report" }) {
  const inputRef = useRef(null);

  function handleChange(event) {
    const file = event.target.files?.[0];

    if (file) {
      onLoadFile(file);
    }

    event.target.value = "";
  }

  return (
    <>
      <button type="button" className={className} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={handleChange}
      />
    </>
  );
}
