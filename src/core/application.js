import { logger } from "../utils/logger.js";
import { env } from "../config/environment.js";

export function startApplication() {
  logger.info("Starting TestNexus AI");

  logger.info("Application configuration loaded", {
    environment: env.environment,
    port: env.port
  });

  logger.info("TestNexus AI initialized successfully");
}