import { createSuiteService } from "../suites/suite-service.js";
import { loadSuites } from "../suites/suite-registry.js";
import { handleError } from "../utils/error-handler.js";

// npm run suite -- sale-order-regression
// npm run suite -- --list
try {
  const suites = await loadSuites();
  const service = createSuiteService({ suites });
  const argument = process.argv[2];

  if (!argument || argument === "--list") {
    for (const suite of service.getSuites()) {
      console.log(`${suite.id.padEnd(24)} ${suite.repository}  ${suite.filter}`);
    }
  } else {
    const result = await service.runSuite(argument);
    console.log(`Started ${result.suiteId}. Watch it on the dashboard or in GitHub Actions.`);
  }
} catch (error) {
  console.error(JSON.stringify(handleError(error)));
  process.exitCode = 1;
}
