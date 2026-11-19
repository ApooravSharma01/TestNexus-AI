import dotenv from "dotenv";

dotenv.config();

const allowedEnvironments = ["development", "test", "production"];
const allowedLogLevels = ["debug", "info", "warn", "error"];

const environment = process.env.APP_ENV || "development";
const logLevel = process.env.LOG_LEVEL || "info";
const port = Number(process.env.PORT || 3000);

if (!allowedEnvironments.includes(environment)) {
  throw new Error(`Invalid APP_ENV: ${environment}`);
}

if (!allowedLogLevels.includes(logLevel)) {
  throw new Error(`Invalid LOG_LEVEL: ${logLevel}`);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: ${process.env.PORT}`);
}

export const env = Object.freeze({
  environment,
  logLevel,
  port,
  githubToken: process.env.GITHUB_TOKEN || "",
  githubOwner: process.env.GITHUB_OWNER || "",
  githubRepo: process.env.GITHUB_REPO || ""
});