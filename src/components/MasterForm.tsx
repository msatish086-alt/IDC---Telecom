'use client';
import { useActionState } from 'react';
type Act = (s: { error?: string; ok?: string }, f: FormData) => Promise<{ error?: string; ok?: string }>;
export default function MasterForm({ action, children, submit }: { action: Act; children: React.ReactNode; submit: string }) {
  const [st, run, pending] = useActionState(action, {});
  return (<form action={run}><div className="form">{children}<button className="btn pri" disabled={pending}>{submit}</button></div>
    {st.error && <div className="err" style={{ marginTop: 6 }}>{st.error}</div>}{st.ok && <div className="ok" style={{ marginTop: 6 }}>{st.ok}</div>}</form>);
}
