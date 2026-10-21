import { Router } from "express";
import authGuard from "../../middlewares/authGuard";
import { validateRequest } from "../../middlewares/validateRequest";
import { submissionRateLimiter } from "../../middlewares/rateLimiter";
import { UserRole } from "../../interfaces/userRole";
import {
  createProjectZodSchema,
  reviewProjectZodSchema,
} from "./project.validation";
import { projectController } from "./project.controller";

const router = Router();

// Student routes
router.post(
  "/",
  authGuard(UserRole.STUDENT),
  submissionRateLimiter,
  validateRequest(createProjectZodSchema),
  projectController.createProjectController
);

router.get(
  "/my-submissions",
  authGuard(UserRole.STUDENT, { allowSuspended: true }),
  projectController.getMySubmissionsController
);

router.get(
  "/my-stats",
  authGuard(UserRole.STUDENT, { allowSuspended: true }),
  projectController.getMyStatsController
);

// Mentor & Admin routes
router.get(
  "/stats",
  authGuard(UserRole.MENTOR, UserRole.ADMIN, { allowSuspended: true }),
  projectController.getProjectStatsController
);

router.get(
  "/",
  authGuard(UserRole.MENTOR, UserRole.ADMIN, { allowSuspended: true }),
  projectController.getAllProjectsController
);

router.patch(
  "/:id/review",
  authGuard(UserRole.MENTOR, UserRole.ADMIN),
  validateRequest(reviewProjectZodSchema),
  projectController.reviewProjectController
);

export const projectRoutes = router;