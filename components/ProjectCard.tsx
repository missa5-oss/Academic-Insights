import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ArrowRight, Clock, Database, AlertTriangle } from 'lucide-react';
import { Project, ExtractionResult } from '@/types';

interface ProjectCardProps {
  project: Project;
  results: ExtractionResult[];
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, results }) => {
  // Filter results for this project
  const projectResults = results.filter(r => r.project_id === project.id && r.status === 'Success' && r.tuition_amount);

  // Calculate project stats
  const avgTuition = projectResults.length > 0
    ? Math.round(
        projectResults.reduce((sum, r) => {
          const amount = parseFloat(r.tuition_amount?.replace(/[^0-9.]/g, '') || '0');
          return sum + amount;
        }, 0) / projectResults.length
      )
    : 0;

  // Get tuition range for mini chart (group into bins)
  const getTuitionBins = () => {
    if (projectResults.length === 0) return [];

    const tuitions = projectResults.map(r =>
      parseFloat(r.tuition_amount?.replace(/[^0-9.]/g, '') || '0')
    );

    const min = Math.min(...tuitions);
    const max = Math.max(...tuitions);
    const range = max - min;

    if (range === 0) {
      return [{ name: `$${(min / 1000).toFixed(0)}k`, count: tuitions.length }];
    }

    // Create 4 bins
    const binSize = range / 4;
    const bins = [
      { name: `$${(min / 1000).toFixed(0)}k`, count: 0, min: min, max: min + binSize },
      { name: '', count: 0, min: min + binSize, max: min + 2 * binSize },
      { name: '', count: 0, min: min + 2 * binSize, max: min + 3 * binSize },
      { name: `$${(max / 1000).toFixed(0)}k`, count: 0, min: min + 3 * binSize, max: max }
    ];

    tuitions.forEach(t => {
      const bin = bins.find(b => t >= b.min && t <= b.max);
      if (bin) bin.count++;
    });

    return bins;
  };

  const chartData = getTuitionBins();

  // Check if data is stale (>30 days)
  const isStale = () => {
    if (!project.last_run || project.last_run === 'Never') return false;
    try {
      const lastRun = new Date(project.last_run);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return lastRun < thirtyDaysAgo;
    } catch {
      return false;
    }
  };

  const staleData = isStale();

  return (
    <Link
      to={`/project/${project.id}`}
      className="block bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 group-hover:text-jhu-heritage transition-colors truncate">
              {project.name}
            </h3>
            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
              {project.description}
            </p>
          </div>
          <span
            className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold border shrink-0 ${
              project.status === 'Active'
                ? 'bg-green-50 text-jhu-green border-green-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {project.status}
          </span>
        </div>
      </div>

      {/* Mini Chart */}
      <div className="px-5 py-3 bg-slate-50">
        {chartData.length > 0 ? (
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Bar dataKey="count" fill="#007567" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center text-xs text-slate-400">
            No tuition data
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="px-5 py-4 space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Programs</span>
          <span className="font-semibold text-slate-900">{project.results_count}</span>
        </div>
        {avgTuition > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Avg Tuition</span>
            <span className="font-semibold text-jhu-heritage">${avgTuition.toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 flex items-center gap-1">
            <Clock size={12} />
            Last Run
          </span>
          <span className={`text-xs ${staleData ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
            {project.last_run}
            {staleData && (
              <AlertTriangle size={12} className="inline ml-1 text-amber-600" />
            )}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">View Details</span>
          <ArrowRight size={16} className="text-slate-400 group-hover:text-jhu-heritage group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </Link>
  );
};
