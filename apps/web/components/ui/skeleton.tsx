import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton no formato do conteudo que vai chegar.
 * Preferimos isso a um spinner central: o usuario ja entende o layout.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-md', className)} {...props} />;
}
