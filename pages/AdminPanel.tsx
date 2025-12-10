
import React, { useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { DollarSign, Server, Cpu, Database, Download, Upload, AlertCircle, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ExtractionStatus, ExtractionResult } from '../types';

export const AdminPanel: React.FC = () => {
  const { results, projects, restoreData } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate Real-time Usage Metrics based on Results
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-4xl font-bold text-jhu-heritage">System Administration</h2>
        <p className="text-slate-600 mt-2 text-lg">Monitor API usage, costs, and system health based on live project data.</p>
      </div>

      {/* Database Management Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
         <div className="flex items-center gap-3 mb-6">
            <Database className="text-jhu-heritage" size={24} />
            <h3 className="text-xl font-semibold text-jhu-heritage">Database Management</h3>
         </div>

         <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
            <div className="text-sm text-blue-800">
               <p className="font-semibold mb-1">Data Persistence Notice</p>
               <p>This application uses browser storage. In this development environment, updates to the code may reset your session.
               Use the <strong>Backup</strong> button below to save your data locally, and <strong>Restore</strong> to reload it if lost.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <Cpu size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Est. Token Usage</p>
                <h3 className="text-xl font-bold text-slate-900">{usageStats.totalTokens.toLocaleString()}</h3>
              </div>
           </div>
           <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
             {/* Visual progress bar just for effect */}
             <div className="h-full bg-purple-500" style={{ width: '45%' }}></div>
           </div>
           <p className="text-xs text-slate-400 mt-2">Based on extraction volume</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 text-jhu-gold rounded-lg">
                <Server size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Agent Runs</p>
                <h3 className="text-xl font-bold text-slate-900">{usageStats.totalCalls.toLocaleString()}</h3>
              </div>
           </div>
           <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-jhu-gold" style={{ width: '30%' }}></div>
           </div>
           <p className="text-xs text-slate-400 mt-2">Successful/Attempted Extractions</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-50 text-jhu-green rounded-lg">
                <DollarSign size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Est. Cost (Total)</p>
                <h3 className="text-xl font-bold text-slate-900">${usageStats.totalCost.toFixed(2)}</h3>
              </div>
           </div>
           <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-jhu-green" style={{ width: '15%' }}></div>
           </div>
           <p className="text-xs text-slate-400 mt-2">Cumulative project cost</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Token Usage Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-semibold text-slate-900 mb-6">AI Token Usage (Last 7 Days)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usageStats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="tokens" fill="#002D72" radius={[4, 4, 0, 0]} name="Tokens" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-xl font-semibold text-slate-900 mb-6">Daily Cost Trend (USD)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usageStats.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend />
                <Line type="monotone" dataKey="cost" stroke="#007567" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} name="Cost ($)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Latest Extractions Audit Trail */}
      <ExtractionAuditTrail results={results} />
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
