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
      status, source_url, validated_sources, extraction_date, raw_content
    } = req.body;

    const [result] = await sql`
      INSERT INTO extraction_results (
        id, project_id, school_name, program_name, tuition_amount,
        tuition_period, academic_year, cost_per_credit, total_credits,
        program_length, remarks, location_data, confidence_score,
        status, source_url, validated_sources, extraction_date, raw_content
      )
      VALUES (
        ${id}, ${project_id}, ${school_name}, ${program_name}, ${tuition_amount},
        ${tuition_period}, ${academic_year}, ${cost_per_credit}, ${total_credits},
        ${program_length}, ${remarks}, ${JSON.stringify(location_data)}, ${confidence_score},
        ${status}, ${source_url}, ${JSON.stringify(validated_sources)}, ${extraction_date}, ${raw_content}
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
        status, source_url, validated_sources, extraction_date, raw_content
      } = result;

      const [inserted] = await sql`
        INSERT INTO extraction_results (
          id, project_id, school_name, program_name, tuition_amount,
          tuition_period, academic_year, cost_per_credit, total_credits,
          program_length, remarks, location_data, confidence_score,
          status, source_url, validated_sources, extraction_date, raw_content
        )
        VALUES (
          ${id}, ${project_id}, ${school_name}, ${program_name}, ${tuition_amount},
          ${tuition_period}, ${academic_year}, ${cost_per_credit}, ${total_credits},
          ${program_length}, ${remarks}, ${JSON.stringify(location_data)}, ${confidence_score},
          ${status}, ${source_url}, ${JSON.stringify(validated_sources)}, ${extraction_date}, ${raw_content}
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
      extraction_date, raw_content, is_flagged
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
        is_flagged = CASE WHEN ${is_flagged}::boolean IS NULL THEN is_flagged ELSE ${is_flagged}::boolean END
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

export default router;
