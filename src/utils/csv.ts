/**
 * CSV Utility Functions
 * Handles CSV generation and parsing for data export
 *
 * @module utils/csv
 */

export interface CSVOptions {
  /** Optional filename for download */
  filename?: string;
  /** Specific columns to include (defaults to all object keys) */
  columns?: string[];
  /** Delimiter character (defaults to ',') */
  delimiter?: string;
}

/**
 * Convert array of objects to CSV string
 *
 * @param data - Array of objects to convert
 * @param options - CSV generation options
 * @returns CSV formatted string
 *
 * @example
 * ```typescript
 * const csv = toCSV([
 *   { name: 'Harvard', tuition: '$75,000' },
 *   { name: 'Yale', tuition: '$70,000' }
 * ]);
 * ```
 */
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  options: CSVOptions = {}
): string {
  const { columns, delimiter = ',' } = options;

  if (data.length === 0) return '';

  const headers = columns || Object.keys(data[0]);
  const headerRow = headers.join(delimiter);

  const rows = data.map((item) =>
    headers
      .map((header) => {
        const value = item[header];
        // Handle null/undefined
        if (value === null || value === undefined) return '';
        // Convert to string
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains delimiter or quotes
        if (
          stringValue.includes(delimiter) ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(delimiter)
  );

  return [headerRow, ...rows].join('\n');
}

/**
 * Download data as CSV file
 *
 * @param data - Array of objects to export
 * @param filename - Name of the downloaded file
 * @param options - CSV generation options
 *
 * @example
 * ```typescript
 * downloadCSV(results, 'tuition-data-2025.csv');
 * ```
 */
export function downloadCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  options: CSVOptions = {}
): void {
  const csv = toCSV(data, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escape a value for CSV format
 *
 * @param val - Value to escape
 * @returns Escaped string safe for CSV
 */
export function escapeCSV(
  val: string | number | boolean | null | undefined
): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Parse CSV string to array of objects
 *
 * @param csvString - Raw CSV string
 * @param hasHeaders - Whether first row contains headers (default: true)
 * @returns Array of parsed objects
 *
 * @example
 * ```typescript
 * const data = parseCSV('name,tuition\nHarvard,$75000');
 * // [{ name: 'Harvard', tuition: '$75000' }]
 * ```
 */
export function parseCSV(
  csvString: string,
  hasHeaders = true
): Record<string, string>[] {
  const lines = csvString.trim().split('\n');
  if (lines.length === 0) return [];

  const headers = hasHeaders
    ? lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    : lines[0].split(',').map((_, i) => `column${i}`);

  const dataLines = hasHeaders ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    // Simple CSV parsing (doesn't handle all edge cases)
    const values = line.split(',');
    return headers.reduce(
      (obj, header, i) => {
        obj[header] = values[i]?.trim().replace(/^"|"$/g, '') ?? '';
        return obj;
      },
      {} as Record<string, string>
    );
  });
}

