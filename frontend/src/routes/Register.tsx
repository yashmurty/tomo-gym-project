import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Field, FormError, inputClass, SubmitButton } from '../components/form';
import { useI18n } from '../i18n/i18n-context';
import type { MessageKey } from '../i18n/i18n';
import { ApiError } from '../lib/api-error';
import { useAuth } from '../lib/auth-context';
import { describeError } from '../lib/describe-error';

// Unit symbols, the same in both languages (like the language names).
const UNITS = ['kg', 'lb'] as const;

// The device's IANA zone ("Asia/Tokyo"): "today" is worked out in it.
function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export default function Register() {
  const { t, locale } = useI18n();
  const { user, register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<MessageKey | null>(null);
  const [timezone] = useState(deviceTimezone);

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t('form.required'))
          .max(100, t('form.tooLong')),
        email: z
          .string()
          .trim()
          .toLowerCase()
          .pipe(z.email(t('form.emailInvalid'))),
        password: z
          .string()
          .min(6, t('form.passwordLength'))
          .max(100, t('form.tooLong')),
        weightUnit: z.enum(UNITS),
        // Optional; the server converts it to kg and range-checks it.
        weight: z
          .string()
          .trim()
          .refine(
            (v) => v === '' || (Number.isFinite(Number(v)) && Number(v) > 0),
            t('register.weightInvalid'),
          ),
        ageConfirmed: z.boolean().refine((v) => v, t('register.ageRequired')),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { weightUnit: 'kg', weight: '', ageConfirmed: false },
  });

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      // Fields copied one by one: only what sign-up accepts.
      await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        timezone,
        locale,
        ageConfirmed: true,
        weightUnit: values.weightUnit,
        ...(values.weight !== '' && { weight: Number(values.weight) }),
      });
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(registerError(err));
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mx-auto flex w-full max-w-sm flex-col gap-4"
    >
      <h1 className="text-2xl font-semibold">{t('register.title')}</h1>
      {serverError && <FormError>{t(serverError)}</FormError>}

      <Field label={t('register.name')} error={errors.name?.message}>
        <input
          {...register('name')}
          autoComplete="name"
          className={inputClass}
        />
      </Field>
      <Field label={t('form.email')} error={errors.email?.message}>
        <input
          type="email"
          {...register('email')}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          className={inputClass}
        />
      </Field>
      <Field label={t('form.password')} error={errors.password?.message}>
        <input
          type="password"
          {...register('password')}
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">
          {t('register.weightUnit')}
        </legend>
        <div className="border-border flex w-fit overflow-hidden rounded-full border">
          {UNITS.map((unit) => (
            <label key={unit} className="cursor-pointer">
              <input
                type="radio"
                value={unit}
                {...register('weightUnit')}
                className="peer sr-only"
              />
              <span className="text-muted peer-checked:bg-foreground flex min-h-11 items-center px-5 peer-checked:text-white peer-focus-visible:ring-2">
                {unit}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label={t('register.weight')}
        error={errors.weight?.message}
        hint={t('register.weightHint')}
      >
        <input
          {...register('weight')}
          inputMode="decimal"
          autoComplete="off"
          className={inputClass}
        />
      </Field>

      <div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            {...register('ageConfirmed')}
            className="accent-accent size-5"
          />
          <span>{t('register.age')}</span>
        </label>
        {errors.ageConfirmed && (
          <p className="text-sm text-red-700">{errors.ageConfirmed.message}</p>
        )}
      </div>

      <p className="text-muted text-sm">
        {t('register.timezone', { timezone })}
      </p>

      <SubmitButton
        busy={isSubmitting}
        label={t('register.submit')}
        busyLabel={t('register.submitting')}
      />

      <p className="text-muted text-center text-sm">
        {t('register.haveAccount')}{' '}
        <Link to="/login" className="text-accent inline-block py-3 font-medium">
          {t('register.loginLink')}
        </Link>
      </p>
    </form>
  );
}

function registerError(err: unknown): MessageKey {
  if (err instanceof ApiError) {
    if (err.status === 409) return 'register.emailTaken';
    if (err.status === 403) return 'register.closed';
    if (err.status === 400) return 'register.invalid';
  }
  return describeError(err);
}
