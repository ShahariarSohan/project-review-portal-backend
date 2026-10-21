# Project Review Portal - Backend API

RESTful API backend for an academic and technical project submission and review platform. The service manages authentication with JSON Web Tokens (JWT) and HTTP-only cookies, role-based access control (RBAC) across three distinct user roles (Admin, Mentor, Student), project submission intake with duplicate prevention and anti-spam rate limiting, immutable evaluation workflows, and account governance with PostgreSQL and Prisma ORM.

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
| Duplicate Repo Prevention (Active PENDING/APPROVED) | Enforced | N/A | N/A |
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

## Technology Stack

- **Runtime**: Node.js (v18 or higher recommended)
- **Language**: TypeScript (strict mode enabled)
- **Framework**: Express.js 4.21
- **Database**: PostgreSQL
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

# Apply pending migrations or push schema directly
npx prisma db push
```

### Automated Account Seeding

On startup, `src/server.ts` automatically invokes `src/app/utils/seedAdmin.ts`. If the database does not already contain them, the script creates:

1. **Default Administrator**:
   - Email: `admin@reviewportal.com`
   - Password: `Admin123` (or the value set in `ADMIN_PASSWORD`)
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

## Business Rules and Enforcements

The backend enforces several core domain constraints:

### 1. Duplicate Submission Prevention
- A student cannot submit a project with a repository URL they have already submitted while that submission is currently `PENDING` or `APPROVED`.
- If a student's prior submission with that repository was `REJECTED`, they are permitted to re-submit with an updated description and revisions.

### 2. Submission Rate Limiting
- The `POST /api/v1/projects` endpoint is protected by an `express-rate-limit` middleware (`submissionRateLimiter`).
- Each user/IP is capped at a maximum of 3 submissions every 2 minutes to prevent bot flooding.

### 3. One-Time Final Review Decision
- An evaluation decision (`APPROVED` or `REJECTED`) is permanent.
- Once a project is reviewed, its status is finalized along with the reviewer's ID and review notes.
- Subsequent calls to `PATCH /api/v1/projects/:id/review` for that project return an HTTP 400 Bad Request indicating the project has already been evaluated.

### 4. Account Governance: Suspended vs Banned
- **BANNED (Total Revocation)**:
  - Users with `status = "BANNED"` are rejected immediately at login (`POST /api/v1/auth/login`) with HTTP 403 Forbidden.
  - Any active JWT tokens encountering `authGuard` are immediately rejected with HTTP 403.
- **SUSPENDED (Read-Only Access)**:
  - Suspended accounts may log in and inspect their previous records (`GET /my-submissions`, `GET /my-stats`, `GET /projects`, `GET /projects/stats`).
  - Mutation endpoints are blocked: suspended students cannot submit new projects (`POST /projects` returns 403), and suspended mentors cannot evaluate submissions (`PATCH /projects/:id/review` returns 403).

### 5. Role Immutability
- User roles (`ADMIN`, `MENTOR`, `STUDENT`) cannot be modified after account creation.
- Administrators can toggle user account status (`ACTIVE`, `SUSPENDED`, `BANNED`), but role mutation is prohibited to prevent unauthorized privilege escalation.

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
| `POST` | `/projects` | STUDENT | Submit a new project (title, repoUrl, liveUrl, description). Rate-limited. |
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
      "message": "Invalid repository URL format"
    }
  ],
  "stack": "Error: ... (in development mode only)"
}
```
