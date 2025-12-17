import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Search, Globe, ExternalLink, MapPin } from 'lucide-react';
import { ExtractionLog, ToolUsageInfo } from '../../types';

interface ExtractionAuditTableProps {
  logs: ExtractionLog[];
  loading: boolean;
  onRefresh: () => void;
}

export const ExtractionAuditTable: React.FC<ExtractionAuditTableProps> = ({
  logs,
  loading,
  onRefresh
}) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens?.toString() || '0';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-jhu-heritage">Recent Extractions</h3>
          <p className="text-sm text-slate-500 mt-1">
            Last {logs.length} extraction calls with full debug info
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && logs.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          <RefreshCw size={32} className="mx-auto mb-4 animate-spin text-slate-400" />
          <p>Loading extraction logs...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && logs.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          <AlertTriangle size={32} className="mx-auto mb-4 text-slate-300" />
          <p>No extraction logs found</p>
          <p className="text-sm mt-1">Run some extractions to see data here</p>
        </div>
      )}

      {/* Extraction Rows */}
      <div className="divide-y divide-slate-100">
        {logs.map((log) => (
          <div key={log.id}>
            {/* Summary Row (clickable) */}
            <div
              className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
            >
              <div className="flex items-center justify-between">
                {/* Left: Status + School/Program */}
                <div className="flex items-center gap-4">
                  {/* Status indicator */}
                  {log.success ? (
                    <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle size={20} className="text-red-500 flex-shrink-0" />
                  )}

                  {/* School & Program */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate">
                        {log.request_metadata?.school || 'Unknown School'}
                      </p>
                      {/* Search indicator */}
                      {log.tools_used && log.tools_used.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          <Globe size={10} />
                          {log.tools_used.reduce((acc, t) => acc + (t.resultsCount || 0), 0)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">
                      {log.request_metadata?.program || 'Unknown Program'}
                    </p>
                  </div>
                </div>

                {/* Right: Quick Stats */}
                <div className="flex items-center gap-6 text-sm">
                  {/* Time */}
                  <div className="flex items-center gap-1 text-slate-500">
                    <Clock size={14} />
                    <span>{formatTime(log.created_at)}</span>
                  </div>

                  {/* Tokens */}
                  <div className="w-20 text-right">
                    <span className="text-slate-500">Tokens:</span>
                    <span className="ml-1 font-semibold text-slate-900">
                      {formatTokens(log.total_tokens)}
                    </span>
                  </div>

                  {/* Cost */}
                  <div className="w-20 text-right">
                    <span className="text-slate-500">Cost:</span>
                    <span className="ml-1 font-semibold text-slate-900">
                      ${log.total_cost?.toFixed(4) || '0.0000'}
                    </span>
                  </div>

                  {/* Response Time */}
                  <div className="w-24 text-right">
                    <span className="text-slate-500">Time:</span>
                    <span className="ml-1 font-semibold text-slate-900">
                      {log.ai_response_time_ms?.toLocaleString() || 0}ms
                    </span>
                  </div>

                  {/* Expand/Collapse Icon */}
                  {expandedRow === log.id ? (
                    <ChevronDown size={20} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={20} className="text-slate-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedRow === log.id && (
              <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                <div className="pt-4 space-y-4">
                  {/* Token Breakdown */}
                  <div className="flex gap-4 text-sm">
                    <div className="px-3 py-2 bg-white rounded border border-slate-200">
                      <span className="text-slate-500">Input:</span>
                      <span className="ml-1 font-semibold">{log.input_tokens?.toLocaleString() || 0}</span>
                      <span className="ml-1 text-slate-400">(${log.input_cost?.toFixed(4) || '0.0000'})</span>
                    </div>
                    <div className="px-3 py-2 bg-white rounded border border-slate-200">
                      <span className="text-slate-500">Output:</span>
                      <span className="ml-1 font-semibold">{log.output_tokens?.toLocaleString() || 0}</span>
                      <span className="ml-1 text-slate-400">(${log.output_cost?.toFixed(4) || '0.0000'})</span>
                    </div>
                    <div className="px-3 py-2 bg-white rounded border border-slate-200">
                      <span className="text-slate-500">Tools:</span>
                      <span className="ml-1 font-semibold">${log.tool_cost?.toFixed(4) || '0.0000'}</span>
                    </div>
                    {log.retry_count > 0 && (
                      <div className="px-3 py-2 bg-amber-50 rounded border border-amber-200">
                        <span className="text-amber-700">Retries:</span>
                        <span className="ml-1 font-semibold text-amber-900">{log.retry_count}</span>
                      </div>
                    )}
                  </div>

                  {/* Request & Response Metadata */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Request */}
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 text-sm">Request Metadata</h4>
                      <pre className="bg-slate-800 text-green-400 p-3 rounded text-xs overflow-auto max-h-48 font-mono">
                        {JSON.stringify(log.request_metadata, null, 2)}
                      </pre>
                    </div>

                    {/* Response */}
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 text-sm">Response Metadata</h4>
                      <pre className="bg-slate-800 text-green-400 p-3 rounded text-xs overflow-auto max-h-48 font-mono">
                        {JSON.stringify(log.response_metadata, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Tools Used with Source Details */}
                  {log.tools_used && log.tools_used.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-2 text-sm flex items-center gap-2">
                        <Search size={14} />
                        Grounding Tools & Sources
                      </h4>
                      <div className="space-y-3">
                        {log.tools_used.map((tool: ToolUsageInfo, idx: number) => (
                          <div key={idx} className="bg-white rounded border border-slate-200 overflow-hidden">
                            {/* Tool Header */}
                            <div className={`px-3 py-2 flex items-center justify-between ${
                              tool.success ? 'bg-green-50' : 'bg-red-50'
                            }`}>
                              <div className="flex items-center gap-2">
                                {tool.type === 'googleSearch' ? (
                                  <Globe size={16} className="text-blue-600" />
                                ) : (
                                  <MapPin size={16} className="text-red-600" />
                                )}
                                <span className="font-medium text-sm">
                                  {tool.type === 'googleSearch' ? 'Google Search' : 'Google Maps'}
                                </span>
                              </div>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                tool.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                              }`}>
                                {tool.resultsCount || 0} source{(tool.resultsCount || 0) !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {/* Source URLs */}
                            {tool.sources && tool.sources.length > 0 && (
                              <div className="divide-y divide-slate-100">
                                {tool.sources.map((source, sourceIdx) => (
                                  <div key={sourceIdx} className="p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <a
                                          href={source.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                        >
                                          {source.title || 'Untitled Source'}
                                          <ExternalLink size={12} />
                                        </a>
                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                          {source.url}
                                        </p>
                                        {source.snippet && (
                                          <p className="text-xs text-slate-600 mt-1 line-clamp-2 bg-slate-50 p-2 rounded">
                                            "{source.snippet}"
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* No sources case */}
                            {(!tool.sources || tool.sources.length === 0) && (
                              <div className="p-3 text-sm text-slate-500 italic">
                                No source URLs captured (may indicate empty grounding response)
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Tools Used */}
                  {(!log.tools_used || log.tools_used.length === 0) && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                      <div className="flex items-center gap-2 text-amber-700">
                        <AlertTriangle size={16} />
                        <span className="text-sm font-medium">No grounding tools used</span>
                      </div>
                      <p className="text-xs text-amber-600 mt-1">
                        The AI did not use Google Search for this extraction (may have used cached knowledge)
                      </p>
                    </div>
                  )}

                  {/* Error Details (if failed) */}
                  {!log.success && log.error_message && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded">
                      <h4 className="font-semibold text-red-700 mb-1 text-sm">
                        Error: {log.error_type || 'Unknown'}
                      </h4>
                      <p className="text-sm text-red-600 font-mono">{log.error_message}</p>
                    </div>
                  )}

                  {/* Model & Endpoint Info */}
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-200">
                    <span>Model: {log.model}</span>
                    <span className="mx-2">|</span>
                    <span>Endpoint: {log.endpoint}</span>
                    <span className="mx-2">|</span>
                    <span>ID: {log.id}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExtractionAuditTable;
