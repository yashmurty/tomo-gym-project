import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { Field, FormError, inputClass, SubmitButton } from '../components/form';
import { useI18n } from '../i18n/i18n-context';
import type { MessageKey } from '../i18n/i18n';
import { ApiError } from '../lib/api-error';
import { useAuth } from '../lib/auth-context';
import { describeError } from '../lib/describe-error';
import { safeRedirect } from '../lib/safe-redirect';

export default function Login() {
  const { t } = useI18n();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = safeRedirect(params.get('from'));
  const sessionExpired = params.get('session') === 'expired';
  const [serverError, setServerError] = useState<MessageKey | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        // Phone keyboards capitalise and autocomplete adds a space.
        email: z
          .string()
          .trim()
          .toLowerCase()
          .pipe(z.email(t('form.emailInvalid'))),
        password: z.string().min(1, t('form.required')),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={from} replace />;

  const onSubmit = async (values: Values) => {
    setServerError(null);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(
        err instanceof ApiError && err.status === 401
          ? 'login.invalid'
          : describeError(err),
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mx-auto flex w-full max-w-sm flex-col gap-4"
    >
      <h1 className="text-2xl font-semibold">{t('login.title')}</h1>

      {sessionExpired && !serverError && (
        <div
          role="status"
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm"
        >
          {t('login.sessionExpired')}
        </div>
      )}
      {serverError && <FormError>{t(serverError)}</FormError>}

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
          autoComplete="current-password"
          className={inputClass}
        />
      </Field>

      <SubmitButton
        busy={isSubmitting}
        label={t('login.submit')}
        busyLabel={t('login.submitting')}
      />

      <p className="text-muted text-center text-sm">
        {t('login.noAccount')}{' '}
        <Link
          to="/register"
          className="text-accent inline-block py-3 font-medium"
        >
          {t('login.registerLink')}
        </Link>
      </p>
    </form>
  );
}
