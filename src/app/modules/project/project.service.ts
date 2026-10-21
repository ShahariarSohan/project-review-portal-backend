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
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { status: true },
  });

  if (!student || student.status !== "ACTIVE") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Your account has been ${student?.status?.toLowerCase() || "restricted"}. You are restricted from submitting projects.`
    );
  }

  const trimmedTitle = payload.title.trim();
  const trimmedRepo = payload.repoUrl.trim();
  const trimmedLive = payload.liveUrl.trim();

  const activeDuplicate = await prisma.project.findFirst({
    where: {
      studentId,
      status: { in: [ProjectStatus.PENDING, ProjectStatus.APPROVED] },
      OR: [
        {
          title: { equals: trimmedTitle, mode: "insensitive" },
        },
        {
          repoUrl: { equals: trimmedRepo, mode: "insensitive" },
        },
        {
          liveUrl: { equals: trimmedLive, mode: "insensitive" },
        },
      ],
    },
  });

  if (activeDuplicate) {
    const isTitleMatch =
      activeDuplicate.title.trim().toLowerCase() === trimmedTitle.toLowerCase();
    const isRepoMatch =
      activeDuplicate.repoUrl.trim().toLowerCase() === trimmedRepo.toLowerCase();
    const isLiveMatch = Boolean(
      activeDuplicate.liveUrl &&
        activeDuplicate.liveUrl.trim().toLowerCase() === trimmedLive.toLowerCase()
    );

    const conflictingFields: string[] = [];
    if (isTitleMatch) conflictingFields.push("project title");
    if (isRepoMatch) conflictingFields.push("repository URL");
    if (isLiveMatch) conflictingFields.push("live demo URL");

    const fieldsText =
      conflictingFields.length > 0
        ? conflictingFields.join(" and ")
        : "project attributes";

    throw new AppError(
      httpStatus.CONFLICT,
      `You already have an active or approved submission with this ${fieldsText}. Duplicate submissions are not allowed.`
    );
  }

  const project = await prisma.project.create({
    data: {
      title: trimmedTitle,
      repoUrl: trimmedRepo,
      liveUrl: trimmedLive,
      description: payload.description.trim(),
      status: ProjectStatus.PENDING,
      studentId,
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
  });

  return project;
};

const getMySubmissions = async (studentId: string, filters: IProjectFilterQuery = {}) => {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(filters.limit) || 10));
  const skip = (page - 1) * limit;

  const andConditions: Prisma.ProjectWhereInput[] = [{ studentId }];

  if (filters.status && filters.status !== "ALL") {
    andConditions.push({ status: filters.status as ProjectStatus });
  }

  if (filters.searchTerm?.trim()) {
    const term = filters.searchTerm.trim();
    andConditions.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { repoUrl: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  const whereCondition: Prisma.ProjectWhereInput = { AND: andConditions };

  const [total, submissions] = await Promise.all([
    prisma.project.count({ where: whereCondition }),
    prisma.project.findMany({
      where: whereCondition,
      skip,
      take: limit,
      include: {
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
    data: submissions,
  };
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
  const reviewer = await prisma.user.findUnique({
    where: { id: reviewerId },
    select: { status: true },
  });

  if (!reviewer || reviewer.status !== "ACTIVE") {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Your account has been ${reviewer?.status?.toLowerCase() || "restricted"}. You are restricted from evaluating projects.`
    );
  }

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