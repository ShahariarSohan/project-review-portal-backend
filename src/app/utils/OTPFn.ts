import { prisma } from "../config/prisma";
import { sendEmailFn } from "./sendMailFn";

export const OTPFn = async (email: string) => {
  const OTP_EXPIRY_TIME = 5 * 60 * 1000; // OTP valid for 5 minutes
  const expiry = new Date(Date.now() + OTP_EXPIRY_TIME);
  const otp = Math.floor(100000 + Math.random() * 900000);

  const updateOTP = await prisma.otp.upsert({
    where: {
      email: email,
    },
    update: {
      otp: otp,
      expiry: expiry,
    },
    create: {
      email: email,
      otp: otp,
      expiry: expiry,
    },
  });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true },
  });

  sendEmailFn(email, otp, user?.name).catch((error) => {
    console.error("Delayed Email Sending Failed:", error);
  });

  return updateOTP;
};
