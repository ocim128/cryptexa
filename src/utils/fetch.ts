/**
 * Network Utilities
 * Provides fetch with retry and debounce functionality
 */

/**
 * Retry fetch with exponential backoff
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Promise resolving to Response
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxRetries: number = 3
): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;

        } catch (error) {
            lastError = error as Error;

            // Don't retry on abort or non-network errors
            if ((error as Error).name === 'AbortError' || attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Debounce function for performance
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    return function executedFunction(...args: Parameters<T>): void {
        const later = (): void => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
