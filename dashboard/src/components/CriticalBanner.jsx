export function CriticalBanner({ tests }) {
  if (tests.length === 0) {
    return null;
  }

  return (
    <section className="banner tone-bad" role="alert">
      <strong>
        {tests.length === 1
          ? "A critical test of a changed feature was not selected."
          : `${tests.length} critical tests of a changed feature were not selected.`}
      </strong>
      <ul>
        {tests.map((test) => (
          <li key={test.id}>{test.id}: {test.title}</li>
        ))}
      </ul>
    </section>
  );
}
