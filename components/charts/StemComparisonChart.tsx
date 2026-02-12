import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { CrossProjectAnalytics } from '@/types';

interface StemComparisonChartProps {
  data: CrossProjectAnalytics | null;
  loading?: boolean;
}

export const StemComparisonChart: React.FC<StemComparisonChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jhu-heritage"></div>
      </div>
    );
  }

  if (!data || (data.stemCount === 0 && data.nonStemCount === 0)) {
    return (
      <div className="h-80 flex items-center justify-center text-slate-500">
        No STEM comparison data available
      </div>
    );
  }

  // Transform data for bar chart
  const chartData = [
    {
      category: 'STEM',
      count: data.stemCount,
      percentage: data.stemPercentage,
      color: '#3b82f6'
    },
    {
      category: 'Non-STEM',
      count: data.nonStemCount,
      percentage: 100 - data.stemPercentage,
      color: '#8b5cf6'
    }
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-900">{data.category} Programs</p>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-medium">{data.count}</span> programs
          </p>
          <p className="text-sm text-jhu-heritage font-medium">
            {data.percentage}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="category"
            label={{ value: 'Program Type', position: 'insideBottom', offset: -10, style: { fill: '#64748b' } }}
            stroke="#94a3b8"
          />
          <YAxis
            label={{ value: 'Number of Programs', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }}
            stroke="#94a3b8"
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary stats below chart */}
      <div className="mt-4 flex justify-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-slate-600">
            STEM: <span className="font-semibold text-slate-900">{data.stemCount}</span> ({data.stemPercentage}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-slate-600">
            Non-STEM: <span className="font-semibold text-slate-900">{data.nonStemCount}</span> ({100 - data.stemPercentage}%)
          </span>
        </div>
      </div>
    </div>
  );
};
