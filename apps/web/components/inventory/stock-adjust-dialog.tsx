'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryMovementType, ProductDto } from '@hub/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, ApiError } from '@/lib/api/client';
import { formatStock } from '@/lib/inventory/format';
import { parseCurrencyInput } from '@/lib/format';
import { cn } from '@/lib/utils';

type Direction = 'in' | 'out';

/** Motivos frequentes por direcao; "Outro" libera texto livre. */
const REASONS: Record<Direction, { type: InventoryMovementType; label: string }[]> = {
  in: [
    { type: 'PURCHASE', label: 'Compra / reposicao' },
    { type: 'ADJUSTMENT_IN', label: 'Correcao de estoque' },
    { type: 'OTHER_IN', label: 'Outra entrada' },
  ],
  out: [
    { type: 'ADJUSTMENT_OUT', label: 'Correcao de estoque' },
    { type: 'DAMAGE', label: 'Avaria' },
    { type: 'LOSS', label: 'Perda / extravio' },
    { type: 'OTHER_OUT', label: 'Outra saida' },
  ],
};

/**
 * Ajuste de estoque.
 *
 * Nao e "editar quantidade": o usuario declara o que ACONTECEU (entrada ou
 * saida, com motivo) e o sistema deriva o novo saldo. E o que mantem o
 * historico capaz de explicar o numero depois.
 */
export function StockAdjustDialog({
  product,
  open,
  onOpenChange,
  onCompleted,
}: {
  product: ProductDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: () => void;
}) {
  const [direction, setDirection] = useState<Direction>('in');
  const [type, setType] = useState<InventoryMovementType>('PURCHASE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseCurrencyInput(quantity);
  const amount = parsed !== null && parsed > 0 ? parsed : null;

  // Previsao do saldo: a pessoa confirma sabendo onde vai chegar.
  const nextBalance = useMemo(() => {
    if (amount === null) {
      return null;
    }

    return product.inventory.quantity + (direction === 'in' ? amount : -amount);
  }, [amount, direction, product.inventory.quantity]);

  const insufficient = nextBalance !== null && nextBalance < 0;

  const chooseDirection = (next: Direction) => {
    setDirection(next);
    setType(REASONS[next][0]!.type);
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (amount === null) {
      setError('Informe uma quantidade maior que zero.');
      return;
    }

    if (!reason.trim()) {
      setError('Informe o motivo do ajuste.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiClient.post('/inventory/movements', {
        productId: product.id,
        type,
        quantity: amount,
        reason: reason.trim(),
        notes: notes.trim() || null,
      });

      toast.success('Estoque atualizado.');
      setQuantity('');
      setReason('');
      setNotes('');
      onOpenChange(false);
      onCompleted();
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'Nao conseguimos registrar a movimentacao.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar estoque</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-danger-surface px-3 py-2 text-sm font-medium text-danger"
            >
              {error}
            </p>
          ) : null}

          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Tipo de movimentacao</legend>

            {(['in', 'out'] as Direction[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseDirection(option)}
                aria-pressed={direction === option}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                  direction === option
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-line-strong bg-surface text-foreground-muted hover:bg-surface-muted',
                )}
              >
                {option === 'in' ? (
                  <ArrowUpRight className="size-4" />
                ) : (
                  <ArrowDownLeft className="size-4" />
                )}
                {option === 'in' ? 'Entrada' : 'Saida'}
              </button>
            ))}
          </fieldset>

          <Field label="Motivo" htmlFor="movement-type">
            <select
              id="movement-type"
              value={type}
              onChange={(event) => setType(event.target.value as InventoryMovementType)}
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
            >
              {REASONS[direction].map((option) => (
                <option key={option.type} value={option.type}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Quantidade"
            htmlFor="movement-quantity"
            hint={`Saldo atual: ${formatStock(product.inventory.quantity, product.unit)}`}
          >
            <Input
              id="movement-quantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="0"
              inputMode="decimal"
              className="tabular"
              autoFocus
            />
          </Field>

          <Field label="Observacao" htmlFor="movement-notes" optional>
            <Textarea
              id="movement-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Detalhe o que aconteceu"
              className="min-h-16"
            />
          </Field>

          <Field label="Descricao do motivo" htmlFor="movement-reason">
            <Input
              id="movement-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: Recebimento da nota 1234"
            />
          </Field>

          {nextBalance !== null ? (
            <div
              className={cn(
                'rounded-lg px-3 py-2.5 text-sm',
                insufficient ? 'bg-danger-surface text-danger' : 'bg-surface-muted',
              )}
            >
              {insufficient ? (
                <span className="font-medium">
                  Estoque insuficiente. Disponivel:{' '}
                  {formatStock(product.inventory.quantity, product.unit)}.
                </span>
              ) : (
                <span className="flex items-center justify-between">
                  <span className="text-foreground-muted">Novo saldo</span>
                  <span className="font-semibold text-foreground tabular">
                    {formatStock(nextBalance, product.unit)}
                  </span>
                </span>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button type="submit" disabled={saving || insufficient || amount === null}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
