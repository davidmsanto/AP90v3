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
    <Card variant={variant} padding="md" className={`flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-caption font-medium uppercase tracking-wider text-text-secondary truncate">
          {label}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {badge}
          {icon && <span className="text-text-secondary">{icon}</span>}
        </div>
      </div>

      <div className="text-2xl font-bold font-mono text-text-primary tracking-tight my-1">
        {value}
      </div>

      {context && (
        <div className="text-caption text-text-secondary font-mono mt-1 truncate">
          {context}
        </div>
      )}
    </Card>
  );
};
