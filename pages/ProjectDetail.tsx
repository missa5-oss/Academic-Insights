
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ExtractionResult, ConfidenceScore, ExtractionStatus } from '../types';
import { AuditModal } from '../components/AuditModal';
import { AddTargetModal, EditProjectModal } from '../components/ProjectModals';
import { generateExecutiveSummary, simulateExtraction, getCampusLocation } from '../services/geminiService';
import { Search, RefreshCw, Bot, AlertTriangle, CheckCircle, ExternalLink, Eye, Download, Plus, Play, Clock, BarChart3, Table as TableIcon, Trash2, Pencil, MapPin, XCircle, Flag, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Legend, LineChart, Line } from 'recharts';
import { ChatAssistant } from '../components/ChatAssistant';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, results, addTargets, updateResult, deleteResult, editProject, deleteProject, user } = useApp();
  
  const project = projects.find(p => p.id === id);
  const projectResults = results.filter(r => r.project_id === id);
  
  const [viewMode, setViewMode] = useState<'table' | 'analysis'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResult, setSelectedResult] = useState<ExtractionResult | null>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isAddTargetOpen, setIsAddTargetOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [processingItems, setProcessingItems] = useState<Record<string, boolean>>({});
  const [locatingItems, setLocatingItems] = useState<Record<string, boolean>>({});

  // --- Selection State ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- Editing State ---
  const [editingTuitionId, setEditingTuitionId] = useState<string | null>(null);
  const [editingTuitionValue, setEditingTuitionValue] = useState<string>('');

  // Filter logic
  const filteredResults = projectResults.filter(result => 
    result.school_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.program_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = filteredResults.filter(r => r.status === ExtractionStatus.PENDING).length;

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
      { name: 'High', value: filteredResults.filter(r => r.confidence_score === ConfidenceScore.HIGH).length, color: '#16a34a' },
      { name: 'Medium', value: filteredResults.filter(r => r.confidence_score === ConfidenceScore.MEDIUM).length, color: '#eab308' },
      { name: 'Low', value: filteredResults.filter(r => r.confidence_score === ConfidenceScore.LOW).length, color: '#f97316' },
    ].filter(d => d.value > 0);

    // Placeholder data for tuition trends over time
    // In a real implementation, this would track historical tuition changes
    const trendData = [
      { year: '2020', avgTuition: 48000 },
      { year: '2021', avgTuition: 49500 },
      { year: '2022', avgTuition: 51200 },
      { year: '2023', avgTuition: 53000 },
      { year: '2024', avgTuition: 54800 },
      { year: '2025', avgTuition: 56500 },
    ];

    return { pricing: validData, confidence: confidenceData, trends: trendData };
  }, [filteredResults]);

  const handleAudit = (result: ExtractionResult) => {
    setSelectedResult(result);
    setIsAuditOpen(true);
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    const summary = await generateExecutiveSummary(filteredResults.filter(r => r.status === ExtractionStatus.SUCCESS));
    setAiAnalysis(summary);
    setIsAnalyzing(false);
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

    const headers = [
      "School Name",
      "Program Name",
      "Tuition Amount",
      "Period",
      "Academic Year",
      "Location",
      "Cost Per Credit",
      "Total Credits",
      "Program Length",
      "Status",
      "Confidence",
      "Remarks",
      "Source URL",
      "HTML Content Snippet"
    ];

    const escapeCsv = (val: string | null | undefined) => {
      if (!val) return "";
      const str = String(val);
      if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredResults.map(r => [
      escapeCsv(r.school_name),
      escapeCsv(r.program_name),
      escapeCsv(r.tuition_amount),
      escapeCsv(r.tuition_period),
      escapeCsv(r.academic_year),
      escapeCsv(r.location_data?.address),
      escapeCsv(r.cost_per_credit),
      escapeCsv(r.total_credits),
      escapeCsv(r.program_length),
      escapeCsv(r.status),
      escapeCsv(r.confidence_score),
      escapeCsv(r.remarks),
      escapeCsv(r.source_url),
      escapeCsv(r.raw_content)
    ].join(","));

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
    if (project && window.confirm(`Are you sure you want to delete the ENTIRE project "${project.name}"? This will delete all ${projectResults.length} extracted records.`)) {
        deleteProject(project.id);
        navigate('/');
    }
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

    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} selected items?`)) {
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
    }
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

  const handleToggleFlag = (result: ExtractionResult) => {
    updateResult(result.id, { is_flagged: !result.is_flagged });
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
                className="p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors"
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
             onClick={handleRunAnalysis}
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

      {/* AI Analysis Section */}
      {aiAnalysis && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm animate-fade-in-up">
           <div className="flex items-center gap-2 mb-3">
             <Bot className="text-brand-600" size={20} />
             <h3 className="font-semibold text-slate-900">Executive Summary (Generated by Gemini 2.5)</h3>
           </div>
           <div className="prose prose-sm prose-slate max-w-none">
             <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
           </div>
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
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
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
            className="hidden sm:flex items-center gap-2 px-3 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      onChange={handleSelectAll}
                      checked={filteredResults.length > 0 && selectedIds.size === filteredResults.length}
                    />
                  </th>
                  <th className="px-6 py-4 font-semibold text-slate-700">School / Program</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">Tuition</th>
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
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          checked={selectedIds.has(result.id)}
                          onChange={() => handleSelectOne(result.id)}
                        />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{result.school_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{result.program_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      {editingTuitionId === result.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingTuitionValue}
                            onChange={(e) => setEditingTuitionValue(e.target.value)}
                            className="px-2 py-1 border border-brand-300 rounded text-sm w-32 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                          </div>
                          <button
                            onClick={() => handleStartEditTuition(result)}
                            className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors opacity-0 group-hover/tuition:opacity-100"
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
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-brand-100 text-brand-700 hover:bg-brand-200 rounded-md transition-colors disabled:opacity-50"
                              >
                                  {processingItems[result.id] ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14} />}
                                  {processingItems[result.id] ? 'Running...' : 'Run Extraction'}
                              </button>
                          </div>
                        ) : (
                            <>
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
                                  className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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
                     <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
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

          {/* Chart 3: Tuition Trends Over Time */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Tuition Trends Over Time</h3>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Placeholder Data</span>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.trends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="year"
                    tick={{fontSize: 12}}
                    label={{ value: 'Academic Year', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis
                    tick={{fontSize: 12}}
                    label={{ value: 'Average Tuition ($)', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: any) => [`$${value.toLocaleString()}`, 'Avg. Tuition']}
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
              <p className="text-xs text-slate-400 mt-2 text-center">
                This is placeholder data showing hypothetical tuition trends. Historical tracking feature coming soon.
              </p>
            </div>
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
      
      {/* Floating Chat Assistant */}
      <ChatAssistant 
        isOpen={isChatOpen} 
        onToggle={() => setIsChatOpen(!isChatOpen)} 
        data={projectResults.filter(r => r.status === ExtractionStatus.SUCCESS)} 
      />
    </div>
  );
};
