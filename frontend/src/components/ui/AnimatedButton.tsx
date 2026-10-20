'use client';
import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface AnimatedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children:  ReactNode;
  variant?:  'primary' | 'secondary' | 'danger' | 'ghost';
  size?:     'sm' | 'md' | 'lg';
  loading?:  boolean;
  icon?:     ReactNode;
}

const VARIANTS = {
  primary:   'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20',
  secondary: 'bg-slate-800 hover:bg-slate-900 text-white shadow-lg shadow-slate-800/20',
  danger:    'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20',
  ghost:     'bg-transparent hover:bg-gray-100 text-gray-700 border border-gray-200',
};

const SIZES = {
  sm:  'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md:  'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg:  'px-7 py-3.5 text-base rounded-xl gap-2.5',
};

export function AnimatedButton({
  children, variant = 'primary', size = 'md', loading = false,
  icon, className = '', disabled, ...props
}: AnimatedButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-150',
        'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin shrink-0" /> : icon}
      {children}
    </button>
  );
}
