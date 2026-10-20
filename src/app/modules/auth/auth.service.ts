import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { JwtPayload, Secret } from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { envVariables } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import { jwtHelpers } from "../../utils/jwtHelpers";
import { UserRole } from "../../interfaces/userRole";

const registerUser = async (payload: {
  name: string;
  email: string;
  password: string;
}) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email.trim().toLowerCase() },
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
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: hashedPassword,
      role: UserRole.STUDENT,
      status: "ACTIVE",
      isVerified: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
    },
  });

  const accessToken = jwtHelpers.generateToken(
    {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    },
    envVariables.ACCESS_TOKEN_SECRET as Secret,
    envVariables.ACCESS_TOKEN_EXPIRES_IN as string
  );

  const refreshToken = jwtHelpers.generateToken(
    {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
    },
    envVariables.REFRESH_TOKEN_SECRET as Secret,
    envVariables.REFRESH_TOKEN_EXPIRES_IN as string
  );

  return {
    accessToken,
    refreshToken,
    user: newUser,
  };
};

const loginUser = async (payload: { email: string; password: string }) => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email.trim().toLowerCase(),
    },
  });

  if (!userData) {
    throw new AppError(httpStatus.NOT_FOUND, "Invalid email or password");
  }

  const isCorrectPassword = await bcrypt.compare(
    payload.password,
    userData.password
  );

  if (!isCorrectPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid email or password");
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
  changePassword,
};