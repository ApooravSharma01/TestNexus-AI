import { createServer } from "node:http";

import { AppError } from "../utils/app-error.js";
import { handleError } from "../utils/error-handler.js";

// Browsers on this machine are the only callers we expect.
const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const localHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

export function createSuiteServer({ service }) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const origin = request.headers.origin;

      // A page on another website must not be able to start runs through the
      // visitor's browser, so anything that is not local is refused.
      if (origin && !localOrigin.test(origin)) {
        throw new AppError("This origin is not allowed", 403, "ORIGIN_NOT_ALLOWED");
      }

      // Blocks DNS rebinding, where a hostile site points its own name at 127.0.0.1.
      if (!localHost.test(request.headers.host || "")) {
        throw new AppError("This host is not allowed", 403, "HOST_NOT_ALLOWED");
      }

      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, { ok: true });
      }

      if (request.method === "GET" && url.pathname === "/api/suites") {
        return sendJson(response, 200, { suites: service.getSuites() });
      }

      if (request.method === "GET" && url.pathname === "/api/suite-runs") {
        return sendJson(response, 200, { runs: await service.listRuns() });
      }

      const runMatch = url.pathname.match(/^\/api\/suites\/([a-z0-9-]+)\/run$/);

      if (request.method === "POST" && runMatch) {
        const result = await service.runSuite(runMatch[1]);
        return sendJson(response, 202, result);
      }

      throw new AppError("Not found", 404, "NOT_FOUND");
    } catch (error) {
      const result = handleError(error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      return sendJson(response, statusCode, result);
    }
  });
}
