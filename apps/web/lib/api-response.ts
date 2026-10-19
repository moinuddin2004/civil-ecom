import { ApiError, errorFromResponse, networkError } from './api-errors';

/**
 * Response handling shared by `apiServer()` and `apiClient()`: both return the parsed JSON
 * envelope (`{ data }`, `{ data, meta }`) and throw `ApiError` for anything else.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** `'/cart'` and `'/api/cart'` both become `'/api/cart'`. */
export function apiPath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash === '/api' || withSlash.startsWith('/api/') || withSlash.startsWith('/api?')
    ? withSlash
    : `/api${withSlash}`;
}

/** JSON text → value; anything that isn't JSON (an HTML error page, an empty body) → undefined. */
export function parseJsonText(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Reads a fetch response. 2xx with JSON → the parsed body (typed by the caller from the shared
 * DTOs); 204 → undefined; errors → ApiError with the API's code and message.
 */
export async function readApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    // The connection dropped while the body was streaming.
    throw networkError(error);
  }

  const body = parseJsonText(text);
  if (!response.ok) throw errorFromResponse(response.status, body);
  if (body === undefined) {
    throw new ApiError('INTERNAL', response.status, 'The shop sent an unexpected answer. Please try again.');
  }
  return body as T;
}
