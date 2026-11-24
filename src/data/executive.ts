import { inventoryCheck, quoteTotals, type Totals } from './logic';
import type { Project, ProjectStatus, State } from './types';

/** Executive (C-suite) metrics, derived live from the store. All money in COP. */

export const OPEN: ProjectStatus[] = ['nuevo', 'cotizacion', 'enviado'];
export const FUNNEL: ProjectStatus[] = ['nuevo', 'cotizacion', 'enviado', 'aprobado', 'rechazado'];

export interface ProjectRow {
  project: Project;
  totals: Totals;
  shortages: number;
  /** Days until the shoot starts (negative = already started/passed). null without dates. */
  daysToShoot: number | null;
}

export type RiskKind = 'vencido' | 'faltantes' | 'sin_fechas' | 'mantenimiento';

export interface Risk {
  kind: RiskKind;
  title: string;
  detail: string;
  to: string;
  severity: 'critical' | 'serious' | 'warning';
}

export interface MonthPoint {
  key: string; // YYYY-MM
  label: string;
  value: number;
  scheduled: boolean; // month is after the current month
}

export interface Executive {
  rows: ProjectRow[];
  pipeline: { value: number; count: number };
  awaiting: ProjectRow[];
  approved: { value: number; count: number; margin: number; avgDeal: number; marginPct: number };
  winRate: number | null;
  closed: number;
  funnel: { status: ProjectStatus; count: number; value: number }[];
  monthly: MonthPoint[];
  composition: { label: string; value: number }[];
  risks: Risk[];
  upcoming: ProjectRow[];
  inventory: { units: number; unavailableUnits: number; itemsDown: number; committedValue: number };
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY = 86_400_000;

function isoToday(now: Date): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${z(now.getMonth() + 1)}-${z(now.getDate())}`;
}

export function executive(state: State, now = new Date()): Executive {
  const today = isoToday(now);
  const rows: ProjectRow[] = state.projects.map(project => ({
    project,
    totals: quoteTotals(state, project),
    shortages: project.effects.length ? inventoryCheck(state, project).filter(r => r.shortage > 0).length : 0,
    daysToShoot: project.start ? Math.round((Date.parse(project.start) - Date.parse(today)) / DAY) : null,
  }));
  const sum = (rs: ProjectRow[], f: (r: ProjectRow) => number = r => r.totals.total) => rs.reduce((s, r) => s + f(r), 0);

  const open = rows.filter(r => OPEN.includes(r.project.status));
  const approvedRows = rows.filter(r => r.project.status === 'aprobado');
  const rejected = rows.filter(r => r.project.status === 'rechazado');
  const approvedValue = sum(approvedRows);
  const approvedMargin = sum(approvedRows, r => r.totals.margin);
  const closed = approvedRows.length + rejected.length;

  const funnel = FUNNEL.map(status => {
    const rs = rows.filter(r => r.project.status === status);
    return { status, count: rs.length, value: sum(rs) };
  });

  // Approved revenue by shoot month: from the first approved shoot through the latest, gaps filled.
  const monthly: MonthPoint[] = [];
  const dated = approvedRows.filter(r => r.project.start).map(r => r.project.start.slice(0, 7)).sort();
  if (dated.length) {
    const thisMonth = today.slice(0, 7);
    let [y, m] = dated[0].split('-').map(Number);
    const last = dated[dated.length - 1] > thisMonth ? dated[dated.length - 1] : thisMonth;
    for (let guard = 0; guard < 36; guard++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      monthly.push({
        key,
        label: `${MONTHS[m - 1]} ${String(y).slice(2)}`,
        value: sum(approvedRows.filter(r => r.project.start.startsWith(key))),
        scheduled: key > thisMonth,
      });
      if (key >= last) break;
      m++; if (m > 12) { m = 1; y++; }
    }
  }

  const composition = [
    { label: 'Inventario propio', value: sum(approvedRows, r => r.totals.inventory) },
    { label: 'Proveedores', value: sum(approvedRows, r => r.totals.suppliers) },
    { label: 'Personal', value: sum(approvedRows, r => r.totals.personal) },
    { label: 'Pólizas', value: sum(approvedRows, r => r.totals.polizas) },
    { label: 'Margen', value: approvedMargin },
  ];

  const risks: Risk[] = [];
  for (const r of open) {
    const p = r.project;
    if (r.daysToShoot !== null && r.daysToShoot <= 0) {
      risks.push({
        kind: 'vencido', severity: 'critical', to: `/proyectos/${p.id}/comparador`,
        title: `${p.name}: rodaje sin cotización aprobada`,
        detail: r.daysToShoot === 0 ? 'El rodaje empieza hoy.' : `El rodaje empezó hace ${-r.daysToShoot} días.`,
      });
    } else if (r.daysToShoot !== null && r.daysToShoot <= 14) {
      risks.push({
        kind: 'vencido', severity: 'serious', to: `/proyectos/${p.id}/comparador`,
        title: `${p.name}: rodaje en ${r.daysToShoot} días sin aprobar`,
        detail: 'Aprobar pronto para asegurar inventario y proveedores.',
      });
    }
    if (r.shortages > 0) {
      risks.push({
        kind: 'faltantes', severity: 'serious', to: `/proyectos/${p.id}/inventario`,
        title: `${p.name}: ${r.shortages} ítem${r.shortages > 1 ? 's' : ''} sin cubrir`,
        detail: 'Falta stock propio; requiere proveedor o liberar reservas.',
      });
    }
    if (!p.start) {
      risks.push({
        kind: 'sin_fechas', severity: 'warning', to: `/proyectos/${p.id}`,
        title: `${p.name}: sin fechas de rodaje`, detail: 'No se puede verificar disponibilidad.',
      });
    }
  }
  const down = state.inventory.filter(i => i.status !== 'disponible');
  for (const i of down) {
    const neededBy = open.filter(r => r.project.effects.some(e => e.itemId === i.id)).length;
    if (!neededBy) continue;
    risks.push({
      kind: 'mantenimiento', severity: 'warning', to: `/inventario/${i.id}`,
      title: `${i.name} fuera de servicio`,
      detail: `Lo requieren ${neededBy} proyecto${neededBy > 1 ? 's' : ''} abiertos.`,
    });
  }
  const rank = { critical: 0, serious: 1, warning: 2 };
  risks.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const upcoming = rows
    .filter(r => r.project.status !== 'rechazado' && r.daysToShoot !== null && r.daysToShoot >= 0 && r.daysToShoot <= 60)
    .sort((a, b) => a.daysToShoot! - b.daysToShoot!);

  const committedValue = state.reservations.reduce((s, r) => {
    const item = state.inventory.find(i => i.id === r.itemId);
    const p = state.projects.find(x => x.id === r.projectId);
    return item && p ? s + r.qty * item.dailyRate * Math.max(1, Math.round((Date.parse(r.to || r.from) - Date.parse(r.from)) / DAY) + 1) : s;
  }, 0);

  return {
    rows,
    pipeline: { value: sum(open), count: open.length },
    awaiting: rows.filter(r => r.project.status === 'enviado').sort((a, b) => b.totals.total - a.totals.total),
    approved: {
      value: approvedValue,
      count: approvedRows.length,
      margin: approvedMargin,
      avgDeal: approvedRows.length ? approvedValue / approvedRows.length : 0,
      marginPct: approvedValue ? approvedMargin / approvedValue : 0,
    },
    winRate: closed ? approvedRows.length / closed : null,
    closed,
    funnel,
    monthly,
    composition,
    risks,
    upcoming,
    inventory: {
      units: state.inventory.reduce((s, i) => s + i.qty, 0),
      unavailableUnits: down.reduce((s, i) => s + i.qty, 0),
      itemsDown: down.length,
      committedValue,
    },
  };
}

/** Compact COP for headline numbers: $48,2 M. */
export function moneyShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 })} mil M`;
  if (abs >= 1e6) return `$${(n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e3) return `$${(n / 1e3).toLocaleString('es-CO', { maximumFractionDigits: 0 })} mil`;
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}
