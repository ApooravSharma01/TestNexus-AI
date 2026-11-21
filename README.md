# TestNexus AI

TestNexus AI reads a pull request, decides which regression tests are worth running, and reports what ran, what was skipped, and why.

The selection rules are deterministic. An optional AI call can add tests. It cannot remove the tests the rules already selected.

## Run

```bash
npm install
npm test
npm run evaluate
npm run analyze
```

`npm run analyze` uses `tests/fixtures/login-change.json` and writes `reports/latest.json`.

```bash
npm run analyze -- tests/fixtures/login-change.json
npm run inspect-pr -- 12
npm run analyze -- --pr 12
npm run analyze -- --execute
npm run test:e2e
```

`--execute` runs the selected Playwright tests. The first Playwright run needs `npx playwright install chromium`.

`inspect-pr` and `--pr` read a real pull request from GitHub. Set `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` in `.env` first. `.env.example` lists them.

Run `npm run analyze`, then `npm run dashboard:sync`. The sync command publishes the latest report, the five labeled runs, and the precision, recall, and critical-recall scores. From `dashboard/`, run `npm install` and `npm run dev`.

## Pipeline

1. GitHub returns the pull request and the changed files.
2. The diff parser reads added and removed lines.
3. The change analyzer labels each file as source, test, configuration, documentation, or other.
4. The impact analyzer matches file paths to features in `registry/feature-map.json`.
5. The mapper finds registry tests for those features, and tests whose file was edited directly.
6. The risk engine scores the change from 0 to 100.
7. The selector keeps the mapped tests. If a source file matches no feature, it also keeps every critical test.
8. The AI step, when `AI_API_KEY` is set, may add registry test ids. Unknown ids are rejected.
9. Playwright runs the selected titles.
10. Failures are labeled product or infrastructure.
11. The report compares the full suite, the deterministic selection, and the final selection.

## Risk score

| Condition | Points |
|---|---|
| Critical feature changed | 40 |
| Other mapped feature changed | 20 |
| Source file outside the feature map | 25 |
| Source file removed | 15 |
| Change size | 1 point per 5 changed lines, maximum 20 |
| Configuration changed | 10 |

A documentation-only change scores 0. The level is low below 25, medium from 25 to 59, and high from 60.

## Evaluation

`npm run evaluate` compares the selected tests with the labeled cases in `tests/fixtures/evaluations.json`.

- Precision: selected tests that were relevant, divided by selected tests.
- Recall: relevant tests that were selected, divided by relevant tests.
- Critical recall: relevant critical tests that were selected.

On the current labeled cases the three averages are 1. An empty selection on a documentation change counts as a perfect score because there was nothing relevant to run.

## Running on a real product (OpenOMS)

TestNexus is the brain, GitHub Actions is the muscle, the dashboard is the control room. The product's full stack (database, API, UI) only exists inside its own pipeline, so the tests run there.

```
Pull request on OpenOMS
  -> workflow "select" job: npm run analyze -- --project openoms --pr N
  -> TestNexus picks the sale-order tests (writes a report and a grep pattern)
  -> workflow "order-creation-e2e" job starts Postgres, Redis, API, UI
  -> Playwright runs only the selected tests (--grep)
  -> report and results are uploaded as artifacts
```

- A product is a folder in `registry/projects/<id>/` with `project.json`, `feature-map.json` and `tests.json`.
- If TestNexus fails in the pipeline, the full suite still runs. Skipping tests only happens when TestNexus said so.
- `--execute` is refused for these projects because the stack is not on your laptop.

### Run a suite from the dashboard

Suites are listed in `registry/suites.json`. Each one points at a workflow, a branch and a Playwright filter.

```bash
npm run suites:server        # terminal 1, needs GITHUB_TOKEN with repo and workflow access
cd dashboard && npm run dev  # terminal 2, then open http://127.0.0.1:5173
npm run suite -- --list      # same suites from the command line
npm run suite -- sale-order-regression
```

The token stays in the local server, which listens on 127.0.0.1 only and refuses requests from other websites. The browser never sees it. A suite cannot be started twice at once, and the dashboard can only start suites that are in the registry.
