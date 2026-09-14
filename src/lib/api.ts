/**
 * Safe API Client for StorePulse
 * Handles robust JSON parsing, Content-Type verification, and graceful retries.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit,
  retries: number = 2,
  delayMs: number = 400
): Promise<ApiResponse<T>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          Accept: 'application/json',
          ...(options?.headers || {}),
        },
      });

      const contentType = res.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        // If server responded with HTML (e.g. 404/500/SPA fallback), avoid JSON.parse syntax error
        if (!res.ok) {
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
            continue;
          }
          return {
            success: false,
            statusCode: res.status,
            error: `API returned non-JSON response with status ${res.status}`,
          };
        }
        // Fallback text if needed
        const text = await res.text();
        return {
          success: false,
          statusCode: res.status,
          error: `Expected JSON, received: ${text.substring(0, 100)}`,
        };
      }

      const json = await res.json();
      if (!res.ok) {
        return {
          success: false,
          statusCode: res.status,
          error: json?.error || json?.message || `HTTP ${res.status}`,
          data: json,
        };
      }

      return {
        success: true,
        statusCode: res.status,
        data: json,
      };
    } catch (err: any) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      return {
        success: false,
        error: err?.message || 'Network request failed',
      };
    }
  }

  return {
    success: false,
    error: 'Request timed out or failed after retries',
  };
}
