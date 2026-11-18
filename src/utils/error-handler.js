import { logger } from "./logger.js";
import { AppError } from "./app-error.js";

export function handleError(error) {
  const isOperational = error instanceof AppError;

  const statusCode = isOperational ? error.statusCode : 500;
  const code = isOperational ? error.code : "INTERNAL_ERROR";

  logger.error("Application error occurred", {
    name: error.name,
    message: error.message,
    code,
    statusCode,
    isOperational
  });

  return {
    success: false,
    error: {
      code,
      message: isOperational ? error.message : "An unexpected error occurred."
    }
  };
}
