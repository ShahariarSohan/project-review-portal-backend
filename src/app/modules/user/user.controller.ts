import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../shared/catchAsync";
import sendResponse from "../../shared/sendResponse";
import { userService } from "./user.service";

const createMentorController = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.createMentor(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Mentor account created successfully",
    data: result,
  });
});

const getAllUsersController = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getAllUsers(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User directory retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const updateUserStatusController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const currentAdminId = req.user?.id;
  const result = await userService.updateUserStatus(
    id,
    req.body.status,
    currentAdminId
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `User status changed to ${req.body.status}`,
    data: result,
  });
});

export const userController = {
  createMentorController,
  getAllUsersController,
  updateUserStatusController,
};
