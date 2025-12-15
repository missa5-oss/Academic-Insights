
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Minimize2, Loader2, Sparkles, MessageSquare, Plus, Trash2, ChevronLeft, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { createProjectChat, BackendChat } from '../services/geminiService';
import { ExtractionResult } from '../types';
import { API_URL } from '../src/config';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';

interface ChatAssistantProps {
  data: ExtractionResult[];
  projectId: string;
  isOpen: boolean;
  onToggle: () => void;
}

interface Message {
  id?: string;
  role: 'user' | 'model';
  text: string;
}

interface Conversation {
  id: string;
  title: string;
  message_count: number;
  last_message_at: string;
  created_at: string;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ data, projectId, isOpen, onToggle }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hi! I can analyze the extracted tuition data for you. Ask me to compare prices or find insights.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<BackendChat | null>(null);

  // Conversation persistence state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversationList, setShowConversationList] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // Confirmation dialog state
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    conversationId: string | null;
    title: string;
  }>({ isOpen: false, conversationId: null, title: '' });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations when chat opens or project changes
  useEffect(() => {
    if (isOpen && projectId) {
      fetchConversations();
    }
  }, [isOpen, projectId]);

  // Initialize or update chat when data changes
  useEffect(() => {
    if (data.length > 0) {
      if (chatSession) {
        chatSession.updateContext(data);
        if (!currentConversationId) {
          setMessages([
            { role: 'model', text: 'Hi! I can analyze the extracted tuition data for this project. Ask me to compare prices or find insights.' }
          ]);
        }
      } else {
        const session = createProjectChat(data);
        setChatSession(session);
      }
    }
  }, [data]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Fetch all conversations for this project
  const fetchConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const response = await fetch(`${API_URL}/api/conversations/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // Create a new conversation
  const createConversation = async () => {
    try {
      const response = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title: 'New Conversation' })
      });

      if (response.ok) {
        const newConv = await response.json();
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newConv.id);
        setMessages([
          { role: 'model', text: 'Hi! I can analyze the extracted tuition data for you. Ask me to compare prices or find insights.' }
        ]);
        setShowConversationList(false);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  // Load messages for a conversation
  const loadConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        interface APIMessage {
          id: string;
          role: 'user' | 'assistant';
          content: string;
        }
        const loadedMessages: Message[] = data.map((msg: APIMessage) => ({
          id: msg.id,
          role: msg.role === 'assistant' ? 'model' : msg.role,
          text: msg.content
        }));

        if (loadedMessages.length === 0) {
          loadedMessages.push({
            role: 'model',
            text: 'Hi! I can analyze the extracted tuition data for you. Ask me to compare prices or find insights.'
          });
        }

        setMessages(loadedMessages);
        setCurrentConversationId(conversationId);
        setShowConversationList(false);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  // Save a message to the current conversation
  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    if (!currentConversationId) return;

    try {
      await fetch(`${API_URL}/api/conversations/${currentConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content })
      });

      // Update conversation title based on first user message
      const userMessages = messages.filter(m => m.role === 'user');
      if (userMessages.length === 0 && role === 'user') {
        const title = content.length > 30 ? content.substring(0, 30) + '...' : content;
        await fetch(`${API_URL}/api/conversations/${currentConversationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        });
        // Update local state
        setConversations(prev => prev.map(c =>
          c.id === currentConversationId ? { ...c, title } : c
        ));
      }
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  };

  // Delete a conversation
  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          setMessages([
            { role: 'model', text: 'Hi! I can analyze the extracted tuition data for you. Ask me to compare prices or find insights.' }
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  // Export conversation
  const exportConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/conversations/${conversationId}/export`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation-${conversationId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export conversation:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !chatSession) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    // Auto-create conversation if none exists
    if (!currentConversationId) {
      try {
        const response = await fetch(`${API_URL}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            title: userMsg.length > 30 ? userMsg.substring(0, 30) + '...' : userMsg
          })
        });

        if (response.ok) {
          const newConv = await response.json();
          setCurrentConversationId(newConv.id);
          setConversations(prev => [newConv, ...prev]);

          // Save the user message
          await fetch(`${API_URL}/api/conversations/${newConv.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'user', content: userMsg })
          });
        }
      } catch (error) {
        console.error('Failed to auto-create conversation:', error);
      }
    } else {
      // Save user message to existing conversation
      saveMessage('user', userMsg);
    }

    try {
      const result = chatSession.sendMessageStream(userMsg);

      let fullText = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of result) {
        if (chunk.text) {
            fullText += chunk.text;
            setMessages(prev => {
                const newHistory = [...prev];
                newHistory[newHistory.length - 1].text = fullText;
                return newHistory;
            });
        }
      }

      // Save assistant response
      if (currentConversationId && fullText) {
        saveMessage('assistant', fullText);
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I'm having trouble connecting to Gemini right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-14 h-14 bg-jhu-heritage hover:opacity-90 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-40"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl flex flex-col border border-slate-200 z-40 animate-fade-in-up">
      {/* Header */}
      <div className="px-4 py-3 bg-jhu-heritage text-white rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showConversationList ? (
            <button
              onClick={() => setShowConversationList(false)}
              className="p-1 hover:bg-white/20 rounded transition-all"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <Bot size={18} />
          )}
          <span className="font-semibold text-sm">
            {showConversationList ? 'Conversations' : 'Tuition Analyst'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!showConversationList && (
            <button
              onClick={() => setShowConversationList(true)}
              className="p-1 hover:bg-white/20 rounded text-white transition-all"
              title="View conversations"
            >
              <MessageSquare size={16} />
            </button>
          )}
          <button onClick={onToggle} className="p-1 hover:bg-white/20 rounded text-white transition-all">
            <Minimize2 size={16} />
          </button>
        </div>
      </div>

      {showConversationList ? (
        /* Conversation List View */
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-3 border-b border-slate-200 bg-white">
            <button
              onClick={createConversation}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-jhu-heritage text-white rounded-lg hover:opacity-90 transition-all text-sm"
            >
              <Plus size={16} />
              New Conversation
            </button>
          </div>

          {isLoadingConversations ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="animate-spin text-jhu-heritage" size={24} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No conversations yet. Start a new one!
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`p-3 hover:bg-white cursor-pointer transition-colors ${
                    currentConversationId === conv.id ? 'bg-blue-50 border-l-2 border-jhu-heritage' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => loadConversation(conv.id)}
                    >
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {conv.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {conv.message_count} messages · {new Date(conv.last_message_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportConversation(conv.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Export"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDelete({
                            isOpen: true,
                            conversationId: conv.id,
                            title: conv.title
                          });
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Chat View */
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-jhu-heritage text-white'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                  }`}
                >
                  {msg.role === 'model' ? (
                    <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-sm">
                  <Loader2 size={16} className="animate-spin text-jhu-heritage" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-slate-100 rounded-b-xl">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Compare Yale and Harvard..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jhu-heritage"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-2 bg-jhu-heritage text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirmation Dialog for Conversation Deletion */}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${confirmDelete.title}"? This will permanently remove all messages in this conversation.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete.conversationId) {
            deleteConversation(confirmDelete.conversationId);
          }
          setConfirmDelete({ isOpen: false, conversationId: null, title: '' });
        }}
        onCancel={() => setConfirmDelete({ isOpen: false, conversationId: null, title: '' })}
      />
    </div>
  );
};
