'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductDto } from '@hub/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, ApiError } from '@/lib/api/client';
import { parseCurrencyInput } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CategoryPicker } from './category-picker';

interface ProductFormProps {
  mode: 'create' | 'edit';
  product?: ProductDto;
}

interface FormState {
  name: string;
  salePrice: string;
  sku: string;
  categoryId: string | null;
  trackInventory: boolean;
  stockQuantity: string;
  minStockQuantity: string;
  barcode: string;
  costPrice: string;
  description: string;
}

const DRAFT_KEY = 'hub:product-draft';

function initialState(product?: ProductDto): FormState {
  return {
    name: product?.name ?? '',
    salePrice: product ? String(product.salePrice).replace('.', ',') : '',
    sku: product?.sku ?? '',
    categoryId: product?.categoryId ?? null,
    trackInventory: product?.trackInventory ?? false,
    stockQuantity: product?.trackInventory ? String(product.stockQuantity) : '',
    minStockQuantity:
      product?.minStockQuantity !== null && product?.minStockQuantity !== undefined
        ? String(product.minStockQuantity)
        : '',
    barcode: product?.barcode ?? '',
    costPrice:
      product?.costPrice !== null && product?.costPrice !== undefined
        ? String(product.costPrice).replace('.', ',')
        : '',
    description: product?.description ?? '',
  };
}

/**
 * Formulario de produto.
 *
 * Decisoes de UX:
 *  - obrigatorio e so nome + preco; o resto e opcional ou fica em "Mais informacoes";
 *  - campos de estoque so aparecem quando o controle e ligado;
 *  - preco aceita "1.299,90" ou "1299.90";
 *  - rascunho do cadastro sobrevive a um refresh acidental;
 *  - depois de salvar, o usuario escolhe o proximo passo em vez de ser levado.
 */
export function ProductForm({ mode, product }: ProductFormProps) {
  const router = useRouter();

  const [form, setForm] = useState<FormState>(() => initialState(product));
  const [showMore, setShowMore] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedProduct, setSavedProduct] = useState<ProductDto | null>(null);

  // Recupera rascunho de um cadastro interrompido (fechou a aba, recarregou).
  useEffect(() => {
    if (mode !== 'create' || typeof window === 'undefined') {
      return;
    }

    const stored = window.sessionStorage.getItem(DRAFT_KEY);

    if (!stored) {
      return;
    }

    try {
      setForm(JSON.parse(stored) as FormState);
      toast('Recuperamos o que voce tinha preenchido.');
    } catch {
      window.sessionStorage.removeItem(DRAFT_KEY);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'create' || typeof window === 'undefined') {
      return;
    }

    if (!form.name && !form.salePrice) {
      window.sessionStorage.removeItem(DRAFT_KEY);
      return;
    }

    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form, mode]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!(key in current)) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validate = (): { payload: Record<string, unknown>; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};

    if (form.name.trim().length < 2) {
      errors.name = 'Informe o nome do produto.';
    }

    const salePrice = parseCurrencyInput(form.salePrice);

    if (salePrice === null) {
      errors.salePrice = 'Informe o preco de venda.';
    } else if (salePrice < 0) {
      errors.salePrice = 'O preco nao pode ser negativo.';
    }

    const costPrice = form.costPrice.trim() ? parseCurrencyInput(form.costPrice) : null;

    if (form.costPrice.trim() && costPrice === null) {
      errors.costPrice = 'Preco de custo invalido.';
    }

    const stockQuantity = form.stockQuantity.trim()
      ? parseCurrencyInput(form.stockQuantity)
      : null;

    if (form.trackInventory && form.stockQuantity.trim() && stockQuantity === null) {
      errors.stockQuantity = 'Quantidade invalida.';
    }

    const minStockQuantity = form.minStockQuantity.trim()
      ? parseCurrencyInput(form.minStockQuantity)
      : null;

    if (form.trackInventory && form.minStockQuantity.trim() && minStockQuantity === null) {
      errors.minStockQuantity = 'Estoque minimo invalido.';
    }

    return {
      errors,
      payload: {
        name: form.name.trim(),
        salePrice,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        description: form.description.trim() || null,
        categoryId: form.categoryId,
        costPrice,
        trackInventory: form.trackInventory,
        stockQuantity: form.trackInventory ? (stockQuantity ?? 0) : 0,
        minStockQuantity: form.trackInventory ? minStockQuantity : null,
      },
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const { errors, payload } = validate();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);

    try {
      const saved =
        mode === 'create'
          ? await apiClient.post<ProductDto>('/products', payload)
          : await apiClient.patch<ProductDto>(`/products/${product?.id ?? ''}`, payload);

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(DRAFT_KEY);
      }

      if (mode === 'edit') {
        toast.success('Produto atualizado.');
        router.push(`/products/${saved.id}`);
        router.refresh();
        return;
      }

      // No cadastro mostramos o proximo passo em vez de decidir pelo usuario.
      setSavedProduct(saved);
      setForm(initialState());
      setSaving(false);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped: Record<string, string> = {};

        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (messages[0]) {
            mapped[field] = messages[0];
          }
        }

        setFieldErrors(mapped);
        setFormError(Object.keys(mapped).length > 0 ? null : error.message);
      } else {
        setFormError('Nao conseguimos salvar agora. Verifique sua conexao e tente de novo.');
      }

      setSaving(false);
    }
  };

  if (savedProduct) {
    return (
      <SavedPanel
        product={savedProduct}
        onAddAnother={() => setSavedProduct(null)}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {formError ? (
        <p
          role="alert"
          className="rounded-lg bg-danger-surface px-3 py-2 text-sm font-medium text-danger"
        >
          {formError}
        </p>
      ) : null}

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome do produto"
            htmlFor="product-name"
            error={fieldErrors.name}
            className="sm:col-span-2"
          >
            <Input
              id="product-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Ex.: Sofa 3 lugares cinza"
              autoFocus
              aria-invalid={Boolean(fieldErrors.name)}
            />
          </Field>

          <Field
            label="Preco de venda"
            htmlFor="product-price"
            error={fieldErrors.salePrice}
            hint="Pode digitar 1.299,90 ou 1299.90."
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-subtle">
                R$
              </span>
              <Input
                id="product-price"
                value={form.salePrice}
                onChange={(event) => update('salePrice', event.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                className="pl-9 tabular"
                aria-invalid={Boolean(fieldErrors.salePrice)}
              />
            </div>
          </Field>

          <Field label="Categoria" htmlFor="product-category" optional>
            <CategoryPicker
              id="product-category"
              value={form.categoryId}
              onChange={(categoryId) => update('categoryId', categoryId)}
            />
          </Field>

          <Field
            label="SKU"
            htmlFor="product-sku"
            optional
            error={fieldErrors.sku}
            hint="Codigo interno que voce usa para identificar o item."
          >
            <Input
              id="product-sku"
              value={form.sku}
              onChange={(event) => update('sku', event.target.value)}
              placeholder="Ex.: SOF-001"
              className="tabular"
              aria-invalid={Boolean(fieldErrors.sku)}
            />
          </Field>
        </div>

        <div className="mt-5 flex items-start justify-between gap-4 rounded-lg bg-surface-muted p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Controlar estoque</p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              Ative para acompanhar a quantidade disponivel deste produto.
            </p>
          </div>

          <Switch
            checked={form.trackInventory}
            onCheckedChange={(checked) => update('trackInventory', checked)}
            aria-label="Controlar estoque"
          />
        </div>

        {form.trackInventory ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label={mode === 'create' ? 'Quantidade inicial' : 'Quantidade em estoque'}
              htmlFor="product-stock"
              error={fieldErrors.stockQuantity}
            >
              <Input
                id="product-stock"
                value={form.stockQuantity}
                onChange={(event) => update('stockQuantity', event.target.value)}
                placeholder="0"
                inputMode="decimal"
                className="tabular"
                aria-invalid={Boolean(fieldErrors.stockQuantity)}
              />
            </Field>

            <Field
              label="Estoque minimo"
              htmlFor="product-min-stock"
              optional
              error={fieldErrors.minStockQuantity}
              hint="Avisamos quando o saldo chegar nesse numero."
            >
              <Input
                id="product-min-stock"
                value={form.minStockQuantity}
                onChange={(event) => update('minStockQuantity', event.target.value)}
                placeholder="0"
                inputMode="decimal"
                className="tabular"
                aria-invalid={Boolean(fieldErrors.minStockQuantity)}
              />
            </Field>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <button
          type="button"
          onClick={() => setShowMore((current) => !current)}
          aria-expanded={showMore}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
        >
          <span>
            <span className="block text-sm font-medium text-foreground">Mais informacoes</span>
            <span className="mt-0.5 block text-xs text-foreground-muted">
              Codigo de barras, preco de custo e descricao. Da para preencher depois.
            </span>
          </span>

          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-foreground-subtle transition-transform',
              showMore && 'rotate-180',
            )}
          />
        </button>

        {showMore ? (
          <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2 sm:p-6">
            <Field label="Codigo de barras" htmlFor="product-barcode" optional>
              <Input
                id="product-barcode"
                value={form.barcode}
                onChange={(event) => update('barcode', event.target.value)}
                placeholder="Ex.: 7891234567890"
                inputMode="numeric"
                className="tabular"
              />
            </Field>

            <Field
              label="Preco de custo"
              htmlFor="product-cost"
              optional
              error={fieldErrors.costPrice}
              hint="Usado depois para calcular sua margem."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-foreground-subtle">
                  R$
                </span>
                <Input
                  id="product-cost"
                  value={form.costPrice}
                  onChange={(event) => update('costPrice', event.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  className="pl-9 tabular"
                  aria-invalid={Boolean(fieldErrors.costPrice)}
                />
              </div>
            </Field>

            <Field label="Descricao" htmlFor="product-description" optional className="sm:col-span-2">
              <Textarea
                id="product-description"
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="Detalhes que ajudam na venda: medidas, material, garantia..."
              />
            </Field>
          </div>
        ) : null}
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
          disabled={saving}
        >
          Cancelar
        </Button>

        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Salvando...
            </>
          ) : mode === 'create' ? (
            'Salvar produto'
          ) : (
            'Salvar alteracoes'
          )}
        </Button>
      </div>
    </form>
  );
}

/** Confirmacao com os proximos passos possiveis, sem forcar um caminho. */
function SavedPanel({
  product,
  onAddAnother,
}: {
  product: ProductDto;
  onAddAnother: () => void;
}) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-line bg-surface p-6 text-center sm:p-8">
      <p className="text-sm font-medium text-success">Produto salvo</p>
      <h2 className="mt-1 text-lg font-semibold text-foreground">{product.name}</h2>
      <p className="mt-1 text-sm text-foreground-muted">O que voce quer fazer agora?</p>

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button type="button" onClick={onAddAnother}>
          Salvar e adicionar outro
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/products/${product.id}`)}
        >
          Ver produto
        </Button>

        <Button type="button" variant="ghost" onClick={() => router.push('/products')}>
          Voltar para produtos
        </Button>
      </div>
    </div>
  );
}
