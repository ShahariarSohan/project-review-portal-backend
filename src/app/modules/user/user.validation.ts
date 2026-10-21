import { z } from "zod";

export const createMentorZodSchema = z.object({
  name: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters"),
  email: z
    .string({ required_error: "Email address is required" })
    .trim()
    .email("Please provide a valid email address"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(15, "Password cannot exceed 15 characters"),
});

export const updateUserStatusZodSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"], {
    required_error: "Status must be ACTIVE, SUSPENDED, or BANNED",
  }),
});
