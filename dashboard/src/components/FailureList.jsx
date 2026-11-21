// Collapsed by default, so a failing run does not fill the table.
export function FailureList({ failures }) {
  if (!failures || failures.length === 0) {
    return <span className="muted">None</span>;
  }

  return (
    <details className="failure-details">
      <summary>{failures.length} failed</summary>
      <ul>
        {failures.map((failure) => (
          <li key={failure.title}>
            <span className="mono">{failure.title}</span>
            {failure.message && <span className="message">{failure.message}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}
