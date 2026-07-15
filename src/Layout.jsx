import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import Sidebar from './Sidebar';
import Header from './Header';
import Dashboard from './Dashboard';
import { supabase } from './supabaseClient';

const SUPABASE_URL = 'https://dchliszajubvvuupkqlz.supabase.co';
const STORAGE_BUCKET = 'imagenes';

const buildImageUrl = (imagenuri) => {
  if (!imagenuri) return '';
  // Si ya es una URL completa, retornarlo
  if (imagenuri.startsWith('http')) return imagenuri;
  // Construir la URL pública de Supabase Storage
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${imagenuri}`;
};

const getInspectionTimestamp = (dateStr, timeStr) => {
  if (!dateStr) return 0;
  const safeTime = timeStr && String(timeStr).trim() ? String(timeStr).trim() : '00:00:00';
  const parsed = new Date(`${dateStr}T${safeTime}`);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getTime();
};

const getInspectionStatus = (inspection) => {
  const hasStartTime = Boolean(inspection?.horainicio);
  const hasEndTime = Boolean(inspection?.horafin);

  if (hasEndTime) return 'Completada';
  if (hasStartTime) return 'Activa';
  return 'Pendiente';
};

function Layout({ userEmail, onSignOut }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeItem, setActiveItem] = useState('Dashboard');
  const [openInspection, setOpenInspection] = useState(null);
  const [inspectors, setInspectors] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [selectedInspectorId, setSelectedInspectorId] = useState(null);
  const [expandedJornadaIds, setExpandedJornadaIds] = useState([]);
  const [inspectionSearch, setInspectionSearch] = useState('');
  const [inspectionInspectorFilter, setInspectionInspectorFilter] = useState('all');
  const [inspectionLineFilter, setInspectionLineFilter] = useState('all');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [{ data: inspectorsData, error: inspectorsError }, { data: jornadasData, error: jornadasError }, { data: inspectionsData, error: inspectionsError }] = await Promise.all([
        supabase.from('inspectores').select('*').order('nombre', { ascending: true }),
        supabase.from('jornadas').select('*').order('fecha', { ascending: false }),
        supabase.from('inspecciones').select('*').order('fechainicio', { ascending: false }),
      ]);

      if (inspectorsError) {
        console.warn('No se pudo leer inspectores:', inspectorsError.message);
      }
      if (jornadasError) {
        console.warn('No se pudo leer jornadas:', jornadasError.message);
      }
      if (inspectionsError) {
        console.warn('No se pudo leer inspecciones:', inspectionsError.message);
      }

      const inspectorsById = (inspectorsData || []).reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {});

      setInspectors(
        (inspectorsData || []).map((item) => ({
          id: item.id,
          name: `${item.nombre ?? ''} ${item.apellido ?? ''}`.trim() || item.legajo || 'Sin nombre',
          area: item.rol ? item.rol : 'Inspector',
          status: item.rol ? item.rol : 'Activo',
          phone: item.pin ? String(item.pin) : '—',
        }))
      );

      // store jornadas for statistics
      setJornadas((jornadasData || []).map((j) => ({
        id: j.id,
        fecha: j.fecha,
        iniciojornada: j.iniciojornada,
        finjornada: j.finjornada,
        inspector_id: j.inspector_id,
      })));

      const jornadaById = (jornadasData || []).reduce((acc, jornada) => {
        acc[jornada.id] = jornada;
        return acc;
      }, {});

      setInspections(
        (inspectionsData || [])
          .map((item) => {
            const jornada = jornadaById[item.jornada_id] || {};
            const inspector = inspectorsById[jornada.inspector_id] || {};
            const inspectorName = inspector.nombre ? `${inspector.nombre} ${inspector.apellido ?? ''}`.trim() : 'Inspector';
            const dateValue = item.fechainicio || jornada.fecha || null;
            const timeStartValue = item.horainicio || null;
            const statusValue = getInspectionStatus(item);

            return {
              id: item.id,
              jornada_id: item.jornada_id,
              interno: item.interno || '—',
              linea: item.linea || '—',
              title: `Interno ${item.interno} · Línea ${item.linea}`,
              inspector: inspectorName,
              date: dateValue || 'Sin fecha',
              timeStart: timeStartValue || '—',
              timeEnd: item.horafin || '—',
              status: statusValue,
              locationStart: item.direccioninicio || '—',
              locationEnd: item.direccionfin || '—',
              image: buildImageUrl(item.imagenuri),
              details: item.observaciones || 'Sin observaciones',
              sortTimestamp: getInspectionTimestamp(dateValue, timeStartValue),
            };
          })
          .sort((a, b) => {
            if (b.sortTimestamp !== a.sortTimestamp) {
              return b.sortTimestamp - a.sortTimestamp;
            }
            return Number(b.id || 0) - Number(a.id || 0);
          })
          .map(({ sortTimestamp, ...inspection }) => inspection)
      );

      setLastSyncAt(new Date().toISOString());
    } catch (error) {
      console.error('Error cargando datos reales:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('layout-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspectores' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jornadas' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspecciones' }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // set default selected inspector once inspectors load
  useEffect(() => {
    if (!selectedInspectorId && inspectors && inspectors.length > 0) {
      setSelectedInspectorId(inspectors[0].id);
    }
  }, [inspectors]);

  // helpers to compute durations
  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    // accept formats like HH:MM or HH:MM:SS
    const parts = String(timeStr).split(':').map((p) => parseInt(p, 10));
    if (!parts.length || Number.isNaN(parts[0])) return 0;
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return h * 60 + m;
  };

  const computeDurationMinutes = (start, end) => {
    const s = parseTimeToMinutes(start);
    const e = parseTimeToMinutes(end);
    if (!s || !e) return 0;
    const diff = e - s;
    return diff > 0 ? diff : 0;
  };

  const formatMinutes = (mins) => {
    if (!mins || mins <= 0) return '0 min';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m} min`;
  };

  const toggleJornada = (jornadaId) => {
    setExpandedJornadaIds((prev) =>
      prev.includes(jornadaId) ? prev.filter((id) => id !== jornadaId) : [...prev, jornadaId]
    );
  };

  const exportJornadaToExcel = (jornada, jornadaInspections, metrics, inspectorName) => {
    if (typeof window === 'undefined') return;

    const headerFill = { fgColor: { rgb: '0F766E' }, patternType: 'solid' };
    const headerFont = { bold: true, color: { rgb: 'FFFFFF' } };
    const cellStyle = {
      border: {
        top: { style: 'thin', color: { rgb: 'D1D5DB' } },
        bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
        left: { style: 'thin', color: { rgb: 'D1D5DB' } },
        right: { style: 'thin', color: { rgb: 'D1D5DB' } },
      },
      alignment: { vertical: 'top', wrapText: true },
    };

    const summaryRows = [
      ['Resumen de jornada', jornada.fecha || 'Sin fecha'],
      ['Inspector', inspectorName],
      ['Hora de inicio', jornada.iniciojornada || '—'],
      ['Hora de fin', jornada.finjornada || '—'],
      ['Tiempo total inspeccionado', metrics.totalInspected],
      ['Tiempo sin actividad', metrics.timeWithoutActivity],
      ['Promedio por inspección', metrics.avgPerInspection],
    ];

    const inspectionRows = [
      ['Interno', 'Línea', 'Inspector', 'Fecha', 'Hora inicio', 'Hora fin', 'Estado', 'Dirección inicio', 'Dirección fin', 'Observaciones'],
      ...jornadaInspections.map((item) => [
        item.interno || '—',
        item.linea || '—',
        item.inspector || '—',
        item.date || '—',
        item.timeStart || '—',
        item.timeEnd || '—',
        item.status || '—',
        item.locationStart || '—',
        item.locationEnd || '—',
        item.details || '—',
      ]),
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    const inspectionsSheet = XLSX.utils.aoa_to_sheet(inspectionRows);

    const applyTableStyle = (ws, headerRowIndex = 0, startRow = 1) => {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = startRow; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellRef]) continue;
          ws[cellRef].s = { ...cellStyle, ...(R === headerRowIndex ? { fill: headerFill, font: headerFont } : {}) };
        }
      }
      ws['!cols'] = Array.from({ length: range.e.c + 1 }, (_, c) => ({
        width: Math.max(12, Math.min(40, Math.max(...Array.from({ length: range.e.r + 1 }, (_, r) => {
          const ref = ws[XLSX.utils.encode_cell({ r, c })];
          return ref ? String(ref.v || '').length : 0;
        })) + 2)),
      }));
      ws['!rows'] = [{ hpx: 24 }, ...Array.from({ length: range.e.r }, () => ({ hpx: 20 }))];
      ws['!freeze'] = { ySplit: 1 };
      ws['A1'].s = { ...cellStyle, fill: headerFill, font: headerFont };
    };

    const titleStyle = {
      font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
      fill: headerFill,
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'D1D5DB' } },
        bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
        left: { style: 'thin', color: { rgb: 'D1D5DB' } },
        right: { style: 'thin', color: { rgb: 'D1D5DB' } },
      },
    };

    summarySheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    summarySheet['A1'].s = titleStyle;
    summarySheet['B1'].s = titleStyle;
    summarySheet['!cols'] = [
      { width: 24 },
      { width: 36 },
    ];
    summarySheet['!rows'] = [{ hpx: 28 }, ...Array.from({ length: summaryRows.length }, () => ({ hpx: 20 }))];

    for (let rowIndex = 1; rowIndex < summaryRows.length + 1; rowIndex += 1) {
      const row = summaryRows[rowIndex - 1];
      const firstCell = summarySheet[XLSX.utils.encode_cell({ r: rowIndex, c: 0 })];
      const secondCell = summarySheet[XLSX.utils.encode_cell({ r: rowIndex, c: 1 })];
      if (firstCell) firstCell.s = { ...cellStyle, font: { bold: true } };
      if (secondCell) secondCell.s = cellStyle;
    }

    const workbook = XLSX.utils.book_new();
    applyTableStyle(inspectionsSheet, 0, 0);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
    XLSX.utils.book_append_sheet(workbook, inspectionsSheet, 'Inspecciones');

    XLSX.writeFile(workbook, `jornada-${jornada.fecha || 'sin-fecha'}.xlsx`);
  };

  const renderStatisticsView = () => {
    const filteredJornadas = jornadas.filter((j) => !selectedInspectorId || String(j.inspector_id) === String(selectedInspectorId));

    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Estadísticas</h2>
            <p className="mt-2 text-sm text-slate-500">Resumen de jornadas con métricas exportables.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Inspector</label>
            <select
              value={selectedInspectorId ?? ''}
              onChange={(e) => setSelectedInspectorId(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {inspectors.map((ins) => (
                <option key={ins.id} value={ins.id}>{ins.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-500">Cargando métricas...</p>
          ) : filteredJornadas.length === 0 ? (
            <p className="text-sm text-slate-500">No hay jornadas para el inspector seleccionado.</p>
          ) : (
            filteredJornadas.map((j) => {
              const jornadaInspections = inspections.filter((it) => String(it.jornada_id) === String(j.id));
              const totalInspectedMinutes = jornadaInspections.reduce((acc, it) => acc + computeDurationMinutes(it.timeStart, it.timeEnd), 0);
              const jornadaDurationMinutes = computeDurationMinutes(j.iniciojornada, j.finjornada);
              const timeWithoutActivity = Math.max(0, jornadaDurationMinutes - totalInspectedMinutes);
              const avgPerInspection = jornadaInspections.length > 0 ? Math.round(totalInspectedMinutes / jornadaInspections.length) : 0;
              const inspectorName = inspectors.find((ins) => String(ins.id) === String(selectedInspectorId))?.name || 'Inspector';

              return (
                <div key={j.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">Jornada: {j.fecha || 'Sin fecha'}</h3>
                      <p className="mt-1 text-sm text-slate-500">Inicio: {j.iniciojornada || '—'} — Fin: {j.finjornada || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportJornadaToExcel(j, jornadaInspections, {
                          totalInspected: formatMinutes(totalInspectedMinutes),
                          timeWithoutActivity: formatMinutes(timeWithoutActivity),
                          avgPerInspection: formatMinutes(avgPerInspection),
                        }, inspectorName)}
                        className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-700 transition hover:bg-cyan-100"
                      >
                        Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleJornada(j.id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        {expandedJornadaIds.includes(j.id) ? 'Ocultar' : 'Ver tablas'}
                      </button>
                    </div>
                  </div>

                  {expandedJornadaIds.includes(j.id) && (
                    <div className="p-4">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <table className="min-w-full text-sm">
                          <caption className="bg-slate-100 px-3 py-2 text-left text-sm font-semibold text-slate-700">Resumen de jornada</caption>
                          <tbody>
                            <tr className="border-b border-slate-200">
                              <td className="w-1/3 px-3 py-2 font-medium text-slate-600">Fecha</td>
                              <td className="px-3 py-2 text-slate-700">{j.fecha || '—'}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="w-1/3 px-3 py-2 font-medium text-slate-600">Hora de inicio</td>
                              <td className="px-3 py-2 text-slate-700">{j.iniciojornada || '—'}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="w-1/3 px-3 py-2 font-medium text-slate-600">Hora de fin</td>
                              <td className="px-3 py-2 text-slate-700">{j.finjornada || '—'}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="w-1/3 px-3 py-2 font-medium text-slate-600">Tiempo total inspeccionado</td>
                              <td className="px-3 py-2 text-slate-700">{formatMinutes(totalInspectedMinutes)}</td>
                            </tr>
                            <tr className="border-b border-slate-200">
                              <td className="w-1/3 px-3 py-2 font-medium text-slate-600">Tiempo sin actividad</td>
                              <td className="px-3 py-2 text-slate-700">{formatMinutes(timeWithoutActivity)}</td>
                            </tr>
                            <tr>
                              <td className="w-1/3 px-3 py-2 font-medium text-slate-600">Promedio por inspección</td>
                              <td className="px-3 py-2 text-slate-700">{formatMinutes(avgPerInspection)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="min-w-full text-sm">
                          <caption className="bg-slate-100 px-3 py-2 text-left text-sm font-semibold text-slate-700">Inspecciones</caption>
                          <thead className="bg-slate-50 text-left text-slate-600">
                            <tr>
                              <th className="px-3 py-2">Interno</th>
                              <th className="px-3 py-2">Línea</th>
                              <th className="px-3 py-2">Inspector</th>
                              <th className="px-3 py-2">Fecha</th>
                              <th className="px-3 py-2">Inicio</th>
                              <th className="px-3 py-2">Fin</th>
                              <th className="px-3 py-2">Estado</th>
                              <th className="px-3 py-2">Dirección inicio</th>
                              <th className="px-3 py-2">Dirección fin</th>
                              <th className="px-3 py-2">Observaciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jornadaInspections.length > 0 ? (
                              jornadaInspections.map((item) => (
                                <tr key={item.id} className="border-t border-slate-200">
                                  <td className="px-3 py-2">{item.interno}</td>
                                  <td className="px-3 py-2">{item.linea}</td>
                                  <td className="px-3 py-2">{item.inspector}</td>
                                  <td className="px-3 py-2">{item.date}</td>
                                  <td className="px-3 py-2">{item.timeStart}</td>
                                  <td className="px-3 py-2">{item.timeEnd}</td>
                                  <td className="px-3 py-2">{item.status}</td>
                                  <td className="px-3 py-2">{item.locationStart}</td>
                                  <td className="px-3 py-2">{item.locationEnd}</td>
                                  <td className="px-3 py-2">{item.details}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan="10" className="px-3 py-3 text-sm text-slate-500">No hay inspecciones para esta jornada.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    );
  };

  const renderContent = () => {
    const normalizedSearch = inspectionSearch.trim().toLowerCase();
    const completedInspections = inspections.filter((item) => item.status === 'Completada');
    const filteredInspections = completedInspections.filter((item) => {
      const matchesSearch = !normalizedSearch
        || String(item.interno).toLowerCase().includes(normalizedSearch)
        || String(item.linea).toLowerCase().includes(normalizedSearch)
        || String(item.inspector).toLowerCase().includes(normalizedSearch)
        || String(item.details).toLowerCase().includes(normalizedSearch);

      const matchesInspector = inspectionInspectorFilter === 'all'
        || item.inspector === inspectionInspectorFilter;

      const matchesLine = inspectionLineFilter === 'all'
        || String(item.linea) === inspectionLineFilter;

      return matchesSearch && matchesInspector && matchesLine;
    });

    const inspectorFilterOptions = Array.from(new Set(completedInspections.map((item) => item.inspector))).sort();
    const lineFilterOptions = Array.from(new Set(completedInspections.map((item) => String(item.linea)))).sort();

    switch (activeItem) {
      case 'Inspectores':
        return (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Inspectores</h2>
              <p className="mt-2 text-sm text-slate-500">Lista de inspectores registrados con su estado actual.</p>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Cargando inspectores desde Supabase...</p>
            ) : inspectors.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {inspectors.map((inspector) => (
                  <div key={inspector.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">{inspector.name}</h3>
                      <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-700">{inspector.status}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-500">Área: {inspector.area}</p>
                    <p className="mt-1 text-sm text-slate-500">Teléfono: {inspector.phone}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay inspectores registrados aún.</p>
            )}
          </section>
        );
      case 'Inspecciones':
        return (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Inspecciones</h2>
              <p className="mt-2 text-sm text-slate-500">Detalle de inspecciones realizadas con ubicación, horarios e imágenes.</p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
              <input
                type="text"
                value={inspectionSearch}
                onChange={(event) => setInspectionSearch(event.target.value)}
                placeholder="Buscar por interno, linea, inspector u observacion"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-cyan-400 xl:col-span-2"
              />

              <select
                value={inspectionInspectorFilter}
                onChange={(event) => setInspectionInspectorFilter(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <option value="all">Todos los inspectores</option>
                {inspectorFilterOptions.map((inspectorName) => (
                  <option key={inspectorName} value={inspectorName}>{inspectorName}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <select
                  value={inspectionLineFilter}
                  onChange={(event) => setInspectionLineFilter(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="all">Todas las lineas</option>
                  {lineFilterOptions.map((lineValue) => (
                    <option key={lineValue} value={lineValue}>Linea {lineValue}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setInspectionSearch('');
                    setInspectionInspectorFilter('all');
                    setInspectionLineFilter('all');
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Mostrando {filteredInspections.length} de {completedInspections.length} inspecciones completadas.
            </p>

            {loading ? (
              <p className="text-sm text-slate-500">Cargando inspecciones desde Supabase...</p>
            ) : filteredInspections.length > 0 ? (
              <div className="space-y-4">
                {filteredInspections.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setOpenInspection(openInspection === item.id ? null : item.id)}
                      className="flex w-full items-center justify-between bg-slate-50 px-4 py-4 text-left hover:bg-slate-100 transition"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <div className="mt-2 grid gap-2 text-sm text-slate-600">
                          <p>👤 {item.inspector}</p>
                          <p>📅 {item.date}</p>
                          <p>⏰ {item.timeStart} - {item.timeEnd}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.status === 'Completada' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : item.status === 'Activa'
                              ? 'bg-cyan-100 text-cyan-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}>
                          {item.status}
                        </span>
                        <span className="text-lg text-slate-500">{openInspection === item.id ? '−' : '+'}</span>
                      </div>
                    </button>
                    {openInspection === item.id && (
                      <div className="space-y-4 border-t border-slate-200 bg-white p-4">
                        <div className="grid gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Hora inicio</p>
                            <p className="mt-1 text-sm text-slate-700">{item.timeStart}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Hora fin</p>
                            <p className="mt-1 text-sm text-slate-700">{item.timeEnd}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Dirección de inicio</p>
                            <p className="mt-1 text-sm text-slate-700">{item.locationStart}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Dirección de fin</p>
                            <p className="mt-1 text-sm text-slate-700">{item.locationEnd}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase">Observaciones</p>
                            <p className="mt-1 text-sm text-slate-700">{item.details}</p>
                          </div>
                        </div>
                        {item.image && (
                          <div>
                            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">Fotografía</p>
                            <img 
                              src={item.image} 
                              alt={item.title} 
                              className="h-40 w-full rounded-xl object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay inspecciones que coincidan con los filtros aplicados.</p>
            )}
          </section>
        );
      case 'Estadísticas':
        return renderStatisticsView();
      case 'Exportar Excel':
        return renderStatisticsView();
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        activeItem={activeItem}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNavigate={(item) => {
          setActiveItem(item);
          setSidebarOpen(false);
        }}
      />

      <div className="lg:pl-72">
        <Header
          title={activeItem}
          userEmail={userEmail}
          onSignOut={onSignOut}
          lastSyncAt={lastSyncAt}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{renderContent()}</main>
      </div>

      {/* image modal removed per user request */}
    </div>
  );
}

export default Layout;
