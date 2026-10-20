import bcrypt from "bcrypt";
import { envVariables } from "../config/env";
import { UserRole } from "../interfaces/userRole";
import { prisma } from "../config/prisma";

const seedPlatformAdmin = async () => {
  try {
    const isPlatformAdminExist = await prisma.user.findFirst({
      where: {
        role: UserRole.ADMIN,
      },
    });

    if (isPlatformAdminExist) {
      console.log("Admin already exists:", isPlatformAdminExist.email);
      return;
    }

    const hashedPassword = await bcrypt.hash(
      envVariables.ADMIN_PASSWORD,
      Number(envVariables.BCRYPT_SALT_ROUND) || 12
    );

    const platformAdmin = await prisma.user.create({
      data: {
        name: envVariables.ADMIN_NAME,
        email: envVariables.ADMIN_EMAIL,
        password: hashedPassword,
        role: UserRole.ADMIN,
        isVerified: true,
      },
    });

    console.log("Platform admin created successfully:", {
      id: platformAdmin.id,
      name: platformAdmin.name,
      email: platformAdmin.email,
      role: platformAdmin.role,
    });
  } catch (err) {
    console.error("Error seeding platform admin:", err);
  }
};

export default seedPlatformAdmin;