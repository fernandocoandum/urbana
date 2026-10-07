import crypto from 'node:crypto';

export function genToken(): string { return crypto.randomBytes(32).toString('hex'); }

// --- Senhas: scrypt com salt por usuário, com verificação de contas antigas (sha256 sem salt) ---
export function hashPassword(senha: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}
export function verifyPassword(senha: unknown, armazenado: string | null | undefined): boolean {
  if (!armazenado || typeof senha !== 'string') return false;
  if (armazenado.startsWith('scrypt:')) {
    const [, salt, derivedHex] = armazenado.split(':');
    if (!salt || !derivedHex) return false;
    const stored = Buffer.from(derivedHex, 'hex');
    const test = crypto.scryptSync(senha, salt, stored.length);
    return stored.length === test.length && crypto.timingSafeEqual(stored, test);
  }
  // Compatibilidade com contas criadas antes do reforço de segurança (sha256 sem salt)
  const legacy = Buffer.from(crypto.createHash('sha256').update(senha).digest('hex'), 'hex');
  const stored = Buffer.from(armazenado, 'hex');
  return legacy.length === stored.length && crypto.timingSafeEqual(legacy, stored);
}
export function isLegacyHash(armazenado: string | null | undefined): boolean {
  return !!armazenado && !armazenado.startsWith('scrypt:');
}
