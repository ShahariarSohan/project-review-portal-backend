import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { projectService } from "./project.service";

const createProjectController = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user.id;
  const result = await projectService.createProject(studentId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Project submitted successfully for review",
    data: result,
  });
});

const getMySubmissionsController = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user.id;
  const result = await projectService.getMySubmissions(studentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My submissions retrieved successfully",
    data: result,
  });
});

const getMyStatsController = catchAsync(async (req: Request, res: Response) => {
  const studentId = req.user.id;
  const result = await projectService.getMyStats(studentId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Student metrics retrieved successfully",
    data: result,
  });
});

const getAllProjectsController = catchAsync(async (req: Request, res: Response) => {
  const result = await projectService.getAllProjects(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Projects queue retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getProjectStatsController = catchAsync(async (_req: Request, res: Response) => {
  const result = await projectService.getProjectStats();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project statistics retrieved successfully",
    data: result,
  });
});

const reviewProjectController = catchAsync(async (req: Request, res: Response) => {
  const reviewerId = req.user.id;
  const { id } = req.params;
  const result = await projectService.reviewProject(id, reviewerId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Project has been marked as ${req.body.status}`,
    data: result,
  });
});

export const projectController = {
  createProjectController,
  getMySubmissionsController,
  getMyStatsController,
  getAllProjectsController,
  getProjectStatsController,
  reviewProjectController,
};