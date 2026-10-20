import { z } from "zod";

export const registerZodSchema = z.object({
  name: z.string({ required_error: "Name is required" }).min(1, "Name cannot be empty"),
  email: z.string({ required_error: "Email is required" }).email("Invalid email format"),
  password: z.string({ required_error: "Password is required" }).min(6, "Password must be at least 6 characters"),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export const loginZodSchema = z.object({
  email: z.string({ required_error: "Email is required" }).email("Invalid email format"),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const forgotPassword = z.object({
  email: z.string({ required_error: "Email is required" }).email("Invalid email format"),
});

export const verifyOtp = z.object({
  email: z.string({ required_error: "Email is required" }).email("Invalid email format"),
  otp: z.number({ required_error: "OTP is required" }),
});

export const changePassword = z.object({
  currentPassword: z.string({ required_error: "Current password is required" }),
  newPassword: z.string({ required_error: "New password is required" }).min(6, "Password must be at least 6 characters"),
});

export const resetPassword = z.object({
  email: z.string({ required_error: "Email is required" }).email("Invalid email format"),
  newPassword: z.string({ required_error: "New password is required" }).min(6, "Password must be at least 6 characters"),
});
