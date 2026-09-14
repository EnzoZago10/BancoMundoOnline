import crypto from "node:crypto";

export const secureToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (value:string) => crypto.createHash("sha256").update(value).digest("hex");
export const safeEqualHash = (a:string, b:string) => {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

export function validatePin(pin: string) {
  if (pin.length < 4 || pin.length > 32) throw Error("O PIN deve ter entre 4 e 32 caracteres.");
}

function deriveScryptKey(
  pin: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPin(pin: string) {
  validatePin(pin);
  const salt = crypto.randomBytes(16);
  const derived = await deriveScryptKey(pin, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPin(pin: string, stored: string) {
  if (!stored) return false;
  if (/^[a-f0-9]{64}$/i.test(stored)) return safeEqualHash(hashToken(pin), stored); // legado 0.7.x
  const [kind, n, r, p, saltB64, hashB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !hashB64) return false;

  const cost = Number(n);
  const blockSize = Number(r);
  const parallelization = Number(p);
  if (!Number.isInteger(cost) || cost <= 1 || !Number.isInteger(blockSize) || blockSize <= 0 || !Number.isInteger(parallelization) || parallelization <= 0) {
    return false;
  }

  const salt = Buffer.from(saltB64, "base64url");
  const expected = Buffer.from(hashB64, "base64url");
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = await deriveScryptKey(pin, salt, expected.length, {
    N: cost,
    r: blockSize,
    p: parallelization,
  });
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}
