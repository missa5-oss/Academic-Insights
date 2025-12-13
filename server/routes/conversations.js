import express from 'express';
import { sql } from '../db.js';
import logger from '../utils/logger.js';

const router = express.Router();

// ==========================================
// Sprint 2: Conversation Persistence (US2.3)
// ==========================================

/**
 * GET /api/conversations/:projectId
 * List all conversations for a project
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const conversations = await sql`
      SELECT id, title, message_count, last_message_at, created_at
      FROM conversations
      WHERE project_id = ${projectId}
      ORDER BY last_message_at DESC
    `;

    res.json(conversations);
  } catch (error) {
    logger.error('Error fetching conversations', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post('/', async (req, res) => {
  try {
    const { projectId, title } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const conversationTitle = title || 'New Conversation';

    await sql`
      INSERT INTO conversations (id, project_id, title)
      VALUES (${id}, ${projectId}, ${conversationTitle})
    `;

    logger.info(`Created conversation ${id} for project ${projectId}`);

    res.json({
      id,
      projectId,
      title: conversationTitle,
      message_count: 0,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error creating conversation', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Get all messages for a conversation
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;

    const messages = await sql`
      SELECT id, role, content, tokens_used, created_at
      FROM conversation_messages
      WHERE conversation_id = ${id}
      ORDER BY created_at ASC
    `;

    res.json(messages);
  } catch (error) {
    logger.error('Error fetching messages', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Add a message to a conversation
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, content, tokensUsed } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'role and content are required' });
    }

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    await sql`
      INSERT INTO conversation_messages (id, conversation_id, role, content, tokens_used)
      VALUES (${msgId}, ${id}, ${role}, ${content}, ${tokensUsed || null})
    `;

    // Update conversation message count and last_message_at
    await sql`
      UPDATE conversations
      SET message_count = message_count + 1, last_message_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;

    logger.info(`Added message ${msgId} to conversation ${id}`);

    res.json({
      id: msgId,
      conversation_id: id,
      role,
      content,
      tokens_used: tokensUsed || null,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error adding message', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

/**
 * PUT /api/conversations/:id
 * Update conversation title
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    await sql`
      UPDATE conversations
      SET title = ${title}
      WHERE id = ${id}
    `;

    logger.info(`Updated conversation ${id} title to: ${title}`);

    res.json({ id, title });
  } catch (error) {
    logger.error('Error updating conversation', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation and all its messages
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Messages are deleted automatically via CASCADE
    await sql`
      DELETE FROM conversations WHERE id = ${id}
    `;

    logger.info(`Deleted conversation ${id}`);

    res.json({ success: true, id });
  } catch (error) {
    logger.error('Error deleting conversation', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * POST /api/conversations/:id/export
 * Export conversation as text/JSON
 */
router.post('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.body; // 'text' or 'json'

    // Get conversation details
    const [conversation] = await sql`
      SELECT id, title, message_count, created_at
      FROM conversations
      WHERE id = ${id}
    `;

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get all messages
    const messages = await sql`
      SELECT role, content, created_at
      FROM conversation_messages
      WHERE conversation_id = ${id}
      ORDER BY created_at ASC
    `;

    if (format === 'text') {
      // Format as readable text
      let textExport = `# ${conversation.title}\n`;
      textExport += `Created: ${conversation.created_at}\n`;
      textExport += `Messages: ${conversation.message_count}\n\n`;
      textExport += '---\n\n';

      messages.forEach(msg => {
        const label = msg.role === 'user' ? 'You' : 'AI Analyst';
        textExport += `**${label}** (${msg.created_at}):\n${msg.content}\n\n`;
      });

      res.json({ format: 'text', content: textExport });
    } else {
      // JSON format
      res.json({
        format: 'json',
        conversation: {
          id: conversation.id,
          title: conversation.title,
          messageCount: conversation.message_count,
          createdAt: conversation.created_at
        },
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          createdAt: m.created_at
        }))
      });
    }
  } catch (error) {
    logger.error('Error exporting conversation', error);
    res.status(500).json({ error: 'Failed to export conversation' });
  }
});

export default router;
