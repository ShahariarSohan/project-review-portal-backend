import dotenv from "dotenv";
import path from "path";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

dotenv.config({ path: path.join(process.cwd(), ".env") });

interface EnvConfig {
  PORT: string;
  NODE_ENV: string;
  DATABASE_URL: string;
  ADMIN_NAME: string;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  BCRYPT_SALT_ROUND: string;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  ACCESS_TOKEN_EXPIRES_IN: string;
  REFRESH_TOKEN_EXPIRES_IN: string;
  FRONTEND_URL: string;
  SMTP_HOST: string;
  SMTP_PORT: string;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM_EMAIL: string;
}

const loadEnvVariables = (): EnvConfig => {
  const requiredVariables: string[] = [
    "DATABASE_URL",
    "ADMIN_EMAIL",
    "ADMIN_NAME",
    "ADMIN_PASSWORD",
    "BCRYPT_SALT_ROUND",
    "ACCESS_TOKEN_SECRET",
    "REFRESH_TOKEN_SECRET",
    "ACCESS_TOKEN_EXPIRES_IN",
    "REFRESH_TOKEN_EXPIRES_IN",
  ];

  requiredVariables.forEach((key) => {
    if (!process.env[key]) {
      console.warn(`[WARNING] Missing environment variable: ${key}`);
    }
  });

  return {
    PORT: process.env.PORT || "5000",
    NODE_ENV: process.env.NODE_ENV || "development",
    DATABASE_URL: process.env.DATABASE_URL || "",
    ADMIN_NAME: process.env.ADMIN_NAME || "Portal Admin",
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@reviewportal.com",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "AdminPassword123!",
    BCRYPT_SALT_ROUND: process.env.BCRYPT_SALT_ROUND || "12",
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || "default_portal_access_token_secret",
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || "default_portal_refresh_token_secret",
    ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN || "1d",
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || "30d",
    FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
    SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
    SMTP_PORT: process.env.SMTP_PORT || "587",
    SMTP_USER: process.env.SMTP_USER || "",
    SMTP_PASS: process.env.SMTP_PASS || "",
    SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || "support@reviewportal.com",
  };
};

export const envVariables = loadEnvVariables();
