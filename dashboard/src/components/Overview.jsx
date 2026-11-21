import { PROOF, PRODUCT_URL, RECORDED_ON, REPO_URL, STACK, STEPS } from "../showcase.js";

export function Overview({ onNavigate, onOpenSample, canOpenSample }) {
  return (
    <div className="overview">
      <section className="ov-hero">
        <span className="pill tone-accent">Portfolio project by Apoorav Sharma</span>
        <h1>Run only the tests a pull request can break.</h1>
        <p className="ov-lead">
          TestNexus AI reads a pull request, scores its regression risk, picks the tests that matter, and runs
          them in GitHub Actions on a real order-management app. Fewer tests, the same safety, and every
          decision explained.
        </p>
        <div className="ov-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => (canOpenSample ? onOpenSample() : onNavigate("analysis"))}
          >
            See a real example
          </button>
          <a className="button" href={REPO_URL} target="_blank" rel="noreferrer">View the code on GitHub</a>
          <a className="button" href={PRODUCT_URL} target="_blank" rel="noreferrer">The product under test</a>
        </div>
      </section>

      <section aria-labelledby="proof-title">
        <h2 id="proof-title" className="ov-heading">Results from real runs</h2>
        <div className="proof-grid">
          {PROOF.map((item) => (
            <a key={item.label} className="proof-card" href={item.href} target="_blank" rel="noreferrer">
              <span className="proof-value">{item.value}</span>
              <span className="proof-label">{item.label}</span>
              <span className="proof-detail">{item.detail}</span>
              <span className="proof-link">Open the evidence</span>
            </a>
          ))}
        </div>
        <p className="ov-note">
          Recorded on {RECORDED_ON} from OpenOMS, an open-source order system. Each card links to the real run or file.
        </p>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="ov-heading">How it works</h2>
        <ol className="ov-steps">
          {STEPS.map((step, index) => (
            <li key={step.title} className="ov-step">
              <span className="ov-step-number" aria-hidden="true">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ov-explore" aria-labelledby="explore-title">
        <div>
          <h2 id="explore-title" className="ov-heading">Explore the dashboard</h2>
          <ul className="chips" aria-label="Built with">
            {STACK.map((item) => <li key={item} className="chip">{item}</li>)}
          </ul>
        </div>
        <div className="ov-links">
          <button type="button" className="button" onClick={() => onNavigate("suites")}>Suites</button>
          <button type="button" className="button" onClick={() => onNavigate("pull-requests")}>Pull requests</button>
          <button type="button" className="button" onClick={() => onNavigate("analysis")}>Analysis</button>
        </div>
      </section>
    </div>
  );
}
