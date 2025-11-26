import express from 'express';
import { sql } from '../db.js';

const router = express.Router();

// GET all projects
router.get('/', async (req, res) => {
  try {
    const projects = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET single project
router.get('/:id', async (req, res) => {
  try {
    const [project] = await sql`SELECT * FROM projects WHERE id = ${req.params.id}`;
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST create project
router.post('/', async (req, res) => {
  try {
    const { id, name, description, created_at, last_run, status, results_count } = req.body;

    const [project] = await sql`
      INSERT INTO projects (id, name, description, created_at, last_run, status, results_count)
      VALUES (${id}, ${name}, ${description}, ${created_at}, ${last_run}, ${status}, ${results_count})
      RETURNING *
    `;

    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT update project
router.put('/:id', async (req, res) => {
  try {
    const { name, description, last_run, status, results_count } = req.body;

    const [project] = await sql`
      UPDATE projects
      SET
        name = COALESCE(${name}, name),
        description = COALESCE(${description}, description),
        last_run = COALESCE(${last_run}, last_run),
        status = COALESCE(${status}, status),
        results_count = COALESCE(${results_count}, results_count)
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  try {
    const [deleted] = await sql`
      DELETE FROM projects
      WHERE id = ${req.params.id}
      RETURNING id
    `;

    if (!deleted) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully', id: deleted.id });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
