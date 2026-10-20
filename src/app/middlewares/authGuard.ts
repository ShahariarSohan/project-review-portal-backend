/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";

import AppError from "../errorHelpers/AppError";
import { jwtHelpers } from "../utils/jwtHelpers";
import { envVariables } from "../config/env";
import { UserRole } from "../interfaces/userRole";
import { prisma } from "../config/prisma";

const authGuard = (...roles: UserRole[]) => {
  return async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction
  ) => {
    try {
      let token = req.headers.authorization || req.cookies?.accessToken || (req.query?.token as string);
      
      if (!token) {
        throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
      }

      if (token.startsWith("Bearer ")) {
        token = token.split(" ")[1];
      }

      if (!token || token === "undefined" || token === "null" || token.trim() === "") {
        throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized!");
      }

      const verifiedUser = jwtHelpers.verifyToken(
        token,
        envVariables.ACCESS_TOKEN_SECRET as string
      );

      const dbUser = await prisma.user.findUnique({
        where: { id: verifiedUser.id },
        select: { id: true, status: true, isDeleted: true, role: true },
      });

      if (!dbUser) {
        throw new AppError(httpStatus.UNAUTHORIZED, "Account not found!");
      }

      if (dbUser.isDeleted) {
        throw new AppError(httpStatus.FORBIDDEN, "This account has been deleted.");
      }

      if (dbUser.status === "SUSPENDED") {
        throw new AppError(httpStatus.FORBIDDEN, "Your account has been suspended. Please contact support.");
      }

      if (dbUser.status === "BANNED") {
        throw new AppError(httpStatus.FORBIDDEN, "Your account has been permanently banned.");
      }

      req.user = { ...verifiedUser, role: dbUser.role };
      const userRole = dbUser.role.toUpperCase();
      
      if (roles.length && !roles.some((r) => r.toUpperCase() === userRole)) {
        throw new AppError(httpStatus.FORBIDDEN, "You do not have permission to access this resource!");
      }
      next();
    } catch (err: any) {
      if (err.name === "JsonWebTokenError") {
        next(new AppError(httpStatus.UNAUTHORIZED, "Invalid access token!"));
      } else if (err.name === "TokenExpiredError") {
        next(new AppError(httpStatus.UNAUTHORIZED, "Access token has expired!"));
      } else {
        next(err);
      }
    }
  };
};

export const optionalAuthGuard = async (
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) => {
  try {
    let token = req.headers.authorization || req.cookies?.accessToken || (req.query?.token as string);

    if (!token) {
      return next();
    }

    if (token.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }

    if (!token || token === "undefined" || token === "null" || token.trim() === "") {
      return next();
    }

    req.user = jwtHelpers.verifyToken(
      token,
      envVariables.ACCESS_TOKEN_SECRET as string
    );

    return next();
  } catch {
    return next();
  }
};

export default authGuard;
