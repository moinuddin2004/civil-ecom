import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** SPEC §12.3 `image_urls`: https only, at most 10 MB, 10 seconds. */
export const IMAGE_DOWNLOAD_MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

export class ImageDownloadError extends Error {
  override readonly name = 'ImageDownloadError';
}

/** Loopback, private, link-local and other non-public ranges: never fetched from the server. */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
    return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb');
  }
  const [a = 0, b = 0] = address.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

/**
 * Downloads one product photo for the import. Only public https addresses (so an import file can't
 * make the server reach into its own network), image content types, and the size is enforced while
 * reading. Redirects are not followed.
 */
export async function downloadImage(rawUrl: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ImageDownloadError(`"${rawUrl}" isn't a web address.`);
  }
  if (url.protocol !== 'https:') throw new ImageDownloadError(`${url.host || rawUrl}: only https links are used.`);

  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new ImageDownloadError(`${url.hostname}: the address can't be found.`);
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new ImageDownloadError(`${url.hostname}: not a public address.`);

  let response: Response;
  try {
    response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ImageDownloadError(`${url.hostname}: the photo didn't download within 10 seconds.`);
  }
  if (!response.ok || !response.body) throw new ImageDownloadError(`${url.hostname}: the photo couldn't be downloaded (${response.status}).`);
  if (!(response.headers.get('content-type') ?? '').startsWith('image/')) throw new ImageDownloadError(`${url.hostname}: the link isn't a photo.`);
  if (Number(response.headers.get('content-length') ?? 0) > IMAGE_DOWNLOAD_MAX_BYTES) throw new ImageDownloadError(`${url.hostname}: the photo is over 10 MB.`);

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > IMAGE_DOWNLOAD_MAX_BYTES) throw new ImageDownloadError(`${url.hostname}: the photo is over 10 MB.`);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
