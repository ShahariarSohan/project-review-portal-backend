import { z } from "zod";

export const createProjectZodSchema = z.object({
  title: z
    .string({ required_error: "Project title is required" })
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title cannot exceed 100 characters"),
  repoUrl: z
    .string({ required_error: "GitHub repository URL is required" })
    .trim()
    .url("Please provide a valid URL")
    .regex(
      /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/,
      "Must be a valid GitHub repository URL (e.g., https://github.com/owner/repo)"
    ),
  liveUrl: z
    .string()
    .trim()
    .url("Please provide a valid URL")
    .regex(/^https:\/\//, "Live demo link must use secure https:// protocol")
    .optional()
    .or(z.literal("")),
  description: z
    .string({ required_error: "Project description is required" })
    .trim()
    .min(20, "Description must be at least 20 characters")
    .max(3000, "Description cannot exceed 3000 characters"),
});

export const reviewProjectZodSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"], {
    required_error: "Review status must be either APPROVED or REJECTED",
  }),
  reviewNotes: z
    .string()
    .trim()
    .max(2000, "Review feedback cannot exceed 2000 characters")
    .optional(),
});