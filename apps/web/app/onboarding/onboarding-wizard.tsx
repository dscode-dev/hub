'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Loader2,
  PackagePlus,
  Upload,
} from 'lucide-react';
import {
  OPERATION_GOALS,
  OPERATION_GOAL_DESCRIPTIONS,
  OPERATION_GOAL_LABELS,
  type OperationGoal,
  type OrganizationDto,
} from '@hub/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, { title: string; description: string }> = {
  1: {
    title: 'Vamos comecar pela sua empresa',
    description: 'So o essencial agora. Voce completa o resto quando quiser.',
  },
  2: {
    title: 'Como voce pretende usar a Plataforma Hub?',
    description: 'Escolha quantas opcoes fizerem sentido. Isso ajuda a organizar sua tela.',
  },
  3: {
    title: 'Tudo pronto',
    description: 'Por onde voce quer comecar?',
  },
};

export function OnboardingWizard({
  defaultName,
  defaultTradeName,
  defaultPhone,
}: {
  defaultName: string;
  defaultTradeName: string;
  defaultPhone: string;
}) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(defaultName);
  const [tradeName, setTradeName] = useState(defaultTradeName);
  const [phone, setPhone] = useState(defaultPhone);
  const [goals, setGoals] = useState<OperationGoal[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleGoal = (goal: OperationGoal) => {
    setGoals((current) =>
      current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal],
    );
  };

  const handleCompanySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (name.trim().length < 2) {
      setFieldError('Informe o nome da empresa.');
      return;
    }

    setFieldError(null);
    setStep(2);
  };

  /**
   * O onboarding so grava no final. Assim ninguem fica com uma organizacao
   * meio configurada por ter fechado a aba na etapa 2.
   */
  const finish = async (destination: Route) => {
    setSaving(true);
    setSubmitError(null);

    try {
      await apiClient.post<OrganizationDto>('/organizations/me/onboarding', {
        name: name.trim(),
        tradeName: tradeName.trim() || null,
        phone: phone.trim() || null,
        operationGoals: goals,
      });

      router.replace(destination);
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'Nao conseguimos salvar agora. Tente novamente.',
      );
      setSaving(false);
    }
  };

  return (
    <div>
      <StepIndicator current={step} />

      <div className="mt-6 rounded-xl border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {STEP_TITLES[step].title}
        </h1>
        <p className="mt-1.5 text-sm text-foreground-muted">{STEP_TITLES[step].description}</p>

        {submitError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-danger-surface px-3 py-2 text-sm font-medium text-danger"
          >
            {submitError}
          </p>
        ) : null}

        {step === 1 ? (
          <form onSubmit={handleCompanySubmit} className="mt-6 flex flex-col gap-4" noValidate>
            <Field label="Nome da empresa" htmlFor="company-name" error={fieldError ?? undefined}>
              <Input
                id="company-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Comercial Silva LTDA"
                autoFocus
                aria-invalid={Boolean(fieldError)}
              />
            </Field>

            <Field
              label="Nome comercial"
              htmlFor="company-trade-name"
              optional
              hint="Como seus clientes conhecem a empresa. Aparece nos documentos."
            >
              <Input
                id="company-trade-name"
                value={tradeName}
                onChange={(event) => setTradeName(event.target.value)}
                placeholder="Ex.: Casa Silva"
              />
            </Field>

            <Field label="Telefone" htmlFor="company-phone" optional>
              <Input
                id="company-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="(11) 90000-0000"
              />
            </Field>

            <div className="mt-2 flex justify-end">
              <Button type="submit">
                Continuar
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        ) : null}

        {step === 2 ? (
          <div className="mt-6">
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Objetivos de uso</legend>

              {OPERATION_GOALS.map((goal) => {
                const selected = goals.includes(goal);

                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggleGoal(goal)}
                    aria-pressed={selected}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                      selected
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-line hover:border-line-strong hover:bg-surface-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border',
                        selected
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-line-strong bg-surface',
                      )}
                    >
                      {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                    </span>

                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {OPERATION_GOAL_LABELS[goal]}
                      </span>
                      <span className="mt-0.5 block text-xs text-foreground-muted">
                        {OPERATION_GOAL_DESCRIPTIONS[goal]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </fieldset>

            <div className="mt-6 flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" />
                Voltar
              </Button>

              <Button type="button" onClick={() => setStep(3)}>
                Continuar
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <StartAction
                icon={PackagePlus}
                title="Cadastrar primeiro produto"
                description="Leva menos de um minuto."
                disabled={saving}
                onClick={() => void finish('/products/new')}
              />
              <StartAction
                icon={Upload}
                title="Importar produtos"
                description="Ja tem uma planilha? Traga ela."
                disabled={saving}
                onClick={() => void finish('/products/import')}
              />
              <StartAction
                icon={Compass}
                title="Explorar a plataforma"
                description="Ver tudo com calma antes."
                disabled={saving}
                onClick={() => void finish('/dashboard')}
              />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={saving}>
                <ArrowLeft className="size-4" />
                Voltar
              </Button>

              {saving ? (
                <span className="flex items-center gap-2 text-sm text-foreground-muted">
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { value: Step; label: string }[] = [
    { value: 1, label: 'Empresa' },
    { value: 2, label: 'Como voce usa' },
    { value: 3, label: 'Comecar' },
  ];

  return (
    <ol className="flex items-center gap-2">
      {steps.map((step) => {
        const done = step.value < current;
        const active = step.value === current;

        return (
          <li key={step.value} className="flex flex-1 flex-col gap-1.5">
            <span
              className={cn(
                'h-1 rounded-full transition-colors',
                done || active ? 'bg-brand-600' : 'bg-line',
              )}
            />
            <span
              className={cn(
                'text-xs',
                active ? 'font-medium text-brand-700' : 'text-foreground-subtle',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StartAction({
  icon: Icon,
  title,
  description,
  onClick,
  disabled,
}: {
  icon: typeof PackagePlus;
  title: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start gap-2 rounded-xl border border-line p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/60 disabled:pointer-events-none disabled:opacity-60"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon className="size-[18px]" />
      </span>
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="text-xs text-foreground-muted">{description}</span>
    </button>
  );
}
