import express from 'express';
import { sql } from '../db.js';

const router = express.Router();

// GET all results (optionally filter by project_id)
router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;

    let results;
    if (project_id) {
      results = await sql`
        SELECT * FROM extraction_results
        WHERE project_id = ${project_id}
        ORDER BY extraction_date DESC
      `;
    } else {
      results = await sql`SELECT * FROM extraction_results ORDER BY extraction_date DESC`;
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching results:', error);
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
    console.error('Error fetching result:', error);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

// POST create result
router.post('/', async (req, res) => {
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
    console.error('Error creating result:', error);
    res.status(500).json({ error: 'Failed to create result' });
  }
});

// POST bulk create results
router.post('/bulk', async (req, res) => {
  try {
    const { results } = req.body;

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'Results array is required' });
    }

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
    console.error('Error bulk creating results:', error);
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
      actual_program_name, user_comments, is_stem
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
        is_stem = CASE WHEN ${is_stem}::boolean IS NULL THEN is_stem ELSE ${is_stem}::boolean END
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error updating result:', error);
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
    console.error('Error deleting result:', error);
    res.status(500).json({ error: 'Failed to delete result' });
  }
});

// DELETE bulk results
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array is required' });
    }

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
    console.error('Error bulk deleting results:', error);
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
    console.error('Error fetching result history:', error);
    res.status(500).json({ error: 'Failed to fetch result history' });
  }
});

// GET historical trends data for line chart (all results with multiple versions)
router.get('/trends/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get all results for this project with their versions
    const trends = await sql`
      SELECT
        school_name,
        program_name,
        tuition_amount,
        extraction_version,
        extracted_at,
        academic_year
      FROM extraction_results
      WHERE project_id = ${projectId}
        AND status = 'Success'
        AND tuition_amount IS NOT NULL
      ORDER BY school_name, program_name, extraction_version ASC
    `;

    res.json(trends);
  } catch (error) {
    console.error('Error fetching trends data:', error);
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
    console.error('Error creating new version:', error);
    res.status(500).json({ error: 'Failed to create new version' });
  }
});

export default router;
