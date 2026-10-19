import type { ErrorCode } from './errors.js';

/** Response envelopes used by every API endpoint (CLAUDE.md "API response shape"). */
export interface ApiResponse<T> {
  data: T;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

/** List endpoints are always paginated; the page size never exceeds this (SPEC §7.1). */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;
