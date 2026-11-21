import dotenv from "dotenv";

dotenv.config();

const allowedEnvironments = ["development", "test", "production"];
const allowedLogLevels = ["debug", "info", "warn", "error"];

const environment = process.env.APP_ENV || "development";
const logLevel = process.env.LOG_LEVEL || "info";
const port = Number(process.env.PORT || 3000);
const suiteApiPort = Number(process.env.SUITE_API_PORT || 4000);

if (!allowedEnvironments.includes(environment)) {
  throw new Error(`Invalid APP_ENV: ${environment}`);
}

if (!allowedLogLevels.includes(logLevel)) {
  throw new Error(`Invalid LOG_LEVEL: ${logLevel}`);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

if (!Number.isInteger(suiteApiPort) || suiteApiPort < 1 || suiteApiPort > 65535) {
  throw new Error(`Invalid SUITE_API_PORT: ${process.env.SUITE_API_PORT}`);
}

export const env = Object.freeze({
  environment,
  logLevel,
  port,
  suiteApiPort,
  githubToken: process.env.GITHUB_TOKEN || "",
  githubOwner: process.env.GITHUB_OWNER || "",
  githubRepo: process.env.GITHUB_REPO || "",
  aiApiKey: process.env.AI_API_KEY || "",
  aiModel: process.env.AI_MODEL || "gpt-4o-mini",
  aiBaseUrl: process.env.AI_BASE_URL || "https://api.openai.com/v1"
});