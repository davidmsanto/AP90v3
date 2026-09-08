import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary:
      'bg-accent-success text-black font-semibold hover:bg-accent-success-hover active:opacity-90 shadow-[0_0_20px_rgba(16,185,129,0.25)] border border-accent-success',
    secondary:
      'bg-transparent border border-surface-border text-text-primary hover:bg-surface-elevated hover:border-surface-border-elevated active:bg-surface-card',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-caption rounded-lg gap-1.5',
    md: 'px-4 py-2 text-body rounded-lg gap-2',
    lg: 'px-5 py-2.5 text-body rounded-lg gap-2.5 font-medium',
  };

  return (
    <button
      className={`inline-flex items-center justify-center font-sans transition-all duration-150 select-none disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
