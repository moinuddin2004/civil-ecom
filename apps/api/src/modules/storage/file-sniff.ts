/**
 * The real type of an uploaded file from its first bytes ("magic numbers", SPEC §12.2, CLAUDE.md
 * §30). The name and the browser's MIME type are never trusted. Only the formats the app accepts
 * are recognised; anything else is `null`.
 */
export type SniffedType = 'jpg' | 'png' | 'webp' | 'pdf' | 'xlsx';

export const SNIFFED_MIME_TYPES: Record<SniffedType, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function startsWith(bytes: Buffer, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

const JPG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const ZIP = [0x50, 0x4b, 0x03, 0x04];

export function sniffFileType(bytes: Buffer): SniffedType | null {
  if (startsWith(bytes, JPG)) return 'jpg';
  if (startsWith(bytes, PNG)) return 'png';
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return 'webp';
  if (startsWith(bytes, PDF)) return 'pdf';
  // An .xlsx is a zip whose entries live under `xl/`; other zips (.docx, plain archives) are not.
  if (startsWith(bytes, ZIP) && bytes.includes('[Content_Types].xml') && bytes.includes('xl/')) return 'xlsx';
  return null;
}
