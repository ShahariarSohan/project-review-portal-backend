import { JwtPayload, Secret } from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import AppError from "../errorHelpers/AppError";
import { jwtHelpers } from "./jwtHelpers";
import { envVariables } from "../config/env";
import { prisma } from "../config/prisma";

const OTPVerify = async (payload: {
  otp: number;
  token?: string;
  email?: string;
  time: string;
}) => {
  let decoded: JwtPayload = {};
  if (payload.token && !payload.email) {
    try {
      decoded = jwtHelpers.verifyToken(
        payload.token,
        envVariables.ACCESS_TOKEN_SECRET as Secret
      );
    } catch {
      throw new AppError(StatusCodes.CONFLICT, "Invalid or expired token");
    }
  }

  const userEmail = decoded.email || payload.email;
  if (!userEmail) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Email is required");
  }

  const findUser = await prisma.user.findUnique({
    where: {
      email: userEmail,
    },
  });

  if (!findUser) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  const otpRecord = await prisma.otp.findUnique({
    where: {
      email: userEmail,
    },
    select: {
      otp: true,
      expiry: true,
    },
  });

  if (!otpRecord) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "OTP not found");
  }

  const currentTime = new Date();
  const otpExpiryTime = otpRecord.expiry ? new Date(otpRecord.expiry) : null;

  if (otpExpiryTime && currentTime > otpExpiryTime) {
    throw new AppError(StatusCodes.BAD_REQUEST, "OTP expired");
  }

  if (String(otpRecord.otp) !== String(payload.otp)) {
    throw new AppError(StatusCodes.CONFLICT, "Invalid OTP");
  }

  const newToken = jwtHelpers.generateToken(
    { email: findUser.email, id: findUser.id, role: findUser.role },
    envVariables.ACCESS_TOKEN_SECRET as Secret,
    envVariables.ACCESS_TOKEN_EXPIRES_IN as string
  );

  await prisma.otp.delete({
    where: {
      email: userEmail,
    },
  });

  return {
    message: "OTP verified successfully",
    accessToken: newToken,
  };
};

export default OTPVerify;
