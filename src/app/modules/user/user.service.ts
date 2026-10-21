import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { envVariables } from "../../config/env";
import AppError from "../../errorHelpers/AppError";
import {
  ICreateMentorPayload,
  IUserFilterQuery,
} from "./user.interface";

const createMentor = async (payload: ICreateMentorPayload) => {
  const normalizedEmail = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new AppError(
      httpStatus.CONFLICT,
      "An account with this email address already exists."
    );
  }

  const saltRounds = Number(envVariables.BCRYPT_SALT_ROUND) || 12;
  const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

  const mentor = await prisma.user.create({
    data: {
      name: payload.name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: UserRole.MENTOR,
      status: UserStatus.ACTIVE,
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
      updatedAt: true,
    },
  });

  return mentor;
};

const getAllUsers = async (filters: IUserFilterQuery) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const andConditions: Prisma.UserWhereInput[] = [{ isDeleted: false }];

  if (filters.role && filters.role !== "ALL") {
    andConditions.push({ role: filters.role as UserRole });
  }

  if (filters.status && filters.status !== "ALL") {
    andConditions.push({ status: filters.status as UserStatus });
  }

  if (filters.searchTerm?.trim()) {
    const term = filters.searchTerm.trim();
    andConditions.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  const whereCondition: Prisma.UserWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where: whereCondition }),
    prisma.user.findMany({
      where: whereCondition,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            projectsSubmitted: true,
            projectsReviewed: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: users,
  };
};

const updateUserStatus = async (
  userId: string,
  status: UserStatus,
  currentAdminId?: string
) => {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser || existingUser.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Target user account not found");
  }

  const primaryAdminEmail = (
    envVariables.ADMIN_EMAIL || "admin@reviewportal.com"
  ).toLowerCase();

  if (existingUser.email.toLowerCase() === primaryAdminEmail) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "The primary system administrator account status cannot be modified."
    );
  }

  if (currentAdminId && existingUser.id === currentAdminId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "You cannot suspend or ban your own administrator account."
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

const getUserStats = async () => {
  const [
    total,
    active,
    suspended,
    banned,
    mentors,
    students,
    admins,
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({
      where: { isDeleted: false, status: UserStatus.ACTIVE },
    }),
    prisma.user.count({
      where: { isDeleted: false, status: UserStatus.SUSPENDED },
    }),
    prisma.user.count({
      where: { isDeleted: false, status: UserStatus.BANNED },
    }),
    prisma.user.count({
      where: { isDeleted: false, role: UserRole.MENTOR },
    }),
    prisma.user.count({
      where: { isDeleted: false, role: UserRole.STUDENT },
    }),
    prisma.user.count({
      where: { isDeleted: false, role: UserRole.ADMIN },
    }),
  ]);

  return {
    total,
    active,
    suspended,
    banned,
    mentors,
    students,
    admins,
  };
};

export const userService = {
  createMentor,
  getAllUsers,
  updateUserStatus,
  getUserStats,
};
