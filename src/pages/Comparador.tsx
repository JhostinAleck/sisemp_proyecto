import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Dialog, MoneyInput, PageHeader, StatusPill, Stepper } from '../components/ui';
import { inventoryCheck, money, quoteTotals } from '../data/logic';
import { uid, useStore } from '../data/store';
import type { Offer, Project } from '../data/types';
import { NotFound } from './NotFound';

interface Draft { supplierId: string; itemId: string; price: number; leadDays: number; available: boolean }

export function Comparador() {
  const { id } = useParams();
  const { state, update, toast } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const project = state.projects.find(p => p.id === id);
  if (!project) return <NotFound />;

  const isManager = state.user.role === 'gerencia';
  const rfq = project.rfq;
  const suppliers = rfq ? state.suppliers.filter(s => rfq.supplierIds.includes(s.id)) : [];
  const offerOf = (supplierId: string, itemId: string): Offer | undefined =>
    state.offers.find(o => o.projectId === project.id && o.supplierId === supplierId && o.itemId === itemId);
  const itemName = (iid: string) => state.inventory.find(i => i.id === iid)?.name ?? iid;
  const totals = quoteTotals(state, project);
  const locked = project.status === 'aprobado';

  const mutate = (fn: (p: Project) => void) => update(s => fn(s.projects.find(x => x.id === id)!));

  const saveOffer = () => {
    if (!draft) return;
    update(s => {
      const existing = s.offers.find(o => o.projectId === project.id && o.supplierId === draft.supplierId && o.itemId === draft.itemId);
      if (existing) Object.assign(existing, draft);
      else s.offers.push({ id: uid('o'), projectId: project.id, ...draft });
      const p = s.projects.find(x => x.id === id)!;
      if (draft.available && !p.choices[draft.itemId]) p.choices[draft.itemId] = draft.supplierId;
    });
    setDraft(null);
    toast('Oferta registrada');
  };

  const sendToManagement = () => {
    mutate(p => { p.status = 'enviado'; });
    toast('Cotización enviada a gerencia');
  };

  const approve = () => {
    update(s => {
      const p = s.projects.find(x => x.id === id)!;
      p.status = 'aprobado';
      // Lock in-house stock for the shoot dates.
      for (const r of inventoryCheck(s, p)) {
        const qty = Math.min(r.required, r.free);
        if (qty <= 0 || r.reservedHere >= qty) continue;
        s.reservations = s.reservations.filter(x => !(x.itemId === r.item.id && x.projectId === p.id));
        s.reservations.push({ id: uid('r'), itemId: r.item.id, projectId: p.id, qty, from: p.start, to: p.end || p.start });
        s.movements.push({ id: uid('m'), itemId: r.item.id, kind: 'reserva', label: `Reserva · ${p.name}`, date: new Date().toISOString() });
      }
    });
    toast('Cotización aprobada. Orden de compra lista para exportar a Siigo.');
  };

  const reject = () => { mutate(p => { p.status = 'rechazado'; }); toast('Cotización rechazada'); };

  return (
    <>
      <PageHeader back={`/proyectos/${id}/solicitud`} backLabel="Volver a la solicitud" eyebrow={project.name}
        title="Comparador y resumen" badge={<StatusPill status={project.status} />} />
      <Stepper projectId={project.id} current={3} />

      <div className="split">
        <section className="card" aria-labelledby="cmp" style={{ flex: '999 1 560px', minWidth: 0 }}>
          <div className="card-head" style={{ padding: '18px 20px' }}>
            <h2 id="cmp">Ofertas de proveedores</h2>
            <span className="hint">Elige una oferta por ítem</span>
          </div>
          {!rfq || rfq.lines.length === 0 ? (
            <div className="empty">
              {rfq ? 'La solicitud no incluye ítems.' : 'Aún no se ha enviado una solicitud de cotización.'}{' '}
              <Link to={`/proyectos/${id}/solicitud`}>Crear solicitud</Link>
            </div>
          ) : (
            <div className="scroll-x">
              <table className="t" style={{ minWidth: 200 + suppliers.length * 220 }}>
                <thead><tr><th style={{ paddingLeft: 20 }}>Ítem</th>{suppliers.map(s => <th key={s.id}>{s.name}</th>)}</tr></thead>
                <tbody>
                  {rfq.lines.map(line => (
                    <tr key={line.itemId}>
                      <td style={{ paddingLeft: 20 }}>
                        <div style={{ fontWeight: 500 }}>{itemName(line.itemId)}</div>
                        <div className="mono" style={{ fontSize: 12, color: '#6E6E76', marginTop: 2 }}>{line.qty} und.{line.rental ? ' · alquiler' : ''}</div>
                      </td>
                      {suppliers.map(s => {
                        const o = offerOf(s.id, line.itemId);
                        const chosen = project.choices[line.itemId] === s.id;
                        const openDraft = () => setDraft({ supplierId: s.id, itemId: line.itemId, price: o?.price ?? 0, leadDays: o?.leadDays ?? 1, available: o?.available ?? true });
                        if (!o) return (
                          <td key={s.id}>
                            <div className="offer off">
                              <input className="rd" type="radio" name={line.itemId} disabled aria-label={`Sin oferta de ${s.name}`} />
                              <span className="offer-body">
                                <span className="mono" style={{ color: '#8B8B94' }}>—</span>
                                <span style={{ fontSize: 12, color: '#6E6E76', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="clock" size={12} />Sin respuesta aún</span>
                                {!locked && <button className="link-btn no-print" type="button" onClick={openDraft}>Registrar respuesta</button>}
                              </span>
                            </div>
                          </td>
                        );
                        return (
                          <td key={s.id}>
                            <label className={`offer ${chosen ? 'on' : ''} ${!o.available ? 'off' : ''}`}>
                              <input className="rd" type="radio" name={line.itemId} checked={chosen} disabled={!o.available || locked}
                                onChange={() => mutate(p => { p.choices[line.itemId] = s.id; })} />
                              <span className="offer-body">
                                <span className="mono" style={{ fontWeight: 500 }}>{money(o.price)}</span>
                                {o.available
                                  ? <span style={{ fontSize: 12, color: '#146C3A', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: '#22A05A' }} />Disponible · {o.leadDays} día{o.leadDays === 1 ? '' : 's'}</span>
                                  : <span style={{ fontSize: 12, color: '#B42318' }}>No disponible</span>}
                                {!locked && <button className="link-btn no-print" type="button" onClick={e => { e.preventDefault(); openDraft(); }}>Editar</button>}
                              </span>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="card card-pad" aria-labelledby="res" style={{ flex: '1 1 340px', gap: 4 }}>
          <h2 id="res" style={{ marginBottom: 8 }}>Resumen</h2>
          <div className="sum-row"><span>Inventario propio</span><span className="mono">{money(totals.inventory)}</span></div>
          <div className="sum-row"><span>Proveedores</span><span className="mono">{money(totals.suppliers)}</span></div>
          <div className="sum-row"><label htmlFor="per">Personal <span style={{ color: '#6E6E76' }}>(dobles, riggers, FX)</span></label>
            <div className="money-in"><MoneyInput id="per" value={project.costs.personal} onChange={v => mutate(p => { p.costs.personal = v; })} /></div></div>
          <div className="sum-row"><label htmlFor="pol">Pólizas y ARL</label>
            <div className="money-in"><MoneyInput id="pol" value={project.costs.polizas} onChange={v => mutate(p => { p.costs.polizas = v; })} /></div></div>
          <div className="sum-row"><label htmlFor="mg">Margen</label>
            <div style={{ position: 'relative', width: 96 }}>
              <input className="in mono" id="mg" type="number" min={0} max={100} value={project.costs.margin || ''} placeholder="0"
                onChange={e => mutate(p => { p.costs.margin = Math.max(0, Number(e.target.value)); })}
                style={{ height: 36, textAlign: 'right', paddingRight: 28 }} />
              <span aria-hidden="true" style={{ position: 'absolute', right: 10, top: 9, fontSize: 13, color: '#6E6E76' }}>%</span>
            </div>
          </div>
          <div style={{ height: 1, background: '#E7E5E1', margin: '10px 0 6px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '6px 0 14px' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Total</span>
            <span className="mono" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em' }}>{money(totals.total)}</span>
          </div>
          <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-p" type="button" style={{ width: '100%', height: 44 }} onClick={sendToManagement}
              disabled={project.status === 'enviado' || locked}>
              <Icon name="send" />{project.status === 'enviado' ? 'Enviado a gerencia' : 'Enviar a gerencia'}
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <button className="btn btn-s" type="button" style={{ padding: '0 8px' }} disabled={!isManager || project.status !== 'enviado'} onClick={approve}>Aprobar</button>
              <button className="btn btn-s" type="button" style={{ padding: '0 8px' }} disabled={!isManager || project.status !== 'enviado'} onClick={reject}>Rechazar</button>
              <button className="btn btn-s" type="button" style={{ padding: '0 8px' }} onClick={() => window.print()}><Icon name="download" size={15} />PDF</button>
            </div>
          </div>
          <p className="note no-print"><Icon name="lock" size={14} style={{ flex: 'none', marginTop: 2 }} />
            Aprobar y Rechazar: solo gerencia. Al aprobar se genera la orden de compra para Siigo.</p>
        </aside>
      </div>

      <Dialog open={!!draft} onClose={() => setDraft(null)}>
        {draft && (
          <form method="dialog" onSubmit={e => { e.preventDefault(); saveOffer(); }}>
            <h2>Respuesta de {state.suppliers.find(s => s.id === draft.supplierId)?.name}</h2>
            <p className="hint">{itemName(draft.itemId)} · {rfq?.lines.find(l => l.itemId === draft.itemId)?.qty} und.</p>
            <div><label className="lb" htmlFor="op">Precio total (COP)</label><MoneyInput id="op" value={draft.price} onChange={v => setDraft({ ...draft, price: v })} /></div>
            <div><label className="lb" htmlFor="od">Tiempo de entrega (días)</label>
              <input className="in mono" id="od" type="number" min={0} value={draft.leadDays} onChange={e => setDraft({ ...draft, leadDays: Math.max(0, Number(e.target.value)) })} /></div>
            <label className="check-line"><input className="cb" type="checkbox" checked={draft.available} onChange={e => setDraft({ ...draft, available: e.target.checked })} />Disponible para las fechas de rodaje</label>
            <div className="dlg-actions">
              <button className="btn btn-s" type="button" onClick={() => setDraft(null)}>Cancelar</button>
              <button className="btn btn-p" type="submit">Guardar oferta</button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
