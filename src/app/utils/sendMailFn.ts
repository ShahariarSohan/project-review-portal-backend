import nodemailer from "nodemailer";
import { envVariables } from "../config/env";

export const transporter = nodemailer.createTransport({
  pool: true,
  host: envVariables.SMTP_HOST,
  port: Number(envVariables.SMTP_PORT) || 587,
  secure: Number(envVariables.SMTP_PORT) === 465,
  auth: {
    user: envVariables.SMTP_USER,
    pass: envVariables.SMTP_PASS,
  },
});

if (envVariables.SMTP_USER && envVariables.SMTP_PASS) {
  transporter.verify((error) => {
    if (error) {
      console.error("SMTP connection error:", error);
    } else {
      console.log("SMTP server is ready to send emails");
    }
  });
} else {
  console.log("SMTP credentials not provided. OTP emails will be logged to console in development.");
}

export const sendEmailFn = async (
  email: string,
  otp: number,
  userName?: string
) => {
  if (!envVariables.SMTP_USER || !envVariables.SMTP_PASS) {
    console.log("----------------------------------------");
    console.log("[DEV EMAIL]");
    console.log(`To: ${email}`);
    console.log("Subject: Project Review Portal - Verification Code");
    console.log(`OTP Code: ${otp}`);
    console.log("----------------------------------------");
    return { messageId: "simulated-dev-id" };
  }

  const mailOptions = {
    from: `"Project Review Portal Support" <${envVariables.SMTP_FROM_EMAIL}>`,
    to: email,
    subject: "Project Review Portal - Verification Code",
    text: `Hello ${userName || "User"},\n\nYour one-time password (OTP) is: ${otp}\n\nPlease enter this code within 5 minutes to complete your verification.\n\nIf you did not request this code, you can ignore this email.\n\nBest regards,\nProject Review Portal Team`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); background-color: #ffffff; border: 1px solid #e0e0e0;">
        <h2 style="color: #2563eb; margin-bottom: 10px;">Project Review Portal</h2>
        <h3 style="color: #1e293b; margin-bottom: 20px;">One-Time Password (OTP)</h3>
        <p style="font-size: 16px; color: #555;">Hello ${userName || "User"},</p>
        <p style="font-size: 16px; color: #555;">Your one-time password (OTP) for verification is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 28px; font-weight: bold; color: #1e293b; padding: 15px 30px; border: 2px dashed #2563eb; border-radius: 10px; background-color: #eff6ff;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 16px; color: #555;">Please enter this code within <strong>5 minutes</strong> to complete your verification.</p>
        <p style="font-size: 16px; color: #888; font-style: italic;">If you did not request this code, you can safely ignore this message.</p>
        <hr style="margin: 30px 0 20px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 16px; color: #555;">Best regards,</p>
        <p style="font-size: 16px; color: #2563eb; font-weight: bold;">Project Review Portal Team</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: %s", info.messageId);
    return info;
  } catch (error: any) {
    console.error("Error sending email:", error.message || error);
    throw new Error("Failed to send email via SMTP");
  }
};