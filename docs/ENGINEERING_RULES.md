# Engineering Standards & Architectural Rules

This document defines the non-negotiable engineering principles, code organization constraints, and architectural standards for the Project Review Portal backend. Every engineer and AI agent working on this repository must adhere strictly to these rules.

---

## 1. Professional Engineering Mindset (No AI Hallucinations)

- **Write Production-Grade Code**: Code must be engineered with intent, type safety, error boundaries, and defensive checks. Do not write generic or hallucinated boilerplate.
- **Single Responsibility Principle**: Every function, service, and controller must do one thing well.
- **Zero Emojis**: Never use emoji icons in code, comments, log statements, commit messages, or API error payloads. Keep all text 100% clean ASCII.
- **Clean Naming Conventions**: Use explicit, descriptive identifiers (`createProjectZodSchema`, `submissionRateLimiter`, `projectService`) rather than abbreviations.

---

## 2. Modularity & File Size Limits (No Monolithic Files)

- **Strict File Length Limit**: No single file should exceed 150 to 200 lines of code. If a file approaches this threshold, decompose it into smaller helper modules or sub-services.
- **Three-Tier Architecture**:
  1. **Route Layer (`*.route.ts`)**: Define path, apply middlewares (`authGuard`, `rateLimiter`), validate payloads via Zod, and dispatch to controller. Never write business logic here.
  2. **Controller Layer (`*.controller.ts`)**: Extract `req.body`, `req.query`, `req.params`, call the corresponding service, and return formatted response via `sendResponse`.
  3. **Service Layer (`*.service.ts`)**: Business logic, database operations via Prisma ORM, conflict checks, and error throwing via `AppError`.
  4. **Validation Layer (`*.validation.ts`)**: Zod schemas for request payloads, query parameters, and mutations.
  5. **Interface Layer (`*.interface.ts`)**: TypeScript types and interfaces for the domain module.

---

## 3. Assessment Requirements & Ambiguity Protocols

- **Three-Role RBAC Model**:
  - `STUDENT`: Submits projects, views personal submissions and review notes. Subject to duplicate submission check and anti-spam rate limiting.
  - `MENTOR`: Views server-side paginated review queue, filters by status, searches submissions, approves/rejects with constructive feedback notes, and views aggregated metrics.
  - `ADMIN`: Full system supervisor. Holds all mentor capabilities plus exclusive user management access (User Directory, creating Mentors via `POST /api/v1/users/mentor`, and promoting users to Mentors).
- **Mentor Creation Rule**: Mentors cannot self-register. Only `ADMIN` can create Mentors or promote existing users. An initial Mentor account is pre-seeded on startup for evaluation convenience.
- **Student Registration (No OTP)**: Student signup creates verified, active accounts (`isVerified: true`) immediately and issues JWT tokens to eliminate email friction during evaluation.
- **Duplicate Submission Rule**: Block duplicate repository submissions if the student already has an active `PENDING` or `APPROVED` project with that `repoUrl` (HTTP 409 Conflict). If a previous submission was `REJECTED`, the student is permitted to resubmit improvements.
- **Anti-Spam Rate Limiting**: `express-rate-limit` enforces a maximum of 5 project submissions per 10-minute window per IP/user (HTTP 429 Too Many Requests).
- **Settings Page Rule**: The settings page displays user profile identity (Email, Role, Status) in a read-only manner. Password modification is strictly disabled.

---

## 4. Security & Input Sanitization Guardrails

- **Mandatory Protocol Enforcement**: GitHub and live demo URLs must explicitly enforce the `https://` protocol via Zod regex to eliminate `javascript:` XSS vectors and malformed links.
- **Strict String Trimming**: Apply `.trim()` on all user inputs in Zod schemas (`title`, `description`, `email`, `name`) to prevent blank-whitespace bypasses.
- **Password Security**: Hash passwords using `bcryptjs` with a work factor of 10-12 salt rounds. Never log or store raw passwords.
- **Data Leak Prevention**: Never return sensitive fields (like `password` hashes) in Prisma query results. Always use explicit `select` clauses.
- **Cookie Security**: Auth cookies must be configured with `httpOnly: true`, `sameSite: "lax"`, and path `/`.

---

## 5. Database Performance & Query Optimization

- **Compound Indexing**: Ensure database indexes exist on high-frequency query paths:
  - `@@index([studentId])` for personal student submission lookups.
  - `@@index([status])` for mentor review status filtering.
  - `@@index([createdAt])` for chronological sort order.
- **Zero N+1 Queries**: Never loop through projects to fetch student or reviewer names. Always use Prisma's eager relation loading:
  ```typescript
  include: {
    student: { select: { id: true, name: true, email: true } },
    reviewer: { select: { id: true, name: true } }
  }
  ```
- **Lean Aggregations**: Compute statistics using `prisma.project.count()` with specific `where` conditions rather than loading rows into Node.js memory.

---

## 6. Coding Standards & Response Contracts

- **Strict TypeScript**: `noImplicitAny: true`, `strict: true`. Avoid casting to `any`.
- **Centralized Error Handling**: Use `AppError(statusCode, message)` for business logic exceptions. Never send raw stack traces to the client.
- **Unified Response Schema**: All API endpoints must return:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Operation completed successfully",
    "data": {}
  }
  ```
- **Idempotent Seeding**: The startup seeder (`seedAdmin.ts`) must check for account existence before insertion to prevent duplicate record crashes.
- **File Encoding**: Always write files in UTF-8 without BOM to avoid breaking JSON parsers and Prisma generators on Windows.

---

## 7. Execution Phasing Protocol

- Code must be implemented **one feature at a time**.
- Before proceeding to the next feature:
  1. Compile and type-check with `npx tsc --noEmit`.
  2. Verify endpoint behavior and database state.
  3. Await user review and confirmation before starting the next feature.