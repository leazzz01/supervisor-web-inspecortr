const navigation = [
  { name: 'Dashboard', icon: '◉' },
  { name: 'Inspectores', icon: '👥' },
  { name: 'Inspecciones', icon: '📄' },
  { name: 'Estadísticas', icon: '📊' },
];

function Sidebar({ activeItem = 'Dashboard', isOpen, onClose, onNavigate }) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/70 transition-all lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">ALE HNOS</p>
            <h2 className="text-lg font-semibold">Supervisor</h2>
          </div>
          <button
            className="rounded-lg border border-slate-700 p-2 text-slate-300 lg:hidden"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-6">
          {navigation.map((item) => {
            const isActive = item.name === activeItem;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  onNavigate?.(item.name);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.name}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="rounded-2xl bg-slate-900 p-4">
            <p className="text-sm font-semibold text-white">Estado del sistema</p>
            <p className="mt-1 text-sm text-slate-400">Operativo · 24/7</p>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
