
import React from 'react';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Activity, Database } from 'lucide-react';
import { ConfidenceScore, ExtractionStatus } from '../types';

export const Dashboard: React.FC = () => {
  const { projects, results } = useApp();

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
      confidenceTextColor = "text-green-600";
      confidenceIconStyle = "bg-emerald-50 text-emerald-600";
    } else if (confidencePercentage >= 60) {
      confidenceLabel = "Moderate Accuracy";
      confidenceTextColor = "text-yellow-600";
      confidenceIconStyle = "bg-yellow-50 text-yellow-600";
    } else {
      confidenceLabel = "Needs Review";
      confidenceTextColor = "text-orange-600";
      confidenceIconStyle = "bg-orange-50 text-orange-600";
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 mt-1">Overview of your tuition intelligence operations.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Active Projects</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{activeProjects}</h3>
            <p className="text-xs text-green-600 font-medium mt-1">Operations Normal</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Activity size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Total Schools Tracked</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">{totalSchools}</h3>
            <p className="text-xs text-slate-400 mt-1">Across all projects</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Database size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Avg. Confidence Score</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">
              {completedResults.length > 0 ? `${confidencePercentage}%` : '-'}
            </h3>
            <p className={`text-xs font-medium mt-1 ${confidenceTextColor}`}>{confidenceLabel}</p>
          </div>
          <div className={`p-3 rounded-lg ${confidenceIconStyle}`}>
            <Activity size={24} />
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Recent Projects</h3>
          <button className="text-sm text-brand-600 font-medium hover:underline">View All</button>
        </div>
        <div className="divide-y divide-slate-100">
          {projects.length > 0 ? projects.map((project) => (
            <div key={project.id} className="p-6 hover:bg-slate-50 transition-colors group">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
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
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    project.status === 'Active' 
                      ? 'bg-green-50 text-green-700 border-green-200' 
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {project.status}
                  </span>
                  <Link 
                    to={`/project/${project.id}`}
                    className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-full transition-colors"
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
