import { UserRole, UserStatus } from "@prisma/client";

export interface ICreateMentorPayload {
  name: string;
  email: string;
  password: string;
}

export interface IUpdateUserStatusPayload {
  status: UserStatus;
}

export interface IUserFilterQuery {
  searchTerm?: string;
  role?: string;
  status?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
