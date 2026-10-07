export function isOwnUploadUrl(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === 'string' && /^\/api\/arquivos\/[A-Za-z0-9]+$/.test(v));
}
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function cap<T>(str: T, max: number): T | string {
  return typeof str === 'string' ? str.trim().slice(0, max) : str;
}

export function isCoordenadaValida(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// Confere os bytes mágicos reais do arquivo contra o MIME declarado — um base64 arbitrário
// rotulado "image/png" não passa mais por causa de um Content-Type de confiança.
export function assinaturaImagemValida(mime: string, buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const b = buffer;
  if (mime === 'image/png') {
    return b[0]===0x89 && b[1]===0x50 && b[2]===0x4E && b[3]===0x47 && b[4]===0x0D && b[5]===0x0A && b[6]===0x1A && b[7]===0x0A;
  }
  if (mime === 'image/jpeg') {
    return b[0]===0xFF && b[1]===0xD8 && b[2]===0xFF;
  }
  if (mime === 'image/gif') {
    const header = b.subarray(0,6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (mime === 'image/webp') {
    return b.subarray(0,4).toString('ascii') === 'RIFF' && b.subarray(8,12).toString('ascii') === 'WEBP';
  }
  return false;
}
