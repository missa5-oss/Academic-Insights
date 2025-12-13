/**
 * Date Utility Functions
 * Centralized date formatting and manipulation
 *
 * @module utils/date
 */

/**
 * Format date for display
 *
 * @param date - Date string or Date object
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 *
 * @example
 * ```typescript
 * formatDate('2025-12-12'); // 'Dec 12, 2025'
 * formatDate(new Date(), { month: 'long' }); // 'December 12, 2025'
 * ```
 */
export function formatDate(
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }

  return d.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format date with time
 *
 * @param date - Date string or Date object
 * @returns Formatted date and time string
 *
 * @example
 * ```typescript
 * formatDateTime('2025-12-12T14:30:00Z'); // 'Dec 12, 2025, 2:30 PM'
 * ```
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }

  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time (e.g., "2 hours ago")
 *
 * @param date - Date string or Date object
 * @returns Relative time string
 *
 * @example
 * ```typescript
 * getRelativeTime(new Date(Date.now() - 3600000)); // '1 hour ago'
 * ```
 */
export function getRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return formatDate(d);
}

/**
 * Get current timestamp for filenames (ISO format without colons)
 *
 * @returns Timestamp string safe for filenames
 *
 * @example
 * ```typescript
 * getTimestamp(); // '2025-12-12T14-30-00'
 * ```
 */
export function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Get current academic year (e.g., "2025-2026")
 * Academic year starts in September
 *
 * @returns Academic year string
 *
 * @example
 * ```typescript
 * getAcademicYear(); // '2025-2026' (if current date is Oct 2025)
 * ```
 */
export function getAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Academic year starts in September (month 8)
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/**
 * Format date for API requests (YYYY-MM-DD)
 *
 * @param date - Date string or Date object
 * @returns ISO date string (YYYY-MM-DD)
 *
 * @example
 * ```typescript
 * toISODate(new Date()); // '2025-12-12'
 * ```
 */
export function toISODate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return '';
  }

  return d.toISOString().split('T')[0];
}

/**
 * Check if a date is today
 *
 * @param date - Date to check
 * @returns True if date is today
 */
export function isToday(date: string | Date): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();

  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Get date N days ago
 *
 * @param days - Number of days to go back
 * @returns Date object
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

