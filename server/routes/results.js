import express from 'express';
import { sql } from '../db.js';
import { validateResult, validateBulkResults, validateBulkDelete } from '../middleware/validation.js';
import logger from '../utils/logger.js';

const router = express.Router();

// GET all results (optionally filter by project_id, with pagination)
router.get('/', async (req, res) => {
  try {
    const { project_id, page, limit, status, confidence } = req.query;

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

    // Return with pagination metadata if page/limit was requested
    if (page || limit) {
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
    } else {
      // Backward compatible: return just the array
      res.json(results);
    }
  } catch (error) {
    logger.error('Error fetching results', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// GET single result
router.get('/:id', async (req, res) => {
  try {
    const [result] = await sql`SELECT * FROM extraction_results WHERE id = ${req.params.id}`;
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }
    res.json(result);
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

    res.status(201).json(result);
  } catch (error) {
    logger.error('Error creating result', error);
    res.status(500).json({ error: 'Failed to create result' });
  }
});

// POST bulk create results
router.post('/bulk', validateBulkResults, async (req, res) => {
  try {
    const { results } = req.body;

    const created = [];
    for (const result of results) {
      const {
        id, project_id, school_name, program_name, tuition_amount,
        tuition_period, academic_year, cost_per_credit, total_credits,
        program_length, remarks, location_data, confidence_score,
        status, source_url, validated_sources, extraction_date, raw_content,
        actual_program_name, user_comments
      } = result;

      const [inserted] = await sql`
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

      created.push(inserted);
    }

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
      actual_program_name, user_comments, is_stem, updated_at
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
        updated_at = COALESCE(${updated_at}, updated_at)
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

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

// GET analytics data for a project (US1.1 - Statistics Cards)
router.get('/analytics/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

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

    if (results.length === 0) {
      return res.json({
        avgTuition: 0,
        highestTuition: null,
        lowestTuition: null,
        totalPrograms: 0,
        successRate: 0,
        stemPrograms: 0,
        nonStemPrograms: 0,
        totalResults: 0
      });
    }

    // Parse tuition amounts and calculate metrics
    const tuitionValues = results
      .map(r => {
        const parsed = parseFloat(r.tuition_amount.replace(/[^0-9.]/g, '') || '0');
        return { ...r, parsedAmount: parsed };
      })
      .filter(r => r.parsedAmount > 0);

    if (tuitionValues.length === 0) {
      return res.json({
        avgTuition: 0,
        highestTuition: null,
        lowestTuition: null,
        totalPrograms: results.length,
        successRate: 0,
        stemPrograms: results.filter(r => r.is_stem).length,
        nonStemPrograms: results.filter(r => !r.is_stem).length,
        totalResults: results.length
      });
    }

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

    res.json({
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
    });
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
