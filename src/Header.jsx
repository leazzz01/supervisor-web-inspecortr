const formatLastSync = (lastSyncAt) => {
  if (!lastSyncAt) return 'sin datos';

  const diffMs = Date.now() - new Date(lastSyncAt).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return 'recién';

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return 'hace unos segundos';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  return `hace ${diffHours} h`;
};

function Header({ title, onToggleSidebar, userEmail, onSignOut, lastSyncAt }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
            onClick={onToggleSidebar}
            aria-label="Abrir menú"
          >
            <span className="text-base">☰</span>
            <span className="sm:hidden">Menú</span>
          </button>
          <div>
            <p className="text-sm font-medium text-slate-500">Panel de supervisión</p>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userEmail && (
            <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 xl:block">
              {userEmail}
            </div>
          )}
          <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 sm:block">
            Última sincronización: {formatLastSync(lastSyncAt)}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Cerrar sesion
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
