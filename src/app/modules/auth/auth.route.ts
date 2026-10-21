import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import {
  changePassword,
  loginZodSchema,
  registerZodSchema,
} from "./auth.validation";
import authGuard from "../../middlewares/authGuard";

const router = Router();

router.post("/register", validateRequest(registerZodSchema), authController.registerUserController);
router.post("/signup", validateRequest(registerZodSchema), authController.registerUserController);
router.post("/login", validateRequest(loginZodSchema), authController.loginUser);
router.post("/logout", authGuard({ allowSuspended: true, allowBanned: true }), authController.logoutUser);
router.get("/me", authGuard({ allowSuspended: true, allowBanned: true }), authController.getMe);
router.post("/change-password", authGuard(), validateRequest(changePassword), authController.changePassword);

export const authRoutes = router;