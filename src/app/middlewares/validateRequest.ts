/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";

export const validateRequest =
  (ZodSchema: any) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.body) req.body = {};

      if (req.body.data && typeof req.body.data === "string") {
        req.body = JSON.parse(req.body.data);
      }
      req.body = await ZodSchema.parseAsync(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
