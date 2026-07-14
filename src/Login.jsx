import { useState } from 'react';

function Login({ onSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const maintenanceContactUrl = import.meta.env.VITE_MAINTENANCE_CONTACT_URL || 'mailto:zegarralenny10@gmail.com?subject=Soporte%20Portal%20InspecorTR';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');

    try {
      setLoading(true);
      await onSignIn({ email: email.trim(), password });
    } catch (error) {
      setErrorMessage(error?.message || 'No se pudo iniciar sesion. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute -left-28 -top-30 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Ale Hnos</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Portal de InspecorTR</h1>
        <p className="mt-2 text-sm text-slate-300">Inicia sesion para acceder al portal web de InspecorTR.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">Correo</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="rrhh@empresa.com"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-300">Contrasena</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="Ingresa tu contrasena"
              autoComplete="current-password"
            />
          </label>

          {errorMessage && (
            <p className="rounded-lg border border-rose-900 bg-rose-950/70 px-3 py-2 text-sm text-rose-200">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <a
            href={maintenanceContactUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-xl border border-slate-700 px-4 py-2.5 text-center text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300"
          >
            Contactar mantenimiento
          </a>
        </form>
      </section>
    </div>
  );
}

export default Login;
