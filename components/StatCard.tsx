import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  valueClass?: string;
}

/**
 * StatCard Component
 * Displays a metric card with title, value, icon, and optional trend indicator
 * Used in Market Analysis dashboard for key statistics (avg tuition, highest, lowest, completion rate)
 */
export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend = 'neutral',
  valueClass = 'text-3xl font-bold text-slate-900'
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-emerald-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Minus className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Icon and Trend Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-slate-600 opacity-75">{icon}</div>
        {getTrendIcon()}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-slate-600 mb-2">{title}</h3>

      {/* Value */}
      <p className={valueClass}>{value}</p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
      )}
    </div>
  );
};

export default StatCard;
