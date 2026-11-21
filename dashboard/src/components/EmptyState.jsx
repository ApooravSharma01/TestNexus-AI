// A calm, centred message for screens that have nothing to show yet.
export function EmptyState({ title, children, actions }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <div className="empty-body">{children}</div>
      {actions && <div className="empty-actions">{actions}</div>}
    </div>
  );
}
