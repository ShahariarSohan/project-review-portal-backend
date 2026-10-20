/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import { authService } from "./auth.service";
import { Request, Response } from "express";
import sendResponse from "../../shared/sendResponse";
import { envVariables } from "../../config/env";
import { parseExpiryToken } from "../../shared/parseExpiryToken";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/prisma";
import AppError from "../../errorHelpers/AppError";

const registerUserController = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully",
    data: result,
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const accessTokenMaxAge = parseExpiryToken(
    envVariables.ACCESS_TOKEN_EXPIRES_IN,
    1000 * 60 * 60 * 24
  );
  const refreshTokenMaxAge = parseExpiryToken(
    envVariables.REFRESH_TOKEN_EXPIRES_IN,
    1000 * 60 * 60 * 24 * 30
  );

  const result = await authService.loginUser(req.body);
  const { refreshToken, accessToken, user } = result;

  res.cookie("accessToken", accessToken, {
    secure: envVariables.NODE_ENV === "production",
    httpOnly: true,
    sameSite: envVariables.NODE_ENV === "production" ? "none" : "lax",
    maxAge: accessTokenMaxAge,
  });
  res.cookie("refreshToken", refreshToken, {
    secure: envVariables.NODE_ENV === "production",
    httpOnly: true,
    sameSite: envVariables.NODE_ENV === "production" ? "none" : "lax",
    maxAge: refreshTokenMaxAge,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged in successfully!",
    data: {
      accessToken,
      refreshToken,
      user,
    },
  });
});

const logoutUser = catchAsync(async (req: Request, res: Response) => {
  res.clearCookie("accessToken", {
    secure: envVariables.NODE_ENV === "production",
    httpOnly: true,
    sameSite: envVariables.NODE_ENV === "production" ? "none" : "lax",
  });

  res.clearCookie("refreshToken", {
    secure: envVariables.NODE_ENV === "production",
    httpOnly: true,
    sameSite: envVariables.NODE_ENV === "production" ? "none" : "lax",
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully!",
    data: null,
  });
});

const verifyOtp = catchAsync(async (req: Request, res: Response) => {
  const body = req.body;
  const result: any = await authService.verifyOtp(body);

  if (result?.accessToken && result?.refreshToken) {
    const accessTokenMaxAge = parseExpiryToken(
      envVariables.ACCESS_TOKEN_EXPIRES_IN,
      1000 * 60 * 60 * 24
    );
    const refreshTokenMaxAge = parseExpiryToken(
      envVariables.REFRESH_TOKEN_EXPIRES_IN,
      1000 * 60 * 60 * 24 * 30
    );

    res.cookie("accessToken", result.accessToken, {
      secure: envVariables.NODE_ENV === "production",
      httpOnly: true,
      sameSite: envVariables.NODE_ENV === "production" ? "none" : "lax",
      maxAge: accessTokenMaxAge,
    });
    res.cookie("refreshToken", result.refreshToken, {
      secure: envVariables.NODE_ENV === "production",
      httpOnly: true,
      sameSite: envVariables.NODE_ENV === "production" ? "none" : "lax",
      maxAge: refreshTokenMaxAge,
    });

    return sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "OTP verified successfully",
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
      },
    });
  }

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "OTP verified successfully",
    data: result,
  });
});

const forgetPasswordController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body;
  const result = await authService.forgetPassword(body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "OTP sent to your email",
    data: result,
  });
});

const resetOtpVerifyController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body;
  const result = await authService.resetOtpVerify(body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "OTP verified successfully",
    data: { accessToken: result },
  });
});

const resendOtpController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body;
  const result = await authService.resendOtp(body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "OTP sent to your email",
    data: result,
  });
});

const socialLoginController = catchAsync(async (req: Request, res: Response) => {
  const accessTokenMaxAge = parseExpiryToken(
    envVariables.ACCESS_TOKEN_EXPIRES_IN,
    1000 * 60 * 60 * 24
  );
  const refreshTokenMaxAge = parseExpiryToken(
    envVariables.REFRESH_TOKEN_EXPIRES_IN,
    1000 * 60 * 60 * 24 * 30
  );

  const result: any = await authService.socialLogin(req.body);

  if (result.isNewUser) {
    return sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: "New user detected, please complete registration",
      data: result,
    });
  }

  const { refreshToken, accessToken } = result;

  res.cookie("accessToken", accessToken, {
    secure: envVariables.NODE_ENV === "production",
    httpOnly: true,
    sameSite: envVariables.NODE_ENV === "production" ? "none" : "lax",
    maxAge: accessTokenMaxAge,
  });
  res.cookie("refreshToken", refreshToken, {
    secure: envVariables.NODE_ENV === "production",
    httpOnly: true,
    sameSite: envVariables.NODE_ENV === "production" ? "none" : "lax",
    maxAge: refreshTokenMaxAge,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "User logged in successfully",
    data: result,
  });
});

const resetPasswordController = catchAsync(async (req: Request, res: Response) => {
  const { newPassword, email } = req.body;
  const result = await authService.resetPassword(newPassword, email);
  sendResponse(res, {
    statusCode: httpStatus.ACCEPTED,
    success: true,
    message: "Reset password successfully",
    data: result,
  });
});

const changePassword = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user;
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(
    currentPassword,
    newPassword,
    decodedToken
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully",
    data: null,
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const decodedToken = req.user;
  const user = await prisma.user.findUnique({
    where: { email: decodedToken.email },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const { password, ...userWithoutPassword } = user;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: userWithoutPassword,
  });
});

export const authController = {
  registerUserController,
  loginUser,
  logoutUser,
  verifyOtp,
  forgetPasswordController,
  resetOtpVerifyController,
  resendOtpController,
  socialLoginController,
  resetPasswordController,
  changePassword,
  getMe,
};
