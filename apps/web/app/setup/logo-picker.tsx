'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { ACCEPTED_LOGO_MIME, MAX_LOGO_BYTES } from '@hub/shared';

/**
 * Seletor da logo da empresa.
 *
 * Converte para data URL no proprio cliente: a instalacao e local e guardar a
 * imagem junto do registro evita caminho de arquivo que quebra ao mover o app.
 * A validacao aqui e conveniencia - o servidor revalida tipo e tamanho.
 */
export function LogoPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (logo: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setError(null);

    if (!file) {
      return;
    }

    if (!ACCEPTED_LOGO_MIME.includes(file.type)) {
      setError('Use uma imagem PNG, JPEG, WEBP ou SVG.');
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setError(`A imagem deve ter no maximo ${Math.round(MAX_LOGO_BYTES / 1024)} KB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => setError('Nao conseguimos ler este arquivo.');
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface-muted">
          {value ? (
            // Data URL local: next/image nao agrega nada e exigiria configuracao.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Logo da empresa" className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-6 text-foreground-subtle" />
          )}
        </div>

        <div className="flex flex-col items-start gap-1.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              {value ? 'Trocar' : 'Escolher imagem'}
            </button>

            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setError(null);
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:bg-surface-muted hover:text-danger"
              >
                <Trash2 className="size-3.5" />
                Remover
              </button>
            ) : null}
          </div>

          <p className="text-xs text-foreground-subtle">
            PNG, JPEG, WEBP ou SVG ate {Math.round(MAX_LOGO_BYTES / 1024)} KB.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_LOGO_MIME.join(',')}
        className="sr-only"
        onChange={handleFile}
      />

      {error ? (
        <p className="mt-2 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
