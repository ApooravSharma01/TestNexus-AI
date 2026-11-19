import { Panel } from "./Panel.jsx";

const STATUS_TONE = {
  added: "good",
  modified: "accent",
  removed: "bad",
  renamed: "warn"
};

export function ChangedFiles({ files, totals }) {
  const largest = Math.max(1, ...files.map((file) => file.additions + file.deletions));

  return (
    <Panel
      title="Changed files"
      subtitle={totals
        ? `${totals.files} ${totals.files === 1 ? "file" : "files"}, ${totals.churn} lines changed`
        : undefined}
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Change</th>
              <th>Type</th>
              <th className="align-right">Lines</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr key={file.path}>
                <td>
                  <span className="mono">{file.path}</span>
                  {file.previousPath && <span className="muted mono previous-path">from {file.previousPath}</span>}
                </td>
                <td><span className={`pill tone-${STATUS_TONE[file.status] || "neutral"}`}>{file.status}</span></td>
                <td className="muted">{file.category}</td>
                <td className="align-right">
                  <div className="churn">
                    <span className="text-good mono">+{file.additions}</span>
                    <span className="text-bad mono">-{file.deletions}</span>
                    <span className="churn-bar" aria-hidden="true">
                      <span
                        className="churn-add"
                        style={{ width: `${(file.additions / largest) * 100}%` }}
                      />
                      <span
                        className="churn-del"
                        style={{ width: `${(file.deletions / largest) * 100}%` }}
                      />
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {files.some((file) => file.hunks?.length > 0) && (
        <div className="diffs">
          {files.filter((file) => file.hunks?.length > 0).map((file) => (
            <article key={`${file.path}-diff`}>
              <p className="mono">{file.path}</p>
              {file.hunks.map((hunk, index) => (
                <pre key={`${file.path}-${index}`} className="diff">
                  {hunk.heading && <span className="diff-heading">{hunk.heading}{"\n"}</span>}
                  {hunk.removedLines.map((entry, lineIndex) => (
                    <span key={`del-${lineIndex}`} className="diff-del">- {entry}{"\n"}</span>
                  ))}
                  {hunk.addedLines.map((entry, lineIndex) => (
                    <span key={`add-${lineIndex}`} className="diff-add">+ {entry}{"\n"}</span>
                  ))}
                </pre>
              ))}
            </article>
          ))}
        </div>
      )}
    </Panel>
  );
}
