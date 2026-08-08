import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-foreground transition-colors',
        'placeholder:text-foreground-subtle',
        'focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-subtle',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger-surface',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
