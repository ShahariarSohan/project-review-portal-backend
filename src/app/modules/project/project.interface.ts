export interface ICreateProjectPayload {
  title: string;
  repoUrl: string;
  liveUrl: string;
  description: string;
}

export interface IReviewProjectPayload {
  status: "APPROVED" | "REJECTED";
  reviewNotes?: string;
}

export interface IProjectFilterQuery {
  status?: string;
  searchTerm?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}