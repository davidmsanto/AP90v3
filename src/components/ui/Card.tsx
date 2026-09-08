import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className = '',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-surface-card border-surface-border text-text-primary',
    elevated: 'bg-surface-elevated border-surface-border-elevated text-text-primary shadow-lg shadow-black/40',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4', // 16px
    md: 'p-5', // 20px
    lg: 'p-6', // 24px
  };

  return (
    <div
      className={`rounded-card border transition-colors ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
