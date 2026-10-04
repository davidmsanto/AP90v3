import React from 'react';
import { Card, CardProps } from './Card';

export interface MetricCardProps {
  label: string;
  value: string | number;
  context?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: CardProps['variant'];
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  context,
  badge,
  icon,
  variant = 'default',
  className = '',
}) => {
  return (
    <Card 
      variant={variant} 
      padding="md" 
      className={`flex flex-col justify-between hover:border-white/20 transition-all group ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-caption font-semibold uppercase tracking-wider text-text-secondary group-hover:text-text-primary transition-colors">
          {label}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {badge}
          {icon && (
            <span className="w-7 h-7 rounded-lg glass-pill flex items-center justify-center text-text-secondary group-hover:text-[#00e676] group-hover:border-[#00e676]/30 transition-all">
              {icon}
            </span>
          )}
        </div>
      </div>

      <div className="text-3xl font-bold font-mono text-text-primary tracking-tight my-1">
        {value}
      </div>

      {context && (
        <div className="text-caption text-text-muted font-mono mt-2 truncate flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[#00e676]" />
          <span>{context}</span>
        </div>
      )}
    </Card>
  );
};
