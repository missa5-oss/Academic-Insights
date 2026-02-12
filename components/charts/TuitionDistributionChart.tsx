import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TuitionDistributionBin } from '@/types';

interface TuitionDistributionChartProps {
  data: TuitionDistributionBin[];
  loading?: boolean;
}

export const TuitionDistributionChart: React.FC<TuitionDistributionChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-jhu-heritage"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-slate-500">
        No distribution data available
      </div>
    );
  }

  // Color mapping for bins
  const getBarColor = (range: string) => {
    switch (range) {
      case '0-30k':
        return '#22c55e'; // Green (low)
      case '30-50k':
        return '#3b82f6'; // Blue (medium-low)
      case '50-70k':
        return '#f59e0b'; // Amber (medium-high)
      case '70k+':
        return '#ef4444'; // Red (high)
      default:
        return '#64748b'; // Slate (default)
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-900">{data.range}</p>
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
          data={data}
          margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="range"
            label={{ value: 'Tuition Range', position: 'insideBottom', offset: -10, style: { fill: '#64748b' } }}
            stroke="#94a3b8"
          />
          <YAxis
            label={{ value: 'Number of Programs', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }}
            stroke="#94a3b8"
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
