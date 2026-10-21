import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { homeFor, useSession } from '../auth/session';
import { UI } from '../labels';
import { Alert, Button, Card, Field, Shell, fieldErrors } from '../ui/kit';

export function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(identifier.trim(), password);
      await navigate({ to: homeFor(user.role) });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const errors = fieldErrors(error);
  return (
    <Shell>
      <Card title={UI.login}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field
            label={UI.phoneOrEmail}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
          <Field
            label={UI.password}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            error={errors['password']}
          />
          {error && !Object.keys(errors).length ? <Alert>{(error as Error).message}</Alert> : null}
          <Button type="submit" disabled={busy || !identifier || !password} className="w-full">
            {busy ? UI.saving : UI.login}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-2">
          {UI.noAccount}{' '}
          <Link to="/register" className="font-semibold text-brand">
            {UI.register}
          </Link>
        </p>
      </Card>
    </Shell>
  );
}
