import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  DollarSign, FileText, Zap, Clock, Activity, RefreshCw, Loader2,
  Table as TableIcon, Search, Download
} from 'lucide-react';
import { ExtractionStatus, MasterDataResult, ExtractionLog, AiUsageMetrics, AiCostBreakdown } from '../types';
import { API_URL } from '../src/config';
import { LLMMetricsCard } from '../components/admin/LLMMetricsCard';
import { ExtractionAuditTable } from '../components/admin/ExtractionAuditTable';

export const AdminPanel: React.FC = () => {
  const { results, projects } = useApp();

  // Tab state
  const [activeTab, setActiveTab] = useState<'llm' | 'masterData'>('llm');

  // LLM Observability state
  const [aiUsage, setAiUsage] = useState<AiUsageMetrics | null>(null);
  const [aiCosts, setAiCosts] = useState<AiCostBreakdown | null>(null);
  const [extractionLogs, setExtractionLogs] = useState<ExtractionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Master Data state
  const [masterData, setMasterData] = useState<MasterDataResult[]>([]);
  const [masterDataLoading, setMasterDataLoading] = useState(false);
  const [masterDataSearch, setMasterDataSearch] = useState('');
  const [masterDataPagination, setMasterDataPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasMore: false
  });

  // Fetch LLM observability data
  const fetchLLMData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usageRes, costsRes, detailsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/ai-usage?days=7`),
        fetch(`${API_URL}/api/admin/ai-costs?days=30`),
        fetch(`${API_URL}/api/admin/ai-extraction-details?limit=10`)
      ]);

      if (usageRes.ok) {
        setAiUsage(await usageRes.json());
      }
      if (costsRes.ok) {
        setAiCosts(await costsRes.json());
      }
      if (detailsRes.ok) {
        const data = await detailsRes.json();
        setExtractionLogs(data.logs || []);
      }

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch LLM data:', err);
      setError('Failed to connect to backend. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh LLM data
  useEffect(() => {
    if (activeTab === 'llm') {
      fetchLLMData();
      const interval = setInterval(fetchLLMData, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Build local master data from context
  const localMasterData = useMemo(() => {
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    return results
      .filter(r => r.status === ExtractionStatus.SUCCESS)
      .map(r => ({
        ...r,
        project_name: projectMap.get(r.project_id) || 'Unknown Project'
      }))
      .sort((a, b) => {
        const dateCompare = (b.extraction_date || '').localeCompare(a.extraction_date || '');
        if (dateCompare !== 0) return dateCompare;
        return a.school_name.localeCompare(b.school_name);
      });
  }, [results, projects]);

  // Fetch master data from API
  const fetchMasterData = async (page = 1) => {
    setMasterDataLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/master-data?page=${page}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          setMasterData(data.data);
          setMasterDataPagination(data.pagination);
        } else {
          setMasterData(localMasterData as MasterDataResult[]);
          setMasterDataPagination({
            page: 1,
            limit: localMasterData.length,
            total: localMasterData.length,
            totalPages: 1,
            hasMore: false
          });
        }
      } else {
        setMasterData(localMasterData as MasterDataResult[]);
      }
    } catch (err) {
      setMasterData(localMasterData as MasterDataResult[]);
    } finally {
      setMasterDataLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'masterData') {
      fetchMasterData();
    }
  }, [activeTab]);

  // Filter master data
  const filteredMasterData = useMemo(() => {
    const sourceData = masterData.length > 0 ? masterData : localMasterData;
    if (!masterDataSearch) return sourceData as MasterDataResult[];
    const term = masterDataSearch.toLowerCase();
    return (sourceData as MasterDataResult[]).filter(r =>
      r.school_name.toLowerCase().includes(term) ||
      r.program_name.toLowerCase().includes(term) ||
      r.project_name?.toLowerCase().includes(term)
    );
  }, [masterData, masterDataSearch, localMasterData]);

  // Export functions
  const exportMasterDataToCSV = () => {
    const dataToExport = filteredMasterData.length > 0 ? filteredMasterData : localMasterData;
    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Project Name', 'School Name', 'Program Name', 'Tuition Amount', 'Academic Year', 'Confidence Score', 'Cost Per Credit', 'Total Credits', 'Is STEM', 'Extraction Date'];
    const rows = dataToExport.map(r => [
      r.project_name || '',
      r.school_name,
      r.program_name,
      r.tuition_amount || '',
      r.academic_year || '',
      r.confidence_score,
      r.cost_per_credit || '',
      r.total_credits || '',
      r.is_stem ? 'Yes' : 'No',
      r.extraction_date || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const escaped = (cell?.toString() || '').replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('"') ? `"${escaped}"` : escaped;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `master-tuition-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMasterDataToJSON = () => {
    const dataToExport = filteredMasterData.length > 0 ? filteredMasterData : localMasterData;
    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalRecords: dataToExport.length,
      results: dataToExport
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `master-tuition-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format helpers
  const formatTokens = (tokens: number) => {
    if (!tokens) return '0';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toLocaleString();
  };

  // Cost chart data
  const costChartData = useMemo(() => {
    if (!aiCosts?.totalsByOperation) return [];
    return aiCosts.totalsByOperation.map(op => ({
      name: op.operation_type.charAt(0).toUpperCase() + op.operation_type.slice(1),
      cost: op.total_cost,
      fill: op.operation_type === 'extraction' ? '#3b82f6' :
            op.operation_type === 'chat' ? '#8b5cf6' :
            op.operation_type === 'summary' ? '#10b981' : '#f59e0b'
    }));
  }, [aiCosts]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold text-jhu-heritage">LLM Observability</h2>
          <p className="text-slate-600 mt-2 text-lg">
            Monitor AI usage, token consumption, and extraction performance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('llm')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'llm'
                  ? 'bg-white text-jhu-heritage shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity size={16} />
              LLM Metrics
            </button>
            <button
              onClick={() => setActiveTab('masterData')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'masterData'
                  ? 'bg-white text-jhu-heritage shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon size={16} />
              Master Data
            </button>
          </div>

          {/* Refresh button for LLM tab */}
          {activeTab === 'llm' && (
            <button
              onClick={fetchLLMData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-jhu-heritage text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && activeTab === 'llm' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Connection Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* LLM METRICS TAB */}
      {activeTab === 'llm' && (
        <div className="space-y-6">
          {/* Section 1: Key Metrics Cards */}
          <div className="grid grid-cols-4 gap-4">
            <LLMMetricsCard
              title="Total AI Calls"
              value={aiUsage?.summary?.total_calls?.toLocaleString() || '0'}
              subtitle={`${aiUsage?.summary?.success_count || 0} success, ${aiUsage?.summary?.failure_count || 0} failed`}
              icon={<Zap size={16} className="text-blue-500" />}
              colorClass="bg-blue-50"
            />
            <LLMMetricsCard
              title="Total Tokens"
              value={formatTokens(aiUsage?.summary?.total_tokens || 0)}
              subtitle="Input + Output tokens"
              icon={<FileText size={16} className="text-purple-500" />}
              colorClass="bg-purple-50"
            />
            <LLMMetricsCard
              title="Total Cost"
              value={`$${(aiUsage?.summary?.total_cost || 0).toFixed(2)}`}
              subtitle="Actual costs from API"
              icon={<DollarSign size={16} className="text-green-500" />}
              colorClass="bg-green-50"
            />
            <LLMMetricsCard
              title="Avg Response Time"
              value={`${(aiUsage?.summary?.avg_response_time || 0).toLocaleString()}ms`}
              subtitle="AI processing time"
              icon={<Clock size={16} className="text-amber-500" />}
              colorClass="bg-amber-50"
            />
          </div>

          {/* Section 2: Cost by Operation + Performance */}
          <div className="grid grid-cols-2 gap-6">
            {/* Cost by Operation Chart */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-semibold text-jhu-heritage mb-4">Cost by Operation</h3>
              {costChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={costChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={(v) => `$${v.toFixed(2)}`} />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']} />
                    <Bar dataKey="cost" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400">
                  No cost data available
                </div>
              )}
            </div>

            {/* Extraction Performance */}
            <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-semibold text-jhu-heritage mb-4">Performance by Operation</h3>
              <div className="space-y-4">
                {aiUsage?.byOperation?.map(op => (
                  <div key={op.operation_type} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-semibold capitalize text-slate-900">{op.operation_type}</p>
                      <p className="text-xs text-slate-500">
                        {op.calls} calls | ${op.cost?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${
                        op.success_rate >= 90 ? 'text-green-600' :
                        op.success_rate >= 70 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {op.success_rate?.toFixed(0) || 0}%
                      </p>
                      <p className="text-xs text-slate-500">success rate</p>
                    </div>
                  </div>
                )) || (
                  <div className="text-center text-slate-400 py-8">
                    No operation data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Recent Extractions Audit Table */}
          <ExtractionAuditTable
            logs={extractionLogs}
            loading={loading}
            onRefresh={fetchLLMData}
          />

          {/* Last Refresh */}
          <p className="text-xs text-slate-400 text-right">
            Last updated: {lastRefresh.toLocaleTimeString()} (auto-refresh every 30s)
          </p>
        </div>
      )}

      {/* MASTER DATA TAB */}
      {activeTab === 'masterData' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            {/* Header with controls */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <TableIcon className="text-jhu-heritage" size={24} />
                <div>
                  <h3 className="text-xl font-semibold text-jhu-heritage">Master Tuition Data</h3>
                  <p className="text-sm text-slate-500">All successful extractions across all projects</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search schools, programs..."
                    value={masterDataSearch}
                    onChange={(e) => setMasterDataSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jhu-heritage w-64"
                  />
                </div>

                {/* Export buttons */}
                <button
                  onClick={exportMasterDataToCSV}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Download size={16} />
                  CSV
                </button>
                <button
                  onClick={exportMasterDataToJSON}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <Download size={16} />
                  JSON
                </button>
                <button
                  onClick={() => fetchMasterData(masterDataPagination.page)}
                  disabled={masterDataLoading}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-jhu-heritage rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {masterDataLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-slate-600 mb-4">
              <span>Total: <strong className="text-slate-900">{masterDataPagination.total || localMasterData.length}</strong></span>
              <span>Showing: <strong className="text-slate-900">{filteredMasterData.length}</strong></span>
            </div>

            {/* Table */}
            {masterDataLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-slate-400" />
              </div>
            ) : filteredMasterData.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <TableIcon size={48} className="mx-auto mb-4 text-slate-300" />
                <p>No successful extractions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-slate-700">Project</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">School</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Program</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Tuition</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Year</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Confidence</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">STEM</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMasterData.map((result) => (
                      <tr key={result.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-50 text-jhu-heritage text-xs font-medium rounded">
                            {result.project_name || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{result.school_name}</td>
                        <td className="px-4 py-3 text-slate-600">{result.program_name}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{result.tuition_amount || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{result.academic_year || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            result.confidence_score === 'High' ? 'bg-green-100 text-green-800' :
                            result.confidence_score === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {result.confidence_score}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {result.is_stem ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">STEM</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{result.extraction_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {masterDataPagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => fetchMasterData(masterDataPagination.page - 1)}
                  disabled={masterDataPagination.page <= 1 || masterDataLoading}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {masterDataPagination.page} of {masterDataPagination.totalPages}
                </span>
                <button
                  onClick={() => fetchMasterData(masterDataPagination.page + 1)}
                  disabled={!masterDataPagination.hasMore || masterDataLoading}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
