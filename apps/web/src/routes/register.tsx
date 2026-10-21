import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { publicApi } from '../api/http';
import type { ServiceItem } from '../api/types';
import { homeFor, useSession } from '../auth/session';
import { UI } from '../labels';
import { Alert, Button, Card, Field, Shell, fieldErrors } from '../ui/kit';

export function RegisterPage() {
  const { register } = useSession();
  const navigate = useNavigate();
  const [role, setRole] = useState<'CUSTOMER' | 'ENGINEER'>('CUSTOMER');
  const [f, setF] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    experienceYears: '0',
  });
  const [hasShop, setHasShop] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });

  const services = useQuery({
    queryKey: ['services'],
    queryFn: () => publicApi<ServiceItem[]>('GET', '/services'),
    enabled: role === 'ENGINEER',
  });
  const byCategory = Object.entries(
    (services.data ?? []).reduce<Record<string, ServiceItem[]>>((acc, s) => {
      (acc[s.category.name] ??= []).push(s);
      return acc;
    }, {}),
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await register({
        name: f.name,
        phone: f.phone,
        password: f.password,
        role,
        ...(f.email ? { email: f.email } : {}),
        ...(role === 'ENGINEER'
          ? { experienceYears: Number(f.experienceYears) || 0, hasShop, serviceIds: picked }
          : {}),
      });
      await navigate({ to: homeFor(user.role) });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const errors = fieldErrors(error);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Shell>
      <Card title={UI.register}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="mb-1 text-sm font-semibold text-ink-2">{UI.iAm}</legend>
            {(['CUSTOMER', 'ENGINEER'] as const).map((r) => (
              <label
                key={r}
                className={`cursor-pointer rounded-md border px-3 py-2 text-center ${role === r ? 'border-brand bg-brand-soft font-bold' : 'border-line'}`}
              >
                <input
                  type="radio"
                  name="role"
                  className="sr-only"
                  checked={role === r}
                  onChange={() => setRole(r)}
                />
                {r === 'CUSTOMER' ? UI.customer : UI.engineer}
              </label>
            ))}
          </fieldset>
          <Field
            label={UI.name}
            value={f.name}
            onChange={set('name')}
            error={errors['name']}
            autoComplete="name"
          />
          <Field
            label={UI.phone}
            value={f.phone}
            onChange={set('phone')}
            error={errors['phone']}
            inputMode="tel"
            autoComplete="tel"
          />
          <Field
            label={UI.emailOptional}
            value={f.email}
            onChange={set('email')}
            error={errors['email']}
            type="email"
            autoComplete="email"
          />
          <Field
            label={UI.password}
            value={f.password}
            onChange={set('password')}
            error={errors['password']}
            type="password"
            autoComplete="new-password"
          />
          {role === 'ENGINEER' ? (
            <>
              <Field
                label={UI.experience}
                value={f.experienceYears}
                onChange={set('experienceYears')}
                type="number"
                min={0}
                max={60}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasShop}
                  onChange={(e) => setHasShop(e.target.checked)}
                />{' '}
                {UI.hasShop}
              </label>
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-2">{UI.chooseServices}</p>
                {services.isLoading ? <p className="text-ink-3">{UI.loading}</p> : null}
                {byCategory.map(([cat, list]) => (
                  <fieldset key={cat} className="mb-3">
                    <legend className="font-bold">{cat}</legend>
                    {list.map((s) => (
                      <label key={s.id} className="mt-1 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={picked.includes(s.id)}
                          onChange={() => toggle(s.id)}
                        />{' '}
                        {s.name}
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            </>
          ) : null}
          {error && !Object.keys(errors).length ? <Alert>{(error as Error).message}</Alert> : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? UI.saving : UI.register}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-2">
          {UI.haveAccount}{' '}
          <Link to="/login" className="font-semibold text-brand">
            {UI.login}
          </Link>
        </p>
      </Card>
    </Shell>
  );
}
