
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Minimize2, Maximize2, Loader2, Sparkles } from 'lucide-react';
import { GenerateContentResponse, Chat } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { createProjectChat } from '../services/geminiService';
import { ExtractionResult } from '../types';

interface ChatAssistantProps {
  data: ExtractionResult[];
  isOpen: boolean;
  onToggle: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({ data, isOpen, onToggle }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hi! I can analyze the extracted tuition data for you. Ask me to compare prices or find insights.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize chat when data changes or component mounts
  useEffect(() => {
    if (data.length > 0) {
      const session = createProjectChat(data);
      setChatSession(session);
    }
  }, [data]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || !chatSession) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const result = await chatSession.sendMessageStream({ message: userMsg });
      
      let fullText = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
            fullText += c.text;
            setMessages(prev => {
                const newHistory = [...prev];
                newHistory[newHistory.length - 1].text = fullText;
                return newHistory;
            });
        }
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
        className="fixed bottom-6 right-6 w-14 h-14 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-40"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl flex flex-col border border-slate-200 z-40 animate-fade-in-up">
      {/* Header */}
      <div className="px-4 py-3 bg-brand-600 text-white rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={18} />
          <span className="font-semibold text-sm">Tuition Analyst</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggle} className="p-1 hover:bg-brand-500 rounded text-brand-100">
            <Minimize2 size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                msg.role === 'user' 
                  ? 'bg-brand-600 text-white' 
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
              <Loader2 size={16} className="animate-spin text-brand-600" />
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
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
