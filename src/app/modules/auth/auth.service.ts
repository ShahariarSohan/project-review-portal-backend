import httpStatus from "http-status";
import bcrypt from "bcrypt";
import { JwtPayload, Secret } from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../config/prisma";
import { envVariables } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { jwtHelpers } from "../../utils/jwtHelpers";
import { OTPFn } from "../../utils/OTPFn";
import OTPVerify from "../../utils/OTPVerify";
import { UserRole } from "../../interfaces/userRole";

const registerUser = async (payload: {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
}) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (existingUser) {
    throw new AppError(httpStatus.BAD_REQUEST, "User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(
    payload.password,
    Number(envVariables.BCRYPT_SALT_ROUND) || 12
  );

  const newUser = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      password: hashedPassword,
      role: (payload.role as UserRole) || UserRole.USER,
      isVerified: false,
    },
  });

  await OTPFn(newUser.email);

  return {
    message: "Registration successful. Please verify your email with the OTP sent.",
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    },
  };
};

const loginUser = async (payload: { email: string; password: string }) => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });
  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, "Invalid user or email");
  }
  const isCorrectPassword: boolean = await bcrypt.compare(
    payload.password,
    userData.password
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, "Incorrect Password!");
  }

  if (userData.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "This account has been deleted.");
  }

  if (userData.status === "SUSPENDED") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been suspended. Please contact support."
    );
  }

  if (userData.status === "BANNED") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Your account has been permanently banned."
    );
  }

  const accessToken = jwtHelpers.generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    envVariables.ACCESS_TOKEN_SECRET as Secret,
    envVariables.ACCESS_TOKEN_EXPIRES_IN as string
  );

  const refreshToken = jwtHelpers.generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    envVariables.REFRESH_TOKEN_SECRET as Secret,
    envVariables.REFRESH_TOKEN_EXPIRES_IN as string
  );

  return {
    accessToken,
    refreshToken,
    user: {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      status: userData.status,
      isVerified: userData.isVerified,
      profileImage: userData.profileImage,
    },
  };
};

const verifyOtp = async (payload: { email: string; otp: number }) => {
  const verifyResult = await OTPVerify({ ...payload, time: "24h" });

  if (verifyResult.message) {
    const updatedUser = await prisma.user.update({
      where: {
        email: payload.email,
      },
      data: {
        isVerified: true,
      },
    });

    const refreshToken = jwtHelpers.generateToken(
      { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
      envVariables.REFRESH_TOKEN_SECRET as Secret,
      envVariables.REFRESH_TOKEN_EXPIRES_IN as string
    );

    return {
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
      },
      accessToken: verifyResult.accessToken,
      refreshToken,
    };
  }
};

const forgetPassword = async (payload: { email: string }) => {
  const findUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });
  if (!findUser) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }

  await OTPFn(findUser.email);
  return { message: "OTP sent to your email" };
};

const resetOtpVerify = async (payload: { email: string; otp: number }) => {
  const { accessToken } = await OTPVerify({ ...payload, time: "1h" });
  return accessToken;
};

const resendOtp = async (payload: { email: string }) => {
  const findUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });
  if (!findUser) {
    throw new AppError(StatusCodes.NOT_FOUND, "User not found");
  }
  await OTPFn(findUser.email);
  return { message: "OTP sent to your email" };
};

const socialLogin = async (payload: {
  email: string;
  name: string;
  profileImage?: string;
}) => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email.trim(),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      profileImage: true,
      isVerified: true,
      status: true,
      isDeleted: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (userData) {
    if (userData.isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, "This account has been deleted.");
    }

    if (userData.status === "SUSPENDED") {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your account has been suspended. Please contact support."
      );
    }

    if (userData.status === "BANNED") {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Your account has been permanently banned."
      );
    }

    const accessToken = jwtHelpers.generateToken(
      { id: userData.id, email: userData.email, role: userData.role },
      envVariables.ACCESS_TOKEN_SECRET as Secret,
      envVariables.ACCESS_TOKEN_EXPIRES_IN as string
    );

    const refreshToken = jwtHelpers.generateToken(
      { id: userData.id, email: userData.email, role: userData.role },
      envVariables.REFRESH_TOKEN_SECRET as Secret,
      envVariables.REFRESH_TOKEN_EXPIRES_IN as string
    );

    return {
      ...userData,
      accessToken,
      refreshToken,
    };
  } else {
    return {
      isNewUser: true,
      email: payload.email,
      name: payload.name,
    };
  }
};

const resetPassword = async (newPassword: string, email: string) => {
  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "No user exists with this email");
  }
  const hashPassword = await bcrypt.hash(
    newPassword,
    Number(envVariables.BCRYPT_SALT_ROUND) || 12
  );

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      password: hashPassword,
    },
  });
  return { message: "Password reset successfully" };
};

const changePassword = async (
  currentPassword: string,
  newPassword: string,
  decodedToken: JwtPayload
) => {
  const user = await prisma.user.findUnique({
    where: {
      email: decodedToken.email,
    },
  });
  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, "User not found");
  }
  const isPasswordMatched = await bcrypt.compare(
    currentPassword,
    user.password as string
  );
  if (!isPasswordMatched) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Current password does not match");
  }
  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(envVariables.BCRYPT_SALT_ROUND) || 12
  );
  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      password: hashedPassword,
    },
  });
  return true;
};

export const authService = {
  registerUser,
  loginUser,
  forgetPassword,
  verifyOtp,
  resendOtp,
  socialLogin,
  resetOtpVerify,
  resetPassword,
  changePassword,
};
