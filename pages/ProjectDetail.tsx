
import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useDebounce } from '@/src/hooks/useDebounce';
import { ExtractionResult, ConfidenceScore, ExtractionStatus } from '../types';
import { AuditModal } from '../components/AuditModal';
import { HistoryModal } from '../components/HistoryModal';
import { AddTargetModal, EditProjectModal } from '../components/ProjectModals';
import { StatCard } from '../components/StatCard';
import { generateExecutiveSummary, simulateExtraction, getCampusLocation, fetchAnalysisHistory } from '../services/geminiService';
import { API_URL } from '@/src/config';
import { Search, RefreshCw, Bot, AlertTriangle, CheckCircle, ExternalLink, Eye, Download, Plus, Play, Clock, BarChart3, Table as TableIcon, Trash2, Pencil, Flag, Check, X, History, DollarSign, Target, TrendingUp, TrendingDown, Copy, Check as CheckIcon, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Legend, LineChart, Line } from 'recharts';
import { ChatAssistant } from '../components/ChatAssistant';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, results, addTargets, updateResult, deleteResult, editProject, deleteProject, user, createNewVersion } = useApp();
  const toast = useToast();

  const project = projects.find(p => p.id === id);
  const projectResults = results.filter(r => r.project_id === id);

  const [viewMode, setViewMode] = useState<'table' | 'analysis'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedResult, setSelectedResult] = useState<ExtractionResult | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyResultId, setHistoryResultId] = useState<string | null>(null);
  const [isAddTargetOpen, setIsAddTargetOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [summaryMetrics, setSummaryMetrics] = useState<{
    totalPrograms: number;
    successfulExtractions: number;
    avgTuition: number;
    medianTuition: number;
    minTuition: number;
    maxTuition: number;
    stemPrograms: number;
    nonStemPrograms: number;
    dataQuality: { high: number; medium: number; low: number };
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [processingItems, setProcessingItems] = useState<Record<string, boolean>>({});
  const [locatingItems, setLocatingItems] = useState<Record<string, boolean>>({});

  // NEW: Copy feedback and analysis history
  const [copiedAnalysis, setCopiedAnalysis] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);

  // --- Analytics Data State (US1.1) ---
  const [analyticsData, setAnalyticsData] = useState<{
    avgTuition: number;
    highestTuition: { amount: string; school: string; program: string } | null;
    lowestTuition: { amount: string; school: string; program: string } | null;
    totalPrograms: number;
    successRate: number;
    stemPrograms: number;
    nonStemPrograms: number;
    totalResults: number;
  } | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // --- Trends Data State (US1.2) ---
  const [trendsData, setTrendsData] = useState<Array<{
    date: string;
    avgTuition: number;
    count: number;
  }> | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  // --- Selection State ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- Editing State ---
  const [editingTuitionId, setEditingTuitionId] = useState<string | null>(null);
  const [editingTuitionValue, setEditingTuitionValue] = useState<string>('');
  const [editingAcademicYearId, setEditingAcademicYearId] = useState<string | null>(null);
  const [editingAcademicYearValue, setEditingAcademicYearValue] = useState<string>('');

  // --- Confirmation Dialog State ---
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'deleteProject' | 'bulkDelete' | null;
  }>({ isOpen: false, type: null });

  // Filter logic (uses debounced search for performance) - Memoized for optimization
  const filteredResults = useMemo(() => {
    return projectResults.filter(result =>
      result.school_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      result.program_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [projectResults, debouncedSearchTerm]);

  const pendingCount = useMemo(() => {
    return filteredResults.filter(r => r.status === ExtractionStatus.PENDING).length;
  }, [filteredResults]);

  // --- Analytics Data Preparation ---
  const chartData = useMemo(() => {
    const validData = filteredResults
      .filter(r => r.status === ExtractionStatus.SUCCESS && r.tuition_amount)
      .map(r => {
        // Parse "$55,000" -> 55000
        const rawAmount = r.tuition_amount?.replace(/[^0-9.]/g, '') || '0';
        return {
          name: r.school_name,
          program: r.program_name,
          amount: parseFloat(rawAmount),
          displayAmount: r.tuition_amount
        };
      })
      .sort((a, b) => b.amount - a.amount); // Sort high to low

    const confidenceData = [
      { name: 'High', value: filteredResults.filter(r => r.confidence_score === ConfidenceScore.HIGH).length, color: '#007567' }, // Carey Teal
      { name: 'Medium', value: filteredResults.filter(r => r.confidence_score === ConfidenceScore.MEDIUM).length, color: '#A19261' }, // JHU Gold
      { name: 'Low', value: filteredResults.filter(r => r.confidence_score === ConfidenceScore.LOW).length, color: '#CF4520' }, // Accent Alert
    ].filter(d => d.value > 0);

    // Chart data for US1.3 - Status Distribution
    const statusData = [
      { name: 'Success', value: filteredResults.filter(r => r.status === ExtractionStatus.SUCCESS).length, color: '#22c55e' },
      { name: 'Pending', value: filteredResults.filter(r => r.status === ExtractionStatus.PENDING).length, color: '#f59e0b' },
      { name: 'Not Found', value: filteredResults.filter(r => r.status === ExtractionStatus.NOT_FOUND).length, color: '#ef4444' },
      { name: 'Failed', value: filteredResults.filter(r => r.status === ExtractionStatus.FAILED).length, color: '#6b7280' },
    ].filter(d => d.value > 0);

    // Chart data for US1.3 - STEM vs Non-STEM
    const stemCount = filteredResults.filter(r => r.is_stem === true).length;
    const nonStemCount = filteredResults.filter(r => r.is_stem === false).length;
    const stemData = [];
    if (stemCount > 0) stemData.push({ name: 'STEM', value: stemCount, color: '#3b82f6' });
    if (nonStemCount > 0) stemData.push({ name: 'Non-STEM', value: nonStemCount, color: '#8b5cf6' });

    // Chart data for US1.3 - Cost Per Credit Analysis (top 10)
    const costPerCreditData = filteredResults
      .filter(r => r.cost_per_credit && r.tuition_amount)
      .map(r => {
        const costPerCredit = parseFloat(r.cost_per_credit?.toString() || '0');
        return {
          school: r.school_name.length > 20 ? r.school_name.substring(0, 20) + '...' : r.school_name,
          program: r.program_name.length > 15 ? r.program_name.substring(0, 15) + '...' : r.program_name,
          cost: costPerCredit
        };
      })
      .filter(r => r.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    // Real trends data is now fetched from backend (US1.2)
    return {
      pricing: validData,
      confidence: confidenceData,
      status: statusData,
      stem: stemData,
      costPerCredit: costPerCreditData
    };
  }, [filteredResults]);

  const handleAudit = (result: ExtractionResult) => {
    setSelectedResult(result);
    setIsAuditOpen(true);
  };

  const handleRunAnalysis = async (forceRefresh?: boolean) => {
    setIsAnalyzing(true);
    setCopiedAnalysis(false);
    const response = await generateExecutiveSummary(
      filteredResults.filter(r => r.status === ExtractionStatus.SUCCESS),
      project?.id,
      forceRefresh
    );
    setAiAnalysis(response.summary);
    if (response.metrics) {
      setSummaryMetrics(response.metrics);
    }
    setIsAnalyzing(false);

    // Load history after analysis is generated
    if (project?.id) {
      loadAnalysisHistory(project.id);
    }
  };

  // Copy analysis to clipboard
  const handleCopyAnalysis = () => {
    if (aiAnalysis) {
      navigator.clipboard.writeText(aiAnalysis).then(() => {
        setCopiedAnalysis(true);
        toast.success('Copied', 'Analysis copied to clipboard');
        setTimeout(() => setCopiedAnalysis(false), 2000);
      });
    }
  };

  // Load analysis history for the project
  const loadAnalysisHistory = async (projectId: string) => {
    setIsLoadingHistory(true);
    try {
      const history = await fetchAnalysisHistory(projectId, 5);
      setAnalysisHistory(history);
    } catch (error) {
      console.error('Error loading analysis history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch analytics data when analysis tab is viewed (US1.1)
  const fetchAnalytics = useCallback(async () => {
    if (!project) return;

    setIsLoadingAnalytics(true);
    try {
      const response = await fetch(`${API_URL}/api/results/analytics/${project.id}`);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data);
      } else {
        toast.error('Failed to load analytics', 'Could not fetch analytics data from the server.');
        setAnalyticsData(null);
      }
    } catch (error) {
      toast.error('Network error', 'Could not connect to the server. Please check your connection.');
      setAnalyticsData(null);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [project, toast]);

  // Fetch trends data (US1.2)
  const fetchTrendsData = useCallback(async () => {
    if (!project) return;

    setIsLoadingTrends(true);
    try {
      const response = await fetch(`${API_URL}/api/results/trends/${project.id}`);
      if (response.ok) {
        const data = await response.json();
        setTrendsData(data);
      } else {
        toast.error('Failed to load trends', 'Could not fetch trends data from the server.');
        setTrendsData(null);
      }
    } catch (error) {
      toast.error('Network error', 'Could not connect to the server. Please check your connection.');
      setTrendsData(null);
    } finally {
      setIsLoadingTrends(false);
    }
  }, [project, toast]);

  // Load analytics and trends when switching to analysis view
  React.useEffect(() => {
    if (viewMode === 'analysis' && project) {
      fetchAnalytics();
      fetchTrendsData();
    }
  }, [viewMode, project?.id]);

  // Clear all analysis state when project changes (FIX: prevent cross-project persistence)
  React.useEffect(() => {
    setAiAnalysis(null);
    setSummaryMetrics(null);
    setAnalysisHistory([]);
    setIsAnalysisExpanded(true);
    setCopiedAnalysis(false);
  }, [id]);

  // US1.4 - Export Functions
  const exportToCSV = () => {
    if (filteredResults.length === 0) {
      alert('No results to export');
      return;
    }

    const headers = [
      'School Name',
      'Program Name',
      'Tuition Amount',
      'Status',
      'Confidence Score',
      'Academic Year',
      'Cost Per Credit',
      'Total Credits',
      'Is STEM',
      'Additional Fees',
      'Extraction Date'
    ];

    const rows = filteredResults.map(r => [
      r.school_name,
      r.program_name,
      r.tuition_amount || '',
      r.status,
      r.confidence_score,
      r.academic_year || '',
      r.cost_per_credit || '',
      r.total_credits || '',
      r.is_stem ? 'Yes' : 'No',
      r.additional_fees || '',
      r.extraction_date || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const escaped = (cell?.toString() || '').replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('"') ? `"${escaped}"` : escaped;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${project?.name || 'analysis'}-data-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (filteredResults.length === 0) {
      alert('No results to export');
      return;
    }

    const exportData = {
      project: {
        id: project?.id,
        name: project?.name,
        description: project?.description,
        exportDate: new Date().toISOString()
      },
      analytics: analyticsData,
      trends: trendsData,
      results: filteredResults.map(r => ({
        id: r.id,
        schoolName: r.school_name,
        programName: r.program_name,
        tuitionAmount: r.tuition_amount,
        status: r.status,
        confidenceScore: r.confidence_score,
        academicYear: r.academic_year,
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
    link.setAttribute('download', `${project?.name || 'analysis'}-data-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRunExtraction = async (item: ExtractionResult) => {
    setProcessingItems(prev => ({ ...prev, [item.id]: true }));
    
    // Simulate API latency + Gemini Processing
    const data = await simulateExtraction(item.school_name, item.program_name);
    
    updateResult(item.id, {
        ...data,
        extraction_date: new Date().toISOString().split('T')[0]
    });
    
    setProcessingItems(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
    });
  };

  const handleLocateCampus = async (item: ExtractionResult) => {
    setLocatingItems(prev => ({ ...prev, [item.id]: true }));
    const locationData = await getCampusLocation(item.school_name, item.program_name);
    
    if (locationData) {
      updateResult(item.id, { location_data: locationData });
    }
    setLocatingItems(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
    });
  };

  const handleRunBatch = async () => {
    setIsBatchProcessing(true);
    const pendingItems = filteredResults.filter(r => r.status === ExtractionStatus.PENDING);
    
    // Process one at a time
    for (const item of pendingItems) {
        setProcessingItems(prev => ({ ...prev, [item.id]: true }));
        
        const data = await simulateExtraction(item.school_name, item.program_name);
        
        updateResult(item.id, {
            ...data,
            extraction_date: new Date().toISOString().split('T')[0]
        });
        
        setProcessingItems(prev => {
            const next = { ...prev };
            delete next[item.id];
            return next;
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setIsBatchProcessing(false);
  };

  const handleExportCSV = () => {
    if (filteredResults.length === 0) return;

    const escapeCsv = (val: string | null | undefined | boolean | number) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      "School Name",
      "Program Name",
      "Official Program Name",
      "Tuition Amount",
      "Period",
      "Academic Year",
      "Cost Per Credit",
      "Total Credits",
      "Program Length",
      "Status",
      "Confidence Score",
      "Is STEM",
      "Is Flagged",
      "Remarks",
      "User Comments",
      "Location Address",
      "Location Map URL",
      "Location Latitude",
      "Location Longitude",
      "Primary Source URL",
      "Validated Sources (JSON)",
      "Extraction Date",
      "Extraction Version",
      "Extracted At",
      "Raw Content Snippet"
    ];

    const rows = filteredResults.map(r => {
      // Format validated sources as JSON string
      const validatedSourcesJson = r.validated_sources && r.validated_sources.length > 0
        ? JSON.stringify(r.validated_sources)
        : "";

      return [
        escapeCsv(r.school_name),
        escapeCsv(r.program_name),
        escapeCsv(r.actual_program_name),
        escapeCsv(r.tuition_amount),
        escapeCsv(r.tuition_period),
        escapeCsv(r.academic_year),
        escapeCsv(r.cost_per_credit),
        escapeCsv(r.total_credits),
        escapeCsv(r.program_length),
        escapeCsv(r.status),
        escapeCsv(r.confidence_score),
        escapeCsv(r.is_stem === true ? "Yes" : r.is_stem === false ? "No" : ""),
        escapeCsv(r.is_flagged ? "Yes" : "No"),
        escapeCsv(r.remarks),
        escapeCsv(r.user_comments),
        escapeCsv(r.location_data?.address),
        escapeCsv(r.location_data?.map_url),
        escapeCsv(r.location_data?.latitude),
        escapeCsv(r.location_data?.longitude),
        escapeCsv(r.source_url),
        escapeCsv(validatedSourcesJson),
        escapeCsv(r.extraction_date),
        escapeCsv(r.extraction_version),
        escapeCsv(r.extracted_at),
        escapeCsv(r.raw_content)
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${project?.name.replace(/\s+/g, '_')}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleEditProject = (name: string, description: string) => {
    if (project) {
        editProject(project.id, name, description);
    }
  };
  
  const handleDeleteProject = () => {
    setConfirmDialog({ isOpen: true, type: 'deleteProject' });
  };

  const confirmDeleteProject = () => {
    if (project) {
      deleteProject(project.id);
      navigate('/');
    }
    setConfirmDialog({ isOpen: false, type: null });
  };

  // --- Selection Handlers ---

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredResults.map(r => r.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({ isOpen: true, type: 'bulkDelete' });
  };

  const confirmBulkDelete = () => {
    // Convert Set to Array to iterate
    Array.from(selectedIds).forEach(id => {
      // We need the project ID for each item, but they all belong to this project
      // However, standard deleteResult needs result.project_id to update counts
      // Since we are in ProjectDetail, we know the project ID is `id` from params
      if (project) {
        deleteResult(id, project.id);
      }
    });
    setSelectedIds(new Set());
    setConfirmDialog({ isOpen: false, type: null });
  };

  const handleStartEditTuition = (result: ExtractionResult) => {
    setEditingTuitionId(result.id);
    setEditingTuitionValue(result.tuition_amount || '');
  };

  const handleSaveTuition = (resultId: string) => {
    updateResult(resultId, { tuition_amount: editingTuitionValue });
    setEditingTuitionId(null);
    setEditingTuitionValue('');
  };

  const handleCancelEditTuition = () => {
    setEditingTuitionId(null);
    setEditingTuitionValue('');
  };

  // --- Academic Year Editing Handlers ---
  const handleStartEditAcademicYear = (result: ExtractionResult) => {
    setEditingAcademicYearId(result.id);
    setEditingAcademicYearValue(result.academic_year || '');
  };

  const handleSaveAcademicYear = (resultId: string) => {
    updateResult(resultId, { academic_year: editingAcademicYearValue });
    setEditingAcademicYearId(null);
    setEditingAcademicYearValue('');
  };

  const handleCancelEditAcademicYear = () => {
    setEditingAcademicYearId(null);
    setEditingAcademicYearValue('');
  };

  const handleToggleFlag = (result: ExtractionResult) => {
    updateResult(result.id, { is_flagged: !result.is_flagged });
  };

  const handleOpenHistory = (resultId: string) => {
    setHistoryResultId(resultId);
    setIsHistoryOpen(true);
  };

  const handleTrackPriceUpdate = async (resultId: string) => {
    const result = projectResults.find(r => r.id === resultId);
    if (!result) return;

    setProcessingItems(prev => ({ ...prev, [resultId]: true }));

    try {
      // Run new extraction
      const extractedData = await simulateExtraction(result.school_name, result.program_name);

      // Get location if not already present
      let locationData = extractedData.location_data || result.location_data;
      if (!locationData) {
        locationData = await getCampusLocation(result.school_name, result.program_name);
      }

      // Create new version with extracted data
      await createNewVersion(resultId, {
        ...extractedData,
        location_data: locationData,
        extraction_date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Error tracking price update:', error);
    } finally {
      setProcessingItems(prev => ({ ...prev, [resultId]: false }));
    }
  };

  if (!project) return <div className="p-8">Project not found</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Project</span>
             <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs">{project.status}</span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">{project.name}</h2>
            <button 
                onClick={() => setIsEditProjectOpen(true)}
                className="p-1 text-slate-400 hover:text-jhu-heritage hover:bg-blue-50 rounded transition-colors"
                title="Edit Project Details"
            >
                <Pencil size={16} />
            </button>
            {user?.role === 'Admin' && (
                <button 
                    onClick={handleDeleteProject}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete Project"
                >
                    <Trash2 size={16} />
                </button>
            )}
          </div>
          <p className="text-slate-500 text-sm mt-1">{project.description}</p>
        </div>
        <div className="flex items-center gap-3">
           {pendingCount > 0 && (
             <button
               onClick={handleRunBatch}
               disabled={isBatchProcessing}
               className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all ${
                 isBatchProcessing 
                   ? 'bg-slate-100 text-slate-500 cursor-not-allowed' 
                   : 'bg-indigo-600 text-white hover:bg-indigo-700'
               }`}
             >
               {isBatchProcessing ? (
                 <>
                   <RefreshCw className="animate-spin" size={16} /> Processing Queue...
                 </>
               ) : (
                 <>
                   <Play size={16} /> Process Pending ({pendingCount})
                 </>
               )}
             </button>
           )}
           
           <button
             onClick={() => handleRunAnalysis()}
             disabled={isAnalyzing || isBatchProcessing}
             className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-70"
           >
             {isAnalyzing ? <RefreshCw className="animate-spin" size={16} /> : <Bot size={16} />}
             AI Analysis
           </button>
           
           <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
           >
             <Download size={16} /> Export
           </button>
        </div>
      </div>

      {/* AI Analysis Section - Collapsible */}
      {aiAnalysis && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm animate-fade-in-up">
          {/* Collapsible Header */}
          <button
            onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
            className="w-full flex items-center justify-between gap-3 p-6 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 text-left">
              <Bot className="text-jhu-heritage flex-shrink-0" size={20} />
              <div>
                <h3 className="font-semibold text-slate-900 text-lg">Executive Summary</h3>
                <p className="text-xs text-slate-500 mt-0.5">Strategic market analysis • Generated by Gemini 2.5</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ChevronDown
                size={20}
                className={`text-slate-400 transition-transform ${
                  isAnalysisExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {/* Expandable Content */}
          {isAnalysisExpanded && (
            <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
              {/* Copy Button */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={handleCopyAnalysis}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                  title="Copy analysis to clipboard"
                >
                  {copiedAnalysis ? (
                    <>
                      <CheckIcon size={16} className="text-green-600" />
                      <span className="text-green-600 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} className="text-slate-600" />
                      <span className="text-slate-600">Copy Analysis</span>
                    </>
                  )}
                </button>
              </div>

              {/* Analysis Content - Markdown Rendered */}
              <div className="bg-white rounded-lg p-6 text-slate-900">
                <div className="prose prose-sm prose-slate max-w-none">
                  <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                </div>
              </div>

              {/* Metadata Footer */}
              {analysisHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500">
                  <p>{analysisHistory.length} previous analysis versions available</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Controls & Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 sm:space-y-0 sm:flex items-center justify-between">
         {/* Search & Bulk Actions */}
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search schools or programs..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-jhu-heritage focus:border-transparent transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {user?.role === 'Admin' && (
             <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors animate-fade-in-up ${
                  selectedIds.size > 0 
                    ? 'bg-red-50 text-red-700 hover:bg-red-100' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
             >
                <Trash2 size={16} />
                {selectedIds.size > 0 ? `Delete (${selectedIds.size})` : 'Delete'}
             </button>
          )}

           <button 
            onClick={() => setIsAddTargetOpen(true)}
            disabled={isBatchProcessing}
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-blue-50 text-jhu-heritage hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
             <Plus size={16} /> Add Target
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                <TableIcon size={14} /> Data Table
            </button>
            <button
                onClick={() => setViewMode('analysis')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    viewMode === 'analysis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                <BarChart3 size={14} /> Market Analysis
            </button>

            {/* Export buttons (US1.4) */}
            {viewMode === 'analysis' && (
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-3">
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all"
                  title="Export results to CSV"
                >
                  <Download size={14} /> CSV
                </button>
                <button
                  onClick={exportToJSON}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
                  title="Export results to JSON"
                >
                  <Download size={14} /> JSON
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-jhu-heritage focus:ring-jhu-heritage"
                      onChange={handleSelectAll}
                      checked={filteredResults.length > 0 && selectedIds.size === filteredResults.length}
                    />
                  </th>
                  <th className="px-6 py-4 font-semibold text-slate-700">School / Program</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Tuition</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Academic Year</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Confidence</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 text-center w-20">Flag</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.map((result) => (
                  <tr key={result.id} className={`transition-colors group ${processingItems[result.id] ? 'bg-indigo-50/50' : 'hover:bg-slate-50'} ${selectedIds.has(result.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-4 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-jhu-heritage focus:ring-jhu-heritage"
                          checked={selectedIds.has(result.id)}
                          onChange={() => handleSelectOne(result.id)}
                        />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-slate-900">{result.school_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{result.program_name}</div>
                        </div>
                        {result.extraction_version > 1 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-jhu-heritage text-xs font-semibold rounded">
                            v{result.extraction_version}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {editingTuitionId === result.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingTuitionValue}
                            onChange={(e) => setEditingTuitionValue(e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded text-sm w-32 focus:outline-none focus:ring-2 focus:ring-jhu-heritage"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveTuition(result.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Save"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={handleCancelEditTuition}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : result.status === ExtractionStatus.SUCCESS ? (
                        <div className="flex items-center gap-2 group/tuition">
                          <div>
                            <span className="font-semibold text-slate-900">{result.tuition_amount}</span>
                            <div className="text-xs text-slate-400">{result.tuition_period}</div>
                            {result.updated_at && (
                              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <Clock size={12} />
                                {new Date(result.updated_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleStartEditTuition(result)}
                            className="p-1 text-slate-400 hover:text-jhu-heritage hover:bg-blue-50 rounded transition-colors opacity-0 group-hover/tuition:opacity-100"
                            title="Edit Tuition"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      ) : result.status === ExtractionStatus.PENDING ? (
                          <div className="flex items-center gap-2 text-slate-400 italic">
                               {processingItems[result.id] ? (
                                  <>
                                    <RefreshCw size={12} className="animate-spin text-indigo-600" />
                                    <span className="text-indigo-600 font-medium">Extracting...</span>
                                  </>
                               ) : isBatchProcessing ? (
                                  <span className="text-slate-400">Queued (Waiting)...</span>
                               ) : (
                                  <span>Pending extraction...</span>
                               )}
                          </div>
                      ) : (
                        <span className="text-slate-400 italic">Not available</span>
                      )}
                    </td>
                    {/* Academic Year Cell */}
                    <td className="px-6 py-4">
                      {editingAcademicYearId === result.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingAcademicYearValue}
                            onChange={(e) => setEditingAcademicYearValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAcademicYear(result.id);
                              if (e.key === 'Escape') handleCancelEditAcademicYear();
                            }}
                            className="px-2 py-1 border border-slate-300 rounded text-sm w-28 focus:outline-none focus:ring-2 focus:ring-jhu-heritage"
                            placeholder="2024-2025"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveAcademicYear(result.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Save"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={handleCancelEditAcademicYear}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : result.status === ExtractionStatus.SUCCESS ? (
                        <div className="flex items-center gap-2 group/academicyear">
                          <span className="text-sm text-slate-700">{result.academic_year || '—'}</span>
                          <button
                            onClick={() => handleStartEditAcademicYear(result)}
                            className="p-1 text-slate-400 hover:text-jhu-heritage hover:bg-blue-50 rounded transition-colors opacity-0 group-hover/academicyear:opacity-100"
                            title="Edit Academic Year"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {result.status === ExtractionStatus.NOT_FOUND ? (
                           <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                             <AlertTriangle size={12} /> Not Found
                           </span>
                        ) : result.status === ExtractionStatus.PENDING ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isBatchProcessing && !processingItems[result.id]
                                  ? 'bg-slate-50 text-slate-400 border border-slate-200'
                                  : 'bg-slate-100 text-slate-600'
                          }`}>
                             <Clock size={12} /> {isBatchProcessing && !processingItems[result.id] ? 'Queued' : 'Pending'}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            result.confidence_score === ConfidenceScore.HIGH ? 'bg-green-100 text-green-800' :
                            result.confidence_score === ConfidenceScore.MEDIUM ? 'bg-yellow-100 text-yellow-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {result.confidence_score === ConfidenceScore.HIGH ? <CheckCircle size={12}/> : <AlertTriangle size={12}/>}
                            {result.confidence_score}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleFlag(result)}
                        className={`p-1.5 rounded transition-colors ${
                          result.is_flagged
                            ? 'text-red-600 bg-red-50 hover:bg-red-100'
                            : 'text-slate-300 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title={result.is_flagged ? 'Unflag entry' : 'Flag entry for review'}
                      >
                        <Flag size={16} fill={result.is_flagged ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {result.status === ExtractionStatus.PENDING ? (
                          <div className="flex items-center gap-2">
                              <button
                                  onClick={() => handleRunExtraction(result)}
                                  disabled={processingItems[result.id] || isBatchProcessing}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-100 text-jhu-heritage hover:bg-blue-200 rounded-md transition-colors disabled:opacity-50"
                              >
                                  {processingItems[result.id] ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14} />}
                                  {processingItems[result.id] ? 'Running...' : 'Run Extraction'}
                              </button>
                          </div>
                        ) : (
                            <>
                               <button
                                  onClick={() => handleOpenHistory(result.id)}
                                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold bg-blue-100 text-jhu-heritage hover:bg-blue-200 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                  title="View Price History"
                               >
                                  <History size={14}/>
                               </button>
                               <button
                                  onClick={() => handleRunExtraction(result)}
                                  disabled={processingItems[result.id] || isBatchProcessing}
                                  className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                  title="Re-run Extraction"
                               >
                                  <RefreshCw className={processingItems[result.id] ? "animate-spin" : ""} size={14}/>
                               </button>
                              <a
                                  href={result.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 text-slate-400 hover:text-jhu-heritage hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="Open Source URL"
                              >
                                  <ExternalLink size={16} />
                              </a>
                              <button
                                  onClick={() => handleAudit(result)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                              >
                                  <Eye size={14} /> Audit
                              </button>
                            </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredResults.length === 0 && (
                  <tr>
                     <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                       No results found. Add a target to get started.
                     </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in-up">
          {/* Statistics Cards Section (US1.1) */}
          {isLoadingAnalytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-slate-100 p-6 rounded-xl animate-pulse h-32"></div>
              ))}
            </div>
          ) : analyticsData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Average Tuition"
                value={`$${analyticsData.avgTuition.toLocaleString()}`}
                icon={<DollarSign size={20} className="text-slate-600" />}
                subtitle={`${analyticsData.totalPrograms} programs`}
              />
              <StatCard
                title="Highest Tuition"
                value={analyticsData.highestTuition ? analyticsData.highestTuition.amount : 'N/A'}
                subtitle={analyticsData.highestTuition ? `${analyticsData.highestTuition.school}` : 'No data'}
                icon={<TrendingUp size={20} className="text-red-600" />}
                trend="up"
              />
              <StatCard
                title="Lowest Tuition"
                value={analyticsData.lowestTuition ? analyticsData.lowestTuition.amount : 'N/A'}
                subtitle={analyticsData.lowestTuition ? `${analyticsData.lowestTuition.school}` : 'No data'}
                icon={<TrendingDown size={20} className="text-emerald-600" />}
                trend="down"
              />
              <StatCard
                title="Success Rate"
                value={`${analyticsData.successRate}%`}
                subtitle={`${analyticsData.totalResults} total extractions`}
                icon={<Target size={20} className="text-blue-600" />}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* Chart 1: Competitive Landscape */}
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4">Competitor Pricing Landscape</h3>
              {chartData.pricing.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.pricing} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={120} tick={{fontSize: 10}} />
                      <Tooltip
                        contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        formatter={(value: any) => [`$${value.toLocaleString()}`, 'Tuition']}
                      />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                         {chartData.pricing.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : index === chartData.pricing.length - 1 ? '#22c55e' : '#3b82f6'} />
                         ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    Red: Most Expensive | Green: Least Expensive
                  </p>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-400 italic">
                  Run extraction to see pricing data
                </div>
              )}
           </div>

           {/* Chart 2: Confidence & Health */}
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-4">Data Confidence Distribution</h3>
              {chartData.confidence.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={chartData.confidence}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.confidence.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-400 italic">
                  Run extraction to see confidence metrics
                </div>
              )}
           </div>
          </div>

          {/* Chart 3: Tuition Trends Over Time (US1.2) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Tuition Trends Over Time</h3>
              {isLoadingTrends ? (
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded animate-pulse">Loading...</span>
              ) : trendsData && trendsData.length > 0 ? (
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Real Data</span>
              ) : (
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">No Data</span>
              )}
            </div>
            <div className="h-80">
              {isLoadingTrends ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <p>Loading trends data...</p>
                </div>
              ) : trendsData && trendsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{fontSize: 12}}
                      label={{ value: 'Extraction Date (YYYY-MM)', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      tick={{fontSize: 12}}
                      label={{ value: 'Average Tuition ($)', angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      formatter={(value: any) => [`$${value.toLocaleString()}`, 'Avg. Tuition']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgTuition"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', r: 5 }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 italic">
                  Run extraction to see tuition trends over time
                </div>
              )}
              {trendsData && trendsData.length > 0 && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Showing average tuition trends across {trendsData.length} extraction periods
                </p>
              )}
            </div>
          </div>

        {/* Additional Charts Grid (US1.3) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 4: Status Distribution (US1.3) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">Extraction Status Distribution</h3>
            {chartData.status.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={chartData.status}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.status.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400 italic">
                Run extraction to see status breakdown
              </div>
            )}
          </div>

          {/* Chart 5: STEM vs Non-STEM (US1.3) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4">STEM vs Non-STEM Programs</h3>
            {chartData.stem.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.stem} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11}} />
                    <Tooltip
                      contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                      formatter={(value: any) => [`${value} programs`, 'Count']}
                    />
                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                      {chartData.stem.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400 italic">
                Run extraction to see STEM classification
              </div>
            )}
          </div>
        </div>

        {/* Cost Per Credit Chart (spans full width) (US1.3) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Cost Per Credit Analysis (Top 10)</h3>
          {chartData.costPerCredit.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.costPerCredit} layout="vertical" margin={{ top: 5, right: 30, left: 150, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="school"
                    type="category"
                    width={150}
                    tick={{fontSize: 11}}
                  />
                  <Tooltip
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: any) => [`$${value.toLocaleString()}`, 'Cost per Credit']}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="cost" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center text-slate-400 italic">
              Run extraction to see cost per credit data
            </div>
          )}
        </div>
      </div>
      )}

      {/* Modals */}
      {selectedResult && (
        <AuditModal 
          isOpen={isAuditOpen} 
          onClose={() => setIsAuditOpen(false)} 
          data={selectedResult} 
        />
      )}
      
      <AddTargetModal
        isOpen={isAddTargetOpen}
        onClose={() => setIsAddTargetOpen(false)}
        onSubmit={(targets) => {
             addTargets(project.id, targets.map(t => ({ schoolName: t.school, programName: t.program })));
        }}
      />
      
      <EditProjectModal
        isOpen={isEditProjectOpen}
        onClose={() => setIsEditProjectOpen(false)}
        initialName={project.name}
        initialDescription={project.description}
        onSubmit={handleEditProject}
      />

      {/* History Modal */}
      {historyResultId && (
        <HistoryModal
          isOpen={isHistoryOpen}
          onClose={() => {
            setIsHistoryOpen(false);
            setHistoryResultId(null);
          }}
          resultId={historyResultId}
          onTrackUpdate={() => handleTrackPriceUpdate(historyResultId)}
        />
      )}

      {/* Floating Chat Assistant */}
      <ChatAssistant
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        data={projectResults.filter(r => r.status === ExtractionStatus.SUCCESS)}
        projectId={project?.id || ''}
      />

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen && confirmDialog.type === 'deleteProject'}
        title="Delete Project"
        message={`Are you sure you want to delete the entire project "${project?.name}"? This will permanently delete all ${projectResults.length} extracted records.`}
        confirmLabel="Delete Project"
        variant="danger"
        onConfirm={confirmDeleteProject}
        onCancel={() => setConfirmDialog({ isOpen: false, type: null })}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen && confirmDialog.type === 'bulkDelete'}
        title="Delete Selected Items"
        message={`Are you sure you want to delete ${selectedIds.size} selected item${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, type: null })}
      />
    </div>
  );
};
