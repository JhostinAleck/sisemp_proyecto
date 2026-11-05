import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Dialog, PageHeader, Pill, StatusPill } from '../components/ui';
import { dateRange, ITEM_STATUS_LABEL, money, quoteTotals } from '../data/logic';
import { uid, useStore } from '../data/store';
import type { InventoryItem, Supplier } from '../data/types';

const ITEM_TONE: Record<InventoryItem['status'], string> = { disponible: 'green', mantenimiento: 'blue', en_set: 'amber', baja: 'red' };

export function InventoryList() {
  const { state, update } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const needle = q.trim().toLowerCase();
  const rows = state.inventory.filter(i => !needle || `${i.name} ${i.code} ${i.category}`.toLowerCase().includes(needle));

  const add = () => {
    const id = uid('i');
    update(s => {
      const n = s.inventory.length + 1;
      s.inventory.push({ id, code: `IT-${String(n).padStart(3, '0')}`, name: 'Nuevo ítem', category: '', qty: 0, location: '', status: 'disponible', dailyRate: 0 });
    });
    nav(`/inventario/${id}`);
  };

  return (
    <>
      <PageHeader eyebrow="Operación" title="Inventario" actions={<button className="btn btn-p" type="button" onClick={add}><Icon name="plus" />Nuevo ítem</button>} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="search">
          <Icon name="search" style={{ color: '#6E6E76' }} />
          <input className="in" type="search" aria-label="Buscar ítem" placeholder="Buscar ítem, código o categoría" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>
      <section className="card">
        <div className="scroll-x">
          <table className="t" style={{ minWidth: 760 }}>
            <thead><tr><th>Ítem</th><th>Código</th><th>Categoría</th><th className="num">En bodega</th><th className="num">Reservado (próx.)</th><th>Estado</th><th>Ubicación</th></tr></thead>
            <tbody>
              {rows.map(i => {
                const reserved = state.reservations.filter(r => r.itemId === i.id && (r.to || r.from) >= today).reduce((s, r) => s + r.qty, 0);
                return (
                  <tr key={i.id}>
                    <td><Link className="row-link" to={`/inventario/${i.id}`}>{i.name}</Link></td>
                    <td className="mono dim" style={{ fontSize: 13 }}>{i.code}</td>
                    <td className="dim">{i.category || '—'}</td>
                    <td className="num mono">{i.qty}</td>
                    <td className="num mono dim">{reserved}</td>
                    <td><Pill tone={ITEM_TONE[i.status]}>{ITEM_STATUS_LABEL[i.status]}</Pill></td>
                    <td>{i.location ? <span className="loc">{i.location}</span> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card-foot"><span>{rows.length} ítems</span></div>
      </section>
    </>
  );
}

export function Suppliers() {
  const { state, update, toast } = useStore();
  const [draft, setDraft] = useState<Supplier | null>(null);

  const save = () => {
    if (!draft) return;
    update(s => {
      const ex = s.suppliers.find(x => x.id === draft.id);
      const initials = draft.name.replace(/[[\]]/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
      const next = { ...draft, initials };
      if (ex) Object.assign(ex, next); else s.suppliers.push(next);
    });
    toast('Proveedor guardado');
    setDraft(null);
  };

  return (
    <>
      <PageHeader eyebrow="Operación" title="Proveedores" actions={
        <button className="btn btn-p" type="button" onClick={() => setDraft({ id: uid('s'), name: '', initials: '', category: 'Seguridad y rigging', channel: 'email', email: '' })}>
          <Icon name="plus" />Nuevo proveedor
        </button>} />
      <section className="card">
        <div className="scroll-x">
          <table className="t" style={{ minWidth: 640 }}>
            <thead><tr><th>Proveedor</th><th>Categoría</th><th>Canal</th><th>Correo</th><th><span className="sr-only">Editar</span></th></tr></thead>
            <tbody>
              {state.suppliers.map(s => (
                <tr key={s.id}>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}><span className="sq">{s.initials}</span><b style={{ fontWeight: 500 }}>{s.name}</b></span></td>
                  <td className="dim">{s.category}</td>
                  <td>{s.channel === 'portal'
                    ? <span className="tag"><span className="dot" style={{ background: '#22A05A' }} />Responde en el portal</span>
                    : <span className="tag"><Icon name="mail" size={14} />Invitado por correo</span>}</td>
                  <td className="dim">{s.email || '—'}</td>
                  <td style={{ textAlign: 'right' }}><button className="btn btn-s" style={{ height: 32 }} type="button" onClick={() => setDraft({ ...s })}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!draft} onClose={() => setDraft(null)}>
        {draft && (
          <form onSubmit={e => { e.preventDefault(); save(); }}>
            <h2>{state.suppliers.some(s => s.id === draft.id) ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
            <div><label className="lb" htmlFor="sn">Nombre</label><input className="in" id="sn" required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><label className="lb" htmlFor="sc">Categoría</label><input className="in" id="sc" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></div>
            <div><label className="lb" htmlFor="sch">Canal</label>
              <select className="in" id="sch" value={draft.channel} onChange={e => setDraft({ ...draft, channel: e.target.value as Supplier['channel'] })}>
                <option value="portal">Responde en el portal</option><option value="email">Invitado por correo</option>
              </select></div>
            <div><label className="lb" htmlFor="se">Correo</label><input className="in" id="se" type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></div>
            <div className="dlg-actions">
              <button className="btn btn-s" type="button" onClick={() => setDraft(null)}>Cancelar</button>
              <button className="btn btn-p" type="submit">Guardar</button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

export function Quotes() {
  const { state } = useStore();
  const rows = state.projects.filter(p => p.rfq || p.status !== 'nuevo');
  return (
    <>
      <PageHeader eyebrow="Operación" title="Cotizaciones" />
      <section className="card">
        <div className="scroll-x">
          <table className="t" style={{ minWidth: 720 }}>
            <thead><tr><th>Producción</th><th>Rodaje</th><th>Proveedores</th><th>Estado</th><th className="num">Total</th></tr></thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id}>
                  <td><Link className="row-link" to={`/proyectos/${p.id}/comparador`}>{p.name}</Link></td>
                  <td className="mono dim" style={{ fontSize: 13 }}>{dateRange(p)}</td>
                  <td className="dim">{p.rfq ? `${p.rfq.supplierIds.length} invitados` : '—'}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td className="num mono">{money(quoteTotals(state, p).total)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5} className="empty">Todavía no hay cotizaciones.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
