import { errorFromResponse, isApiError, networkError } from './api-errors';
import { apiPath, parseJsonText, readApiResponse, type HttpMethod } from './api-response';

/**
 * Browser access to the API: same-origin `/api/...` (Nginx in production, the Next.js rewrite in
 * development), so the session cookie goes along and the API's Origin check passes.
 *
 * Returns the parsed JSON envelope; callers read `.data` (and `.meta` for lists). Errors are
 * `ApiError` with the API's code and a message that can be shown as it is.
 */

export interface ApiClientInit {
  method?: HttpMethod;
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as multipart/form-data (use `upload()` when you need progress). */
  formData?: FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function isFetchFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

/*
 * Access tokens last 15 minutes. When a call comes back 401 the session is refreshed once with the
 * refresh cookie and the call is repeated; parallel calls share one refresh. Auth endpoints
 * themselves are never retried (a wrong password is not an expired session).
 */

const refreshes = new Map<string, Promise<boolean>>();

function refreshEndpointFor(url: string): string | null {
  if (url.startsWith('/api/admin/auth/') || url.startsWith('/api/auth/')) return null;
  return url.startsWith('/api/admin/') ? '/api/admin/auth/refresh' : '/api/auth/refresh';
}

function refreshSession(endpoint: string): Promise<boolean> {
  let pending = refreshes.get(endpoint);
  if (!pending) {
    pending = fetch(endpoint, { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => refreshes.delete(endpoint));
    refreshes.set(endpoint, pending);
  }
  return pending;
}

/**
 * @example
 * const { data } = await apiClient<ApiResponse<PricedCart>>('/cart');
 * await apiClient('/orders', { method: 'POST', body, headers: { [IDEMPOTENCY_HEADER]: key } });
 */
export async function apiClient<T>(path: string, init: ApiClientInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  let body: BodyInit | undefined;
  if (init.formData) {
    // The browser sets the multipart boundary itself.
    body = init.formData;
  } else if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.body);
  }

  const url = apiPath(path);
  const send = () =>
    fetch(url, {
      method: init.method ?? (body === undefined ? 'GET' : 'POST'),
      headers,
      body,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: init.signal,
    });

  let response: Response;
  try {
    response = await send();
    const refreshEndpoint = response.status === 401 ? refreshEndpointFor(url) : null;
    if (refreshEndpoint && (await refreshSession(refreshEndpoint))) response = await send();
  } catch (error) {
    // Aborts (unmount, a newer request) stay AbortError so callers and React Query can ignore them.
    if (isFetchFailure(error)) throw networkError(error);
    throw error;
  }
  return readApiResponse<T>(response);
}

export interface UploadOptions {
  signal?: AbortSignal;
  /** Extra form fields, sent before the file (e.g. `{ variant: 'mobile' }` for banners). */
  fields?: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Uploads one file as multipart/form-data with upload progress (fetch can't report it).
 * `onProgress` receives 0…1. Resolves with the parsed JSON envelope, like `apiClient()`. An
 * expired session is refreshed once and the upload sent again, like `apiClient()`.
 */
export async function upload<T>(
  path: string,
  file: Blob,
  fieldName = 'file',
  onProgress?: (fraction: number) => void,
  options: UploadOptions = {},
): Promise<T> {
  try {
    return await sendUpload<T>(path, file, fieldName, onProgress, options);
  } catch (error) {
    const refreshEndpoint = isApiError(error) && error.status === 401 ? refreshEndpointFor(apiPath(path)) : null;
    if (!refreshEndpoint || options.signal?.aborted || !(await refreshSession(refreshEndpoint))) throw error;
    return sendUpload<T>(path, file, fieldName, onProgress, options);
  }
}

function sendUpload<T>(
  path: string,
  file: Blob,
  fieldName: string,
  onProgress: ((fraction: number) => void) | undefined,
  options: UploadOptions,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const { signal } = options;
    if (signal?.aborted) {
      reject(new DOMException('The upload was cancelled.', 'AbortError'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiPath(path));
    xhr.setRequestHeader('Accept', 'application/json');
    for (const [name, value] of Object.entries(options.headers ?? {})) xhr.setRequestHeader(name, value);

    xhr.upload.addEventListener('progress', (event) => {
      if (onProgress && event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    });

    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const cleanUp = () => signal?.removeEventListener('abort', onAbort);

    xhr.addEventListener('load', () => {
      cleanUp();
      const body = xhr.status === 204 ? undefined : parseJsonText(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve(body as T);
      } else {
        reject(errorFromResponse(xhr.status, body));
      }
    });
    xhr.addEventListener('error', () => {
      cleanUp();
      reject(networkError());
    });
    xhr.addEventListener('abort', () => {
      cleanUp();
      reject(new DOMException('The upload was cancelled.', 'AbortError'));
    });

    const form = new FormData();
    for (const [name, value] of Object.entries(options.fields ?? {})) form.append(name, value);
    const fileName = file instanceof File ? file.name : 'upload';
    form.append(fieldName, file, fileName);
    xhr.send(form);
  });
}

/** `filename="…"` from a Content-Disposition header. */
function fileNameOf(disposition: string | null): string | null {
  const match = disposition ? /filename="?([^";]+)"?/i.exec(disposition) : null;
  return match?.[1] ?? null;
}

/**
 * Downloads a file the API serves (invoice PDF, Excel export) and saves it, with the same session
 * refresh as `apiClient()` — a plain link would just show the API's 401 once the 15-minute access
 * token has expired. Errors are `ApiError`s like everywhere else.
 */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const url = apiPath(path);
  const send = () => fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  let response: Response;
  try {
    response = await send();
    const refreshEndpoint = response.status === 401 ? refreshEndpointFor(url) : null;
    if (refreshEndpoint && (await refreshSession(refreshEndpoint))) response = await send();
  } catch (error) {
    if (isFetchFailure(error)) throw networkError(error);
    throw error;
  }
  if (!response.ok) throw errorFromResponse(response.status, parseJsonText(await response.text()));

  const href = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = href;
  link.download = fileNameOf(response.headers.get('content-disposition')) ?? fallbackName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start saving before the blob goes away.
  window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/**
 * A new idempotency key (UUID v4) for `POST /api/orders` (SPEC §6.6). `crypto.randomUUID` only
 * exists on secure origins, so plain-http testing on a LAN address falls back to random bytes.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
