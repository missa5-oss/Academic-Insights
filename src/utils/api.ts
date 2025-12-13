/**
 * API Utility Functions
 * Centralized API calls with error handling
 *
 * @module utils/api
 */

import { API_URL } from '@/src/config';

/**
 * Standard API error response
 */
export interface APIError {
  error: true;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * API response wrapper
 */
export interface APIResponse<T> {
  data?: T;
  error?: APIError;
}

/**
 * Make API request with standardized error handling
 *
 * @param endpoint - API endpoint (can be relative or absolute)
 * @param options - Fetch options
 * @returns Promise with data or error
 *
 * @example
 * ```typescript
 * const { data, error } = await apiRequest<Project[]>('/api/projects');
 * if (error) {
 *   console.error(error.message);
 * } else {
 *   console.log(data);
 * }
 * ```
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  try {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    // Try to parse response as JSON
    let data: T | APIError;
    try {
      data = await response.json();
    } catch {
      // Response wasn't JSON
      if (!response.ok) {
        return {
          error: {
            error: true,
            code: 'PARSE_ERROR',
            message: response.statusText || 'Failed to parse response',
          },
        };
      }
      return { data: undefined as unknown as T };
    }

    if (!response.ok) {
      const errorData = data as Record<string, unknown>;
      return {
        error: {
          error: true,
          code: (errorData.code as string) || 'API_ERROR',
          message: (errorData.message as string) || response.statusText,
          details: errorData.details as Record<string, unknown>,
        },
      };
    }

    return { data: data as T };
  } catch (err) {
    return {
      error: {
        error: true,
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network request failed',
      },
    };
  }
}

/**
 * GET request helper
 *
 * @param endpoint - API endpoint
 * @returns Promise with response data or error
 *
 * @example
 * ```typescript
 * const { data, error } = await get<Project[]>('/api/projects');
 * ```
 */
export async function get<T>(endpoint: string): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { method: 'GET' });
}

/**
 * POST request helper
 *
 * @param endpoint - API endpoint
 * @param body - Request body
 * @returns Promise with response data or error
 *
 * @example
 * ```typescript
 * const { data, error } = await post<Project>('/api/projects', {
 *   name: 'New Project',
 *   description: 'Description'
 * });
 * ```
 */
export async function post<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request helper
 *
 * @param endpoint - API endpoint
 * @param body - Request body
 * @returns Promise with response data or error
 */
export async function put<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * PATCH request helper
 *
 * @param endpoint - API endpoint
 * @param body - Request body (partial update)
 * @returns Promise with response data or error
 */
export async function patch<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request helper
 *
 * @param endpoint - API endpoint
 * @returns Promise with response data or error
 *
 * @example
 * ```typescript
 * const { error } = await del('/api/projects/123');
 * if (!error) {
 *   console.log('Deleted successfully');
 * }
 * ```
 */
export async function del<T>(endpoint: string): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
}

/**
 * Check if response is an error
 *
 * @param response - API response object
 * @returns True if response contains an error
 */
export function isError<T>(
  response: APIResponse<T>
): response is { error: APIError; data?: undefined } {
  return response.error !== undefined;
}

