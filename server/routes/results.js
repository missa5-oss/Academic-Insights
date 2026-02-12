import express from 'express';
import { sql } from '../db.js';
import { validateResult, validateBulkResults, validateBulkDelete } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { cache, getAnalyticsCacheKey, invalidateAnalyticsCache, setCacheHeaders } from '../utils/cache.js';
import { refreshProjectAnalyticsForProject } from '../utils/materializedView.js';
import { parseFields, projectFieldsArray } from '../utils/fieldSelection.js';
import crypto from 'crypto';
import quotaGuard from '../middleware/quotaGuard.js';

const router = express.Router();

// GET all results (optionally filter by project_id, with pagination, field selection)
router.get('/', async (req, res) => {
  try {
    const { project_id, page, limit, status, confidence, fields } = req.query;

    // Parse field selection (Sprint 7: Field selection)
    const selectedFields = parseFields(fields);

    // Pagination defaults
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 100));
    const offset = (pageNum - 1) * limitNum;

    let results;
    let totalCount;

    if (project_id) {
      // Build dynamic query based on filters
      if (status && confidence) {
        results = await sql`
          SELECT * FROM extraction_results
          WHERE project_id = ${project_id}
            AND status = ${status}
            AND confidence_score = ${confidence}
          ORDER BY extraction_date DESC
          LIMIT ${limitNum} OFFSET ${offset}
        `;
        const [countResult] = await sql`
          SELECT COUNT(*) as count FROM extraction_results
          WHERE project_id = ${project_id}
            AND status = ${status}
            AND confidence_score = ${confidence}
        `;
        totalCount = parseInt(countResult.count);
      } else if (status) {
        results = await sql`
          SELECT * FROM extraction_results
          WHERE project_id = ${project_id}
            AND status = ${status}
          ORDER BY extraction_date DESC
          LIMIT ${limitNum} OFFSET ${offset}
        `;
        const [countResult] = await sql`
          SELECT COUNT(*) as count FROM extraction_results
          WHERE project_id = ${project_id}
            AND status = ${status}
        `;
        totalCount = parseInt(countResult.count);
      } else if (confidence) {
        results = await sql`
          SELECT * FROM extraction_results
          WHERE project_id = ${project_id}
            AND confidence_score = ${confidence}
          ORDER BY extraction_date DESC
          LIMIT ${limitNum} OFFSET ${offset}
        `;
        const [countResult] = await sql`
          SELECT COUNT(*) as count FROM extraction_results
          WHERE project_id = ${project_id}
            AND confidence_score = ${confidence}
        `;
        totalCount = parseInt(countResult.count);
      } else {
        results = await sql`
          SELECT * FROM extraction_results
          WHERE project_id = ${project_id}
          ORDER BY extraction_date DESC
          LIMIT ${limitNum} OFFSET ${offset}
        `;
        const [countResult] = await sql`
          SELECT COUNT(*) as count FROM extraction_results
          WHERE project_id = ${project_id}
        `;
        totalCount = parseInt(countResult.count);
      }
    } else {
      results = await sql`
        SELECT * FROM extraction_results
        ORDER BY extraction_date DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
      const [countResult] = await sql`SELECT COUNT(*) as count FROM extraction_results`;
      totalCount = parseInt(countResult.count);
    }

    // Apply field selection if requested (Sprint 7: Field selection)
    const filteredResults = selectedFields ? projectFieldsArray(results, selectedFields) : results;

    // Return with pagination metadata if page/limit was requested
    if (page || limit) {
      res.json({
        data: filteredResults,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
          hasMore: offset + results.length < totalCount
        }
      });
    } else {
      // Backward compatible: return just the array
      res.json(filteredResults);
    }
  } catch (error) {
    logger.error('Error fetching results', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// GET single result
router.get('/:id', async (req, res) => {
  try {
    const { fields } = req.query;
    const selectedFields = parseFields(fields);

    const [result] = await sql`SELECT * FROM extraction_results WHERE id = ${req.params.id}`;
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Apply field selection if requested (Sprint 7: Field selection)
    const filteredResult = selectedFields ? projectFieldsArray([result], selectedFields)[0] : result;
    res.json(filteredResult);
  } catch (error) {
    logger.error('Error fetching result', error);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

// POST create result
router.post('/', validateResult, async (req, res) => {
  try {
    const {
      id, project_id, school_name, program_name, tuition_amount,
      tuition_period, academic_year, cost_per_credit, total_credits,
      program_length, remarks, location_data, confidence_score,
      status, source_url, validated_sources, extraction_date, raw_content,
      actual_program_name, user_comments
    } = req.body;

    const [result] = await sql`
      INSERT INTO extraction_results (
        id, project_id, school_name, program_name, tuition_amount,
        tuition_period, academic_year, cost_per_credit, total_credits,
        program_length, remarks, location_data, confidence_score,
        status, source_url, validated_sources, extraction_date, raw_content,
        actual_program_name, user_comments
      )
      VALUES (
        ${id}, ${project_id}, ${school_name}, ${program_name}, ${tuition_amount},
        ${tuition_period}, ${academic_year}, ${cost_per_credit}, ${total_credits},
        ${program_length}, ${remarks}, ${JSON.stringify(location_data)}, ${confidence_score},
        ${status}, ${source_url}, ${JSON.stringify(validated_sources)}, ${extraction_date}, ${raw_content},
        ${actual_program_name || null}, ${user_comments || null}
      )
      RETURNING *
    `;

    // Sprint 5: Invalidate analytics cache and refresh materialized view
    invalidateAnalyticsCache(project_id);
    // Refresh materialized view asynchronously (don't block response)
    refreshProjectAnalyticsForProject(project_id).catch(err => 
      logger.warn('Failed to refresh materialized view', err)
    );

    res.status(201).json(result);
  } catch (error) {
    logger.error('Error creating result', error);
    res.status(500).json({ error: 'Failed to create result' });
  }
});

// POST bulk create results
router.post('/bulk', validateBulkResults, quotaGuard, async (req, res) => {
  try {
    const { results } = req.body;

    // Optimized: Single bulk insert instead of N+1 pattern
    // Use PostgreSQL's array-based bulk insert with UNNEST
    if (results.length === 0) {
      return res.status(201).json([]);
    }

    // Phase 3: Check if we have enough quota for this bulk operation
    const { getQuotaStatus } = await import('../utils/quotaTracker.js');
    const estimatedQueries = results.length; // Each result typically requires 1 search
    const quotaStatus = await getQuotaStatus();

    if (quotaStatus && quotaStatus.remaining < estimatedQueries) {
      logger.warn('Insufficient quota for bulk operation', {
        required: estimatedQueries,
        remaining: quotaStatus.remaining
      });
      return res.status(429).json({
        error: 'Insufficient quota for bulk operation',
        message: `This operation requires approximately ${estimatedQueries} queries, but only ${quotaStatus.remaining} remain today. Please reduce the batch size or try again tomorrow.`,
        quotaStatus: {
          used: quotaStatus.used,
          limit: quotaStatus.limit,
          remaining: quotaStatus.remaining
        }
      });
    }

    // Prepare arrays for bulk insert using UNNEST
    const ids = results.map(r => r.id);
    const projectIds = results.map(r => r.project_id);
    const schoolNames = results.map(r => r.school_name);
    const programNames = results.map(r => r.program_name);
    const tuitionAmounts = results.map(r => r.tuition_amount);
    const tuitionPeriods = results.map(r => r.tuition_period);
    const academicYears = results.map(r => r.academic_year);
    const costPerCredits = results.map(r => r.cost_per_credit);
    const totalCredits = results.map(r => r.total_credits);
    const programLengths = results.map(r => r.program_length);
    const remarksList = results.map(r => r.remarks);
    const locationDataList = results.map(r => r.location_data ? JSON.stringify(r.location_data) : null);
    const confidenceScores = results.map(r => r.confidence_score);
    const statuses = results.map(r => r.status);
    const sourceUrls = results.map(r => r.source_url);
    const validatedSourcesList = results.map(r => r.validated_sources ? JSON.stringify(r.validated_sources) : '[]');
    const extractionDates = results.map(r => r.extraction_date);
    const rawContents = results.map(r => r.raw_content);
    const actualProgramNames = results.map(r => r.actual_program_name || null);
    const userCommentsList = results.map(r => r.user_comments || null);

    // Execute bulk insert using UNNEST (PostgreSQL array pattern)
    // This is much faster than individual inserts
    const created = await sql`
      INSERT INTO extraction_results (
        id, project_id, school_name, program_name, tuition_amount,
        tuition_period, academic_year, cost_per_credit, total_credits,
        program_length, remarks, location_data, confidence_score,
        status, source_url, validated_sources, extraction_date, raw_content,
        actual_program_name, user_comments
      )
      SELECT
        unnest(${ids}::text[]) as id,
        unnest(${projectIds}::text[]) as project_id,
        unnest(${schoolNames}::text[]) as school_name,
        unnest(${programNames}::text[]) as program_name,
        unnest(${tuitionAmounts}::text[]) as tuition_amount,
        unnest(${tuitionPeriods}::text[]) as tuition_period,
        unnest(${academicYears}::text[]) as academic_year,
        unnest(${costPerCredits}::text[]) as cost_per_credit,
        unnest(${totalCredits}::text[]) as total_credits,
        unnest(${programLengths}::text[]) as program_length,
        unnest(${remarksList}::text[]) as remarks,
        NULLIF(unnest(${locationDataList}::text[]), 'null')::jsonb as location_data,
        unnest(${confidenceScores}::text[]) as confidence_score,
        unnest(${statuses}::text[]) as status,
        unnest(${sourceUrls}::text[]) as source_url,
        unnest(${validatedSourcesList}::text[])::jsonb as validated_sources,
        unnest(${extractionDates}::text[]) as extraction_date,
        unnest(${rawContents}::text[]) as raw_content,
        unnest(${actualProgramNames}::text[]) as actual_program_name,
        unnest(${userCommentsList}::text[]) as user_comments
      RETURNING *
    `;

    // Sprint 5: Invalidate analytics cache and refresh materialized view for affected projects
    const affectedProjectIds = [...new Set(results.map(r => r.project_id))];
    affectedProjectIds.forEach(projectId => {
      invalidateAnalyticsCache(projectId);
      // Refresh materialized view asynchronously
      refreshProjectAnalyticsForProject(projectId).catch(err => 
        logger.warn('Failed to refresh materialized view', err)
      );
    });

    res.status(201).json(created);
  } catch (error) {
    logger.error('Error bulk creating results', error);
    res.status(500).json({ error: 'Failed to bulk create results' });
  }
});

// PUT update result
router.put('/:id', async (req, res) => {
  try {
    const {
      tuition_amount, tuition_period, academic_year, cost_per_credit,
      total_credits, program_length, remarks, location_data,
      confidence_score, status, source_url, validated_sources,
      extraction_date, raw_content, is_flagged,
      actual_program_name, user_comments, is_stem, updated_at,
      verification, verification_status, retry_count
    } = req.body;

    const [result] = await sql`
      UPDATE extraction_results
      SET
        tuition_amount = COALESCE(${tuition_amount}, tuition_amount),
        tuition_period = COALESCE(${tuition_period}, tuition_period),
        academic_year = COALESCE(${academic_year}, academic_year),
        cost_per_credit = COALESCE(${cost_per_credit}, cost_per_credit),
        total_credits = COALESCE(${total_credits}, total_credits),
        program_length = COALESCE(${program_length}, program_length),
        remarks = COALESCE(${remarks}, remarks),
        location_data = COALESCE(${location_data ? JSON.stringify(location_data) : null}, location_data),
        confidence_score = COALESCE(${confidence_score}, confidence_score),
        status = COALESCE(${status}, status),
        source_url = COALESCE(${source_url}, source_url),
        validated_sources = COALESCE(${validated_sources ? JSON.stringify(validated_sources) : null}, validated_sources),
        extraction_date = COALESCE(${extraction_date}, extraction_date),
        raw_content = COALESCE(${raw_content}, raw_content),
        is_flagged = CASE WHEN ${is_flagged}::boolean IS NULL THEN is_flagged ELSE ${is_flagged}::boolean END,
        actual_program_name = COALESCE(${actual_program_name}, actual_program_name),
        user_comments = COALESCE(${user_comments}, user_comments),
        is_stem = CASE WHEN ${is_stem}::boolean IS NULL THEN is_stem ELSE ${is_stem}::boolean END,
        updated_at = COALESCE(${updated_at}, updated_at),
        verification_data = COALESCE(${verification ? JSON.stringify(verification) : null}, verification_data),
        verification_status = COALESCE(${verification_status}, verification_status),
        retry_count = COALESCE(${retry_count}, retry_count)
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Sprint 5: Invalidate analytics cache and refresh materialized view
    invalidateAnalyticsCache(result.project_id);
    refreshProjectAnalyticsForProject(result.project_id).catch(err => 
      logger.warn('Failed to refresh materialized view', err)
    );

    res.json(result);
  } catch (error) {
    logger.error('Error updating result', error);
    res.status(500).json({ error: 'Failed to update result' });
  }
});

// DELETE result
router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`
      DELETE FROM extraction_results
      WHERE id = ${req.params.id}
      RETURNING id, project_id
    `;

    if (!deleted) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Sprint 5: Invalidate analytics cache and refresh materialized view
    invalidateAnalyticsCache(deleted.project_id);
    refreshProjectAnalyticsForProject(deleted.project_id).catch(err => 
      logger.warn('Failed to refresh materialized view', err)
    );

    res.json({ message: 'Result deleted successfully', id: deleted.id, project_id: deleted.project_id });
  } catch (error) {
    logger.error('Error deleting result', error);
    res.status(500).json({ error: 'Failed to delete result' });
  }
});

// DELETE bulk results
router.post('/bulk-delete', validateBulkDelete, async (req, res) => {
  try {
    const { ids } = req.body;

    const deleted = await sql`
      DELETE FROM extraction_results
      WHERE id = ANY(${ids})
      RETURNING id, project_id
    `;

    // Sprint 5: Invalidate analytics cache and refresh materialized view for affected projects
    const affectedProjectIds = [...new Set(deleted.map(d => d.project_id))];
    affectedProjectIds.forEach(projectId => {
      invalidateAnalyticsCache(projectId);
      refreshProjectAnalyticsForProject(projectId).catch(err => 
        logger.warn('Failed to refresh materialized view', err)
      );
    });

    res.json({
      message: `${deleted.length} results deleted successfully`,
      deleted
    });
  } catch (error) {
    logger.error('Error bulk deleting results', error);
    res.status(500).json({ error: 'Failed to bulk delete results' });
  }
});

// GET version history for a specific result (all versions of same school/program)
router.get('/:id/history', async (req, res) => {
  try {
    const [current] = await sql`SELECT * FROM extraction_results WHERE id = ${req.params.id}`;

    if (!current) {
      return res.status(404).json({ error: 'Result not found' });
    }

    // Get all versions for this school/program in this project
    const history = await sql`
      SELECT * FROM extraction_results
      WHERE project_id = ${current.project_id}
        AND school_name = ${current.school_name}
        AND program_name = ${current.program_name}
      ORDER BY extraction_version DESC
    `;

    res.json(history);
  } catch (error) {
    logger.error('Error fetching result history', error);
    res.status(500).json({ error: 'Failed to fetch result history' });
  }
});

// GET historical trends data for line chart (aggregated by extraction date)
router.get('/trends/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get all results for this project, grouped by extraction date
    const rawTrends = await sql`
      SELECT
        TO_CHAR(extracted_at, 'YYYY-MM') as date,
        tuition_amount,
        extraction_version,
        extracted_at
      FROM extraction_results
      WHERE project_id = ${projectId}
        AND status = 'Success'
        AND tuition_amount IS NOT NULL
      ORDER BY extracted_at ASC
    `;

    if (rawTrends.length === 0) {
      return res.json([]);
    }

    // Aggregate by date: calculate average tuition per month
    const trendsMap = new Map();

    rawTrends.forEach((result) => {
      const date = result.date;
      const amount = parseFloat(result.tuition_amount.replace(/[^0-9.]/g, '') || '0');

      if (!trendsMap.has(date)) {
        trendsMap.set(date, { amounts: [], count: 0 });
      }

      const trend = trendsMap.get(date);
      if (amount > 0) {
        trend.amounts.push(amount);
        trend.count++;
      }
    });

    // Convert map to array and calculate averages
    const trends = Array.from(trendsMap.entries())
      .map(([date, data]) => ({
        date,
        avgTuition: data.amounts.length > 0
          ? Math.round(data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length)
          : 0,
        count: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(trends);
  } catch (error) {
    logger.error('Error fetching trends data', error);
    res.status(500).json({ error: 'Failed to fetch trends data' });
  }
});

// POST create new version (track price update)
// This creates a new version of an existing result for historical tracking
router.post('/:id/new-version', async (req, res) => {
  try {
    const [current] = await sql`SELECT * FROM extraction_results WHERE id = ${req.params.id}`;

    if (!current) {
      return res.status(404).json({ error: 'Result not found' });
    }

    const {
      id: newId,
      tuition_amount,
      tuition_period,
      academic_year,
      cost_per_credit,
      total_credits,
      program_length,
      remarks,
      location_data,
      confidence_score,
      status,
      source_url,
      validated_sources,
      extraction_date,
      raw_content
    } = req.body;

    // Create new version with incremented version number
    const [newVersion] = await sql`
      INSERT INTO extraction_results (
        id, project_id, school_name, program_name, tuition_amount, tuition_period,
        academic_year, cost_per_credit, total_credits, program_length, remarks,
        location_data, confidence_score, status, source_url, validated_sources,
        extraction_date, raw_content, extraction_version, extracted_at
      ) VALUES (
        ${newId},
        ${current.project_id},
        ${current.school_name},
        ${current.program_name},
        ${tuition_amount},
        ${tuition_period},
        ${academic_year},
        ${cost_per_credit},
        ${total_credits},
        ${program_length},
        ${remarks},
        ${location_data ? JSON.stringify(location_data) : null},
        ${confidence_score},
        ${status},
        ${source_url},
        ${validated_sources ? JSON.stringify(validated_sources) : '[]'},
        ${extraction_date},
        ${raw_content},
        ${current.extraction_version + 1},
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    res.json(newVersion);
  } catch (error) {
    logger.error('Error creating new version', error);
    res.status(500).json({ error: 'Failed to create new version' });
  }
});

// ==========================================
// Dashboard Enhancement: Cross-Project Analytics Endpoints
// NOTE: These static routes MUST come BEFORE the dynamic :projectId route
// ==========================================

// GET /api/analytics/cross-project - Aggregate stats across all projects
router.get('/analytics/cross-project', async (req, res) => {
  try {
    const cacheKey = 'cross-project-analytics';

    // Check cache first (5-minute TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      setCacheHeaders(res, 300);
      res.set('X-Cache-Status', 'HIT');
      return res.json(cached);
    }

    setCacheHeaders(res, 300);
    res.set('X-Cache-Status', 'MISS');

    // Get all successful results across all projects
    const results = await sql`
      SELECT
        r.tuition_amount,
        r.is_stem,
        r.extracted_at,
        r.project_id,
        p.name as project_name
      FROM extraction_results r
      JOIN projects p ON r.project_id = p.id
      WHERE r.status = 'Success'
        AND r.tuition_amount IS NOT NULL
    `;

    // Parse tuition amounts
    const tuitionValues = results
      .map(r => ({
        ...r,
        parsedAmount: parseFloat(r.tuition_amount.replace(/[^0-9.]/g, '') || '0')
      }))
      .filter(r => r.parsedAmount > 0);

    let analyticsData;

    if (tuitionValues.length === 0) {
      analyticsData = {
        avgTuition: 0,
        tuitionRange: { min: 0, max: 0 },
        totalPrograms: 0,
        stemPercentage: 0,
        stemCount: 0,
        nonStemCount: 0,
        recentExtractions: 0,
        projectBreakdown: []
      };
    } else {
      // Calculate aggregate statistics
      const sum = tuitionValues.reduce((acc, r) => acc + r.parsedAmount, 0);
      const avgTuition = Math.round(sum / tuitionValues.length);

      const minTuition = Math.min(...tuitionValues.map(r => r.parsedAmount));
      const maxTuition = Math.max(...tuitionValues.map(r => r.parsedAmount));

      const stemCount = tuitionValues.filter(r => r.is_stem === true).length;
      const nonStemCount = tuitionValues.filter(r => r.is_stem === false).length;
      const stemPercentage = Math.round((stemCount / tuitionValues.length) * 100);

      // Count recent extractions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentExtractions = tuitionValues.filter(r =>
        new Date(r.extracted_at) >= sevenDaysAgo
      ).length;

      // Project breakdown
      const projectMap = new Map();
      tuitionValues.forEach(r => {
        if (!projectMap.has(r.project_id)) {
          projectMap.set(r.project_id, {
            projectId: r.project_id,
            name: r.project_name,
            sum: 0,
            count: 0
          });
        }
        const project = projectMap.get(r.project_id);
        project.sum += r.parsedAmount;
        project.count += 1;
      });

      const projectBreakdown = Array.from(projectMap.values()).map(p => ({
        projectId: p.projectId,
        name: p.name,
        avgTuition: Math.round(p.sum / p.count),
        count: p.count
      }));

      analyticsData = {
        avgTuition,
        tuitionRange: { min: Math.round(minTuition), max: Math.round(maxTuition) },
        totalPrograms: tuitionValues.length,
        stemPercentage,
        stemCount,
        nonStemCount,
        recentExtractions,
        projectBreakdown
      };
    }

    // Cache for 5 minutes
    cache.set(cacheKey, analyticsData, 5 * 60 * 1000);

    res.json(analyticsData);
  } catch (error) {
    logger.error('Error fetching cross-project analytics', error);
    res.status(500).json({ error: 'Failed to fetch cross-project analytics' });
  }
});

// GET /api/analytics/market-position - Data for scatter plot
router.get('/analytics/market-position', async (req, res) => {
  try {
    const cacheKey = 'market-position-data';

    // Check cache first (5-minute TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      setCacheHeaders(res, 300);
      res.set('X-Cache-Status', 'HIT');
      return res.json(cached);
    }

    setCacheHeaders(res, 300);
    res.set('X-Cache-Status', 'MISS');

    // Get all successful results with tuition data
    const results = await sql`
      SELECT
        r.tuition_amount,
        r.is_stem,
        r.school_name,
        r.program_name,
        r.project_id,
        p.name as project_name
      FROM extraction_results r
      JOIN projects p ON r.project_id = p.id
      WHERE r.status = 'Success'
        AND r.tuition_amount IS NOT NULL
    `;

    // Parse and format data for scatter plot
    const data = results
      .map(r => {
        const tuition = parseFloat(r.tuition_amount.replace(/[^0-9.]/g, '') || '0');
        if (tuition <= 0) return null;
        return {
          tuition,
          isStem: r.is_stem || false,
          school: r.school_name,
          program: r.program_name,
          projectId: r.project_id,
          projectName: r.project_name
        };
      })
      .filter(r => r !== null);

    const response = { data };

    // Cache for 5 minutes
    cache.set(cacheKey, response, 5 * 60 * 1000);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching market position data', error);
    res.status(500).json({ error: 'Failed to fetch market position data' });
  }
});

// GET /api/analytics/tuition-distribution - Histogram bin data
router.get('/analytics/tuition-distribution', async (req, res) => {
  try {
    const cacheKey = 'tuition-distribution';

    // Check cache first (5-minute TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      setCacheHeaders(res, 300);
      res.set('X-Cache-Status', 'HIT');
      return res.json(cached);
    }

    setCacheHeaders(res, 300);
    res.set('X-Cache-Status', 'MISS');

    // Get all successful results
    const results = await sql`
      SELECT tuition_amount
      FROM extraction_results
      WHERE status = 'Success'
        AND tuition_amount IS NOT NULL
    `;

    // Parse tuition amounts
    const tuitionValues = results
      .map(r => parseFloat(r.tuition_amount.replace(/[^0-9.]/g, '') || '0'))
      .filter(t => t > 0);

    // Calculate histogram bins
    const bins = [
      { range: '0-30k', min: 0, max: 30000, count: 0 },
      { range: '30-50k', min: 30000, max: 50000, count: 0 },
      { range: '50-70k', min: 50000, max: 70000, count: 0 },
      { range: '70k+', min: 70000, max: Infinity, count: 0 }
    ];

    tuitionValues.forEach(tuition => {
      const bin = bins.find(b => tuition >= b.min && tuition < b.max);
      if (bin) bin.count++;
    });

    // Calculate percentages
    const total = tuitionValues.length;
    const binsWithPercentage = bins.map(b => ({
      range: b.range,
      count: b.count,
      percentage: total > 0 ? parseFloat(((b.count / total) * 100).toFixed(1)) : 0
    }));

    const response = { bins: binsWithPercentage };

    // Cache for 5 minutes
    cache.set(cacheKey, response, 5 * 60 * 1000);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching tuition distribution', error);
    res.status(500).json({ error: 'Failed to fetch tuition distribution' });
  }
});

// GET /api/analytics/data-quality - Health metrics
router.get('/analytics/data-quality', async (req, res) => {
  try {
    const cacheKey = 'data-quality-metrics';

    // Check cache first (5-minute TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      setCacheHeaders(res, 300);
      res.set('X-Cache-Status', 'HIT');
      return res.json(cached);
    }

    setCacheHeaders(res, 300);
    res.set('X-Cache-Status', 'MISS');

    // Get status breakdown
    const statusResults = await sql`
      SELECT
        status,
        COUNT(*) as count
      FROM extraction_results
      GROUP BY status
    `;

    const statusBreakdown = {};
    let totalCount = 0;
    let successCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let flaggedCount = 0;

    statusResults.forEach(r => {
      const count = parseInt(r.count);
      statusBreakdown[r.status] = count;
      totalCount += count;

      if (r.status === 'Success') successCount = count;
      if (r.status === 'Failed') failedCount = count;
      if (r.status === 'Pending') pendingCount = count;
    });

    // Get flagged count
    const [flaggedResult] = await sql`
      SELECT COUNT(*) as count
      FROM extraction_results
      WHERE is_flagged = true
    `;
    flaggedCount = parseInt(flaggedResult.count);

    // Calculate average age of extractions
    const [ageResult] = await sql`
      SELECT AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - extracted_at)) / 86400) as avg_days
      FROM extraction_results
      WHERE extracted_at IS NOT NULL
    `;
    const staleDays = Math.round(parseFloat(ageResult.avg_days) || 0);

    const successRate = totalCount > 0 ? parseFloat(((successCount / totalCount) * 100).toFixed(1)) : 0;

    const dataQuality = {
      successRate,
      staleDays,
      flaggedCount,
      failedCount,
      pendingCount,
      statusBreakdown
    };

    // Cache for 5 minutes
    cache.set(cacheKey, dataQuality, 5 * 60 * 1000);

    res.json(dataQuality);
  } catch (error) {
    logger.error('Error fetching data quality metrics', error);
    res.status(500).json({ error: 'Failed to fetch data quality metrics' });
  }
});

// GET /api/analytics/recent-activity - Last 30 days extraction trend
router.get('/analytics/recent-activity', async (req, res) => {
  try {
    const cacheKey = 'recent-activity-trend';

    // Check cache first (5-minute TTL)
    const cached = cache.get(cacheKey);
    if (cached) {
      setCacheHeaders(res, 300);
      res.set('X-Cache-Status', 'HIT');
      return res.json(cached);
    }

    setCacheHeaders(res, 300);
    res.set('X-Cache-Status', 'MISS');

    // Get daily extraction counts for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const results = await sql`
      SELECT
        DATE(extracted_at) as date,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'Success') as success_count,
        COUNT(*) FILTER (WHERE status IN ('Failed', 'Not Found')) as failure_count
      FROM extraction_results
      WHERE extracted_at >= ${thirtyDaysAgo.toISOString()}
      GROUP BY DATE(extracted_at)
      ORDER BY date ASC
    `;

    const activityData = results.map(r => ({
      date: r.date,
      successCount: parseInt(r.success_count),
      failureCount: parseInt(r.failure_count),
      totalCount: parseInt(r.total_count)
    }));

    const response = { data: activityData };

    // Cache for 5 minutes
    cache.set(cacheKey, response, 5 * 60 * 1000);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching recent activity', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});

// GET analytics data for a project (US1.1 - Statistics Cards)
// Sprint 5: Performance Optimization - Added response caching
router.get('/analytics/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Generate data hash to detect changes (for cache invalidation)
    // Hash is based on count and last update timestamp
    const [dataHashRow] = await sql`
      SELECT 
        COUNT(*) as count,
        MAX(extracted_at) as last_update
      FROM extraction_results
      WHERE project_id = ${projectId}
    `;
    
    const dataHash = crypto
      .createHash('md5')
      .update(`${dataHashRow.count}-${dataHashRow.last_update}`)
      .digest('hex');

    const cacheKey = getAnalyticsCacheKey(projectId, dataHash);
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      setCacheHeaders(res, 300);
      res.set('X-Cache-Status', 'HIT');
      return res.json(cached);
    }

    // Cache miss - fetch from database
    setCacheHeaders(res, 300);
    res.set('X-Cache-Status', 'MISS');

    // Get all successful results with tuition data
    const results = await sql`
      SELECT
        school_name,
        program_name,
        tuition_amount,
        status,
        confidence_score,
        is_stem
      FROM extraction_results
      WHERE project_id = ${projectId}
        AND status = 'Success'
        AND tuition_amount IS NOT NULL
      ORDER BY extraction_date DESC
    `;

    let analyticsData;

    if (results.length === 0) {
      analyticsData = {
        avgTuition: 0,
        highestTuition: null,
        lowestTuition: null,
        totalPrograms: 0,
        successRate: 0,
        stemPrograms: 0,
        nonStemPrograms: 0,
        totalResults: 0
      };
    } else {
      // Parse tuition amounts and calculate metrics
      const tuitionValues = results
        .map(r => {
          const parsed = parseFloat(r.tuition_amount.replace(/[^0-9.]/g, '') || '0');
          return { ...r, parsedAmount: parsed };
        })
        .filter(r => r.parsedAmount > 0);

      if (tuitionValues.length === 0) {
        analyticsData = {
          avgTuition: 0,
          highestTuition: null,
          lowestTuition: null,
          totalPrograms: results.length,
          successRate: 0,
          stemPrograms: results.filter(r => r.is_stem).length,
          nonStemPrograms: results.filter(r => !r.is_stem).length,
          totalResults: results.length
        };
      } else {
        // Calculate statistics
        const sum = tuitionValues.reduce((acc, r) => acc + r.parsedAmount, 0);
        const avgTuition = Math.round(sum / tuitionValues.length);

        const highest = tuitionValues.reduce((max, r) =>
          r.parsedAmount > max.parsedAmount ? r : max
        );

        const lowest = tuitionValues.reduce((min, r) =>
          r.parsedAmount < min.parsedAmount ? r : min
        );

        // Get total results for this project to calculate success rate
        const [totalCount] = await sql`
          SELECT COUNT(*) as count FROM extraction_results
          WHERE project_id = ${projectId}
        `;
        const totalResults = parseInt(totalCount.count);
        const successCount = results.length;
        const successRate = totalResults > 0 ? Math.round((successCount / totalResults) * 100) : 0;

        // Count STEM vs non-STEM
        const stemPrograms = results.filter(r => r.is_stem).length;
        const nonStemPrograms = results.filter(r => !r.is_stem).length;

        analyticsData = {
          avgTuition,
          highestTuition: {
            amount: highest.tuition_amount,
            school: highest.school_name,
            program: highest.program_name
          },
          lowestTuition: {
            amount: lowest.tuition_amount,
            school: lowest.school_name,
            program: lowest.program_name
          },
          totalPrograms: results.length,
          successRate,
          stemPrograms,
          nonStemPrograms,
          totalResults
        };
      }
    }

    // Cache the result for 5 minutes
    cache.set(cacheKey, analyticsData, 5 * 60 * 1000);
    
    res.json(analyticsData);
  } catch (error) {
    logger.error('Error fetching analytics data', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// GET analysis history for a project (NEW: US2.5 enhancement)
router.get('/analysis-history/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 10 } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const analyses = await sql`
      SELECT
        id,
        project_id,
        analysis_content,
        metrics,
        data_hash,
        cached,
        created_at
      FROM project_analysis_history
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT ${Math.min(parseInt(limit) || 10, 100)}
    `;

    logger.info(`Fetched ${analyses.length} analysis records for project ${projectId}`);
    res.json(analyses);

  } catch (error) {
    logger.error('Error fetching analysis history', error);
    res.status(500).json({ error: 'Failed to fetch analysis history' });
  }
});

export default router;
