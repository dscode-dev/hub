'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  BUSINESS_SEGMENTS,
  BUSINESS_SEGMENT_LABELS,
  OPERATION_GOALS,
  OPERATION_GOAL_LABELS,
  type BusinessSegment,
  type CepLookupDto,
  type OperationGoal,
  type SetupPayload,
  type SetupResultDto,
} from '@hub/shared';
import { HubLogo } from '@/components/brand/logo';
import { useSession } from '@/components/session/session-provider';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { apiClient, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { CheckedInput } from './checked-input';
import { LogoPicker } from './logo-picker';
import { ZipCodeField, type ZipLookupState } from './zip-code-field';

/**
 * Wizard de primeiro acesso.
 *
 * Cria, de uma vez, a empresa e o usuario responsavel desta instalacao.
 * Nada e gravado ate a ultima etapa: abandonar no meio nao deixa a instalacao
 * meio configurada, e o backend continua aceitando um novo primeiro acesso.
 */
type Step = 1 | 2 | 3 | 4;

const STEPS: { value: Step; label: string; title: string; description: string }[] = [
  {
    value: 1,
    label: 'Responsavel',
    title: 'Crie o acesso do responsavel',
    description: 'Esta sera a conta com acesso total ao sistema.',
  },
  {
    value: 2,
    label: 'Empresa',
    title: 'Dados da empresa',
    description: 'Usados em documentos, recibos e relatorios.',
  },
  {
    value: 3,
    label: 'Endereco',
    title: 'Onde sua empresa fica',
    description: 'Digite o CEP e preenchemos o resto para voce.',
  },
  {
    value: 4,
    label: 'Perfil',
    title: 'Sobre o seu negocio',
    description: 'Ajuda a plataforma a se adaptar ao seu dia a dia.',
  },
];

interface FormState {
  ownerName: string;
  ownerEmail: string;
  password: string;
  passwordConfirm: string;
  companyName: string;
  tradeName: string;
  document: string;
  companyEmail: string;
  phone: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  reference: string;
  logo: string | null;
  segments: BusinessSegment[];
  operationGoals: OperationGoal[];
}

const INITIAL: FormState = {
  ownerName: '',
  ownerEmail: '',
  password: '',
  passwordConfirm: '',
  companyName: '',
  tradeName: '',
  document: '',
  companyEmail: '',
  phone: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  reference: '',
  logo: null,
  segments: [],
  operationGoals: [],
};

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export function SetupWizard() {
  const router = useRouter();
  const { login } = useSession();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zipState, setZipState] = useState<ZipLookupState>('idle');

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const toggle = <T,>(list: T[], item: T): T[] =>
    list.includes(item) ? list.filter((value) => value !== item) : [...list, item];

  /**
   * Validade por campo, avaliada a cada tecla.
   * Alimenta o check verde e tambem a liberacao do botao de continuar.
   */
  const valid = useMemo(
    () => ({
      ownerName: form.ownerName.trim().length >= 2,
      ownerEmail: EMAIL_PATTERN.test(form.ownerEmail.trim()),
      password:
        form.password.length >= 10 && /[a-zA-Z]/.test(form.password) && /\d/.test(form.password),
      passwordConfirm: form.passwordConfirm.length > 0 && form.password === form.passwordConfirm,
      companyName: form.companyName.trim().length >= 2,
    }),
    [form],
  );

  /** Preenchido pela consulta de CEP; segue editavel. */
  const autoFilled = zipState === 'found';

  const applyCepResult = useCallback((address: CepLookupDto) => {
    setForm((current) => ({
      ...current,
      zipCode: address.zipCode,
      street: address.street ?? '',
      district: address.district ?? '',
      city: address.city ?? '',
      state: address.state ?? '',
    }));
  }, []);

  const validateStep = (target: Step): boolean => {
    const found: Record<string, string> = {};

    if (target === 1) {
      if (!valid.ownerName) {
        found.ownerName = 'Informe seu nome.';
      }

      if (!valid.ownerEmail) {
        found.ownerEmail = 'Informe um e-mail valido.';
      }

      if (!valid.password) {
        found.password =
          form.password.length < 10
            ? 'Use ao menos 10 caracteres.'
            : 'A senha precisa ter letras e numeros.';
      }

      if (!valid.passwordConfirm) {
        found.passwordConfirm = 'As senhas nao conferem.';
      }
    }

    if (target === 2 && !valid.companyName) {
      found.companyName = 'Informe o nome da empresa.';
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) {
      setStep((current) => Math.min(4, current + 1) as Step);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Revalida as etapas obrigatorias: ninguem chega ao fim sem passar por elas.
    for (const required of [1, 2] as Step[]) {
      if (!validateStep(required)) {
        setStep(required);
        return;
      }
    }

    setSaving(true);
    setSubmitError(null);

    const payload: SetupPayload = {
      owner: {
        name: form.ownerName.trim(),
        email: form.ownerEmail.trim().toLowerCase(),
        password: form.password,
      },
      company: {
        name: form.companyName.trim(),
        tradeName: form.tradeName.trim() || null,
        document: form.document.trim() || null,
        email: form.companyEmail.trim() || null,
        phone: form.phone.trim() || null,
        logo: form.logo,
        segments: form.segments,
        operationGoals: form.operationGoals,
        address: {
          zipCode: form.zipCode.trim() || null,
          street: form.street.trim() || null,
          number: form.number.trim() || null,
          complement: form.complement.trim() || null,
          district: form.district.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          reference: form.reference.trim() || null,
        },
      },
    };

    try {
      await apiClient.post<SetupResultDto>('/setup', payload);
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'Nao conseguimos concluir a configuracao. Tente novamente.',
      );
      setSaving(false);
      return;
    }

    /*
     * Entra na conta recem-criada com as credenciais que a pessoa acabou de
     * digitar - pedir login logo apos o cadastro seria atrito puro.
     */
    const signedIn = await login({
      email: payload.owner.email,
      password: payload.owner.password,
    });

    if (!signedIn.ok) {
      setSubmitError('Conta criada, mas nao conseguimos entrar. Use a tela de login.');
      setSaving(false);
      router.replace('/login');
      return;
    }

    router.replace('/dashboard');
  };

  const current = STEPS[step - 1]!;

  return (
    <div>
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <HubLogo size="md" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Bem-vindo a Plataforma Hub
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Vamos configurar sua empresa. Leva menos de dois minutos.
          </p>
        </div>
      </div>

      <StepIndicator current={step} />

      <form onSubmit={submit} noValidate>
        <div className="auth-card mt-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <header className="border-b border-line pb-4">
            <h2 className="text-lg font-semibold text-foreground">{current.title}</h2>
            <p className="mt-1 text-sm text-foreground-muted">{current.description}</p>
          </header>

          {submitError ? (
            <p
              role="alert"
              className="mt-5 rounded-lg bg-danger-surface px-3 py-2 text-sm font-medium text-danger"
            >
              {submitError}
            </p>
          ) : null}

          {step === 1 ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Seu nome"
                htmlFor="owner-name"
                error={errors.ownerName}
                className="sm:col-span-2"
              >
                <CheckedInput
                  id="owner-name"
                  value={form.ownerName}
                  onChange={(event) => update('ownerName', event.target.value)}
                  placeholder="Ex.: Maria Silva"
                  autoComplete="name"
                  autoFocus
                  valid={valid.ownerName}
                  aria-invalid={Boolean(errors.ownerName)}
                />
              </Field>

              <Field
                label="E-mail de acesso"
                htmlFor="owner-email"
                error={errors.ownerEmail}
                className="sm:col-span-2"
                hint="Sera usado para entrar no sistema."
              >
                <CheckedInput
                  id="owner-email"
                  type="email"
                  autoComplete="username"
                  value={form.ownerEmail}
                  onChange={(event) => update('ownerEmail', event.target.value)}
                  placeholder="voce@empresa.com.br"
                  valid={valid.ownerEmail}
                  aria-invalid={Boolean(errors.ownerEmail)}
                />
              </Field>

              <Field
                label="Senha"
                htmlFor="owner-password"
                error={errors.password}
                hint="Ao menos 10 caracteres, com letras e numeros."
              >
                <div className="relative">
                  <CheckedInput
                    id="owner-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) => update('password', event.target.value)}
                    className="pr-16"
                    valid={valid.password}
                    aria-invalid={Boolean(errors.password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className={cn(
                      'absolute top-1 rounded-md p-2 text-foreground-subtle transition-colors hover:text-foreground',
                      // Cede espaco para o check quando ele aparece.
                      valid.password ? 'right-8' : 'right-1',
                    )}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              <Field
                label="Confirmar senha"
                htmlFor="owner-password-confirm"
                error={errors.passwordConfirm}
              >
                <CheckedInput
                  id="owner-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.passwordConfirm}
                  onChange={(event) => update('passwordConfirm', event.target.value)}
                  valid={valid.passwordConfirm}
                  aria-invalid={Boolean(errors.passwordConfirm)}
                />
              </Field>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Razao social"
                htmlFor="company-name"
                error={errors.companyName}
                className="sm:col-span-2"
              >
                <CheckedInput
                  id="company-name"
                  value={form.companyName}
                  onChange={(event) => update('companyName', event.target.value)}
                  placeholder="Ex.: Comercial Silva LTDA"
                  autoFocus
                  valid={valid.companyName}
                  aria-invalid={Boolean(errors.companyName)}
                />
              </Field>

              <Field label="Nome fantasia" htmlFor="trade-name" optional>
                <CheckedInput
                  id="trade-name"
                  value={form.tradeName}
                  onChange={(event) => update('tradeName', event.target.value)}
                  placeholder="Ex.: Casa Silva"
                  valid={form.tradeName.trim().length >= 2}
                />
              </Field>

              <Field label="CNPJ" htmlFor="document" optional>
                <CheckedInput
                  id="document"
                  value={form.document}
                  onChange={(event) => update('document', formatDocument(event.target.value))}
                  placeholder="00.000.000/0001-00"
                  inputMode="numeric"
                  className="tabular"
                  valid={form.document.replace(/\D/g, '').length === 14}
                />
              </Field>

              <Field label="Telefone" htmlFor="phone" optional>
                <CheckedInput
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => update('phone', formatPhone(event.target.value))}
                  placeholder="(11) 90000-0000"
                  inputMode="tel"
                  className="tabular"
                  valid={[10, 11].includes(form.phone.replace(/\D/g, '').length)}
                />
              </Field>

              <Field label="E-mail da empresa" htmlFor="company-email" optional>
                <CheckedInput
                  id="company-email"
                  type="email"
                  value={form.companyEmail}
                  onChange={(event) => update('companyEmail', event.target.value)}
                  placeholder="contato@empresa.com.br"
                  valid={EMAIL_PATTERN.test(form.companyEmail.trim())}
                />
              </Field>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="mt-6 flex flex-col gap-5">
              <div className="sm:max-w-56">
                <ZipCodeField
                  value={form.zipCode}
                  state={zipState}
                  onChange={(zipCode) => update('zipCode', zipCode)}
                  onResolved={applyCepResult}
                  onStateChange={setZipState}
                />
              </div>

              <fieldset className="grid gap-5 border-t border-line pt-5 sm:grid-cols-6">
                <legend className="sr-only">Endereco</legend>

                <Field label="Rua" htmlFor="street" optional className="sm:col-span-4">
                  <CheckedInput
                    id="street"
                    value={form.street}
                    onChange={(event) => update('street', event.target.value)}
                    autoComplete="address-line1"
                    valid={autoFilled && form.street.trim().length > 0}
                  />
                </Field>

                <Field label="Numero" htmlFor="number" optional className="sm:col-span-2">
                  <CheckedInput
                    id="number"
                    value={form.number}
                    onChange={(event) => update('number', event.target.value)}
                    className="tabular"
                    inputMode="numeric"
                    valid={form.number.trim().length > 0}
                  />
                </Field>

                <Field label="Bairro" htmlFor="district" optional className="sm:col-span-3">
                  <CheckedInput
                    id="district"
                    value={form.district}
                    onChange={(event) => update('district', event.target.value)}
                    valid={autoFilled && form.district.trim().length > 0}
                  />
                </Field>

                <Field label="Cidade" htmlFor="city" optional className="sm:col-span-2">
                  <CheckedInput
                    id="city"
                    value={form.city}
                    onChange={(event) => update('city', event.target.value)}
                    valid={autoFilled && form.city.trim().length > 0}
                  />
                </Field>

                <Field label="UF" htmlFor="state" optional className="sm:col-span-1">
                  <CheckedInput
                    id="state"
                    value={form.state}
                    onChange={(event) => update('state', event.target.value.toUpperCase())}
                    maxLength={2}
                    placeholder="SP"
                    valid={form.state.trim().length === 2}
                  />
                </Field>

                <Field label="Complemento" htmlFor="complement" optional className="sm:col-span-3">
                  <CheckedInput
                    id="complement"
                    value={form.complement}
                    onChange={(event) => update('complement', event.target.value)}
                    placeholder="Sala, andar, bloco"
                    valid={form.complement.trim().length > 0}
                  />
                </Field>

                <Field
                  label="Ponto de referencia"
                  htmlFor="reference"
                  optional
                  className="sm:col-span-3"
                >
                  <CheckedInput
                    id="reference"
                    value={form.reference}
                    onChange={(event) => update('reference', event.target.value)}
                    placeholder="Proximo ao mercado central"
                    valid={form.reference.trim().length > 0}
                  />
                </Field>
              </fieldset>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="mt-6 flex flex-col gap-7">
              <div>
                <p className="mb-2.5 text-sm font-medium text-foreground">Logo da empresa</p>
                <LogoPicker value={form.logo} onChange={(logo) => update('logo', logo)} />
              </div>

              <fieldset className="border-t border-line pt-6">
                <legend className="mb-2.5 text-sm font-medium text-foreground">
                  Segmento de atuacao
                </legend>
                <div className="flex flex-wrap gap-2">
                  {BUSINESS_SEGMENTS.map((segment) => (
                    <Chip
                      key={segment}
                      selected={form.segments.includes(segment)}
                      onClick={() => update('segments', toggle(form.segments, segment))}
                    >
                      {BUSINESS_SEGMENT_LABELS[segment]}
                    </Chip>
                  ))}
                </div>
              </fieldset>

              <fieldset className="border-t border-line pt-6">
                <legend className="mb-2.5 text-sm font-medium text-foreground">
                  Como pretende usar a plataforma
                </legend>
                <div className="flex flex-wrap gap-2">
                  {OPERATION_GOALS.map((goal) => (
                    <Chip
                      key={goal}
                      selected={form.operationGoals.includes(goal)}
                      onClick={() => update('operationGoals', toggle(form.operationGoals, goal))}
                    >
                      {OPERATION_GOAL_LABELS[goal]}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((value) => Math.max(1, value - 1) as Step)}
            disabled={step === 1 || saving}
          >
            <ArrowLeft className="size-4" />
            Voltar
          </Button>

          {step < 4 ? (
            <Button type="button" onClick={goNext}>
              Continuar
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Configurando...
                </>
              ) : (
                'Concluir configuracao'
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/** Trilha de etapas: numero vira check quando a etapa fica para tras. */
function StepIndicator({ current }: { current: Step }) {
  return (
    <ol className="flex items-start">
      {STEPS.map((item, index) => {
        const done = item.value < current;
        const active = item.value === current;

        return (
          <li key={item.value} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-colors',
                  index === 0 ? 'bg-transparent' : done || active ? 'bg-brand-600' : 'bg-line',
                )}
              />

              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                  done
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : active
                      ? 'border-brand-600 bg-surface text-brand-700'
                      : 'border-line-strong bg-surface text-foreground-subtle',
                )}
              >
                {done ? (
                  <Check
                    className="size-4 animate-[check-pop_260ms_ease-out] motion-reduce:animate-none"
                    strokeWidth={3}
                  />
                ) : (
                  item.value
                )}
              </span>

              <span
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-colors',
                  index === STEPS.length - 1 ? 'bg-transparent' : done ? 'bg-brand-600' : 'bg-line',
                )}
              />
            </div>

            <span
              className={cn(
                'text-xs',
                active ? 'font-medium text-brand-700' : 'text-foreground-subtle',
              )}
            >
              {item.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        selected
          ? 'border-brand-600 bg-brand-50 font-medium text-brand-700'
          : 'border-line-strong bg-surface text-foreground-muted hover:bg-surface-muted',
      )}
    >
      {selected ? (
        <Check
          className="size-3.5 animate-[check-pop_240ms_ease-out] motion-reduce:animate-none"
          strokeWidth={3}
        />
      ) : null}
      {children}
    </button>
  );
}

/** Mascaras aplicadas enquanto digita: o valor bruto e limpo no envio. */
function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }

  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}
