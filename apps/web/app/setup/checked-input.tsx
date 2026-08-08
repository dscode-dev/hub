'use client';

import { Check } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Campo com confirmacao visual.
 *
 * O check aparece assim que o valor fica valido, enquanto a pessoa digita.
 * Num cadastro de varias etapas isso substitui a validacao "no fim do
 * formulario": o acerto e comunicado no momento em que acontece, e o erro deixa
 * de ser surpresa ao clicar em continuar.
 */
export function CheckedInput({
  valid = false,
  className,
  ...props
}: InputProps & { valid?: boolean }) {
  return (
    <div className="relative">
      <Input className={cn(valid && 'pr-10', className)} {...props} />

      {valid ? (
        <span
          // Decorativo: o estado ja e comunicado pelo proprio valor do campo.
          aria-hidden="true"
          data-field-valid="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-[check-pop_260ms_ease-out] text-success motion-reduce:animate-none"
        >
          <Check className="size-4" strokeWidth={3} />
        </span>
      ) : null}
    </div>
  );
}
