/**
 * ETag utility for HTTP caching (Sprint 7)
 * ETags enable conditional requests - clients cache responses and only refetch if content changes
 *
 * Example flow:
 * 1. Server sends response with ETag: "abc123"
 * 2. Client caches response with ETag
 * 3. Client sends next request with If-None-Match: "abc123"
 * 4. Server compares ETags:
 *    - Match → 304 Not Modified (no body)
 *    - No match → 200 OK with new data and new ETag
 */

import crypto from 'crypto';

/**
 * Generate an ETag from data
 * @param {any} data - Data to hash (will be JSON stringified)
 * @returns {string} ETag hash (weak ETag format: W/"hash")
 */
export function generateETag(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = crypto
    .createHash('md5')
    .update(content)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for shorter ETags

  return `W/"${hash}"`; // Weak ETag (W/) indicates semantic equivalence
}

/**
 * Express middleware to handle ETag caching
 * Automatically generates ETags and returns 304 if content hasn't changed
 *
 * Usage:
 * ```js
 * router.get('/api/projects', withETag, async (req, res) => {
 *   const data = await fetchProjects();
 *   res.json(data);
 * });
 * ```
 */
export function withETag(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Generate ETag for response data
    const etag = generateETag(data);

    // Check if client sent If-None-Match header
    const clientETag = req.headers['if-none-match'];

    if (clientETag && clientETag === etag) {
      // Content hasn't changed - return 304 Not Modified
      res.status(304).end();
    } else {
      // Content changed or first request - return full response with ETag
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'private, no-cache'); // Must revalidate with server
      originalJson(data);
    }
  };

  next();
}

/**
 * Check if request ETag matches current data ETag
 * @param {Request} req - Express request object
 * @param {any} data - Current data to compare
 * @returns {boolean} True if ETags match (content unchanged)
 */
export function isETagMatch(req, data) {
  const clientETag = req.headers['if-none-match'];
  if (!clientETag) return false;

  const currentETag = generateETag(data);
  return clientETag === currentETag;
}
