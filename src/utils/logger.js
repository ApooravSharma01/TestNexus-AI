import { env } from "../config/environment.js";

const levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

function log(level, message, metadata = {}) {
  if (levels[level] < levels[env.logLevel]) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...metadata
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message, metadata) => log("debug", message, metadata),
  info: (message, metadata) => log("info", message, metadata),
  warn: (message, metadata) => log("warn", message, metadata),
  error: (message, metadata) => log("error", message, metadata)
};
