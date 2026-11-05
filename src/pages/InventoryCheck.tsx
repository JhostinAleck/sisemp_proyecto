import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PageHeader, Pill, Stepper } from '../components/ui';
import { dateRange, inventoryCheck } from '../data/logic';
import { uid, useStore } from '../data/store';
import { NotFound } from './NotFound';

export function InventoryCheck() {
  const { id } = useParams();
  const nav = useNavigate();
  const { state, update, toast } = useStore();
  const project = state.projects.find(p => p.id === id);
  const rows = project ? inventoryCheck(state, project) : [];
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(rows.filter(r => r.state === 'disponible' && r.reservedHere < r.required).map(r => r.item.id)),
  );
  if (!project) return <NotFound />;

  const n = (s: string) => rows.filter(r => r.state === s).length;
  const missing = rows.filter(r => r.shortage > 0);
  const reservable = rows.filter(r => selected.has(r.item.id) && r.state === 'disponible' && r.reservedHere < r.required);

  const toggle = (iid: string) => setSelected(s => { const c = new Set(s); c.has(iid) ? c.delete(iid) : c.add(iid); return c; });
  const allOn = rows.length > 0 && rows.every(r => selected.has(r.item.id));

  const reserve = () => {
    update(s => {
      for (const r of reservable) {
        s.reservations = s.reservations.filter(x => !(x.itemId === r.item.id && x.projectId === project.id));
        s.reservations.push({ id: uid('r'), itemId: r.item.id, projectId: project.id, qty: r.required, from: project.start, to: project.end || project.start });
        s.movements.push({ id: uid('m'), itemId: r.item.id, kind: 'reserva', label: `Reserva · ${project.name}`, date: new Date().toISOString() });
      }
    });
    toast(`${reservable.length} ítem${reservable.length === 1 ? '' : 's'} reservado${reservable.length === 1 ? '' : 's'} para ${project.name}`);
    setSelected(new Set());
  };

  const quoteMissing = () => {
    update(s => { const p = s.projects.find(x => x.id === id)!; if (p.status === 'nuevo') p.status = 'cotizacion'; });
    nav(`/proyectos/${id}/solicitud`);
  };

  return (
    <>
      <PageHeader back={`/proyectos/${id}`} backLabel="Volver al desglose"
        eyebrow={<>{project.name} · rodaje <span className="mono">{dateRange(project)}</span></>} title="Verificación de inventario" />

      <Stepper projectId={project.id} current={1} />

      <div className="stats">
        <div className="card stat"><div className="stat-ic tone-green"><Icon name="check" size={20} /></div><div><b>{n('disponible')}</b><span>Disponibles</span></div></div>
        <div className="card stat"><div className="stat-ic tone-amber"><Icon name="clock" size={20} /></div><div><b>{n('reservado')}</b><span>Reservado en otro proyecto</span></div></div>
        <div className={`card stat ${n('faltante') ? 'alert' : ''}`}><div className="stat-ic tone-solid-red"><Icon name="alert" size={20} /></div><div><b>{n('faltante')}</b><span>Faltante</span></div></div>
      </div>

      <section className="card" aria-label="Materiales requeridos">
        <div className="scroll-x">
          <table className="t" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ width: 48 }}><input className="cb" type="checkbox" aria-label="Seleccionar todos" checked={allOn}
                  onChange={() => setSelected(allOn ? new Set() : new Set(rows.map(r => r.item.id)))} /></th>
                <th>Ítem</th><th>Categoría</th><th className="num">Requerido</th><th className="num">En bodega</th><th>Estado</th><th>Ubicación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.item.id} style={r.state === 'faltante' ? { background: '#FFFBFA' } : undefined}>
                  <td><input className="cb" type="checkbox" checked={selected.has(r.item.id)} onChange={() => toggle(r.item.id)} aria-label={`Seleccionar ${r.item.name}`} /></td>
                  <td><Link className="row-link" to={`/inventario/${r.item.id}`}>{r.item.name}</Link></td>
                  <td className="dim">{r.item.category}</td>
                  <td className="num mono">{r.required}</td>
                  <td className="num mono" style={r.state === 'faltante' ? { color: '#B42318', fontWeight: 500 } : undefined}>{r.item.qty}</td>
                  <td>
                    {r.state === 'disponible' && (r.reservedHere >= r.required
                      ? <Pill tone="green">Reservado para este proyecto</Pill>
                      : <Pill tone="green">Disponible</Pill>)}
                    {r.state === 'reservado' && <Pill tone="amber">Reservado · {r.conflict}</Pill>}
                    {r.state === 'faltante' && <Pill tone="solid-red" dot={false}>Faltante: {r.shortage}</Pill>}
                  </td>
                  <td><span className="loc">{r.item.location}</span></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="empty">El desglose no tiene materiales todavía.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card-foot">
          <span><strong style={{ color: '#17171A', fontWeight: 600 }}>{selected.size}</strong> ítems seleccionados</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-s" type="button" disabled={reservable.length === 0} onClick={reserve}
              title={!project.start ? 'Define las fechas de rodaje en el desglose' : undefined}>
              Reservar seleccionados ({reservable.length})
            </button>
            {missing.length > 0
              ? <button className="btn btn-p" type="button" onClick={quoteMissing}>Cotizar faltantes <Icon name="next" /></button>
              : <Link className="btn btn-p" to={`/proyectos/${id}/comparador`}>Ir al resumen <Icon name="next" /></Link>}
          </div>
        </div>
      </section>
    </>
  );
}
