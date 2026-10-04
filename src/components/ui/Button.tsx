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
      'bg-gradient-to-b from-[#00f584] via-[#00e676] to-[#00b355] text-[#031d10] font-bold hover:brightness-105 active:scale-[0.98] shadow-[0_0_22px_rgba(0,230,118,0.45)] hover:shadow-[0_0_32px_rgba(0,230,118,0.65)] border border-[#7affba]/60 tracking-wide',
    secondary:
      'glass-pill text-text-primary hover:text-white hover:bg-white/[0.08] hover:border-white/20 active:scale-[0.98] transition-all',
  };

  const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-caption rounded-full gap-1.5',
    md: 'px-5 py-2.5 text-body rounded-full gap-2 font-medium',
    lg: 'px-6 py-3 text-body rounded-full gap-2.5 font-semibold text-base',
  };

  return (
    <button
      className={`inline-flex items-center justify-center font-sans transition-all duration-200 select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
