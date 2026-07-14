import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const fallbackStats = [
  { title: 'Inspectores con actividad hoy', value: '0', subtitle: 'Sin registros hoy', tone: 'from-cyan-500 to-blue-600' },
  { title: 'Inspecciones iniciadas hoy', value: '0', subtitle: 'Operativo diario', tone: 'from-emerald-500 to-green-600' },
  { title: 'Pendientes de cierre (hoy)', value: '0', subtitle: 'Sin pendientes', tone: 'from-amber-500 to-orange-600' },
  { title: 'Tiempo promedio por inspeccion', value: '0 min', subtitle: 'Calculado con inicio/fin', tone: 'from-violet-500 to-fuchsia-600' },
];

const fallbackActivity = [
  { id: 'f1', inspector: 'Sin datos', area: 'Sin direccion de inicio', status: 'Pendiente', time: '—' },
  { id: 'f2', inspector: 'Sin datos', area: 'Sin direccion de inicio', status: 'Pendiente', time: '—' },
  { id: 'f3', inspector: 'Sin datos', area: 'Sin direccion de inicio', status: 'Pendiente', time: '—' },
];

const fallbackWeekly = [
  { key: 'Lun', total: 0, completed: 0 },
  { key: 'Mar', total: 0, completed: 0 },
  { key: 'Mie', total: 0, completed: 0 },
  { key: 'Jue', total: 0, completed: 0 },
  { key: 'Vie', total: 0, completed: 0 },
  { key: 'Sab', total: 0, completed: 0 },
  { key: 'Dom', total: 0, completed: 0 },
];

const toSortableDate = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const safeTime = timeStr && String(timeStr).trim() ? String(timeStr).trim() : '00:00:00';
  const isoCandidate = `${dateStr}T${safeTime}`;
  const parsed = new Date(isoCandidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = String(timeStr).split(':').map((item) => parseInt(item, 10));
  if (!parts.length || Number.isNaN(parts[0])) return 0;
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return (hours * 60) + minutes;
};

const computeDurationMinutes = (startTime, endTime) => {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (!start || !end || end <= start) return 0;
  return end - start;
};

const formatMinutes = (minutes) => {
  if (!minutes || minutes <= 0) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};

const dateKey = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildWeeklySeed = () => {
  const dayLabels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  const days = [];
  const now = new Date();

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    days.push({
      date: dateKey(day),
      key: dayLabels[day.getDay()],
      total: 0,
      completed: 0,
    });
  }

  return days;
};

function Dashboard() {
  const [stats, setStats] = useState(fallbackStats);
  const [activity, setActivity] = useState(fallbackActivity);
  const [weeklySeries, setWeeklySeries] = useState(fallbackWeekly);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [
        { data: inspectorsData, error: inspectorsError },
        { data: jornadasData, error: jornadasError },
        { data: inspectionsData, error: inspectionsError },
      ] = await Promise.all([
        supabase.from('inspectores').select('id, nombre, apellido').order('nombre', { ascending: true }),
        supabase.from('jornadas').select('id, inspector_id, fecha, finjornada').order('fecha', { ascending: false }),
        supabase.from('inspecciones').select('id, jornada_id, fechainicio, horainicio, horafin, direccioninicio').order('fechainicio', { ascending: false }).limit(150),
      ]);

      if (inspectorsError) {
        console.warn('No se pudo leer inspectores:', inspectorsError.message);
      }

      if (inspectionsError) {
        console.warn('No se pudo leer inspecciones:', inspectionsError.message);
      }

      if (jornadasError) {
        console.warn('No se pudo leer jornadas:', jornadasError.message);
      }

      const inspectorsById = (inspectorsData || []).reduce((acc, item) => {
        acc[item.id] = `${item.nombre ?? ''} ${item.apellido ?? ''}`.trim() || 'Inspector';
        return acc;
      }, {});

      const jornadasById = (jornadasData || []).reduce((acc, jornada) => {
        acc[jornada.id] = jornada;
        return acc;
      }, {});

      const inspections = inspectionsData || [];
      const todayKey = dateKey(new Date());
      const todayInspections = inspections.filter((item) => item.fechainicio === todayKey);
      const jornadas = jornadasData || [];
      const pendingJornadas = jornadas.filter((item) => !item.finjornada).length;

      const inspectorIdsToday = new Set(
        todayInspections
          .map((item) => jornadasById[item.jornada_id]?.inspector_id)
          .filter(Boolean)
      );

      const completedToday = todayInspections.filter((item) => item.horafin).length;
      const completionRateToday = todayInspections.length
        ? Math.round((completedToday / todayInspections.length) * 100)
        : 0;

      const completedDurations = todayInspections
        .filter((item) => item.horainicio && item.horafin)
        .map((item) => computeDurationMinutes(item.horainicio, item.horafin))
        .filter((duration) => duration > 0);

      const avgDuration = completedDurations.length
        ? Math.round(completedDurations.reduce((acc, value) => acc + value, 0) / completedDurations.length)
        : 0;

      setStats([
        {
          title: 'Inspectores con actividad hoy',
          value: String(inspectorIdsToday.size),
          subtitle: `Total de inspectores cargados: ${inspectorsData?.length ?? 0}`,
          tone: 'from-cyan-500 to-blue-600',
        },
        {
          title: 'Inspecciones iniciadas hoy',
          value: String(todayInspections.length),
          subtitle: `${completedToday} cerradas`,
          tone: 'from-emerald-500 to-green-600',
        },
        {
          title: 'Pendientes de cierre',
          value: String(pendingJornadas),
          subtitle: `${completionRateToday}% de cierre en inspecciones de hoy`,
          tone: 'from-amber-500 to-orange-600',
        },
        {
          title: 'Tiempo promedio por inspeccion',
          value: formatMinutes(avgDuration),
          subtitle: 'Solo inspecciones finalizadas hoy',
          tone: 'from-violet-500 to-fuchsia-600',
        },
      ]);

      const weeklySeed = buildWeeklySeed();
      const weeklyMap = weeklySeed.reduce((acc, day) => {
        acc[day.date] = day;
        return acc;
      }, {});

      inspections.forEach((item) => {
        const bucket = weeklyMap[item.fechainicio];
        if (!bucket) return;
        bucket.total += 1;
        if (item.horafin) {
          bucket.completed += 1;
        }
      });

      setWeeklySeries(weeklySeed.map((item) => ({ key: item.key, total: item.total, completed: item.completed })));

      if (inspectionsData?.length) {
        const recentItems = inspectionsData
          .map((item) => {
            const relatedJornada = jornadasById[item.jornada_id] || {};
            const inspectorName = inspectorsById[relatedJornada.inspector_id] || 'Inspector';
            const startedAt = toSortableDate(item.fechainicio, item.horainicio);

            return {
              id: item.id,
              startedAt,
              inspector: inspectorName,
              area: item.direccioninicio || 'Sin direccion de inicio',
              status: item.horafin ? 'Completada' : 'Pendiente',
              time: item.horainicio || (startedAt ? startedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—'),
            };
          })
          .sort((a, b) => {
            const aTs = a.startedAt ? a.startedAt.getTime() : 0;
            const bTs = b.startedAt ? b.startedAt.getTime() : 0;
            return bTs - aTs;
          })
          .slice(0, 3)
          .map(({ id, startedAt, ...rest }) => ({
            id,
            ...rest,
            startedAt,
          }));

        setActivity(recentItems);
      } else {
        setActivity([]);
      }
    } catch (error) {
      console.error('Error cargando datos de Supabase:', error);
      setStats(fallbackStats);
      setActivity(fallbackActivity);
      setWeeklySeries(fallbackWeekly);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const bootstrapTimer = setTimeout(() => {
      void loadData();
    }, 0);

    const channel = supabase
      .channel('dashboard-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspectores' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspecciones' }, () => loadData())
      .subscribe();

    return () => {
      clearTimeout(bootstrapTimer);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`h-2 w-24 rounded-full bg-linear-to-r ${item.tone}`} />
            <p className="mt-4 text-sm font-medium text-slate-500">{item.title}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{item.value}</p>
            <p className="mt-2 text-sm text-slate-500">{item.subtitle}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Resumen del día</p>
              <h2 className="text-xl font-semibold text-slate-900">Actividad reciente</h2>
            </div>
            <span className="text-sm font-medium text-cyan-600">Ultimos 3 registros</span>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <p className="text-sm text-slate-500">Cargando datos desde Supabase...</p>
            ) : activity.length > 0 ? (
              activity.map((item) => (
                <div key={item.id || `${item.inspector}-${item.time}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{item.inspector}</p>
                    <p className="text-sm text-slate-500">{item.area}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">{item.status}</p>
                    <p className="text-sm text-slate-500">{item.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No hay actividad registrada aún.</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-cyan-300">Control semanal</p>
          <h2 className="mt-2 text-xl font-semibold">Inspecciones de los ultimos 7 dias</h2>

          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-7 items-end gap-2">
              {weeklySeries.map((day) => {
                const maxTotal = Math.max(1, ...weeklySeries.map((item) => item.total));
                const totalHeight = Math.max(8, Math.round((day.total / maxTotal) * 88));
                const completedHeight = day.total > 0
                  ? Math.max(6, Math.round((day.completed / day.total) * totalHeight))
                  : 0;

                return (
                  <div key={day.key} className="flex flex-col items-center gap-2">
                    <div className="relative h-24 w-8 rounded bg-slate-800">
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded bg-cyan-500/65"
                        style={{ height: `${totalHeight}px` }}
                      />
                      {completedHeight > 0 && (
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded bg-emerald-400"
                          style={{ height: `${completedHeight}px` }}
                        />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-300">{day.key}</p>
                      <p className="text-[11px] text-slate-400">{day.completed}/{day.total}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl bg-slate-800/60 px-3 py-2">
                <span className="text-slate-300">Total semanal</span>
                <span className="font-semibold text-white">{weeklySeries.reduce((acc, day) => acc + day.total, 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-800/60 px-3 py-2">
                <span className="text-slate-300">Cerradas semanales</span>
                <span className="font-semibold text-white">{weeklySeries.reduce((acc, day) => acc + day.completed, 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-800/60 px-3 py-2">
                <span className="text-slate-300">Tasa de cierre semanal</span>
                <span className="font-semibold text-white">
                  {(() => {
                    const total = weeklySeries.reduce((acc, day) => acc + day.total, 0);
                    const completed = weeklySeries.reduce((acc, day) => acc + day.completed, 0);
                    if (!total) return '0%';
                    return `${Math.round((completed / total) * 100)}%`;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
