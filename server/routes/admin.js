/**
 * Admin Routes
 *
 * Provides API endpoints for admin dashboard metrics and system health.
 * Sprint 3: Admin Observability & Monitoring
 */

import express from 'express';
import os from 'os';
import { sql } from '../db.js';
import logger from '../utils/logger.js';
import { APP_VERSION } from '../config.js';
import { getApiAnalytics } from '../middleware/apiLogger.js';

const router = express.Router();

// ==========================================
// US3.3: Health Check Endpoints
// ==========================================

/**
 * GET /api/admin/health
 * Detailed health check with component status
 */
router.get('/health', async (req, res) => {
  const startTime = Date.now();

  const health = {
    status: 'healthy',
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    components: {}
  };

  // Check database connectivity
  try {
    const dbStart = Date.now();
    await sql`SELECT 1`;
    health.components.database = {
      status: 'healthy',
      responseTime: Date.now() - dbStart
    };
  } catch (error) {
    health.status = 'degraded';
    health.components.database = {
      status: 'unhealthy',
      error: error.message
    };
  }

  // System metrics
  health.components.system = {
    status: 'healthy',
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      usagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
    },
    cpu: {
      cores: os.cpus().length,
      loadAverage: os.loadavg()
    },
    platform: os.platform(),
    nodeVersion: process.version
  };

  // Check if memory usage is critical (>90%)
  if (health.components.system.memory.usagePercent > 90) {
    health.status = 'degraded';
    health.components.system.status = 'warning';
  }

  health.responseTime = Date.now() - startTime;

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * GET /api/admin/health/live
 * Simple liveness probe for container orchestration
 */
router.get('/health/live', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

/**
 * GET /api/admin/health/ready
 * Readiness probe - checks if app can serve traffic
 */
router.get('/health/ready', async (req, res) => {
  try {
    // Check database is ready
    await sql`SELECT 1`;
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// ==========================================
// US3.4: API Analytics & Metrics
// ==========================================

/**
 * GET /api/admin/metrics
 * Get comprehensive system metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;

    // Get database stats
    const [projectCount] = await sql`SELECT COUNT(*) as count FROM projects`;
    const [resultCount] = await sql`SELECT COUNT(*) as count FROM extraction_results`;
    const [conversationCount] = await sql`SELECT COUNT(*) as count FROM conversations`;

    // Get extraction status breakdown
    const statusBreakdown = await sql`
      SELECT status, COUNT(*) as count
      FROM extraction_results
      GROUP BY status
    `;

    // Get confidence score breakdown
    const confidenceBreakdown = await sql`
      SELECT confidence_score, COUNT(*) as count
      FROM extraction_results
      GROUP BY confidence_score
    `;

    // Get daily extraction counts
    const dailyExtractions = await sql`
      SELECT
        DATE(extracted_at) as date,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'Success') as success_count
      FROM extraction_results
      WHERE extracted_at > NOW() - ${days} * INTERVAL '1 day'
      GROUP BY DATE(extracted_at)
      ORDER BY date DESC
    `;

    // Get API analytics
    let apiAnalytics = null;
    try {
      apiAnalytics = await getApiAnalytics(days);
    } catch (error) {
      logger.warn('Failed to get API analytics', { error: error.message });
    }

    res.json({
      summary: {
        totalProjects: parseInt(projectCount.count),
        totalResults: parseInt(resultCount.count),
        totalConversations: parseInt(conversationCount.count),
        period: `${days} days`
      },
      statusBreakdown: statusBreakdown.map(s => ({
        status: s.status,
        count: parseInt(s.count)
      })),
      confidenceBreakdown: confidenceBreakdown.map(c => ({
        confidence: c.confidence_score,
        count: parseInt(c.count)
      })),
      dailyExtractions: dailyExtractions.map(d => ({
        date: d.date,
        total: parseInt(d.count),
        success: parseInt(d.success_count)
      })),
      apiAnalytics
    });
  } catch (error) {
    logger.error('Failed to get metrics', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /api/admin/api-logs
 * Get recent API logs for debugging
 */
router.get('/api-logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const path = req.query.path;
    const statusCode = req.query.status;

    let logs;
    if (path && statusCode) {
      logs = await sql`
        SELECT * FROM api_logs
        WHERE path LIKE ${`%${path}%`} AND status_code = ${parseInt(statusCode)}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else if (path) {
      logs = await sql`
        SELECT * FROM api_logs
        WHERE path LIKE ${`%${path}%`}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else if (statusCode) {
      logs = await sql`
        SELECT * FROM api_logs
        WHERE status_code = ${parseInt(statusCode)}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    } else {
      logs = await sql`
        SELECT * FROM api_logs
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
    }

    res.json({
      logs,
      count: logs.length,
      filters: { path, statusCode, limit }
    });
  } catch (error) {
    logger.error('Failed to get API logs', error);
    res.status(500).json({ error: 'Failed to retrieve API logs' });
  }
});

/**
 * GET /api/admin/errors
 * Get recent errors for debugging
 */
router.get('/errors', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const errors = await sql`
      SELECT * FROM api_logs
      WHERE status_code >= 400
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    res.json({
      errors,
      count: errors.length
    });
  } catch (error) {
    logger.error('Failed to get errors', error);
    res.status(500).json({ error: 'Failed to retrieve errors' });
  }
});

/**
 * DELETE /api/admin/api-logs
 * Clear old API logs (older than specified days)
 */
router.delete('/api-logs', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const result = await sql`
      DELETE FROM api_logs
      WHERE created_at < NOW() - ${days} * INTERVAL '1 day'
    `;

    logger.info(`Cleared API logs older than ${days} days`);
    res.json({ message: `Cleared logs older than ${days} days`, deletedCount: result.count });
  } catch (error) {
    logger.error('Failed to clear API logs', error);
    res.status(500).json({ error: 'Failed to clear API logs' });
  }
});

/**
 * GET /api/admin/database-stats
 * Get database table statistics
 */
router.get('/database-stats', async (req, res) => {
  try {
    // Get table sizes and row counts
    const tables = ['projects', 'extraction_results', 'conversations', 'conversation_messages', 'project_summaries', 'api_logs'];

    const stats = await Promise.all(tables.map(async (table) => {
      try {
        const [count] = await sql`
          SELECT COUNT(*) as count FROM ${sql(table)}
        `;
        return {
          table,
          rowCount: parseInt(count.count)
        };
      } catch (error) {
        return {
          table,
          rowCount: 0,
          error: error.message
        };
      }
    }));

    res.json({
      tables: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get database stats', error);
    res.status(500).json({ error: 'Failed to retrieve database stats' });
  }
});

// ==========================================
// AI Usage Analytics Endpoints
// ==========================================

/**
 * GET /api/admin/ai-usage
 * Get comprehensive AI usage statistics
 */
router.get('/ai-usage', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const operationType = req.query.operationType; // Optional filter

    // Build query with optional filter
    let totalUsageQuery = sql`
      SELECT 
        COUNT(*) as total_calls,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(AVG(ai_response_time_ms), 0)::INTEGER as avg_response_time,
        COUNT(*) FILTER (WHERE success = true) as success_count,
        COUNT(*) FILTER (WHERE success = false) as failure_count
      FROM ai_usage_logs
      WHERE created_at > NOW() - ${days} * INTERVAL '1 day'
    `;

    if (operationType) {
      totalUsageQuery = sql`
        SELECT 
          COUNT(*) as total_calls,
          COALESCE(SUM(total_tokens), 0) as total_tokens,
          COALESCE(SUM(total_cost), 0) as total_cost,
          COALESCE(AVG(ai_response_time_ms), 0)::INTEGER as avg_response_time,
          COUNT(*) FILTER (WHERE success = true) as success_count,
          COUNT(*) FILTER (WHERE success = false) as failure_count
        FROM ai_usage_logs
        WHERE created_at > NOW() - ${days} * INTERVAL '1 day'
          AND operation_type = ${operationType}
      `;
    }

    const totalUsage = await totalUsageQuery;

    // Usage by operation type
    const usageByOperation = await sql`
      SELECT 
        operation_type,
        COUNT(*) as calls,
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(SUM(total_cost), 0) as cost,
        COALESCE(AVG(ai_response_time_ms), 0)::INTEGER as avg_response_time,
        CASE 
          WHEN COUNT(*) > 0 THEN 
            (COUNT(*) FILTER (WHERE success = true)::FLOAT / COUNT(*) * 100)
          ELSE 0
        END as success_rate
      FROM ai_usage_logs
      WHERE created_at > NOW() - ${days} * INTERVAL '1 day'
      GROUP BY operation_type
      ORDER BY calls DESC
    `;

    // Daily usage
    const dailyUsage = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as calls,
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(SUM(total_cost), 0) as cost,
        COUNT(*) FILTER (WHERE success = false) as failures
      FROM ai_usage_logs
      WHERE created_at > NOW() - ${days} * INTERVAL '1 day'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Tool usage statistics
    const toolUsage = await sql`
      SELECT 
        tool->>'type' as tool_type,
        COUNT(*) as usage_count,
        COUNT(*) FILTER (WHERE (tool->>'success')::boolean = true) as success_count
      FROM ai_usage_logs,
        jsonb_array_elements(COALESCE(tools_used, '[]'::jsonb)) as tool
      WHERE created_at > NOW() - ${days} * INTERVAL '1 day'
        AND tools_used IS NOT NULL
      GROUP BY tool->>'type'
    `;

    // Error breakdown
    const errorBreakdown = await sql`
      SELECT 
        COALESCE(error_type, 'unknown') as error_type,
        COUNT(*) as count
      FROM ai_usage_logs
      WHERE created_at > NOW() - ${days} * INTERVAL '1 day'
        AND success = false
      GROUP BY error_type
      ORDER BY count DESC
    `;

    res.json({
      summary: {
        total_calls: parseInt(totalUsage[0]?.total_calls || 0),
        total_tokens: parseInt(totalUsage[0]?.total_tokens || 0),
        total_cost: parseFloat(totalUsage[0]?.total_cost || 0),
        avg_response_time: parseInt(totalUsage[0]?.avg_response_time || 0),
        success_count: parseInt(totalUsage[0]?.success_count || 0),
        failure_count: parseInt(totalUsage[0]?.failure_count || 0)
      },
      byOperation: usageByOperation.map(op => ({
        operation_type: op.operation_type,
        calls: parseInt(op.calls),
        tokens: parseInt(op.tokens),
        cost: parseFloat(op.cost),
        avg_response_time: parseInt(op.avg_response_time),
        success_rate: parseFloat(op.success_rate)
      })),
      daily: dailyUsage.map(d => ({
        date: d.date,
        calls: parseInt(d.calls),
        tokens: parseInt(d.tokens),
        cost: parseFloat(d.cost),
        failures: parseInt(d.failures)
      })),
      toolUsage: toolUsage.map(t => ({
        tool_type: t.tool_type,
        usage_count: parseInt(t.usage_count),
        success_count: parseInt(t.success_count)
      })),
      errors: errorBreakdown.map(e => ({
        error_type: e.error_type,
        count: parseInt(e.count)
      })),
      period: `${days} days`
    });
  } catch (error) {
    logger.error('Failed to get AI usage', error);
    res.status(500).json({ error: 'Failed to retrieve AI usage' });
  }
});

// ==========================================
// Master Data Endpoint (All Successful Results)
// ==========================================

/**
 * GET /api/admin/master-data
 * Get all successful extraction results across all projects
 * Includes project name for identification
 */
router.get('/master-data', async (req, res) => {
  try {
    const { page, limit } = req.query;

    // Pagination defaults
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 100));
    const offset = (pageNum - 1) * limitNum;

    // Query successful results with project names
    const results = await sql`
      SELECT
        r.*,
        p.name as project_name
      FROM extraction_results r
      LEFT JOIN projects p ON r.project_id = p.id
      WHERE r.status = 'Success'
      ORDER BY r.extraction_date DESC, r.school_name ASC
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    // Get total count for pagination
    const [countResult] = await sql`
      SELECT COUNT(*) as count
      FROM extraction_results
      WHERE status = 'Success'
    `;
    const totalCount = parseInt(countResult.count);

    res.json({
      data: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasMore: offset + results.length < totalCount
      }
    });
  } catch (error) {
    logger.error('Failed to get master data', error);
    res.status(500).json({ error: 'Failed to retrieve master data' });
  }
});

/**
 * GET /api/admin/ai-costs
 * Get detailed cost breakdown
 */
router.get('/ai-costs', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const costs = await sql`
      SELECT 
        DATE(created_at) as date,
        operation_type,
        COALESCE(SUM(input_cost), 0) as input_cost,
        COALESCE(SUM(output_cost), 0) as output_cost,
        COALESCE(SUM(tool_cost), 0) as tool_cost,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM ai_usage_logs
      WHERE created_at > NOW() - ${days} * INTERVAL '1 day'
      GROUP BY DATE(created_at), operation_type
      ORDER BY date DESC, operation_type
    `;

    // Also get totals by operation type
    const totalsByOperation = await sql`
      SELECT 
        operation_type,
        COALESCE(SUM(input_cost), 0) as input_cost,
        COALESCE(SUM(output_cost), 0) as output_cost,
        COALESCE(SUM(tool_cost), 0) as tool_cost,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM ai_usage_logs
      WHERE created_at > NOW() - ${days} * INTERVAL '1 day'
      GROUP BY operation_type
      ORDER BY total_cost DESC
    `;

    res.json({
      costs: costs.map(c => ({
        date: c.date,
        operation_type: c.operation_type,
        input_cost: parseFloat(c.input_cost),
        output_cost: parseFloat(c.output_cost),
        tool_cost: parseFloat(c.tool_cost),
        total_cost: parseFloat(c.total_cost)
      })),
      totalsByOperation: totalsByOperation.map(t => ({
        operation_type: t.operation_type,
        input_cost: parseFloat(t.input_cost),
        output_cost: parseFloat(t.output_cost),
        tool_cost: parseFloat(t.tool_cost),
        total_cost: parseFloat(t.total_cost)
      })),
      period: `${days} days`
    });
  } catch (error) {
    logger.error('Failed to get AI costs', error);
    res.status(500).json({ error: 'Failed to retrieve AI costs' });
  }
});

// ==========================================
// Extraction Details for LLM Observability
// ==========================================

/**
 * GET /api/admin/ai-extraction-details
 * Get detailed extraction logs with full debug info (prompts/responses)
 * Used for LLM observability dashboard
 */
router.get('/ai-extraction-details', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);

    const logs = await sql`
      SELECT
        id,
        endpoint,
        model,
        operation_type,
        input_tokens,
        output_tokens,
        total_tokens,
        tools_used,
        input_cost,
        output_cost,
        tool_cost,
        total_cost,
        ai_response_time_ms,
        retry_count,
        success,
        error_type,
        error_message,
        request_metadata,
        response_metadata,
        created_at
      FROM ai_usage_logs
      WHERE operation_type = 'extraction'
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    res.json({
      logs: logs.map(log => ({
        ...log,
        input_cost: parseFloat(log.input_cost || 0),
        output_cost: parseFloat(log.output_cost || 0),
        tool_cost: parseFloat(log.tool_cost || 0),
        total_cost: parseFloat(log.total_cost || 0)
      })),
      count: logs.length
    });
  } catch (error) {
    logger.error('Failed to get extraction details', error);
    res.status(500).json({ error: 'Failed to retrieve extraction details' });
  }
});

export default router;
