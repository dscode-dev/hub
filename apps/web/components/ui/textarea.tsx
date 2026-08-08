import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[88px] w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-foreground',
        'placeholder:text-foreground-subtle',
        'focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100',
        'disabled:cursor-not-allowed disabled:bg-surface-muted',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
