export const parseExpiryToken = (expiry: string, defaultMs: number): number => {
  if (!expiry || expiry.length < 2) return (defaultMs = 1000 * 60 * 60);

  const value = parseInt(expiry.slice(0, -1));
  const unit = expiry.slice(-1);

  switch (unit) {
    case "y":
      return value * 365 * 24 * 60 * 60 * 1000;
    case "M":
      return value * 30 * 24 * 60 * 60 * 1000;
    case "w":
      return value * 7 * 24 * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    case "s":
      return value * 1000;
    default:
      return defaultMs;
  }
};
