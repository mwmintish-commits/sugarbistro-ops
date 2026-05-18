import crypto from "crypto";

// 雜湊密碼為 "salt:hash" 字串（scrypt + 16-byte salt + 64-byte hash）
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// 驗證輸入密碼是否符合存儲的 hash；timing-safe compare 防 timing attack
export function verifyPassword(password, stored) {
  if (!password || !stored || typeof stored !== "string" || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  try {
    const test = crypto.scryptSync(password, salt, 64);
    const known = Buffer.from(hash, "hex");
    if (test.length !== known.length) return false;
    return crypto.timingSafeEqual(test, known);
  } catch {
    return false;
  }
}
