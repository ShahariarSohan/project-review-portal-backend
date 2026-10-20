import httpStatus from "http-status";
import { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import AppError from "../../errorHelpers/AppError";
import {
  ICreateProjectPayload,
  IProjectFilterQuery,
  IReviewProjectPayload,
} from "./project.interface";

const createProject = async (studentId: string, payload: ICreateProjectPayload) => {

  const activeDuplicate = await prisma.project.findFirst({
    where: {
      studentId,
      repoUrl: payload.repoUrl,
      status: { in: [ProjectStatus.PENDING, ProjectStatus.APPROVED] },
    },
  });

  if (activeDuplicate) {
    throw new AppError(
      httpStatus.CONFLICT,
      "You already have an active or approved submission for this repository URL."
    );
  }

  const project = await prisma.project.create({
    data: {
      title: payload.title,
      repoUrl: payload.repoUrl,
      liveUrl: payload.liveUrl?.trim() || null,
      description: payload.description,
      status: ProjectStatus.PENDING,
      studentId,
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
  });

  return project;
};

const getMySubmissions = async (studentId: string) => {
  const submissions = await prisma.project.findMany({
    where: { studentId },
    include: {
      reviewer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return submissions;
};

const getMyStats = async (studentId: string) => {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.project.count({ where: { studentId } }),
    prisma.project.count({ where: { studentId, status: ProjectStatus.PENDING } }),
    prisma.project.count({ where: { studentId, status: ProjectStatus.APPROVED } }),
    prisma.project.count({ where: { studentId, status: ProjectStatus.REJECTED } }),
  ]);

  return { total, pending, approved, rejected };
};

const getAllProjects = async (filters: IProjectFilterQuery) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const andConditions: Prisma.ProjectWhereInput[] = [];

  if (filters.status && filters.status !== "ALL") {
    andConditions.push({ status: filters.status as ProjectStatus });
  }

  if (filters.searchTerm?.trim()) {
    const term = filters.searchTerm.trim();
    andConditions.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { student: { name: { contains: term, mode: "insensitive" } } },
        { student: { email: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  const whereCondition: Prisma.ProjectWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [total, projects] = await Promise.all([
    prisma.project.count({ where: whereCondition }),
    prisma.project.findMany({
      where: whereCondition,
      skip,
      take: limit,
      include: {
        student: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
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
    data: projects,
  };
};

const getProjectStats = async () => {
  const [total, pending, approved, rejected] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { status: ProjectStatus.PENDING } }),
    prisma.project.count({ where: { status: ProjectStatus.APPROVED } }),
    prisma.project.count({ where: { status: ProjectStatus.REJECTED } }),
  ]);

  const passRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  return {
    total,
    pending,
    approved,
    rejected,
    passRate,
  };
};

const reviewProject = async (
  projectId: string,
  reviewerId: string,
  payload: IReviewProjectPayload
) => {
  const existing = await prisma.project.findUnique({ where: { id: projectId } });
  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Target project not found");
  }

  if (existing.status !== ProjectStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This project has already been reviewed. Review decisions are final and cannot be modified."
    );
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      status: payload.status,
      reviewerId,
      reviewNotes: payload.reviewNotes?.trim() || null,
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  return updated;
};

export const projectService = {
  createProject,
  getMySubmissions,
  getMyStats,
  getAllProjects,
  getProjectStats,
  reviewProject,
};