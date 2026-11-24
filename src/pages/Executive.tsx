import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { PageHeader, Pill, StatusPill } from '../components/ui';
import { executive, moneyShort, type MonthPoint, type Risk } from '../data/executive';
import { dateRange, money, shortDate, STATUS_LABEL } from '../data/logic';
import { useStore } from '../data/store';
import type { ProjectStatus } from '../data/types';

const pct = (n: number) => `${Math.round(n * 100)} %`;

const FUNNEL_COLOR: Record<ProjectStatus, string> = {
  nuevo: '#71717A', cotizacion: '#3B6CF0', enviado: '#E39B17', aprobado: '#22A05A', rechazado: '#B42318',
};

const SEVERITY: Record<Risk['severity'], { tone: string; label: string; icon: IconName }> = {
  critical: { tone: 'red', label: 'Crítico', icon: 'alert' },
  serious: { tone: 'amber', label: 'Alto', icon: 'alert' },
  warning: { tone: 'gray', label: 'Vigilar', icon: 'info' },
};

export function Executive() {
  const { state, update } = useStore();
  const ex = useMemo(() => executive(state), [state]);
  const isManager = state.user.role === 'gerencia';

  if (!isManager) {
    return (
      <>
        <PageHeader eyebrow="Dirección" title="Tablero ejecutivo" />
        <section className="card empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Icon name="lock" size={28} />
          <p>El tablero ejecutivo es solo para Gerencia.</p>
          <button className="btn btn-s" type="button" onClick={() => update(s => { s.user.role = 'gerencia'; })}>
            Ver como Gerencia (demo)
          </button>
        </section>
      </>
    );
  }

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <>
      <PageHeader eyebrow={`Dirección · corte ${shortDate(today)}`} title="Tablero ejecutivo" actions={
        <button className="btn btn-s" type="button" onClick={() => window.print()}><Icon name="download" />Exportar PDF</button>
      } />

      <div className="kpis">
        <Kpi label="Ingresos aprobados" value={moneyShort(ex.approved.value)} exact={money(ex.approved.value)}
          foot={`${ex.approved.count} proyectos · ticket prom. ${moneyShort(ex.approved.avgDeal)}`} />
        <Kpi label="Pipeline abierto" value={moneyShort(ex.pipeline.value)} exact={money(ex.pipeline.value)}
          foot={`${ex.pipeline.count} cotizaciones en curso`} />
        <Kpi label="Margen bruto aprobado" value={moneyShort(ex.approved.margin)} exact={money(ex.approved.margin)}
          foot={`${pct(ex.approved.marginPct)} sobre ingresos`} />
        <Kpi label="Tasa de cierre" value={ex.winRate === null ? '—' : pct(ex.winRate)}
          foot={ex.closed ? `${ex.approved.count} de ${ex.closed} cotizaciones cerradas` : 'Sin cotizaciones cerradas'} />
      </div>

      <div className="ex-grid">
        <section className="card card-pad" aria-labelledby="dec">
          <div className="card-head">
            <h2 id="dec">Pendiente de tu aprobación</h2>
            <span className="hint">{ex.awaiting.length ? `${moneyShort(ex.awaiting.reduce((s, r) => s + r.totals.total, 0))} en juego` : ''}</span>
          </div>
          {ex.awaiting.length === 0 ? <p className="hint">No hay cotizaciones esperando decisión.</p> : (
            <ul className="ex-list">
              {ex.awaiting.map(r => (
                <li key={r.project.id}>
                  <div className="ex-list-main">
                    <b>{r.project.name}</b>
                    <span className="hint">{r.project.client || 'Sin cliente'} · {dateRange(r.project)} · margen {r.project.costs.margin} %</span>
                  </div>
                  <span className="mono ex-amt">{money(r.totals.total)}</span>
                  <Link className="btn btn-p no-print" to={`/proyectos/${r.project.id}/comparador`}>Revisar</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card-pad" aria-labelledby="risk">
          <div className="card-head">
            <h2 id="risk">Riesgos operativos</h2>
            <span className="hint">{ex.risks.length} alerta{ex.risks.length === 1 ? '' : 's'}</span>
          </div>
          {ex.risks.length === 0 ? <p className="hint">Sin riesgos abiertos.</p> : (
            <ul className="ex-list">
              {ex.risks.slice(0, 6).map((r, i) => {
                const sv = SEVERITY[r.severity];
                return (
                  <li key={i}>
                    <Pill tone={sv.tone} dot={false}><Icon name={sv.icon} size={12} stroke={2.5} />{sv.label}</Pill>
                    <div className="ex-list-main">
                      <Link className="row-link" to={r.to}>{r.title}</Link>
                      <span className="hint">{r.detail}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="ex-grid">
        <section className="card card-pad" aria-labelledby="trend">
          <div className="card-head">
            <h2 id="trend">Ingresos aprobados por mes de rodaje</h2>
            <div className="legend">
              <span><i className="sw" style={{ background: 'var(--ink-2)' }} />Ejecutado</span>
              <span><i className="sw sw-sched" />Programado</span>
            </div>
          </div>
          <MonthlyChart data={ex.monthly} />
        </section>

        <section className="card card-pad" aria-labelledby="funnel">
          <div className="card-head">
            <h2 id="funnel">Embudo comercial</h2>
            <span className="hint">valor por estado</span>
          </div>
          <HBars rows={ex.funnel.map(f => ({
            key: f.status, color: FUNNEL_COLOR[f.status], value: f.value,
            label: <>{STATUS_LABEL[f.status]} <span className="cnt">{f.count}</span></>,
          }))} />
        </section>
      </div>

      <div className="ex-grid">
        <section className="card card-pad" aria-labelledby="mix">
          <div className="card-head">
            <h2 id="mix">¿De dónde vienen los ingresos aprobados?</h2>
          </div>
          <HBars share rows={ex.composition.map(c => ({ key: c.label, label: c.label, value: c.value, color: c.label === 'Margen' ? 'var(--accent)' : 'var(--ink-2)' }))} />
          <p className="hint">
            Inventario propio: {ex.inventory.units} unidades, {ex.inventory.itemsDown} ítem{ex.inventory.itemsDown === 1 ? '' : 's'} fuera de servicio.
            {' '}Reservas vigentes equivalen a {moneyShort(ex.inventory.committedValue)} en alquiler interno.
          </p>
        </section>

        <section className="card" aria-labelledby="up">
          <div className="card-head" style={{ padding: '18px 20px' }}>
            <h2 id="up">Próximos rodajes (60 días)</h2>
          </div>
          {ex.upcoming.length === 0 ? <div className="empty">No hay rodajes programados.</div> : (
            <div className="scroll-x">
              <table className="t t-compact">
                <thead><tr><th>Producción</th><th>Rodaje</th><th>Estado</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {ex.upcoming.map(r => (
                    <tr key={r.project.id}>
                      <td><Link className="row-link" to={`/proyectos/${r.project.id}`}>{r.project.name}</Link></td>
                      <td className="dim" style={{ fontSize: 13 }}>{shortDate(r.project.start)}<br /><span className="hint">{r.daysToShoot === 0 ? 'Hoy' : `en ${r.daysToShoot} días`}</span></td>
                      <td><StatusPill status={r.project.status} /></td>
                      <td className="num mono">{moneyShort(r.totals.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="all">
        <div className="card-head" style={{ padding: '18px 20px' }}>
          <h2 id="all">Cartera completa</h2>
          <span className="hint">valores calculados con el cotizador actual</span>
        </div>
        <div className="scroll-x">
          <table className="t" style={{ minWidth: 760 }}>
            <thead><tr><th>Producción</th><th>Cliente</th><th>Rodaje</th><th>Estado</th><th className="num">Costo</th><th className="num">Margen</th><th className="num">Total</th></tr></thead>
            <tbody>
              {[...ex.rows].sort((a, b) => b.totals.total - a.totals.total).map(r => (
                <tr key={r.project.id}>
                  <td><Link className="row-link" to={`/proyectos/${r.project.id}`}>{r.project.name}</Link></td>
                  <td className="dim">{r.project.client || '—'}</td>
                  <td className="dim mono" style={{ fontSize: 13 }}>{dateRange(r.project)}</td>
                  <td><StatusPill status={r.project.status} /></td>
                  <td className="num mono">{money(r.totals.subtotal)}</td>
                  <td className="num mono">{money(r.totals.margin)}</td>
                  <td className="num mono"><b>{money(r.totals.total)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, exact, foot }: { label: string; value: string; exact?: string; foot: string }) {
  return (
    <div className="card kpi" title={exact}>
      <span className="kpi-label">{label}</span>
      <b className="kpi-value">{value}</b>
      <span className="hint">{foot}</span>
    </div>
  );
}

/** Vertical bars, one series; scheduled (future) months are hatched. */
function MonthlyChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  if (!data.length) return <p className="hint">Aún no hay proyectos aprobados.</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  const H = 180;
  return (
    <>
      <div className="vbars" style={{ height: H + 28 }} onMouseLeave={() => setHover(null)}>
        <div className="vbars-grid" style={{ height: H }}>
          <span>{moneyShort(max)}</span><span>{moneyShort(max / 2)}</span><span>0</span>
        </div>
        <div className="vbars-plot">
          {data.map((d, i) => (
            <div key={d.key} className="vbar-col" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)}
              tabIndex={0} aria-label={`${d.label}: ${money(d.value)}${d.scheduled ? ' (programado)' : ''}`}>
              <div className="vbar-track" style={{ height: H }}>
                {hover === i && (
                  <div className="tip" style={{ bottom: Math.max(4, (d.value / max) * H) + 8 }}>
                    <b>{d.label}</b><span className="mono">{money(d.value)}</span>
                    <small>{d.scheduled ? 'Programado' : 'Ejecutado'}</small>
                  </div>
                )}
                <div className={`vbar ${d.scheduled ? 'sched' : ''} ${hover === i ? 'hot' : ''}`}
                  style={{ height: d.value ? Math.max(3, (d.value / max) * H) : 0 }} />
              </div>
              <span className="vbar-x">{d.label}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="link-btn no-print" type="button" onClick={() => setTable(t => !t)} aria-expanded={table}>
        {table ? 'Ocultar datos' : 'Ver datos'}
      </button>
      {table && (
        <table className="t">
          <thead><tr><th>Mes</th><th>Tipo</th><th className="num">Ingresos</th></tr></thead>
          <tbody>{data.map(d => <tr key={d.key}><td>{d.label}</td><td className="dim">{d.scheduled ? 'Programado' : 'Ejecutado'}</td><td className="num mono">{money(d.value)}</td></tr>)}</tbody>
        </table>
      )}
    </>
  );
}

/** Horizontal bars with direct labels; `share` adds % of total. */
function HBars({ rows, share }: { rows: { key: string; label: ReactNode; value: number; color: string }[]; share?: boolean }) {
  const max = Math.max(...rows.map(r => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="hbars">
      {rows.map(r => (
        <li key={r.key} title={money(r.value)}>
          <span className="hbar-label">{r.label}</span>
          <span className="hbar-track">
            <span className="hbar" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </span>
          <span className="hbar-val mono">{moneyShort(r.value)}{share && <small> · {Math.round((r.value / total) * 100)} %</small>}</span>
        </li>
      ))}
    </ul>
  );
}
