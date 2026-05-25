const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SCRYPT_SALT = "elva-vendor-secrets-v1";

function getEncryptionKey() {
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  if (!masterKey) {
    const err = new Error("MASTER_ENCRYPTION_KEY is not configured");
    err.status = 500;
    throw err;
  }
  return crypto.scryptSync(masterKey, SCRYPT_SALT, KEY_LENGTH);
}

function encrypt(text) {
  if (text == null || text === "") {
    const err = new Error("Cannot encrypt empty value");
    err.status = 400;
    throw err;
  }
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(text), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

function decrypt(payload) {
  if (!payload) {
    const err = new Error("Cannot decrypt empty value");
    err.status = 400;
    throw err;
  }
  const parts = String(payload).split(":");
  if (parts.length !== 3) {
    const err = new Error("Invalid encrypted payload format");
    err.status = 400;
    throw err;
  }
  const [ivB64, authTagB64, encryptedB64] = parts;
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

module.exports = { encrypt, decrypt };
