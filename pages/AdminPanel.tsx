
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Server, Cpu, Database, Download, Upload, AlertCircle, Clock, CheckCircle2, AlertTriangle, Activity, Heart, RefreshCw, Loader2, FileText, TrendingUp, Zap } from 'lucide-react';
import { ExtractionStatus, ExtractionResult } from '../types';
import { API_URL, APP_VERSION } from '../src/config';

// Types for backend metrics
interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  responseTime: number;
  components: {
    database: {
      status: string;
      responseTime?: number;
      error?: string;
    };
    system: {
      status: string;
      memory: {
        total: number;
        free: number;
        used: number;
        usagePercent: number;
      };
      cpu: {
        cores: number;
        loadAverage: number[];
      };
      platform: string;
      nodeVersion: string;
    };
  };
}

interface AdminMetrics {
  summary: {
    totalProjects: number;
    totalResults: number;
    totalConversations: number;
    period: string;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  confidenceBreakdown: Array<{ confidence: string; count: number }>;
  dailyExtractions: Array<{ date: string; total: number; success: number }>;
  apiAnalytics: {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    requestsByPath: Array<{ path: string; count: number }>;
    requestsByStatus: Array<{ status: number; count: number }>;
  } | null;
}

interface DatabaseStats {
  tables: Array<{ table: string; rowCount: number; error?: string }>;
  timestamp: string;
}

interface ApiLog {
  id: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  ip_address: string;
  user_agent: string;
  error_message: string | null;
  created_at: string;
}

interface AiUsageMetrics {
  summary: {
    total_calls: number;
    total_tokens: number;
    total_cost: number;
    avg_response_time: number;
    success_count: number;
    failure_count: number;
  };
  byOperation: Array<{
    operation_type: string;
    calls: number;
    tokens: number;
    cost: number;
    avg_response_time: number;
    success_rate: number;
  }>;
  daily: Array<{
    date: string;
    calls: number;
    tokens: number;
    cost: number;
    failures: number;
  }>;
  toolUsage: Array<{
    tool_type: string;
    usage_count: number;
    success_count: number;
  }>;
  errors: Array<{
    error_type: string;
    count: number;
  }>;
  period: string;
}

interface AiCostBreakdown {
  costs: Array<{
    date: string;
    operation_type: string;
    input_cost: number;
    output_cost: number;
    tool_cost: number;
    total_cost: number;
  }>;
  totalsByOperation: Array<{
    operation_type: string;
    input_cost: number;
    output_cost: number;
    tool_cost: number;
    total_cost: number;
  }>;
  period: string;
}

export const AdminPanel: React.FC = () => {
  const { results, projects, restoreData } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backend metrics state
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [recentErrors, setRecentErrors] = useState<ApiLog[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageMetrics | null>(null);
  const [aiCosts, setAiCosts] = useState<AiCostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch all admin data
  const fetchAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [healthRes, metricsRes, dbStatsRes, errorsRes, aiUsageRes, aiCostsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/health`),
        fetch(`${API_URL}/api/admin/metrics?days=7`),
        fetch(`${API_URL}/api/admin/database-stats`),
        fetch(`${API_URL}/api/admin/errors?limit=5`),
        fetch(`${API_URL}/api/admin/ai-usage?days=7`),
        fetch(`${API_URL}/api/admin/ai-costs?days=30`)
      ]);

      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }
      if (metricsRes.ok) {
        setMetrics(await metricsRes.json());
      }
      if (dbStatsRes.ok) {
        setDbStats(await dbStatsRes.json());
      }
      if (errorsRes.ok) {
        const errorsData = await errorsRes.json();
        setRecentErrors(errorsData.errors || []);
      }
      if (aiUsageRes.ok) {
        setAiUsage(await aiUsageRes.json());
      }
      if (aiCostsRes.ok) {
        setAiCosts(await aiCostsRes.json());
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
      setError('Failed to connect to backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAdminData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate Real-time Usage Metrics based on Results (fallback/local stats)
  const usageStats = useMemo(() => {
    const executedResults = results.filter(
      r => r.status === ExtractionStatus.SUCCESS || r.status === ExtractionStatus.NOT_FOUND
    );

    const totalCalls = executedResults.length;
    // Estimate: 1 Search Call + ~5000 Tokens per execution (Prompt + Context + Output)
    const totalTokens = totalCalls * 5000;
    // Estimate: $0.005 per run (Tokens + Search API)
    const totalCost = totalCalls * 0.005;

    // Group by Date for Charts (Last 7 Days)
    const last7DaysMap = new Map<string, { date: string, tokens: number, calls: number, cost: number }>();

    // Initialize last 7 days with 0
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const displayDate = `${d.getMonth() + 1}/${d.getDate()}`; // MM/DD
        last7DaysMap.set(dateStr, { date: displayDate, tokens: 0, calls: 0, cost: 0 });
    }

    executedResults.forEach(r => {
        // Handle potentially missing extraction_date or format mismatch
        if (!r.extraction_date || r.extraction_date === '-') return;

        // r.extraction_date is YYYY-MM-DD
        if (last7DaysMap.has(r.extraction_date)) {
            const entry = last7DaysMap.get(r.extraction_date)!;
            entry.tokens += 5000; // Estimated tokens
            entry.calls += 1;
            entry.cost += 0.005; // Estimated cost
        }
    });

    return {
        totalTokens,
        totalCalls,
        totalCost,
        chartData: Array.from(last7DaysMap.values())
    };
  }, [results]);

  const handleBackup = () => {
    const data = {
      projects,
      results,
      exportDate: new Date().toISOString()
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `academica_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.projects && json.results) {
          if (window.confirm(`Found ${json.projects.length} projects and ${json.results.length} results. Restore this backup? Current data will be replaced.`)) {
            restoreData(json);
            alert('Database restored successfully.');
          }
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to parse backup file.');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'degraded': return 'text-amber-600 bg-amber-50';
      case 'unhealthy': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  // Status breakdown pie chart colors
  const STATUS_COLORS: Record<string, string> = {
    'Success': '#22c55e',
    'Not Found': '#f59e0b',
    'Failed': '#ef4444',
    'Pending': '#94a3b8'
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold text-jhu-heritage">System Administration</h2>
          <p className="text-slate-600 mt-2 text-lg">Monitor API usage, system health, and database metrics.</p>
        </div>
        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-jhu-heritage text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
          <div className="text-sm text-red-800">
            <p className="font-semibold mb-1">Connection Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* System Health Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Heart className="text-jhu-heritage" size={24} />
            <h3 className="text-xl font-semibold text-jhu-heritage">System Health</h3>
          </div>
          {health && (
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getHealthColor(health.status)}`}>
              {health.status.toUpperCase()}
            </span>
          )}
        </div>

        {health ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Server Uptime */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={16} className="text-slate-500" />
                <span className="text-xs text-slate-500 uppercase font-semibold">Uptime</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{formatUptime(health.uptime)}</p>
              <p className="text-xs text-slate-500 mt-1">v{health.version}</p>
            </div>

            {/* Database Status */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Database size={16} className="text-slate-500" />
                <span className="text-xs text-slate-500 uppercase font-semibold">Database</span>
              </div>
              <p className={`text-lg font-bold ${health.components.database.status === 'healthy' ? 'text-green-600' : 'text-red-600'}`}>
                {health.components.database.status === 'healthy' ? 'Connected' : 'Error'}
              </p>
              {health.components.database.responseTime && (
                <p className="text-xs text-slate-500 mt-1">{health.components.database.responseTime}ms latency</p>
              )}
            </div>

            {/* Memory Usage */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={16} className="text-slate-500" />
                <span className="text-xs text-slate-500 uppercase font-semibold">Memory</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{health.components.system.memory.usagePercent}%</p>
              <p className="text-xs text-slate-500 mt-1">
                {formatBytes(health.components.system.memory.used)} / {formatBytes(health.components.system.memory.total)}
              </p>
              <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    health.components.system.memory.usagePercent > 90 ? 'bg-red-500' :
                    health.components.system.memory.usagePercent > 70 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${health.components.system.memory.usagePercent}%` }}
                />
              </div>
            </div>

            {/* CPU Load */}
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-slate-500" />
                <span className="text-xs text-slate-500 uppercase font-semibold">CPU Load</span>
              </div>
              <p className="text-lg font-bold text-slate-900">{health.components.system.cpu.loadAverage[0].toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">{health.components.system.cpu.cores} cores • {health.components.system.platform}</p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <p className="text-slate-500 text-center py-4">Unable to fetch system health</p>
        )}
      </div>

      {/* Database Statistics */}
      {dbStats && (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <Database className="text-jhu-heritage" size={24} />
            <h3 className="text-xl font-semibold text-jhu-heritage">Database Statistics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {dbStats.tables.map((table) => (
              <div key={table.table} className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-jhu-heritage">{table.rowCount.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1 capitalize">{table.table.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 text-jhu-heritage rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Projects</p>
              <h3 className="text-xl font-bold text-slate-900">{metrics?.summary.totalProjects ?? projects.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <TrendingUp size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Extractions</p>
              <h3 className="text-xl font-bold text-slate-900">{metrics?.summary.totalResults ?? results.length}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-yellow-100 text-jhu-gold rounded-lg">
              <Server size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">API Requests (7d)</p>
              <h3 className="text-xl font-bold text-slate-900">{metrics?.apiAnalytics?.totalRequests?.toLocaleString() ?? 'N/A'}</h3>
            </div>
          </div>
          {metrics?.apiAnalytics?.avgResponseTime && (
            <p className="text-xs text-slate-500">Avg: {metrics.apiAnalytics.avgResponseTime.toFixed(0)}ms</p>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-50 text-jhu-green rounded-lg">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">AI Cost</p>
              <h3 className="text-xl font-bold text-slate-900">
                ${aiUsage?.summary?.total_cost ? aiUsage.summary.total_cost.toFixed(2) : usageStats.totalCost.toFixed(2)}
              </h3>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {aiUsage?.summary?.total_calls ? `${aiUsage.summary.total_calls} calls` : `${usageStats.totalCalls} extractions × $0.005`}
          </p>
        </div>
      </div>

      {/* AI Usage Dashboard */}
      {aiUsage && (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="text-jhu-heritage" size={24} />
            <div>
              <h3 className="text-xl font-semibold text-jhu-heritage">AI Usage Dashboard</h3>
              <p className="text-xs text-slate-500 mt-1">Real-time AI metrics and observability ({aiUsage.period})</p>
            </div>
          </div>

          {/* AI Usage Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total AI Calls</p>
              <p className="text-2xl font-bold text-slate-900">{aiUsage.summary.total_calls.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">
                {aiUsage.summary.success_count} success, {aiUsage.summary.failure_count} failed
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Tokens</p>
              <p className="text-2xl font-bold text-slate-900">{aiUsage.summary.total_tokens.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Input + Output tokens</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Cost</p>
              <p className="text-2xl font-bold text-slate-900">${aiUsage.summary.total_cost.toFixed(2)}</p>
              <p className="text-xs text-slate-500 mt-1">Actual costs (not estimated)</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Avg Response Time</p>
              <p className="text-2xl font-bold text-slate-900">{aiUsage.summary.avg_response_time}ms</p>
              <p className="text-xs text-slate-500 mt-1">AI processing time</p>
            </div>
          </div>

          {/* Operation Type Breakdown */}
          {aiUsage.byOperation && aiUsage.byOperation.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Usage by Operation Type</h4>
              <div className="space-y-2">
                {aiUsage.byOperation.map((op, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900 capitalize">{op.operation_type}</span>
                      <span className="text-sm text-slate-600">{op.calls} calls</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Tokens:</span>
                        <span className="font-semibold ml-1">{op.tokens.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Cost:</span>
                        <span className="font-semibold ml-1">${op.cost.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Success:</span>
                        <span className={`font-semibold ml-1 ${op.success_rate >= 95 ? 'text-green-600' : op.success_rate >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                          {op.success_rate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tool Usage */}
          {aiUsage.toolUsage && aiUsage.toolUsage.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Tool Usage</h4>
              <div className="grid grid-cols-2 gap-4">
                {aiUsage.toolUsage.map((tool, idx) => {
                  const successRate = tool.usage_count > 0 ? (tool.success_count / tool.usage_count) * 100 : 0;
                  return (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-900 capitalize">{tool.tool_type.replace('google', 'Google ')}</span>
                        <span className={`text-xs font-semibold ${successRate >= 90 ? 'text-green-600' : 'text-amber-600'}`}>
                          {successRate.toFixed(1)}% success
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{tool.usage_count} uses, {tool.success_count} successful</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error Breakdown */}
          {aiUsage.errors && aiUsage.errors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Error Breakdown</h4>
              <div className="space-y-2">
                {aiUsage.errors.map((err, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-red-50 rounded">
                    <span className="text-sm text-slate-700 capitalize">{err.error_type.replace('_', ' ')}</span>
                    <span className="text-sm font-semibold text-red-600">{err.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Cost Breakdown Chart */}
      {aiCosts && aiCosts.costs && aiCosts.costs.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-semibold text-slate-900 mb-6">AI Cost Breakdown ({aiCosts.period})</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aiCosts.costs.slice(0, 14).reverse()}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend />
                <Bar dataKey="input_cost" stackId="cost" fill="#3b82f6" name="Input Cost" radius={[0, 0, 0, 0]} />
                <Bar dataKey="output_cost" stackId="cost" fill="#8b5cf6" name="Output Cost" radius={[0, 0, 0, 0]} />
                <Bar dataKey="tool_cost" stackId="cost" fill="#f59e0b" name="Tool Cost" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Extractions Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-semibold text-slate-900 mb-6">Daily Extractions (Last 7 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.dailyExtractions || usageStats.chartData.map(d => ({ date: d.date, total: d.calls, success: d.calls }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend />
                <Bar dataKey="total" fill="#002D72" radius={[4, 4, 0, 0]} name="Total" />
                <Bar dataKey="success" fill="#22c55e" radius={[4, 4, 0, 0]} name="Success" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Chart */}
        {metrics?.statusBreakdown && metrics.statusBreakdown.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold text-slate-900 mb-6">Extraction Status Distribution</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.statusBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="status"
                    label={({ status, count }) => `${status}: ${count}`}
                  >
                    {metrics.statusBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* API Analytics */}
      {metrics?.apiAnalytics && (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="text-jhu-heritage" size={24} />
            <h3 className="text-xl font-semibold text-jhu-heritage">API Analytics (Last 7 Days)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Top Endpoints</h4>
              <div className="space-y-2">
                {metrics.apiAnalytics.requestsByPath?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 font-mono text-xs truncate flex-1 mr-2">{item.path}</span>
                    <span className="text-slate-900 font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Response Codes</h4>
              <div className="space-y-2">
                {metrics.apiAnalytics.requestsByStatus?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className={`font-mono ${
                      item.status >= 500 ? 'text-red-600' :
                      item.status >= 400 ? 'text-amber-600' :
                      'text-green-600'
                    }`}>{item.status}</span>
                    <span className="text-slate-900 font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Performance</h4>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500">Average Response Time</p>
                  <p className="text-lg font-bold text-slate-900">{metrics.apiAnalytics.avgResponseTime.toFixed(0)}ms</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Error Rate</p>
                  <p className={`text-lg font-bold ${metrics.apiAnalytics.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                    {metrics.apiAnalytics.errorRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="text-red-600" size={24} />
            <h3 className="text-xl font-semibold text-red-600">Recent Errors</h3>
          </div>
          <div className="space-y-2">
            {recentErrors.map((log) => (
              <div key={log.id} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-mono rounded">{log.status_code}</span>
                    <span className="text-sm font-mono text-slate-700">{log.method} {log.path}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                {log.error_message && (
                  <p className="text-xs text-red-700 mt-2">{log.error_message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Database Management Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
         <div className="flex items-center gap-3 mb-6">
            <Database className="text-jhu-heritage" size={24} />
            <h3 className="text-xl font-semibold text-jhu-heritage">Database Management</h3>
         </div>

         <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
            <div className="text-sm text-blue-800">
               <p className="font-semibold mb-1">Data Backup & Restore</p>
               <p>Export your projects and results to a JSON file for backup. You can restore from a backup file at any time.</p>
            </div>
         </div>

         <div className="flex flex-col sm:flex-row gap-4">
            <button
               onClick={handleBackup}
               className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-jhu-heritage rounded-lg text-jhu-heritage font-semibold hover:bg-blue-50 transition-all shadow-sm"
            >
               <Download size={18} />
               Backup Database
            </button>
            <button
               onClick={handleRestoreClick}
               className="flex items-center justify-center gap-2 px-4 py-2.5 bg-jhu-heritage text-white rounded-lg font-semibold hover:opacity-90 transition-all shadow-sm"
            >
               <Upload size={18} />
               Restore Database
            </button>
            <input
               type="file"
               ref={fileInputRef}
               onChange={handleFileChange}
               accept=".json"
               className="hidden"
            />
         </div>
      </div>

      {/* Latest Extractions Audit Trail */}
      <ExtractionAuditTrail results={results} />

      {/* Footer with last refresh time */}
      <div className="text-center text-xs text-slate-400">
        Last refreshed: {lastRefresh.toLocaleTimeString()} • Frontend v{APP_VERSION} • Server v{health?.version || 'N/A'}
      </div>
    </div>
  );
};

// Extraction Audit Trail Component
interface ExtractionAuditTrailProps {
  results: ExtractionResult[];
}

const ExtractionAuditTrail: React.FC<ExtractionAuditTrailProps> = ({ results }) => {
  // Get the 10 most recent extractions sorted by updated_at
  const recentExtractions = useMemo(() => {
    return results
      .filter(r => r.updated_at)
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || '').getTime();
        const dateB = new Date(b.updated_at || '').getTime();
        return dateB - dateA;
      })
      .slice(0, 10);
  }, [results]);

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusIcon = (status: ExtractionStatus) => {
    switch (status) {
      case ExtractionStatus.SUCCESS:
        return <CheckCircle2 size={16} className="text-green-600" />;
      case ExtractionStatus.NOT_FOUND:
        return <AlertTriangle size={16} className="text-amber-600" />;
      case ExtractionStatus.FAILED:
        return <AlertTriangle size={16} className="text-red-600" />;
      case ExtractionStatus.PENDING:
        return <Clock size={16} className="text-slate-400" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: ExtractionStatus) => {
    switch (status) {
      case ExtractionStatus.SUCCESS:
        return 'bg-green-50 border-green-100';
      case ExtractionStatus.NOT_FOUND:
        return 'bg-amber-50 border-amber-100';
      case ExtractionStatus.FAILED:
        return 'bg-red-50 border-red-100';
      case ExtractionStatus.PENDING:
        return 'bg-slate-50 border-slate-100';
      default:
        return 'bg-white border-slate-100';
    }
  };

  if (recentExtractions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="text-jhu-heritage" size={24} />
        <div>
          <h3 className="text-xl font-semibold text-jhu-heritage">Latest Extractions Audit Trail</h3>
          <p className="text-xs text-slate-500 mt-1">Most recent extraction attempts (last 10)</p>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {recentExtractions.map((result) => (
          <div key={result.id} className={`p-4 rounded-lg border ${getStatusColor(result.status)} transition-colors hover:shadow-sm`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="mt-1">
                  {getStatusIcon(result.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 truncate">{result.school_name}</p>
                    <span className="text-xs text-slate-500 truncate">{result.program_name}</span>
                    {result.extraction_version > 1 && (
                      <span className="px-2 py-0.5 bg-blue-100 text-jhu-heritage text-xs font-semibold rounded whitespace-nowrap">
                        v{result.extraction_version}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{formatDateTime(result.updated_at || result.extracted_at)}</span>
                    </div>
                    {result.status === ExtractionStatus.SUCCESS && result.tuition_amount && (
                      <div className="flex items-center gap-1">
                        <DollarSign size={12} />
                        <span className="font-semibold text-slate-900">{result.tuition_amount}</span>
                      </div>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      result.status === ExtractionStatus.SUCCESS ? 'bg-green-100 text-green-700' :
                      result.status === ExtractionStatus.NOT_FOUND ? 'bg-amber-100 text-amber-700' :
                      result.status === ExtractionStatus.FAILED ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {result.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
