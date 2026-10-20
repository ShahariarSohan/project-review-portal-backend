import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import httpStatus from "http-status";

export const submissionRateLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2-minute rolling window
  max: 3, // Allow up to 3 submissions per window
  standardHeaders: true, // Modern RFC RateLimit-* headers
  legacyHeaders: false, // Disables deprecated X-RateLimit-* headers
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    return (req as any).user?.id || ipKeyGenerator(req.ip || "127.0.0.1");
  },
  handler: (req, res) => {
    const resetTime = (req as any).rateLimit?.resetTime;
    const remainingSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : 120;

    res.status(httpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      statusCode: httpStatus.TOO_MANY_REQUESTS,
      message: `Submission limit reached (maximum 3 projects per 2 minutes). Please try again in ${remainingSeconds} seconds.`,
      retryAfterSeconds: remainingSeconds,
    });
  },
});