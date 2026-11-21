// Facts shown on the Overview page. Every number comes from a real run or file linked beside it.
export const REPO_URL = "https://github.com/ApooravSharma01/TestNexus-AI";
export const PRODUCT_URL = "https://github.com/ApooravSharma01/openoms";
export const RECORDED_ON = "Nov 21, 2026";

const RUNS = `${PRODUCT_URL}/actions/runs`;

export const PROOF = [
  {
    value: "2 of 8",
    label: "tests picked for a small change",
    detail: "PR #1 edited only the API order spec. Risk was low, and CI passed in 1m 53s.",
    href: `${RUNS}/44885218120`
  },
  {
    value: "8 of 8",
    label: "tests picked for a risky change",
    detail: "PR #2 touched the order tests and the workflow. Risk was high (95), so the full set ran and passed.",
    href: `${RUNS}/44886992358`
  },
  {
    value: "8 / 8",
    label: "regression tests passed",
    detail: "The full sale-order suite (UI, API and database) in GitHub Actions, in 3m 05s.",
    href: `${RUNS}/44887338864`
  },
  {
    value: "92%",
    label: "recall on labelled changes",
    detail: "Precision is 100% over 6 hand-labelled changes. One miss is included on purpose.",
    href: `${REPO_URL}/blob/main/tests/fixtures/evaluations.json`
  }
];

export const STEPS = [
  { title: "A pull request opens", text: "GitHub Actions starts the workflow on the product repository." },
  { title: "TestNexus reads the change", text: "It maps changed files to features and scores the regression risk with fixed rules. Optional AI can add tests, never remove them." },
  { title: "Only the picked tests run", text: "Playwright runs them against a real database, API and UI started inside CI." },
  { title: "The decision is explained", text: "The report shows what ran, what was skipped and why, here in this dashboard." }
];

export const STACK = ["Node.js", "Playwright", "GitHub Actions", "React", "Vite", "Octokit", "PostgreSQL", "Go API (OpenOMS)"];
