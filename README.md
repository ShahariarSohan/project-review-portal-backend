# Project Review Portal - Backend API

RESTful API backend for an academic and technical project submission and review platform. The service manages authentication with JSON Web Tokens (JWT) and HTTP-only cookies, role-based access control (RBAC) across three distinct user roles (Admin, Mentor, Student), project intake with strict multi-field duplicate prevention and anti-spam rate limiting, immutable evaluation workflows, and account governance with PostgreSQL and Prisma ORM.

---

## Live Deployments

- **Production API URL**: https://project-review-portal-backend.vercel.app
- **Production Web Client**: https://project-review-portal-frontend.vercel.app
- **Health Check Endpoint**: `GET https://project-review-portal-backend.vercel.app/`

---

## Overview

The Project Review Portal backend exposes secure REST endpoints designed to facilitate project submission, review workflows, and platform administration:

- **Students** submit project repositories and live deployments, track evaluation states, and inspect mentor review notes.
- **Mentors** access a centralized review queue, inspect submission details, and record one-time approval or rejection decisions with feedback.
- **Administrators** monitor system-wide statistics, inspect all submissions, manage user account statuses (Active, Suspended, Banned), and provision new mentors.

The backend enforces strict schema validation using Zod, handles graceful database disconnection and process signals, and provides unified error handling across all controllers.

---

## Role-Based Access Control (RBAC) Matrix

The system enforces three explicit roles (`ADMIN`, `MENTOR`, `STUDENT`) via middleware:

| Feature / Resource | STUDENT | MENTOR | ADMIN |
|---|:---:|:---:|:---:|
| Public Student Registration (`POST /auth/signup`) | Yes | No | No |
| One-Click Demo Accounts Pre-Seeded | Yes | Yes | Yes |
| Submit New Project (`POST /projects`) | Yes | No | No |
| Strict Multi-Field Duplicate Prevention (Title, Repo, Live) | Enforced | N/A | N/A |
| Mandatory Live Demo Link (Secure HTTPS) | Enforced | N/A | N/A |
| Submission Anti-Spam Rate Limiter (Max 3 / 2 min) | Enforced | N/A | N/A |
| View Personal Submissions (`GET /projects/my-submissions`) | Yes | No | No |
| View Personal Statistics (`GET /projects/my-stats`) | Yes | No | No |
| View All Submissions (`GET /projects`) | No | Yes | Yes |
| Server-Side Status & Search Filters | No | Yes | Yes |
| Review Submission (`PATCH /projects/:id/review`) | No | Yes | Yes |
| One-Time Final Decision (Decision is locked once reviewed) | N/A | Enforced | Enforced |
| View Aggregated Review Statistics (`GET /projects/stats`) | No | Yes | Yes |
| View User Directory (`GET /users`) | No | No | Yes |
| View User Directory Statistics (`GET /users/stats`) | No | No | Yes |
| Provision New Mentor (`POST /users/mentor`) | No | No | Yes |
| Update User Account Status (`PATCH /users/:id/status`) | No | No | Yes |
| Mutate / Change Existing User Role | Prohibited | Prohibited | Prohibited |
| View Profile Details in Settings (`GET /auth/me`) | Yes | Yes | Yes |
| Self-Service Password Change (`POST /auth/change-password`) | Yes | Yes | Yes |

---

## Strict Business Rules and Domain Enforcements

The backend enforces strict operational boundaries to protect data integrity, prevent spam, and maintain evaluation accountability:

### 1. Strict Multi-Field Duplicate Prevention (HTTP 409 Conflict)

To prevent duplicate submissions while preserving fair resubmissions:

- **Active Submission Scope**: When a student submits a project via `POST /api/v1/projects`, the service queries existing projects for that `studentId` where `status IN ('PENDING', 'APPROVED')`.
- **Three-Field Exact Match Detection**: The query executes a case-insensitive check across three distinct fields:
  1. `title`: Compares trimmed project title against existing active submissions.
  2. `repoUrl`: Compares trimmed repository URL against existing active submissions.
  3. `liveUrl`: Compares trimmed live demo URL against existing active submissions.
- **Dynamic Conflict Reporting**: If any match is detected, the API rejects the request with an `HTTP 409 Conflict` status code and dynamically lists every conflicting field in the error message:
  ```json
  {
    "success": false,
    "message": "You already have an active or approved submission with this project title and repository URL. Duplicate submissions are not allowed."
  }
  ```
- **Fair Resubmission Policy**: If a student's prior project was marked `REJECTED`, the repository, title, and live URL are freed from the duplicate block, allowing the student to revise and resubmit their improved project.

### 2. Strict Input Validation (Zod Schema Enforcement)

All payload fields for project submission are strictly validated before database insertion:

| Field | Type | Validation Rules | Error Message on Failure |
|---|---|---|---|
| `title` | String | Trimmed, Min 3 chars, Max 100 chars | "Title must be at least 3 characters" |
| `repoUrl` | String | Valid URL matching `/^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/` | "Must be a valid GitHub repository URL (e.g., https://github.com/owner/repo)" |
| `liveUrl` | String | **Mandatory**, Trimmed, Valid URL matching `/^https:\/\/.+/` | "Live demo link must use secure https:// protocol" |
| `description` | String | Trimmed, Min 20 chars, Max 3000 chars | "Description must be at least 20 characters" |

Review payloads are similarly validated:
- `status`: Must strictly match either `"APPROVED"` or `"REJECTED"`.
- `reviewNotes`: Optional string, trimmed, capped at 2000 characters.

### 3. Anti-Spam Rate Limiting (HTTP 429 Too Many Requests)

The `POST /api/v1/projects` intake route is wrapped with `express-rate-limit`:
- **Rolling Window**: 2 minutes (120 seconds).
- **Submission Cap**: Maximum of 3 submissions per window per student account (keyed by authenticated user ID or IP).
- **Cooldown Feedback**: When exceeded, the middleware returns `HTTP 429 Too Many Requests` with a calculated `retryAfterSeconds` property, allowing the client to display an active countdown timer.

### 4. One-Time Final Review Decision (Review Immutability)

Evaluation decisions cannot be tampered with or altered after submission:
- Mentors and Admins can only evaluate submissions whose current status is `PENDING`.
- Once a project receives an `APPROVED` or `REJECTED` decision with feedback notes, the status, `reviewerId`, `reviewNotes`, and timestamp are recorded permanently.
- Any subsequent attempt to call `PATCH /api/v1/projects/:id/review` on an evaluated project is rejected with `HTTP 400 Bad Request`:
  ```json
  {
    "success": false,
    "message": "This project has already been reviewed. Review decisions are final and cannot be modified."
  }
  ```

### 5. Account Governance: Suspended vs. Banned Logic

- **BANNED (Total Expulsion / Hard Revocation)**:
  - Users with `status = "BANNED"` are rejected at authentication (`POST /api/v1/auth/login`) with `HTTP 403 Forbidden` (`"Your account has been permanently banned. Access is revoked."`).
  - Existing JWT tokens encountering `authGuard` are terminated immediately.
- **SUSPENDED (Read-Only Access)**:
  - Suspended users are permitted to authenticate and view historical submissions (`GET /my-submissions`, `GET /my-stats`, `GET /projects`, `GET /projects/stats`).
  - Mutation endpoints are blocked: suspended students cannot submit new projects (`POST /projects` returns 403), and suspended mentors cannot evaluate submissions (`PATCH /projects/:id/review` returns 403).
- **Role Immutability**:
  - Roles cannot be mutated on existing accounts. Administrators can update user account statuses (`ACTIVE`, `SUSPENDED`, `BANNED`), but role escalation or reassignment is prohibited.

---

## Technology Stack

- **Runtime**: Node.js (v18 or higher recommended)
- **Language**: TypeScript (strict mode enabled)
- **Framework**: Express.js 4.21
- **Database**: PostgreSQL (Neon Cloud / Local)
- **ORM**: Prisma ORM 6.19
- **Validation**: Zod 3.24
- **Authentication**: JSON Web Tokens (`jsonwebtoken`), `bcrypt` (12 salt rounds), `cookie-parser`
- **Security & Protection**: `cors`, `express-rate-limit`
- **Development Tooling**: `ts-node-dev`, `typescript`, `eslint`

---

## Architecture and Directory Structure

The codebase is organized in a modular layered pattern under `src/app/`:

```
project-review-portal-backend/
├── prisma/
│   └── schema.prisma             # Database schema, models, enums, indexes
├── src/
│   ├── app/
│   │   ├── config/
│   │   │   ├── env.ts            # Validated environment variables
│   │   │   └── prisma.ts         # Shared PrismaClient singleton instance
│   │   ├── errorHelpers/         # Custom AppError class and error normalizers
│   │   ├── interfaces/           # Global TypeScript definitions and UserRole enum
│   │   ├── middlewares/
│   │   │   ├── authGuard.ts      # JWT verification, status checks, role authorization
│   │   │   ├── globalErrorHandler.ts # Unified error response formatter
│   │   │   ├── notFound.ts       # 404 handler for undefined endpoints
│   │   │   ├── rateLimiter.ts    # Rate limiter for submissions (3 per 2 minutes)
│   │   │   └── validateRequest.ts # Zod schema validation middleware
│   │   ├── modules/
│   │   │   ├── auth/             # Authentication routes, controllers, services, schemas
│   │   │   ├── project/          # Project submission and review routes, controllers, services
│   │   │   └── user/             # User directory and mentor creation routes, controllers, services
│   │   ├── routes/
│   │   │   └── index.ts          # Central route registry aggregating all module routes
│   │   ├── shared/               # Shared constants and utility functions
│   │   └── utils/
│   │       ├── catchAsync.ts     # Wrapper catching rejected promises in controllers
│   │       ├── jwtHelpers.ts     # Token signing and verification helpers
│   │       ├── seedAdmin.ts      # Automated seeding on application startup
│   │       └── sendResponse.ts   # Standardized JSON response formatting
│   ├── app.ts                    # Express application configuration and middleware setup
│   └── server.ts                 # HTTP server bootstrap, database connection, graceful shutdown
├── .env.example                  # Environment configuration template
├── package.json                  # Dependencies and run scripts
├── tsconfig.json                 # TypeScript compiler configuration
└── vercel.json                   # Deployment configuration
```

---

## Prerequisites

Before running the server, ensure you have the following installed:

1. **Node.js**: v18.0.0 or higher
2. **npm**: v9.0.0 or higher
3. **PostgreSQL**: A reachable PostgreSQL database instance (local or hosted, e.g. Neon, Supabase, Railway)

---

## Environment Configuration

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Configure the variables according to your environment:

| Variable | Required | Default / Example Value | Description |
|---|:---:|---|---|
| `PORT` | Yes | `5000` | Port for the Express HTTP server |
| `NODE_ENV` | Yes | `development` | Environment mode (`development`, `production`, `test`) |
| `DATABASE_URL` | Yes | `postgresql://user:pass@localhost:5432/review_portal_db?schema=public` | PostgreSQL connection string |
| `ADMIN_NAME` | No | `Portal Admin` | Display name for the default administrator account |
| `ADMIN_EMAIL` | Yes | `admin@reviewportal.com` | Email for the seeded administrator account |
| `ADMIN_PASSWORD` | Yes | `Admin123` | Password for the seeded administrator account |
| `BCRYPT_SALT_ROUND` | No | `12` | Salt rounds for password hashing |
| `ACCESS_TOKEN_SECRET` | Yes | Long random string | Secret key used to sign JWT access tokens |
| `REFRESH_TOKEN_SECRET` | Yes | Long random string | Secret key used to sign JWT refresh tokens |
| `ACCESS_TOKEN_EXPIRES_IN` | No | `1d` | Access token lifespan |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `30d` | Refresh token lifespan |
| `FRONTEND_URL` | Yes | `http://localhost:3000` | Allowed origin for CORS headers |


---

## Database Setup and Seeding

The database schema is defined in [prisma/schema.prisma](prisma/schema.prisma). It includes two primary models:
1. `User`: Account credentials, profile fields, role (`ADMIN`, `MENTOR`, `STUDENT`), and status (`ACTIVE`, `SUSPENDED`, `BANNED`).
2. `Project`: Submission details, title, repo URL, live URL, description, status (`PENDING`, `APPROVED`, `REJECTED`), review notes, and foreign key relations to student and reviewer.

### Run Database Migrations

Generate the Prisma Client and apply migrations to your database:

```bash
# Generate Prisma Client
npx prisma generate

# Apply pending schema changes
npx prisma db push
```

### Automated Account Seeding

On startup, `src/server.ts` automatically invokes `src/app/utils/seedAdmin.ts`. If the database does not already contain them, the script creates:

1. **Default Administrator**:
   - Email: `admin@reviewportal.com`
   - Password: `Admin123`
   - Role: `ADMIN`

2. **Default Mentor**:
   - Email: `mentor@reviewportal.com`
   - Password: `Mentor123`
   - Role: `MENTOR`

3. **Default Student**:
   - Email: `student@reviewportal.com`
   - Password: `Student123`
   - Role: `STUDENT`

4. **Sample Project**:
   - Title: `Microservices Order Processing Pipeline`
   - Repo URL: `https://github.com/alexhunter/order-processing-pipeline`
   - Live URL: `https://order-processing-pipeline.vercel.app`
   - Status: `PENDING`
   - Associated with the default student, ready for immediate review testing.

---

## Installation and Local Setup

Follow these steps to run the backend API locally:

```bash
# 1. Clone the repository and enter the directory
cd project-review-portal-backend

# 2. Install dependencies
npm install

# 3. Create and populate environment variables
cp .env.example .env

# 4. Sync Prisma schema with database
npx prisma db push

# 5. Start the development server
npm run dev
```

The server will initialize, connect to PostgreSQL, seed initial demo accounts, and listen on the configured port:

```
PostgreSQL database connected.
Admin account seeded: admin@reviewportal.com
Mentor account seeded: mentor@reviewportal.com
Student account seeded: student@reviewportal.com
Server is running on port 5000
```

To verify the server is running, navigate to:
```
GET http://localhost:5000/
```

Expected response:
```json
{
  "message": "Project Review Portal API Server is Running...",
  "environment": "development",
  "uptime": "1.23sec",
  "timeStamp": "2026-10-21T08:45:00.000Z"
}
```

---

## API Reference

All application endpoints are mounted under `/api/v1`.

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | Public | Register a new student account (instantly active, no OTP required) |
| `POST` | `/auth/register` | Public | Alias for student signup |
| `POST` | `/auth/login` | Public | Authenticate user; returns JWT token and sets HTTP-only cookie |
| `POST` | `/auth/logout` | Authenticated | Clears authentication tokens |
| `GET` | `/auth/me` | Authenticated | Retrieves current authenticated user profile and permissions |
| `POST` | `/auth/change-password` | Authenticated | Self-service password update (validates current password) |

### Projects (`/api/v1/projects`)

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/projects` | STUDENT | Submit a new project (title, repoUrl, liveUrl, description). Rate-limited. Enforces strict multi-field duplicate prevention. |
| `GET` | `/projects/my-submissions` | STUDENT | List submissions submitted by the calling student |
| `GET` | `/projects/my-stats` | STUDENT | Aggregate metrics (total, pending, approved, rejected) for the student |
| `GET` | `/projects` | MENTOR, ADMIN | List all platform submissions with server pagination, search, and status filter |
| `GET` | `/projects/stats` | MENTOR, ADMIN | Platform-wide submission statistics and review queue metrics |
| `PATCH` | `/projects/:id/review` | MENTOR, ADMIN | Submit one-time review decision (`APPROVED` or `REJECTED`) with review notes |

### Users (`/api/v1/users`)

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/users/mentor` | ADMIN | Provision a new mentor account (Name, Email, Password) |
| `GET` | `/users` | ADMIN | List all registered users across the platform |
| `GET` | `/users/stats` | ADMIN | Aggregate counts of users by role and account status |
| `PATCH` | `/users/:id/status` | ADMIN | Update user account status (`ACTIVE`, `SUSPENDED`, `BANNED`) |

---

## Available Scripts

In the project root directory, the following npm scripts are available:

- `npm run dev`: Starts the application in development mode with `ts-node-dev` and automatic reload on file changes.
- `npm run build`: Compiles TypeScript source files to JavaScript in the `dist/` directory.
- `npm run start`: Executes the compiled production server (`dist/server.js`).
- `npm run postinstall`: Automatically triggers `prisma generate` after package installation.

---

## Response and Error Handling

All successful responses follow a standardized JSON structure:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

Paginated query responses include a `meta` property:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Projects retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPage": 5
  },
  "data": [ ... ]
}
```

Error responses handled by `globalErrorHandler` return predictable structures:

```json
{
  "success": false,
  "message": "Validation failed",
  "errorSources": [
    {
      "path": "repoUrl",
      "message": "Must be a valid GitHub repository URL (e.g., https://github.com/owner/repo)"
    }
  ],
  "stack": "Error: ... (in development mode only)"
}
```
