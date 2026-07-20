import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM pour les credentials des connecteurs. Serveur uniquement. */

function key(): Buffer {
  const b64 = process.env.CONNECTOR_TOKEN_ENCRYPTION_KEY;
  if (!b64) throw new Error("CONNECTOR_TOKEN_ENCRYPTION_KEY manquante");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) {
    throw new Error("CONNECTOR_TOKEN_ENCRYPTION_KEY : 32 octets base64 attendus");
  }
  return k;
}

export function encryptJson(data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptJson<T>(payload: string): T {
  const buf = Buffer.from(payload, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  const out = Buffer.concat([d.update(buf.subarray(28)), d.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}
