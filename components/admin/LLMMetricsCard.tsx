import React from 'react';

interface LLMMetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass?: string;
}

export const LLMMetricsCard: React.FC<LLMMetricsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  colorClass = 'bg-blue-50'
}) => {
  return (
    <div className={`p-4 ${colorClass} rounded-lg`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-500 uppercase font-semibold tracking-wide">
          {title}
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
};

export default LLMMetricsCard;
