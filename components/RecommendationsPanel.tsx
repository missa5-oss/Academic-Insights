import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, RefreshCw, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { RecommendationsResponse, CrossProjectAnalytics } from '@/types';

interface RecommendationsPanelProps {
  analyticsData: CrossProjectAnalytics | null;
  onGenerate: (analyticsData: CrossProjectAnalytics) => Promise<RecommendationsResponse>;
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  analyticsData,
  onGenerate
}) => {
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (forceRefresh: boolean = false) => {
    if (!analyticsData) {
      setError('No analytics data available');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await onGenerate(analyticsData);
      setRecommendations(result);
      setIsExpanded(true); // Expand panel after generating
    } catch (err: any) {
      setError(err.message || 'Failed to generate recommendations');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-jhu-heritage to-jhu-spirit rounded-lg">
            <Sparkles size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              AI Market Recommendations
            </h3>
            <p className="text-sm text-slate-600">
              Strategic insights across all projects
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {recommendations && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleGenerate(true);
              }}
              disabled={isGenerating || !analyticsData}
              className="p-2 text-slate-400 hover:text-jhu-heritage hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh recommendations"
            >
              <RefreshCw size={18} className={isGenerating ? 'animate-spin' : ''} />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp size={20} className="text-slate-400" />
          ) : (
            <ChevronDown size={20} className="text-slate-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-6">
          {!recommendations && !error && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-50 to-purple-50 mb-4">
                <Bot size={32} className="text-jhu-heritage" />
              </div>
              <h4 className="text-lg font-medium text-slate-900 mb-2">
                Generate Market Recommendations
              </h4>
              <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
                Get AI-powered strategic insights analyzing pricing positioning, STEM trends, competitive gaps, and actionable next steps across all your projects.
              </p>
              <button
                onClick={() => handleGenerate(false)}
                disabled={isGenerating || !analyticsData}
                className="px-6 py-2.5 bg-gradient-to-r from-jhu-heritage to-jhu-spirit text-white font-medium rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate Recommendations
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <span className="font-semibold">Error:</span> {error}
              </p>
              <button
                onClick={() => handleGenerate(true)}
                disabled={isGenerating}
                className="mt-2 text-sm text-red-700 hover:text-red-900 font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {recommendations && (
            <div>
              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100">
                <span className="flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${recommendations.cached ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                  {recommendations.cached ? 'Cached' : 'Fresh'}
                </span>
                <span>
                  Generated: {new Date(recommendations.generatedAt).toLocaleString()}
                </span>
                <span>
                  Avg Tuition: ${recommendations.metrics.avgTuition.toLocaleString()}
                </span>
                {recommendations.metrics.stemPremium > 0 && (
                  <span>
                    STEM Premium: ${recommendations.metrics.stemPremium.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Recommendations */}
              <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-ul:text-slate-700 prose-li:text-slate-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {recommendations.recommendations}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
