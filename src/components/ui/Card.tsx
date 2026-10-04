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
    default: 'glass-card text-text-primary rounded-2xl',
    elevated: 'glass-card-elevated text-text-primary rounded-2xl border-white/15',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4', // 16px
    md: 'p-5 md:p-6', // 20-24px
    lg: 'p-6 md:p-7', // 24-28px
  };

  return (
    <div
      className={`transition-all duration-200 ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
