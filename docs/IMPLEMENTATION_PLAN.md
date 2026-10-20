# Project Review Portal - Backend Implementation Plan

## 1. System Overview & Tech Stack
- **Language**: TypeScript (`strict: true`)
- **Runtime & Framework**: Node.js + Express.js
- **Database**: PostgreSQL (Neon Cloud)
- **ORM**: Prisma ORM (`v6.19.3`)
- **Authentication**: JWT-based Role-Based Access Control (RBAC) with HTTP-only cookies and Authorization headers
- **Validation**: Zod schema validation for request payloads and query params
- **Security & Protection**: `bcryptjs` password hashing, `cors`, `cookie-parser`, `express-rate-limit` anti-spam limiter
- **Coding Standard**: Zero emojis, clean ASCII log messages, standard HTTP status codes (`http-status`), unified error handling with `AppError` and `globalErrorHandler`.

---

## 2. Role Model & Access Control Matrix

The platform defines 3 explicit roles: `ADMIN`, `MENTOR`, and `STUDENT`.

| Capability / Resource | STUDENT | MENTOR | ADMIN |
|---|:---:|:---:|:---:|
| Register via Student Signup (Instant, No OTP) | Yes | No (Created by Admin or Seeded) | No (Seeded) |
| One-Click Demo Credentials Available | Yes (`student@reviewportal.com`) | Yes (`mentor@reviewportal.com`) | Yes (`admin@reviewportal.com`) |
| Submit New Project (Title, Repo, Live, Desc) | Yes | No | No |
| Duplicate Repo URL Prevention | Yes (Enforced) | N/A | N/A |
| Anti-Spam Rate Limit (Max 3 per 2 min) | Yes (Enforced) | N/A | N/A |
| View "My Submissions" & Mentor Notes | Yes | No | No |
| View All Submissions (Server Paginated Table) | No | Yes | Yes |
| Filter by Status (`PENDING`, `APPROVED`, `REJECTED`) | No | Yes (Server-side) | Yes (Server-side) |
| Search Submissions by Title, Student Name/Email | No | Yes (Server-side) | Yes (Server-side) |
| Approve / Reject Submission with Review Notes | No | Yes (Once only) | Yes (Once only) |
| One-Time Final Review Decision (Immutable after review) | N/A | Yes (Enforced) | Yes (Enforced) |
| View Aggregated Platform / Review Statistics | No (Only Personal Stats) | Yes | Yes |
| View Full User Directory (Students, Mentors, Admins)| No | No | Yes |
| Create New Mentor (`POST /api/v1/users/mentor`) | No | No | Yes |
| Promote User / Change Role | No | No | No (Disabled: Roles are immutable) |
| Manage User Account Status (`ACTIVE`, `SUSPENDED`, `BANNED`) | No | No | Yes |
| View Profile Details (Email, Role, Status) in Settings | Yes (Read-only) | Yes (Read-only) | Yes (Read-only) |
| Change Password in Settings | No (Disabled) | No (Disabled) | No (Disabled) |

---

## 3. Ambiguity Resolutions

1. **Who Creates the Mentor?**:
   - **The ADMIN**: Mentors cannot be created by students or public registration. In `/dashboard/users`, the Admin has an **"Add Mentor"** dialog (`POST /api/v1/users/mentor`) where Admin inputs Name, Email, and Password.
   - **Role Mutation Disabled**: Per product specifications, role changing / promoting existing accounts across roles is strictly disabled; roles are immutable once registered or created.
   - **Startup Seeding for Evaluation**: For immediate assessment grading, backend startup automatically seeds an initial Mentor (`mentor@reviewportal.com` / `Mentor123`), alongside the Admin and sample Student.

2. **Pre-Seeded Student & Signup Option**:
   - Both options are available:
     - Pre-seeded student (`student@reviewportal.com` / `Student123`) enables instant evaluator testing of the student dashboard with pre-filled demo data.
     - Public `/signup` page remains available for testing registration of fresh student accounts without email/OTP verification blockers.

3. **Settings Page Specification**:
   - In `/dashboard/settings`, users can view their profile identity (Name, Email, Role, Status, Creation Date).
   - Password changes are explicitly disabled/removed as requested.

4. **Duplicate Submission Rule**:
   - A student cannot submit the same GitHub repository URL while they already have an active `PENDING` or `APPROVED` project.
   - If a previous submission with that repository was `REJECTED`, the student is permitted to resubmit with an updated description and improvements.

5. **Anti-Spam Rate Limiting**:
   - `express-rate-limit` middleware restricts `POST /api/v1/projects` to a maximum of 3 submissions per 2 minutes per IP/User to protect the platform against bot flooding.

6. **Review Notes / Feedback**:
   - Mentors and Admins submit feedback notes alongside their approval or rejection decision. The student can view these notes on their submissions dashboard.

7. **One-Time Final Review Decision Protocol**:
   - An evaluation decision (`APPROVED` or `REJECTED`) is one-time and final. Once recorded, it cannot be modified or re-reviewed by any mentor or admin.
   - If a request is made to review an already-decided project, the backend returns HTTP 400 Bad Request with a clear message indicating the review decision is finalized.

---

## 4. Feature-by-Feature Implementation Sequence

### Feature 1: Database Schema Migration & Multi-Role Seeding
**Goal**: Update Prisma schema to support 3 roles, Project model with relations, and seed Admin, Mentor, and Student test accounts.

- **File**: `prisma/schema.prisma`
  - Update `enum UserRole`:
    ```prisma
    enum UserRole {
      ADMIN
      MENTOR
      STUDENT
    }
    ```
  - Define `enum ProjectStatus`:
    ```prisma
    enum ProjectStatus {
      PENDING
      APPROVED
      REJECTED
    }
    ```
  - Define `model Project`:
    ```prisma
    model Project {
      id          String        @id @default(uuid())
      title       String
      repoUrl     String
      liveUrl     String?
      description String        @db.Text
      status      ProjectStatus @default(PENDING)
      reviewNotes String?       @db.Text

      studentId   String
      student     User          @relation("StudentProjects", fields: [studentId], references: [id], onDelete: Cascade)

      reviewerId  String?
      reviewer    User?         @relation("ReviewedProjects", fields: [reviewerId], references: [id], onDelete: SetNull)

      createdAt   DateTime      @default(now())
      updatedAt   DateTime      @updatedAt

      @@index([studentId])
      @@index([status])
      @@index([createdAt])
      @@map("projects")
    }
    ```
  - Update `User` model with relations:
    ```prisma
    projectsSubmitted Project[] @relation("StudentProjects")
    projectsReviewed  Project[] @relation("ReviewedProjects")
    ```
- **File**: `src/app/interfaces/userRole.ts`
  - Update enum:
    ```typescript
    export enum UserRole {
      ADMIN = "ADMIN",
      MENTOR = "MENTOR",
      STUDENT = "STUDENT"
    }
    ```
- **File**: `src/app/utils/seedAdmin.ts`
  - Seed initial accounts on startup if they do not exist:
    - Admin: `admin@reviewportal.com` / `Admin123` (`ADMIN`)
    - Mentor: `mentor@reviewportal.com` / `Mentor123` (`MENTOR`)
    - Student: `student@reviewportal.com` / `Student123` (`STUDENT`)
  - Also seed 1 sample pending project for `student@reviewportal.com` so the Mentor review table has immediate data for grading.
- **Execution**: Run `npx prisma db push` and `npx prisma generate`.

---

### Feature 2: Authentication System & Student Signup (No OTP)
**Goal**: Allow students to register with immediate token issuance and provide 3-role JWT authentication.

- **File**: `src/app/modules/auth/auth.validation.ts`
  - Define `signupZodSchema`:
    ```typescript
    export const signupZodSchema = z.object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: z.string().email("Invalid email address"),
      password: z.string().min(6, "Password must be at least 6 characters")
    });
    ```
  - Define `loginZodSchema`:
    ```typescript
    export const loginZodSchema = z.object({
      email: z.string().email("Invalid email address"),
      password: z.string().min(1, "Password is required")
    });
    ```
- **File**: `src/app/modules/auth/auth.service.ts`
  - `signupStudent(payload)`:
    - Check if email is already taken.
    - Hash password with bcrypt.
    - Create user with `role = UserRole.STUDENT`, `status = ACTIVE`, `isVerified = true`.
    - Generate access token and refresh token.
    - Return user object and tokens.
  - `loginUser(payload)`:
    - Check user existence and active status.
    - Validate password with bcrypt.
    - Issue JWT tokens with payload `{ id, email, role, name }`.
- **File**: `src/app/modules/auth/auth.controller.ts` & `auth.route.ts`:
  - Route: `POST /api/v1/auth/signup` -> calls `signupStudent`
  - Route: `POST /api/v1/auth/login` -> calls `loginUser`
  - Route: `GET /api/v1/auth/me` -> protected with `authGuard()` returning current session
  - Route: `POST /api/v1/auth/logout` -> clears HTTP-only cookies

---

### Feature 3: Project Submission & Anti-Spam Rate Limiting (Student View)
**Goal**: Allow students to submit project details, enforce GitHub/live URL validation, prevent duplicates, and rate-limit submissions.

- **Dependencies**: Install `express-rate-limit`.
- **File**: `src/app/middlewares/rateLimiter.ts`
  - Create submission rate limiter:
    ```typescript
    export const submissionRateLimiter = rateLimit({
      windowMs: 2 * 60 * 1000, // 2-minute rolling window
      max: 3, // Allow up to 3 submissions per window
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => (req as any).user?.id || req.ip || "anonymous",
      handler: (req, res) => {
        const resetTime = (req as any).rateLimit?.resetTime;
        const remainingSeconds = resetTime
          ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
          : 120;
        res.status(httpStatus.TOO_MANY_REQUESTS).json({
          success: false,
          statusCode: httpStatus.TOO_MANY_REQUESTS,
          message: `Submission limit reached (maximum 3 projects per 2 minutes). Please try again in ${remainingSeconds} seconds.`,
          retryAfterSeconds: remainingSeconds
        });
      }
    });
    ```
- **File**: `src/app/modules/project/project.validation.ts`
  - `createProjectZodSchema`:
    ```typescript
    export const createProjectZodSchema = z.object({
      title: z.string().min(3, "Title must be at least 3 characters").max(100),
      repoUrl: z.string().url("Invalid URL").regex(/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/, "Must be a valid GitHub repository URL"),
      liveUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
      description: z.string().min(20, "Description must be at least 20 characters").max(3000)
    });
    ```
- **File**: `src/app/modules/project/project.service.ts`
  - `createProject(studentId, payload)`:
    - Check if an active project with the identical `repoUrl` already exists for this `studentId` where `status IN ['PENDING', 'APPROVED']`.
    - If found: throw `AppError(httpStatus.CONFLICT, "You have already submitted this repository URL. An active or approved submission already exists.")`.
    - Insert project into database with status `PENDING`.
    - Return created project.
  - `getMySubmissions(studentId)`:
    - Query `prisma.project.findMany({ where: { studentId }, include: { reviewer: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" } })`.
    - Returns list of projects with status, reviewer name, and review notes.
  - `getMyStats(studentId)`:
    - Query counts for the student: total submitted, pending count, approved count, rejected count.
- **File**: `src/app/modules/project/project.controller.ts` & `project.route.ts`
  - `POST /api/v1/projects`: Protected with `authGuard(UserRole.STUDENT)` and `submissionRateLimiter`.
  - `GET /api/v1/projects/my-submissions`: Protected with `authGuard(UserRole.STUDENT)`.
  - `GET /api/v1/projects/my-stats`: Protected with `authGuard(UserRole.STUDENT)`.

---

### Feature 4: Mentor Review Dashboard API & Statistics (Mentor & Admin View)
**Goal**: Provide server-side paginated and filterable evaluation queue and aggregated statistics for Mentors and Admins.

- **File**: `src/app/modules/project/project.service.ts`
  - `getAllProjects(filters, paginationOptions)`:
    - Filters supported:
      - `status`: `PENDING`, `APPROVED`, `REJECTED`, or `ALL`
      - `searchTerm`: Search across project `title`, student `name`, or student `email`
    - Pagination options:
      - `page` (default 1), `limit` (default 10)
      - `sortBy` (default `createdAt`), `sortOrder` (default `desc`)
    - Prisma query using `skip: (page - 1) * limit`, `take: limit`, dynamic `where` clause.
    - Include student (`id`, `name`, `email`) and reviewer (`id`, `name`).
    - Returns `{ meta: { page, limit, total, totalPages }, data: projects }`.
  - `getProjectStats()`:
    - Aggregates system metrics:
      - `totalSubmissions`: `prisma.project.count()`
      - `pendingCount`: `prisma.project.count({ where: { status: "PENDING" } })`
      - `approvedCount`: `prisma.project.count({ where: { status: "APPROVED" } })`
      - `rejectedCount`: `prisma.project.count({ where: { status: "REJECTED" } })`
      - `approvalRate`: `(approvedCount / totalSubmissions) * 100` (rounded)
  - `reviewProject(projectId, reviewerId, payload)`:
    - `payload`: `{ status: "APPROVED" | "REJECTED", reviewNotes?: string }`
    - Verifies project exists.
    - **One-Time Decision Enforcement**: Validates that `existing.status === ProjectStatus.PENDING`. If `existing.status !== ProjectStatus.PENDING`, throws `AppError(httpStatus.BAD_REQUEST, "This project has already been reviewed. Review decisions are final and cannot be modified.")`.
    - Updates project `status`, sets `reviewerId`, updates `reviewNotes`, sets `updatedAt = new Date()`.
    - Returns updated project.
- **File**: `src/app/modules/project/project.controller.ts` & `project.route.ts`:
  - `GET /api/v1/projects`: Protected with `authGuard(UserRole.MENTOR, UserRole.ADMIN)`.
  - `GET /api/v1/projects/stats`: Protected with `authGuard(UserRole.MENTOR, UserRole.ADMIN)`.
  - `PATCH /api/v1/projects/:id/review`: Protected with `authGuard(UserRole.MENTOR, UserRole.ADMIN)`.

---

### Feature 5: Admin User Directory & Mentor Creation API (Admin View)
**Goal**: Enable Admins to view the platform user directory, search and filter accounts, manage account status (`ACTIVE`, `SUSPENDED`, `BANNED`), and create new Mentors. Role changes on existing accounts are disabled.

- **File**: `src/app/modules/user/user.validation.ts`
  - `createMentorZodSchema`:
    ```typescript
    export const createMentorZodSchema = z.object({
      name: z.string().min(2, "Name must be at least 2 characters"),
      email: z.string().email("Invalid email address"),
      password: z.string().min(6, "Password must be at least 6 characters")
    });
    ```
  - `updateUserStatusZodSchema`:
    ```typescript
    export const updateUserStatusZodSchema = z.object({
      status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"])
    });
    ```
- **File**: `src/app/modules/user/user.service.ts`
  - `createMentor(payload)`:
    - Validates email is not already registered.
    - Hashes password.
    - Creates user with `role = UserRole.MENTOR`, `status = ACTIVE`, `isVerified = true`.
    - Returns created user without password.
  - `getAllUsers(filters, paginationOptions)`:
    - Returns paginated list of all users excluding password hashes.
    - Supports search by name/email and filter by role and status.
  - `updateUserStatus(userId, status)`:
    - Allows admin to set status to `ACTIVE`, `SUSPENDED`, or `BANNED`.
    - Verifies user exists. Cannot suspend the primary seed admin.
    - Returns updated user.
- **File**: `src/app/modules/user/user.controller.ts` & `user.route.ts`:
  - `POST /api/v1/users/mentor`: Protected with `authGuard(UserRole.ADMIN)` -> calls `createMentor`
  - `GET /api/v1/users`: Protected with `authGuard(UserRole.ADMIN)` -> calls `getAllUsers`
  - `PATCH /api/v1/users/:id/status`: Protected with `authGuard(UserRole.ADMIN)` -> calls `updateUserStatus`
- Mount `/api/v1/users` in `src/app/routes/index.ts`.

---

### Feature 6: Verification & Quality Assurance
- Run `npx tsc --noEmit` across backend code.
- Verify startup auto-seeding logs for Admin, Mentor, Student, and sample project.
- Verify role security: Students cannot access review endpoints; Mentors cannot access user management endpoints; Admins have complete system access.
- Confirm zero emoji characters across code, responses, and log outputs.
