import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useApp } from '../context/AppContext';
import { Activity, Database, DollarSign, TrendingUp, Calendar, ArrowUpDown } from 'lucide-react';
import { STORAGE_KEYS } from '@/src/config';
import { CrossProjectAnalytics, MarketPositionData, TuitionDistributionBin, ActivityTrendData } from '@/types';
import { ProjectCard } from '@/components/ProjectCard';

// Lazy load charts for better performance
const MarketPositionChart = lazy(() => import('@/components/charts/MarketPositionChart').then(m => ({ default: m.MarketPositionChart })));
const TuitionDistributionChart = lazy(() => import('@/components/charts/TuitionDistributionChart').then(m => ({ default: m.TuitionDistributionChart })));
const StemComparisonChart = lazy(() => import('@/components/charts/StemComparisonChart').then(m => ({ default: m.StemComparisonChart })));
const RecentActivityChart = lazy(() => import('@/components/charts/RecentActivityChart').then(m => ({ default: m.RecentActivityChart })));
const RecommendationsPanel = lazy(() => import('@/components/RecommendationsPanel').then(m => ({ default: m.RecommendationsPanel })));

type SortOption = 'date-newest' | 'date-oldest' | 'name-asc' | 'name-desc' | 'status' | 'results';

export const Dashboard: React.FC = () => {
  const { projects, results, getCrossProjectAnalytics, getMarketPositionData, getTuitionDistribution, getRecentActivity, getMarketRecommendations } = useApp();

  // Sort preference with localStorage persistence
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SORT_PREFERENCE);
    return (saved as SortOption) || 'date-newest';
  });

  // Cross-project analytics state
  const [analyticsData, setAnalyticsData] = useState<CrossProjectAnalytics | null>(null);
  const [marketPositionData, setMarketPositionData] = useState<MarketPositionData[]>([]);
  const [distributionData, setDistributionData] = useState<TuitionDistributionBin[]>([]);
  const [activityData, setActivityData] = useState<ActivityTrendData[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  // Fetch cross-project analytics on mount
  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoadingAnalytics(true);
      try {
        const [analytics, marketPosition, distribution, activity] = await Promise.all([
          getCrossProjectAnalytics(),
          getMarketPositionData(),
          getTuitionDistribution(),
          getRecentActivity()
        ]);

        setAnalyticsData(analytics);
        setMarketPositionData(marketPosition);
        setDistributionData(distribution);
        setActivityData(activity);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setIsLoadingAnalytics(false);
      }
    };

    fetchAnalytics();
  }, [results]); // Re-fetch when results change

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-4xl font-bold text-jhu-heritage">Dashboard</h2>
        <p className="text-slate-600 mt-2 text-lg">Cross-project market intelligence and strategic insights.</p>
      </div>

      {/* Hero Stats Cards - 5 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Total Programs Tracked */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Programs</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">
              {isLoadingAnalytics ? '-' : analyticsData?.totalPrograms || 0}
            </h3>
            <p className="text-xs text-slate-500 mt-1">Across all projects</p>
          </div>
          <div className="p-3 bg-blue-50 text-jhu-spirit rounded-lg">
            <Database size={24} />
          </div>
        </div>

        {/* Average Tuition */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Avg Tuition</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">
              {isLoadingAnalytics ? '-' : `$${(analyticsData?.avgTuition || 0).toLocaleString()}`}
            </h3>
            <p className="text-xs text-jhu-heritage font-semibold mt-1">Market Benchmark</p>
          </div>
          <div className="p-3 bg-green-50 text-jhu-green rounded-lg">
            <DollarSign size={24} />
          </div>
        </div>

        {/* Market Range */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Market Range</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-2">
              {isLoadingAnalytics || !analyticsData
                ? '-'
                : `$${((analyticsData.tuitionRange.max - analyticsData.tuitionRange.min) / 1000).toFixed(0)}k`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {analyticsData && `$${(analyticsData.tuitionRange.min / 1000).toFixed(0)}k - $${(analyticsData.tuitionRange.max / 1000).toFixed(0)}k`}
            </p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* STEM Programs */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">STEM Programs</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">
              {isLoadingAnalytics ? '-' : `${analyticsData?.stemPercentage || 0}%`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {analyticsData && `${analyticsData.stemCount} of ${analyticsData.totalPrograms}`}
            </p>
          </div>
          <div className="p-3 bg-sky-50 text-blue-600 rounded-lg">
            <Activity size={24} />
          </div>
        </div>

        {/* Recent Extractions */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Last 7 Days</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-2">
              {isLoadingAnalytics ? '-' : analyticsData?.recentExtractions || 0}
            </h3>
            <p className="text-xs text-jhu-green font-semibold mt-1">New Extractions</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Calendar size={24} />
          </div>
        </div>
      </div>

      {/* Cross-Project Insights - 2x2 Chart Grid */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-xl font-semibold text-slate-900">Cross-Project Insights</h3>
          <p className="text-sm text-slate-600 mt-1">Market analysis across all projects</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Market Position Chart */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Market Positioning Matrix</h4>
              <Suspense fallback={
                <div className="h-80 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jhu-heritage"></div>
                </div>
              }>
                <MarketPositionChart data={marketPositionData} loading={isLoadingAnalytics} />
              </Suspense>
            </div>

            {/* Tuition Distribution Chart */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Tuition Distribution</h4>
              <Suspense fallback={
                <div className="h-80 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jhu-heritage"></div>
                </div>
              }>
                <TuitionDistributionChart data={distributionData} loading={isLoadingAnalytics} />
              </Suspense>
            </div>

            {/* STEM Comparison Chart */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">STEM vs Non-STEM</h4>
              <Suspense fallback={
                <div className="h-80 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jhu-heritage"></div>
                </div>
              }>
                <StemComparisonChart data={analyticsData} loading={isLoadingAnalytics} />
              </Suspense>
            </div>

            {/* Recent Activity Chart */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Recent Activity (30 Days)</h4>
              <Suspense fallback={
                <div className="h-80 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jhu-heritage"></div>
                </div>
              }>
                <RecentActivityChart data={activityData} loading={isLoadingAnalytics} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>

      {/* AI Recommendations Panel */}
      <Suspense fallback={
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-slate-200 rounded w-1/4"></div>
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          </div>
        </div>
      }>
        <RecommendationsPanel
          analyticsData={analyticsData}
          onGenerate={getMarketRecommendations}
        />
      </Suspense>

      {/* Projects Grid */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
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
        <div className="p-6">
          {sortedProjects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProjects.map((project) => (
                <ProjectCard key={project.id} project={project} results={results} />
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-slate-500">
              No projects found. Create one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
