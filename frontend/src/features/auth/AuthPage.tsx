import { useId, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import type { User } from '../../lib/types';
import { Brand } from '../../components/Brand';

export function AuthPage({
  onSuccess,
  expired,
}: {
  onSuccess: (user: User) => void;
  expired: boolean;
}) {
  const passwordId = useId();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [visible, setVisible] = useState(false);
  const [validation, setValidation] = useState('');
  const mutation = useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      mode === 'register'
        ? api.register(input)
        : api.login({ email: input.email, password: input.password }),
    onSuccess: ({ user }) => onSuccess(user),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      password: String(data.get('password') ?? ''),
    };
    if (mode === 'register' && new TextEncoder().encode(input.password).length > 72) {
      setValidation('Password must be at most 72 UTF-8 bytes.');
      return;
    }
    setValidation('');
    mutation.mutate(input);
  }
  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="About Sweety">
        <Brand light />
        <div className="auth-story-content">
          <div className="auth-symbol">
            <LockKeyhole size={24} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h2>
            A little check-in.
            <br />A clearer picture.
          </h2>
          <p>
            A simple space for your glucose readings.
            <br className="hidden lg:block" /> One day, one meal, one entry at a time.
          </p>
          <div className="sample-log" aria-label="Illustrative daily log">
            <span className="sample-label">A day in your journal · example</span>
            {[
              ['Morning (fasting)', '98'],
              ['After breakfast', '124'],
              ['After lunch', '118'],
              ['After dinner', '132'],
            ].map(([label, value]) => (
              <div className="sample-row" key={label}>
                <span className="sample-check">
                  <Check size={13} aria-hidden="true" />
                </span>
                <span>{label}</span>
                <strong>
                  {value}
                  <small> mg/dl</small>
                </strong>
              </div>
            ))}
          </div>
        </div>
        <p className="auth-footnote">Small moments. A useful record.</p>
      </section>
      <section className="auth-form-side">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-form-wrap">
          <h1>{mode === 'login' ? 'Good to see you.' : 'Make room for a daily habit.'}</h1>
          <p className="text-muted mt-3">
            {mode === 'login'
              ? 'Log in to pick up where you left off.'
              : 'Create your account to start your glucose journal.'}
          </p>
          <form onSubmit={submit} className="auth-form" key={mode}>
            {expired && mode === 'login' && (
              <p className="notice" role="status">
                Your session ended. Log in again to continue.
              </p>
            )}
            {mode === 'register' && (
              <label className="field">
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={80}
                  placeholder="e.g. Alex"
                />
              </label>
            )}
            <label className="field">
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
            <div className="field">
              <label htmlFor={passwordId}>Password</label>
              <span className="password-input">
                <input
                  id={passwordId}
                  type={visible ? 'text' : 'password'}
                  name="password"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  maxLength={256}
                  placeholder={
                    mode === 'register' ? 'At least 8 characters' : 'Enter your password'
                  }
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </div>
            {(validation || mutation.isError) && (
              <p className="field-error" role="alert">
                {validation || errorMessage(mutation.error)}
              </p>
            )}
            <button
              className="button button-primary w-full justify-between"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'login' ? 'New to Sweety?' : 'Already have an account?'}{' '}
            <button
              className="text-button"
              disabled={mutation.isPending}
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                mutation.reset();
                setValidation('');
              }}
            >
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>
          <div className="privacy-note">
            <LockKeyhole size={16} aria-hidden="true" />
            <p>
              Your journal belongs to you.
              <br />
              Only you can access your readings.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
