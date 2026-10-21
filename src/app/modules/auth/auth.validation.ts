import { z } from "zod";

export const registerZodSchema = z.object({
  name: z.string({ required_error: "Name is required" }).trim().min(2, "Name must be at least 2 characters"),
  email: z.string({ required_error: "Email is required" }).trim().email("Invalid email format"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(15, "Password cannot exceed 15 characters"),
});

export const loginZodSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().email("Invalid email format"),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const changePassword = z.object({
  currentPassword: z.string({ required_error: "Current password is required" }),
  newPassword: z
    .string({ required_error: "New password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(15, "Password cannot exceed 15 characters"),
});