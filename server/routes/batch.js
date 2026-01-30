import express from 'express';
import { sql } from '../db.js';
import logger from '../utils/logger.js';
import { parseFields, projectFieldsArray } from '../utils/fieldSelection.js';
import { withETag } from '../utils/etag.js';

const router = express.Router();

/**
 * Batch endpoint - Fetch multiple resources in a single request
 * Reduces network round trips by combining related API calls
 *
 * Query parameters:
 * - projects: Include projects list
 * - results: Include results list (optionally filtered by project_id)
 * - project_id: Filter results by project
 * - conversations: Include conversations for a project
 * - analytics: Include analytics for a project
 * - projects_fields: Comma-separated list of project fields to include
 * - results_fields: Comma-separated list of result fields to include
 * - conversations_fields: Comma-separated list of conversation fields to include
 *
 * Example: GET /api/batch?projects=true&results=true&project_id=p-123&results_fields=id,school_name,tuition_amount
 * Returns: { projects: [...], results: [...] }
 *
 * Sprint 7: ETag caching for conditional requests
 */
router.get('/', withETag, async (req, res) => {
  const startTime = Date.now();
  const {
    projects, results, project_id, conversations, analytics,
    projects_fields, results_fields, conversations_fields
  } = req.query;

  // Parse field selections (Sprint 7: Field selection)
  const projectsFieldList = parseFields(projects_fields);
  const resultsFieldList = parseFields(results_fields);
  const conversationsFieldList = parseFields(conversations_fields);

  try {
    const response = {};
    const promises = [];

    // Fetch projects if requested
    if (projects === 'true') {
      promises.push(
        sql`SELECT * FROM projects ORDER BY created_at DESC`
          .then(data => {
            // Apply field selection if requested (Sprint 7: Field selection)
            response.projects = projectsFieldList ? projectFieldsArray(data, projectsFieldList) : data;
          })
          .catch(err => {
            logger.error('Batch: Failed to fetch projects', err);
            response.projects = { error: 'Failed to fetch projects' };
          })
      );
    }

    // Fetch results if requested
    if (results === 'true') {
      const resultsQuery = project_id
        ? sql`SELECT * FROM extraction_results WHERE project_id = ${project_id} ORDER BY extraction_date DESC LIMIT 100`
        : sql`SELECT * FROM extraction_results ORDER BY extraction_date DESC LIMIT 100`;

      promises.push(
        resultsQuery
          .then(data => {
            // Apply field selection if requested (Sprint 7: Field selection)
            response.results = resultsFieldList ? projectFieldsArray(data, resultsFieldList) : data;
          })
          .catch(err => {
            logger.error('Batch: Failed to fetch results', err);
            response.results = { error: 'Failed to fetch results' };
          })
      );
    }

    // Fetch conversations if requested
    if (conversations === 'true' && project_id) {
      promises.push(
        sql`SELECT * FROM conversations WHERE project_id = ${project_id} ORDER BY last_message_at DESC`
          .then(data => {
            // Apply field selection if requested (Sprint 7: Field selection)
            response.conversations = conversationsFieldList ? projectFieldsArray(data, conversationsFieldList) : data;
          })
          .catch(err => {
            logger.error('Batch: Failed to fetch conversations', err);
            response.conversations = { error: 'Failed to fetch conversations' };
          })
      );
    }

    // Fetch analytics if requested (from materialized view)
    if (analytics === 'true' && project_id) {
      promises.push(
        sql`SELECT * FROM project_analytics WHERE project_id = ${project_id}`
          .then(data => { response.analytics = data[0] || null; })
          .catch(err => {
            logger.error('Batch: Failed to fetch analytics', err);
            response.analytics = { error: 'Failed to fetch analytics' };
          })
      );
    }

    // Wait for all requests to complete
    await Promise.all(promises);

    const duration = Date.now() - startTime;
    logger.info(`Batch request completed in ${duration}ms`);

    res.json(response);
  } catch (error) {
    logger.error('Batch endpoint error', error);
    res.status(500).json({ error: 'Failed to process batch request' });
  }
});

export default router;
