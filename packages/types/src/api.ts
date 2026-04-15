/**
 * API response wrappers.
 * Every endpoint returns one of these shapes.
 */

/** Successful response */
export interface ApiSuccessResponse<T = unknown> {
  ok: true;
  data: T;
}

/** Error response */
export interface ApiErrorResponse {
  ok: false;
  error: string;
}

/** Union type returned by all API endpoints */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Paginated list wrapper */
export interface PaginatedList<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
