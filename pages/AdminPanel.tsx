
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, Server, Cpu, Database, Download, Upload, AlertCircle, Clock, CheckCircle2, AlertTriangle, Activity, Heart, RefreshCw, Loader2, FileText, TrendingUp, Zap, Table as TableIcon, Search, BarChart3, Target } from 'lucide-react';
import { ExtractionStatus, ExtractionResult, MasterDataResult } from '../types';
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

  // Tab state for navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'masterData'>('overview');

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

  // Build master data from local context (all successful extractions with project names)
  const localMasterData = useMemo(() => {
    // Create a map of project IDs to project names
    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    // Filter successful results and add project names
    return results
      .filter(r => r.status === ExtractionStatus.SUCCESS)
      .map(r => ({
        ...r,
        project_name: projectMap.get(r.project_id) || 'Unknown Project'
      }))
      .sort((a, b) => {
        // Sort by extraction_date desc, then school_name asc
        const dateCompare = (b.extraction_date || '').localeCompare(a.extraction_date || '');
        if (dateCompare !== 0) return dateCompare;
        return a.school_name.localeCompare(b.school_name);
      });
  }, [results, projects]);

  // Fetch master data from API (with fallback to local data)
  const fetchMasterData = async (page = 1) => {
    setMasterDataLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/master-data?page=${page}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        // If API returns data, use it
        if (data.data && data.data.length > 0) {
          setMasterData(data.data);
          setMasterDataPagination(data.pagination);
        } else {
          // Fallback to local data if API returns empty
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
        // API error - use local data
        setMasterData(localMasterData as MasterDataResult[]);
        setMasterDataPagination({
          page: 1,
          limit: localMasterData.length,
          total: localMasterData.length,
          totalPages: 1,
          hasMore: false
        });
      }
    } catch (err) {
      console.error('Failed to fetch master data:', err);
      // Network error - use local data
      setMasterData(localMasterData as MasterDataResult[]);
      setMasterDataPagination({
        page: 1,
        limit: localMasterData.length,
        total: localMasterData.length,
        totalPages: 1,
        hasMore: false
      });
    } finally {
      setMasterDataLoading(false);
    }
  };

  // Load master data when tab changes
  useEffect(() => {
    if (activeTab === 'masterData') {
      // Always refresh when switching to master data tab
      fetchMasterData();
    }
  }, [activeTab]);

  // Export master data to CSV
  const exportMasterDataToCSV = () => {
    // Use filtered data for export (respects search filter)
    const dataToExport = filteredMasterData.length > 0 ? filteredMasterData : localMasterData;
    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = [
      'Project Name',
      'School Name',
      'Program Name',
      'Tuition Amount',
      'Academic Year',
      'Confidence Score',
      'Cost Per Credit',
      'Total Credits',
      'Is STEM',
      'Additional Fees',
      'Extraction Date'
    ];

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
      r.additional_fees || '',
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
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `master-tuition-data-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export master data to JSON
  const exportMasterDataToJSON = () => {
    // Use filtered data for export (respects search filter)
    const dataToExport = filteredMasterData.length > 0 ? filteredMasterData : localMasterData;
    if (dataToExport.length === 0) {
      alert('No data to export');
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      totalRecords: dataToExport.length,
      results: dataToExport.map(r => ({
        projectName: r.project_name,
        schoolName: r.school_name,
        programName: r.program_name,
        tuitionAmount: r.tuition_amount,
        academicYear: r.academic_year,
        confidenceScore: r.confidence_score,
        costPerCredit: r.cost_per_credit,
        totalCredits: r.total_credits,
        isStem: r.is_stem,
        additionalFees: r.additional_fees,
        extractionDate: r.extraction_date
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `master-tuition-data-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  // Calculate project performance metrics
  const projectMetrics = useMemo(() => {
    return projects.map(project => {
      const projectResults = results.filter(r => r.project_id === project.id);
      const successCount = projectResults.filter(r => r.status === ExtractionStatus.SUCCESS).length;
      const successRate = projectResults.length > 0 ? (successCount / projectResults.length) * 100 : 0;

      return {
        id: project.id,
        name: project.name,
        totalExtractions: projectResults.length,
        successCount,
        successRate: Math.round(successRate),
        status: project.status
      };
    });
  }, [projects, results]);

  // Calculate confidence distribution
  const confidenceDistribution = useMemo(() => {
    const successResults = results.filter(r => r.status === ExtractionStatus.SUCCESS);
    const high = successResults.filter(r => r.confidence_score === 'High').length;
    const medium = successResults.filter(r => r.confidence_score === 'Medium').length;
    const low = successResults.filter(r => r.confidence_score === 'Low').length;

    return [
      { name: 'High', value: high, fill: '#22c55e' },
      { name: 'Medium', value: medium, fill: '#eab308' },
      { name: 'Low', value: low, fill: '#ef4444' }
    ];
  }, [results]);

  // Helper function to truncate school names for readability
  const truncateSchoolName = (name: string, maxLength: number = 35): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };

  // Calculate top schools
  const topSchools = useMemo(() => {
    const schoolMap = new Map<string, { displayName: string; fullName: string }>();
    results
      .filter(r => r.status === ExtractionStatus.SUCCESS)
      .forEach(r => {
        const existing = schoolMap.get(r.school_name);
        if (!existing) {
          schoolMap.set(r.school_name, {
            displayName: truncateSchoolName(r.school_name),
            fullName: r.school_name
          });
        }
      });

    return Array.from(schoolMap.entries())
      .map(([fullName, { displayName }]) => {
        const count = results.filter(r => r.status === ExtractionStatus.SUCCESS && r.school_name === fullName).length;
        return { name: displayName, fullName, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [results]);

  // Calculate tuition statistics
  const tuitionStats = useMemo(() => {
    const tuitions = results
      .filter(r => r.status === ExtractionStatus.SUCCESS && r.tuition_amount)
      .map(r => {
        // Extract numeric value from tuition_amount (e.g., "$50,000" -> 50000)
        const cleaned = r.tuition_amount?.replace(/[^0-9.-]/g, '') || '0';
        return parseFloat(cleaned);
      })
      .filter(v => !isNaN(v) && v > 0);

    if (tuitions.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }

    const sorted = [...tuitions].sort((a, b) => a - b);
    const sum = tuitions.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / tuitions.length,
      count: tuitions.length
    };
  }, [results]);

  // Calculate STEM distribution
  const stemDistribution = useMemo(() => {
    const successResults = results.filter(r => r.status === ExtractionStatus.SUCCESS);
    const stem = successResults.filter(r => r.is_stem).length;
    const nonStem = successResults.filter(r => !r.is_stem).length;

    return [
      { name: 'STEM', value: stem, fill: '#3b82f6' },
      { name: 'Non-STEM', value: nonStem, fill: '#8b5cf6' }
    ];
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

  // Filter master data based on search term (with fallback to local data)
  const filteredMasterData = useMemo(() => {
    // Use masterData if available, otherwise fall back to localMasterData
    const sourceData = masterData.length > 0 ? masterData : localMasterData;
    if (!masterDataSearch) return sourceData as MasterDataResult[];
    const term = masterDataSearch.toLowerCase();
    return (sourceData as MasterDataResult[]).filter(r =>
      r.school_name.toLowerCase().includes(term) ||
      r.program_name.toLowerCase().includes(term) ||
      r.project_name?.toLowerCase().includes(term)
    );
  }, [masterData, masterDataSearch, localMasterData]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold text-jhu-heritage">System Administration</h2>
          <p className="text-slate-600 mt-2 text-lg">Monitor API usage, system health, and database metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-jhu-heritage shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity size={16} />
              System Overview
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

          {/* Refresh button - only show for overview tab */}
          {activeTab === 'overview' && (
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-jhu-heritage text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
              Refresh
            </button>
          )}
        </div>
      </div>

      {error && activeTab === 'overview' && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
          <div className="text-sm text-red-800">
            <p className="font-semibold mb-1">Connection Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Master Data */}
      {activeTab === 'masterData' && (
        <div className="space-y-6">
          {/* Header with controls */}
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
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
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Download size={16} />
                  CSV
                </button>
                <button
                  onClick={exportMasterDataToJSON}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Download size={16} />
                  JSON
                </button>
                <button
                  onClick={() => fetchMasterData(masterDataPagination.page)}
                  disabled={masterDataLoading}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-jhu-heritage rounded-lg hover:opacity-90 disabled:opacity-50 transition-colors"
                >
                  {masterDataLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats summary */}
            <div className="flex items-center gap-6 text-sm text-slate-600 mb-4">
              <span>Total Records: <strong className="text-slate-900">{masterDataPagination.total || localMasterData.length}</strong></span>
              <span>Showing: <strong className="text-slate-900">{filteredMasterData.length}</strong></span>
              {masterDataPagination.totalPages > 1 && (
                <span>Page: <strong className="text-slate-900">{masterDataPagination.page} of {masterDataPagination.totalPages}</strong></span>
              )}
            </div>

            {/* Data Table */}
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
                      <th className="px-4 py-3 font-semibold text-slate-700">Academic Year</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Confidence</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">STEM</th>
                      <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMasterData.map((result) => (
                      <tr key={result.id} className="hover:bg-slate-50 transition-colors">
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
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-600">
                  Page {masterDataPagination.page} of {masterDataPagination.totalPages}
                </span>
                <button
                  onClick={() => fetchMasterData(masterDataPagination.page + 1)}
                  disabled={!masterDataPagination.hasMore || masterDataLoading}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: System Overview */}
      {activeTab === 'overview' && (
      <>
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

      {/* Data Quality & Performance Insights */}
      {/* Tuition Statistics Cards */}
      {tuitionStats.count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Avg Tuition</p>
                <h3 className="text-xl font-bold text-slate-900">${(tuitionStats.avg / 1000).toFixed(0)}K</h3>
              </div>
            </div>
            <p className="text-xs text-slate-500">{tuitionStats.count} programs analyzed</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Highest Tuition</p>
                <h3 className="text-xl font-bold text-slate-900">${(tuitionStats.max / 1000).toFixed(0)}K</h3>
              </div>
            </div>
            <p className="text-xs text-slate-500">Maximum extracted value</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Lowest Tuition</p>
                <h3 className="text-xl font-bold text-slate-900">${(tuitionStats.min / 1000).toFixed(0)}K</h3>
              </div>
            </div>
            <p className="text-xs text-slate-500">Minimum extracted value</p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <Target size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Tuition Range</p>
                <h3 className="text-xl font-bold text-slate-900">${((tuitionStats.max - tuitionStats.min) / 1000).toFixed(0)}K</h3>
              </div>
            </div>
            <p className="text-xs text-slate-500">Difference between min & max</p>
          </div>
        </div>
      )}

      {/* Project Performance Table */}
      {projectMetrics.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="text-jhu-heritage" size={24} />
            <div>
              <h3 className="text-xl font-semibold text-jhu-heritage">Project Performance</h3>
              <p className="text-xs text-slate-500 mt-1">Extraction success rate by project</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700">Project</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Total Extractions</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Successful</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Success Rate</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {projectMetrics.map((metric) => (
                  <tr key={metric.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{metric.name}</td>
                    <td className="px-4 py-3 text-slate-600">{metric.totalExtractions}</td>
                    <td className="px-4 py-3 text-slate-600">{metric.successCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-xs">
                          <div
                            className={`h-full transition-all ${
                              metric.successRate >= 80 ? 'bg-green-500' :
                              metric.successRate >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${metric.successRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{metric.successRate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        metric.status === 'Active' ? 'bg-green-100 text-green-800' :
                        metric.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {metric.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Quality Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Confidence Distribution Pie Chart */}
        {confidenceDistribution.some(d => d.value > 0) && (
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Confidence Score Distribution</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={confidenceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {confidenceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* STEM Distribution Pie Chart */}
        {stemDistribution.some(d => d.value > 0) && (
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Program Type Distribution</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stemDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {stemDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Schools Bar Chart */}
        {topSchools.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow col-span-1 lg:col-span-3">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Top 10 Schools by Extractions</h3>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...topSchools].sort((a, b) => a.count - b.count)} layout="vertical" margin={{ left: 200 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{fill: '#64748b', fontSize: 11}}
                    width={200}
                  />
                  <Tooltip
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const data = payload[0].payload as any;
                        return (
                          <div className="bg-white p-3 rounded border border-slate-200">
                            <p className="font-semibold text-slate-900">{data.fullName}</p>
                            <p className="text-sm text-slate-600">Extractions: {data.count}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" fill="#002D72" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
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
                    label={({ name, value }) => `${name || ''}: ${value || 0}`}
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
      </>
      )}
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
