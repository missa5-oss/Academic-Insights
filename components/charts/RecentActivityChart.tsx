import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ActivityTrendData } from '@/types';

interface RecentActivityChartProps {
  data: ActivityTrendData[];
  loading?: boolean;
}

export const RecentActivityChart: React.FC<RecentActivityChartProps> = ({ data, loading }) => {
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
        No recent activity data available
      </div>
    );
  }

  // Format date for display (MM/DD)
  const formattedData = data.map(d => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-900 mb-2">{data.displayDate}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-green-600 font-medium">Success:</span>{' '}
              {data.successCount}
            </p>
            <p className="text-sm">
              <span className="text-red-600 font-medium">Failures:</span>{' '}
              {data.failureCount}
            </p>
            <p className="text-sm border-t border-slate-200 pt-1 mt-1">
              <span className="text-slate-600 font-medium">Total:</span>{' '}
              {data.totalCount}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formattedData}
          margin={{ top: 20, right: 20, bottom: 40, left: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="displayDate"
            label={{ value: 'Date (Last 30 Days)', position: 'insideBottom', offset: -10, style: { fill: '#64748b' } }}
            stroke="#94a3b8"
            interval="preserveStartEnd"
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            label={{ value: 'Extraction Count', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }}
            stroke="#94a3b8"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
          />
          <Line
            type="monotone"
            dataKey="successCount"
            stroke="#22c55e"
            strokeWidth={2}
            name="Successful"
            dot={{ fill: '#22c55e', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="failureCount"
            stroke="#ef4444"
            strokeWidth={2}
            name="Failed"
            dot={{ fill: '#ef4444', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="totalCount"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Total"
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
