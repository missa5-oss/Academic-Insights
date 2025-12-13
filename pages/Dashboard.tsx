
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Activity, Database, ArrowUpDown } from 'lucide-react';
import { ConfidenceScore, ExtractionStatus } from '../types';
import { STORAGE_KEYS } from '@/src/config';

type SortOption = 'date-newest' | 'date-oldest' | 'name-asc' | 'name-desc' | 'status' | 'results';

export const Dashboard: React.FC = () => {
  const { projects, results } = useApp();

  // Sort preference with localStorage persistence
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SORT_PREFERENCE);
    return (saved as SortOption) || 'date-newest';
  });

  const handleSortChange = (option: SortOption) => {
    setSortBy(option);
    localStorage.setItem(STORAGE_KEYS.SORT_PREFERENCE, option);
  };

  // Sorted projects
  const sortedProjects = useMemo(() => {
    const sorted = [...projects];
    switch (sortBy) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'date-newest':
        return sorted.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      case 'date-oldest':
        return sorted.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case 'status': {
        const statusOrder: Record<string, number> = { 'Active': 0, 'Completed': 1, 'Idle': 2 };
        return sorted.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
      }
      case 'results':
        return sorted.sort((a, b) => b.results_count - a.results_count);
      default:
        return sorted;
    }
  }, [projects, sortBy]);

  // Compute Stats
  const activeProjects = projects.filter(p => p.status === 'Active').length;
  const totalSchools = results.length;

  // Compute Average Confidence Score
  const completedResults = results.filter(r => 
    r.status === ExtractionStatus.SUCCESS || r.status === ExtractionStatus.NOT_FOUND
  );

  let confidencePercentage = 0;
  if (completedResults.length > 0) {
    const totalScore = completedResults.reduce((acc, curr) => {
      // Weighting logic for confidence
      if (curr.confidence_score === ConfidenceScore.HIGH) return acc + 100;
      if (curr.confidence_score === ConfidenceScore.MEDIUM) return acc + 75;
      if (curr.confidence_score === ConfidenceScore.LOW) return acc + 40;
      return acc;
    }, 0);
    confidencePercentage = Math.round(totalScore / completedResults.length);
  }

  // Determine UI styles based on confidence
  let confidenceLabel = "No Data";
  let confidenceTextColor = "text-slate-400";
  let confidenceIconStyle = "bg-slate-50 text-slate-400";

  if (completedResults.length > 0) {
    if (confidencePercentage >= 85) {
      confidenceLabel = "High Accuracy";
      confidenceTextColor = "text-jhu-green";
      confidenceIconStyle = "bg-green-50 text-jhu-green";
    } else if (confidencePercentage >= 60) {
      confidenceLabel = "Moderate Accuracy";
      confidenceTextColor = "text-jhu-gold";
      confidenceIconStyle = "bg-yellow-50 text-jhu-gold";
    } else {
      confidenceLabel = "Needs Review";
      confidenceTextColor = "text-jhu-accent";
      confidenceIconStyle = "bg-red-50 text-jhu-accent";
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-4xl font-bold text-jhu-heritage">Dashboard</h2>
        <p className="text-slate-600 mt-2 text-lg">Overview of your tuition intelligence operations.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Active Projects</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{activeProjects}</h3>
            <p className="text-xs text-jhu-green font-semibold mt-1">Operations Normal</p>
          </div>
          <div className="p-3 bg-blue-50 text-jhu-heritage rounded-lg">
            <Activity size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Schools Tracked</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{totalSchools}</h3>
            <p className="text-xs text-slate-500 mt-1">Across all projects</p>
          </div>
          <div className="p-3 bg-sky-50 text-jhu-spirit rounded-lg">
            <Database size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Avg. Confidence Score</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">
              {completedResults.length > 0 ? `${confidencePercentage}%` : '-'}
            </h3>
            <p className={`text-xs font-semibold mt-1 ${confidenceTextColor}`}>{confidenceLabel}</p>
          </div>
          <div className={`p-3 rounded-lg ${confidenceIconStyle}`}>
            <Activity size={24} />
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900">Projects</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ArrowUpDown size={14} className="text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-jhu-heritage focus:border-transparent cursor-pointer"
              >
                <option value="date-newest">Newest First</option>
                <option value="date-oldest">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="status">Status</option>
                <option value="results">Most Results</option>
              </select>
            </div>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {sortedProjects.length > 0 ? sortedProjects.map((project) => (
            <div key={project.id} className="p-6 hover:bg-jhu-gray transition-colors group">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900 group-hover:text-jhu-heritage transition-colors">
                    <Link to={`/project/${project.id}`}>{project.name}</Link>
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">{project.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Last run: {project.last_run}
                    </span>
                    <span className="flex items-center gap-1">
                      <Database size={12} /> {project.results_count} records
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    project.status === 'Active'
                      ? 'bg-green-50 text-jhu-green border-green-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {project.status}
                  </span>
                  <Link
                    to={`/project/${project.id}`}
                    className="p-2 text-slate-400 hover:text-jhu-heritage hover:bg-blue-50 rounded-full transition-colors"
                  >
                    <ArrowRight size={20} />
                  </Link>
                </div>
              </div>
            </div>
          )) : (
             <div className="p-10 text-center text-slate-500">
                No projects found. Create one to get started.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
