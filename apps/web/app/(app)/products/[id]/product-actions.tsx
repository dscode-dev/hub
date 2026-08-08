'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductDto } from '@hub/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient, ApiError } from '@/lib/api/client';

export function ProductActions({ product }: { product: ProductDto }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const remove = async () => {
    setWorking(true);

    try {
      await apiClient.delete(`/products/${product.id}`);
      toast.success('Produto removido do catalogo.');
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Nao foi possivel remover.');
    } finally {
      setWorking(false);
    }
  };

  const restore = async () => {
    setWorking(true);

    try {
      await apiClient.patch(`/products/${product.id}`, { active: true });
      toast.success('Produto reativado.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Nao foi possivel reativar.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex shrink-0 gap-2">
      <Button
        variant="secondary"
        onClick={() => router.push(`/products/${product.id}/edit`)}
      >
        <Pencil className="size-4" />
        Editar
      </Button>

      {product.active ? (
        <Button variant="ghost" onClick={() => setConfirmOpen(true)} disabled={working}>
          <Trash2 className="size-4" />
          Remover
        </Button>
      ) : (
        <Button variant="ghost" onClick={() => void restore()} disabled={working}>
          <RotateCcw className="size-4" />
          Reativar
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover {product.name}?</DialogTitle>
            {/* Explicitar que nada e perdido reduz o medo de clicar. */}
            <DialogDescription>
              O produto sai das listagens, mas o historico e mantido. Voce pode reativa-lo
              quando quiser.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={working}
            >
              Cancelar
            </Button>

            <Button variant="danger" onClick={() => void remove()} disabled={working}>
              {working ? <Loader2 className="size-4 animate-spin" /> : null}
              Remover produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
