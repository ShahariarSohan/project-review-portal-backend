import bcrypt from "bcrypt";
import { envVariables } from "../config/env";
import { UserRole } from "../interfaces/userRole";
import { prisma } from "../config/prisma";

const seedAccounts = async () => {
  try {
    const saltRounds = Number(envVariables.BCRYPT_SALT_ROUND) || 12;

    // 1. Seed Platform Admin
    const existingAdmin = await prisma.user.findFirst({
      where: { email: envVariables.ADMIN_EMAIL || "admin@reviewportal.com" },
    });

    let adminId = existingAdmin?.id;

    if (!existingAdmin) {
      const hashedAdminPassword = await bcrypt.hash(
        envVariables.ADMIN_PASSWORD || "Admin123",
        saltRounds
      );

      const admin = await prisma.user.create({
        data: {
          name: envVariables.ADMIN_NAME || "System Admin",
          email: envVariables.ADMIN_EMAIL || "admin@reviewportal.com",
          password: hashedAdminPassword,
          role: UserRole.ADMIN,
          isVerified: true,
        },
      });
      adminId = admin.id;
      console.log("Admin account seeded:", admin.email);
    }

    // 2. Seed Default Mentor
    const existingMentor = await prisma.user.findFirst({
      where: { email: "mentor@reviewportal.com" },
    });

    if (!existingMentor) {
      const hashedMentorPassword = await bcrypt.hash("Mentor123", saltRounds);
      const mentor = await prisma.user.create({
        data: {
          name: "Lead Reviewer",
          email: "mentor@reviewportal.com",
          password: hashedMentorPassword,
          role: UserRole.MENTOR,
          isVerified: true,
        },
      });
      console.log("Mentor account seeded:", mentor.email);
    }

    // 3. Seed Default Student
    let studentId: string;
    const existingStudent = await prisma.user.findFirst({
      where: { email: "student@reviewportal.com" },
    });

    if (!existingStudent) {
      const hashedStudentPassword = await bcrypt.hash("Student123", saltRounds);
      const student = await prisma.user.create({
        data: {
          name: "Alex Hunter",
          email: "student@reviewportal.com",
          password: hashedStudentPassword,
          role: UserRole.STUDENT,
          isVerified: true,
        },
      });
      studentId = student.id;
      console.log("Student account seeded:", student.email);
    } else {
      studentId = existingStudent.id;
    }

    // 4. Seed 1 Sample Pending Project for instant review grading
    const existingProject = await prisma.project.findFirst({
      where: { studentId },
    });

    if (!existingProject) {
      await prisma.project.create({
        data: {
          title: "Microservices Order Processing Pipeline",
          repoUrl: "https://github.com/alexhunter/order-processing-pipeline",
          liveUrl: "https://order-processing-pipeline.vercel.app",
          description: "High-throughput event-driven order processing engine built with TypeScript, Node.js, RabbitMQ, and PostgreSQL. Features distributed transaction tracing and resilient retry queues.",
          status: "PENDING",
          studentId,
        },
      });
      console.log("Sample pending project seeded for student.");
    }
  } catch (err) {
    console.error("Error during startup seeding:", err);
  }
};

export default seedAccounts;