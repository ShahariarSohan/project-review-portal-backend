import { Router } from "express";
import authGuard from "../../middlewares/authGuard";
import { validateRequest } from "../../middlewares/validateRequest";
import { UserRole } from "../../interfaces/userRole";
import {
  createMentorZodSchema,
  updateUserStatusZodSchema,
} from "./user.validation";
import { userController } from "./user.controller";

const router = Router();

// Admin-only endpoints
router.post(
  "/mentor",
  authGuard(UserRole.ADMIN),
  validateRequest(createMentorZodSchema),
  userController.createMentorController
);

router.get(
  "/",
  authGuard(UserRole.ADMIN),
  userController.getAllUsersController
);

router.patch(
  "/:id/status",
  authGuard(UserRole.ADMIN),
  validateRequest(updateUserStatusZodSchema),
  userController.updateUserStatusController
);

export const userRoutes = router;
