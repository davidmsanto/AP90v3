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
    success: 'bg-[#00e676]/10 text-[#00e676] border-[#00e676]/40 shadow-[0_0_10px_rgba(0,230,118,0.2)]',
    critical: 'bg-red-500/10 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
    neutral: 'glass-pill text-text-secondary border-white/10',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-caption font-mono font-medium border ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
