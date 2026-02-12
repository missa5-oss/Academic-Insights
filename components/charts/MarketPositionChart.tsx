import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { MarketPositionData } from '@/types';

interface MarketPositionChartProps {
  data: MarketPositionData[];
  loading?: boolean;
}

export const MarketPositionChart: React.FC<MarketPositionChartProps> = ({ data, loading }) => {
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
        No market position data available
      </div>
    );
  }

  // Transform data for scatter plot (group by STEM/Non-STEM)
  const stemData = data
    .filter(d => d.isStem)
    .map(d => ({
      x: d.tuition,
      y: 1, // STEM category
      school: d.school,
      program: d.program,
      projectName: d.projectName
    }));

  const nonStemData = data
    .filter(d => !d.isStem)
    .map(d => ({
      x: d.tuition,
      y: 0, // Non-STEM category
      school: d.school,
      program: d.program,
      projectName: d.projectName
    }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-900">{data.school}</p>
          <p className="text-sm text-slate-600">{data.program}</p>
          <p className="text-sm text-slate-500 mt-1">Project: {data.projectName}</p>
          <p className="text-sm font-medium text-jhu-heritage mt-1">
            ${data.x.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            type="number"
            dataKey="x"
            name="Tuition"
            label={{ value: 'Tuition Amount ($)', position: 'insideBottom', offset: -10, style: { fill: '#64748b' } }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            stroke="#94a3b8"
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Program Type"
            label={{ value: 'Program Type', angle: -90, position: 'insideLeft', style: { fill: '#64748b' } }}
            ticks={[0, 1]}
            tickFormatter={(value) => value === 1 ? 'STEM' : 'Non-STEM'}
            stroke="#94a3b8"
            domain={[-0.2, 1.2]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
          />
          <Scatter
            name="STEM Programs"
            data={stemData}
            fill="#3b82f6"
            fillOpacity={0.6}
          />
          <Scatter
            name="Non-STEM Programs"
            data={nonStemData}
            fill="#8b5cf6"
            fillOpacity={0.6}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
