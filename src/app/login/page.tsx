'use client';
import { useActionState } from 'react';
import { loginAction } from '@/app/actions';
export default function Login() {
  const [st, run, pending] = useActionState(loginAction, undefined as { error?: string } | undefined);
  return (
    <div className="login"><form action={run} className="card">
      <div className="brand" style={{ padding: 0 }}><div className="logo">IDC</div><div><b style={{ color: 'var(--navy)' }}>IDC One-Stop</b><small style={{ color: 'var(--mute)', display: 'block' }}>CRM · ERP · Field App</small></div></div>
      <label className="f">Employee ID<input name="employeeId" autoCapitalize="characters" autoComplete="username" required /></label>
      <label className="f">PIN<input name="pin" type="password" inputMode="numeric" autoComplete="current-password" required /></label>
      {st?.error && <div className="err">{st.error}</div>}
      <button className="btn pri big" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form></div>
  );
}
