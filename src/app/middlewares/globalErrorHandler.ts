/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status-codes";

import AppError from "../errorHelpers/AppError";
import { envVariables } from "../config/env";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

const sanitizeError = (error: any) => {
  if (envVariables.NODE_ENV === "production" && error?.code?.startsWith?.("P")) {
    return {
      message: "Database operation failed",
      errorDetails: null,
    };
  }
  return error;
};

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
  const success = false;
  let message = err.message || "Something went wrong!";
  let error = err;

  if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation Error";
    error = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation Error";
    error = err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      message = "Duplicate Key error: A record with this identifier already exists";
      error = err.meta;
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      message = "Requested resource not found";
      error = err;
    } else if (err.code === "P1001") {
      statusCode = httpStatus.SERVICE_UNAVAILABLE;
      message = "Database connection failed. Please check your database server.";
      error = err;
    }
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    error = err;
  }

  const sanitizedError = sanitizeError(error);

  res.status(statusCode).json({
    success,
    message,
    error: sanitizedError,
  });
};

export default globalErrorHandler;
