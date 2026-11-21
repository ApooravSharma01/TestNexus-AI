import { env } from "../config/environment.js";
import { createSuiteServer } from "../server/suite-server.js";
import { createSuiteService } from "../suites/suite-service.js";
import { loadSuites } from "../suites/suite-registry.js";
import { handleError } from "../utils/error-handler.js";
import { logger } from "../utils/logger.js";
import { fromRoot } from "../utils/project-root.js";

try {
  const service = createSuiteService({ suites: await loadSuites() });
  // Written under dashboard/public so the page can read it when this server is off.
  const server = createSuiteServer({
    service,
    snapshotPath: fromRoot("dashboard/public/suite-runs.json")
  });

  // 127.0.0.1 keeps the GitHub token's power on this machine only.
  server.listen(env.suiteApiPort, "127.0.0.1", () => {
    logger.info("Suite runner API is ready", { url: `http://127.0.0.1:${env.suiteApiPort}` });
  });
} catch (error) {
  console.error(JSON.stringify(handleError(error)));
  process.exitCode = 1;
}
