'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import {
  IMPORTABLE_PRODUCT_FIELDS,
  IMPORTABLE_PRODUCT_FIELD_LABELS,
  REQUIRED_IMPORT_FIELDS,
  type ImportCommitResponseDto,
  type ImportFieldMapping,
  type ImportPreviewResponseDto,
  type ImportUploadResponseDto,
  type ImportableProductField,
} from '@hub/shared';
import { Button } from '@/components/ui/button';
import { apiClient, ApiError } from '@/lib/api/client';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

type Stage = 'upload' | 'mapping' | 'preview' | 'done';

const STAGE_LABELS: { stage: Stage; label: string }[] = [
  { stage: 'upload', label: 'Arquivo' },
  { stage: 'mapping', label: 'Colunas' },
  { stage: 'preview', label: 'Conferencia' },
  { stage: 'done', label: 'Concluido' },
];

const NONE_VALUE = '__none__';

export function ImportWizard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('upload');
  const [uploaded, setUploaded] = useState<ImportUploadResponseDto | null>(null);
  const [mapping, setMapping] = useState<ImportFieldMapping>({});
  const [preview, setPreview] = useState<ImportPreviewResponseDto | null>(null);
  const [result, setResult] = useState<ImportCommitResponseDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Por enquanto aceitamos apenas arquivos .csv. Exporte sua planilha nesse formato.');
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.upload<ImportUploadResponseDto>(
        '/products/import/upload',
        formData,
      );

      setUploaded(response);
      setMapping(response.suggestedMapping);
      setStage('mapping');
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : 'Nao conseguimos ler o arquivo. Confira se ele esta em CSV.',
      );
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    if (!uploaded) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await apiClient.post<ImportPreviewResponseDto>(
        `/products/import/${uploaded.importId}/preview`,
        { mapping },
      );

      setPreview(response);
      setStage('preview');
    } catch (previewError) {
      setError(
        previewError instanceof ApiError
          ? previewError.message
          : 'Nao conseguimos validar o arquivo agora.',
      );
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!uploaded) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await apiClient.post<ImportCommitResponseDto>(
        `/products/import/${uploaded.importId}/commit`,
        { mapping },
      );

      setResult(response);
      setStage('done');
    } catch (commitError) {
      setError(
        commitError instanceof ApiError
          ? commitError.message
          : 'Nao conseguimos concluir a importacao.',
      );
    } finally {
      setBusy(false);
    }
  };

  const missingRequired = REQUIRED_IMPORT_FIELDS.filter((field) => !mapping[field]);

  return (
    <div>
      <StageIndicator current={stage} />

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger-surface px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}

      {stage === 'upload' ? (
        <div
          onDragOver={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];

            if (file) {
              void handleFile(file);
            }
          }}
          className={cn(
            'mt-6 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors',
            dragging ? 'border-brand-600 bg-brand-50' : 'border-line-strong bg-surface',
          )}
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-5" />
            )}
          </span>

          <div>
            <p className="text-sm font-medium text-foreground">
              {busy ? 'Lendo seu arquivo...' : 'Arraste seu arquivo CSV aqui'}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              Aceitamos separador por virgula ou ponto e virgula, ate 5 MB.
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0];

              if (file) {
                void handleFile(file);
              }

              event.target.value = '';
            }}
          />

          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <Upload className="size-4" />
            Escolher arquivo
          </Button>
        </div>
      ) : null}

      {stage === 'mapping' && uploaded ? (
        <div className="mt-6">
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                Confira o que e cada coluna
              </h2>
              <span className="text-xs text-foreground-subtle">
                {uploaded.filename} · {uploaded.totalRows} linhas
              </span>
            </div>

            <p className="mt-1 text-xs text-foreground-muted">
              Ja adivinhamos o que deu para adivinhar. Ajuste o que estiver errado.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {IMPORTABLE_PRODUCT_FIELDS.map((field) => (
                <MappingRow
                  key={field}
                  field={field}
                  columns={uploaded.columns}
                  value={mapping[field] ?? null}
                  sampleRows={uploaded.sampleRows}
                  onChange={(column) =>
                    setMapping((current) => ({ ...current, [field]: column }))
                  }
                />
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setStage('upload')}>
              Trocar arquivo
            </Button>

            <div className="flex flex-col items-end gap-2">
              {missingRequired.length > 0 ? (
                <p className="text-xs text-foreground-muted">
                  Indique a coluna de{' '}
                  {missingRequired
                    .map((field) => IMPORTABLE_PRODUCT_FIELD_LABELS[field].toLowerCase())
                    .join(' e ')}{' '}
                  para continuar.
                </p>
              ) : null}

              <Button
                type="button"
                onClick={() => void runPreview()}
                disabled={busy || missingRequired.length > 0}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Conferir dados
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {stage === 'preview' && preview ? (
        <div className="mt-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Linhas no arquivo" value={preview.totalRows} />
            <SummaryCard label="Prontas para importar" value={preview.validRows} tone="success" />
            <SummaryCard
              label="Com problema"
              value={preview.invalidRows}
              tone={preview.invalidRows > 0 ? 'warning' : 'neutral'}
            />
          </div>

          {preview.invalidRows > 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-surface px-3 py-2 text-xs text-warning">
              <AlertTriangle className="mt-px size-4 shrink-0" />
              As linhas com problema serao puladas. As demais entram normalmente - voce nao
              perde o arquivo inteiro por causa delas.
            </p>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
                  <th className="px-4 py-3">Linha</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Preco</th>
                  <th className="px-4 py-3">Situacao</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {preview.rows.map((row) => (
                  <tr key={row.line} className={row.valid ? '' : 'bg-danger-surface/30'}>
                    <td className="px-4 py-2.5 text-foreground-subtle tabular">{row.line}</td>
                    <td className="px-4 py-2.5 text-foreground">{row.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-foreground-muted tabular">
                      {row.sku ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-foreground tabular">
                      {row.salePrice === null ? '—' : formatCurrency(row.salePrice)}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.valid ? (
                        <span className="text-xs text-success">Ok</span>
                      ) : (
                        <span className="text-xs text-danger">{row.errors.join(' ')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="ghost" onClick={() => setStage('mapping')}>
              Ajustar colunas
            </Button>

            <Button
              type="button"
              onClick={() => void commit()}
              disabled={busy || preview.validRows === 0}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Importar {preview.validRows}{' '}
              {preview.validRows === 1 ? 'produto' : 'produtos'}
            </Button>
          </div>
        </div>
      ) : null}

      {stage === 'done' && result ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-6 text-center sm:p-8">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-success-surface text-success">
            <CheckCircle2 className="size-6" />
          </span>

          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {result.createdRows} {result.createdRows === 1 ? 'produto' : 'produtos'} no catalogo
          </h2>

          {result.failedRows > 0 ? (
            <p className="mt-1 text-sm text-foreground-muted">
              {result.failedRows}{' '}
              {result.failedRows === 1 ? 'linha foi pulada' : 'linhas foram puladas'}. Veja
              abaixo o motivo de cada uma.
            </p>
          ) : (
            <p className="mt-1 text-sm text-foreground-muted">Nenhuma linha ficou de fora.</p>
          )}

          {result.errors.length > 0 ? (
            <ul className="mx-auto mt-4 max-h-56 max-w-lg overflow-y-auto rounded-lg border border-line text-left">
              {result.errors.map((rowError) => (
                <li
                  key={rowError.line}
                  className="flex gap-3 border-b border-line px-4 py-2 text-xs last:border-b-0"
                >
                  <span className="shrink-0 font-medium text-foreground-subtle tabular">
                    Linha {rowError.line}
                  </span>
                  <span className="text-foreground-muted">{rowError.message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Button type="button" onClick={() => router.push('/products')}>
              Ver produtos
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStage('upload');
                setUploaded(null);
                setPreview(null);
                setResult(null);
                setMapping({});
              }}
            >
              Importar outro arquivo
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MappingRow({
  field,
  columns,
  value,
  sampleRows,
  onChange,
}: {
  field: ImportableProductField;
  columns: string[];
  value: string | null;
  sampleRows: Record<string, string>[];
  onChange: (column: string | null) => void;
}) {
  const required = REQUIRED_IMPORT_FIELDS.includes(field);
  const sample = value ? sampleRows.find((row) => row[value])?.[value] : undefined;

  return (
    <div className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
      <label
        htmlFor={`mapping-${field}`}
        className="flex items-center gap-1.5 text-sm text-foreground"
      >
        {IMPORTABLE_PRODUCT_FIELD_LABELS[field]}
        {required ? <span className="text-danger">*</span> : null}
      </label>

      <div className="flex items-center gap-3">
        <select
          id={`mapping-${field}`}
          value={value ?? NONE_VALUE}
          onChange={(event) =>
            onChange(event.target.value === NONE_VALUE ? null : event.target.value)
          }
          className="h-10 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-sm text-foreground focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100"
        >
          <option value={NONE_VALUE}>
            {required ? 'Selecione a coluna' : 'Nao importar'}
          </option>
          {columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>

        {/* Amostra real do arquivo: confirma o mapeamento sem precisar abrir o CSV. */}
        <span className="hidden w-32 shrink-0 truncate text-xs text-foreground-subtle sm:block">
          {sample ? `ex.: ${sample}` : ''}
        </span>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'neutral' && 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StageIndicator({ current }: { current: Stage }) {
  const currentIndex = STAGE_LABELS.findIndex((item) => item.stage === current);

  return (
    <ol className="flex items-center gap-2">
      {STAGE_LABELS.map((item, index) => (
        <li key={item.stage} className="flex flex-1 flex-col gap-1.5">
          <span
            className={cn(
              'h-1 rounded-full transition-colors',
              index <= currentIndex ? 'bg-brand-600' : 'bg-line',
            )}
          />
          <span
            className={cn(
              'text-xs',
              index === currentIndex ? 'font-medium text-brand-700' : 'text-foreground-subtle',
            )}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
