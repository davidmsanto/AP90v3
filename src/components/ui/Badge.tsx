import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'critical' | 'warning' | 'neutral';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  icon,
  children,
  className = '',
  ...props
}) => {
  const variantStyles = {
    success: 'bg-accent-success/15 text-accent-success border-accent-success/30',
    critical: 'bg-accent-critical/15 text-accent-critical border-accent-critical/30',
    warning: 'bg-accent-warning/15 text-accent-warning border-accent-warning/30',
    neutral: 'bg-surface-elevated text-text-secondary border-surface-border',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption font-mono font-medium border ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
