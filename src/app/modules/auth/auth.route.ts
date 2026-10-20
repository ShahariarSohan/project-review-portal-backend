import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import {
  changePassword,
  forgotPassword,
  loginZodSchema,
  registerZodSchema,
  resetPassword,
  verifyOtp,
} from "./auth.validation";
import authGuard from "../../middlewares/authGuard";

const router = Router();

router.post("/register", validateRequest(registerZodSchema), authController.registerUserController);
router.post("/login", validateRequest(loginZodSchema), authController.loginUser);
router.post("/logout", authGuard(), authController.logoutUser);

router.post("/verify-otp", validateRequest(verifyOtp), authController.verifyOtp);
router.post("/forget-password", validateRequest(forgotPassword), authController.forgetPasswordController);
router.post("/reset-otp-verify", authController.resetOtpVerifyController);
router.post("/resend-otp", authController.resendOtpController);

router.post("/reset-password", validateRequest(resetPassword), authController.resetPasswordController);
router.post("/change-password", authGuard(), validateRequest(changePassword), authController.changePassword);

router.post("/social", authController.socialLoginController);
router.get("/me", authGuard(), authController.getMe);

export const authRoutes = router;
