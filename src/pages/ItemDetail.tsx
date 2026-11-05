import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { MoneyInput, PageHeader, Pill } from '../components/ui';
import { ITEM_STATUS_LABEL, shortDate } from '../data/logic';
import { uid, useStore } from '../data/store';
import type { InventoryItem, MovementKind } from '../data/types';
import { NotFound } from './NotFound';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const STATUS_TONE: Record<InventoryItem['status'], string> = { disponible: 'green', mantenimiento: 'blue', en_set: 'amber', baja: 'red' };
const MV: Record<MovementKind, { icon: IconName; tone: string }> = {
  salida: { icon: 'out', tone: 'amber' },
  entrada: { icon: 'in', tone: 'green' },
  mantenimiento: { icon: 'wrench', tone: 'blue' },
  escaneo: { icon: 'qr', tone: 'gray' },
  reserva: { icon: 'bookmark', tone: 'amber' },
  ajuste: { icon: 'check', tone: 'gray' },
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function ItemDetail() {
  const { itemId } = useParams();
  const { state, update, toast } = useStore();
  const item = state.inventory.find(i => i.id === itemId);
  const [form, setForm] = useState<InventoryItem | null>(item ?? null);
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  useEffect(() => { setForm(item ?? null); }, [itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!item || !form) return <NotFound />;

  const reservations = state.reservations.filter(r => r.itemId === item.id);
  const projectName = (pid: string) => state.projects.find(p => p.id === pid)?.name ?? 'otro proyecto';

  // Monday-first 6-week grid
  const first = new Date(month);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - offset + i));
  const resOn = (d: string) => reservations.find(r => r.from && d >= r.from && d <= (r.to || r.from));
  const monthRes = [...new Set(cells.filter(c => c.getMonth() === month.getMonth()).map(c => resOn(iso(c))?.projectId).filter(Boolean))] as string[];

  const save = () => {
    update(s => {
      const i = s.inventory.find(x => x.id === item.id)!;
      const changes: string[] = [];
      if (i.qty !== form.qty) changes.push(`cantidad ${i.qty} → ${form.qty}`);
      if (i.status !== form.status) changes.push(`estado: ${ITEM_STATUS_LABEL[form.status]}`);
      Object.assign(i, form);
      if (changes.length) {
        const kind: MovementKind = form.status === 'mantenimiento' && item.status !== 'mantenimiento' ? 'mantenimiento'
          : form.status === 'en_set' && item.status !== 'en_set' ? 'salida'
            : form.status === 'disponible' && item.status !== 'disponible' ? 'entrada' : 'ajuste';
        s.movements.push({ id: uid('m'), itemId: i.id, kind, label: `Actualización · ${changes.join(', ')}`, date: new Date().toISOString() });
      }
    });
    toast('Ítem actualizado');
  };

  const scan = () => {
    update(s => { s.movements.push({ id: uid('m'), itemId: item.id, kind: 'escaneo', label: `Escaneo QR · ${s.user.name}`, date: new Date().toISOString() }); });
    toast(`Escaneo registrado para ${item.code}`);
  };

  const movements = state.movements.filter(m => m.itemId === item.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const f = <K extends keyof InventoryItem>(k: K, v: InventoryItem[K]) => setForm({ ...form, [k]: v });

  return (
    <>
      <PageHeader back="/inventario" backLabel="Volver al inventario" eyebrow="Inventario / Ficha de ítem" title={item.name}
        badge={<Pill tone={STATUS_TONE[item.status]}>{ITEM_STATUS_LABEL[item.status]}</Pill>} />

      <div className="split">
        <section className="card card-pad" aria-labelledby="datos" style={{ flex: '1 1 360px' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="qr" role="img" aria-label={`Código QR del ítem ${item.code}`}><Icon name="qr" size={56} stroke={1.5} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 12, color: '#6E6E76' }}>Código de ítem <span className="mono" style={{ color: '#17171A' }}>{item.code}</span></span>
              <button className="btn btn-p" type="button" style={{ width: '100%' }} onClick={scan}><Icon name="scan" />Escanear QR</button>
            </div>
          </div>
          <h2 id="datos" style={{ marginTop: 4 }}>Datos del ítem</h2>
          <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={e => { e.preventDefault(); save(); }}>
            <div><label className="lb" htmlFor="nom">Nombre</label><input className="in" id="nom" value={form.name} onChange={e => f('name', e.target.value)} /></div>
            <div className="grid2">
              <div><label className="lb" htmlFor="cat">Categoría</label><input className="in" id="cat" value={form.category} onChange={e => f('category', e.target.value)} /></div>
              <div><label className="lb" htmlFor="can">Cantidad</label><input className="in mono" id="can" type="number" min={0} value={form.qty} onChange={e => f('qty', Math.max(0, Number(e.target.value)))} /></div>
            </div>
            <div className="grid2">
              <div><label className="lb" htmlFor="ubi">Ubicación en bodega</label><input className="in mono" id="ubi" value={form.location} onChange={e => f('location', e.target.value)} /></div>
              <div><label className="lb" htmlFor="tar">Costo interno / día (COP)</label><MoneyInput id="tar" value={form.dailyRate} onChange={v => f('dailyRate', v)} /></div>
            </div>
            <div><label className="lb" htmlFor="est">Estado</label>
              <select className="in" id="est" value={form.status} onChange={e => f('status', e.target.value as InventoryItem['status'])}>
                {Object.entries(ITEM_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <button className="btn btn-p" type="submit" style={{ width: '100%', marginTop: 4 }}>Actualizar</button>
          </form>
        </section>

        <div style={{ flex: '999 1 480px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <section className="card card-pad" aria-labelledby="cal">
            <div className="card-head" style={{ alignItems: 'center' }}>
              <h2 id="cal">Calendario de reservas</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="ghost" style={{ border: '1px solid #E7E5E1' }} type="button" aria-label="Mes anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="left" size={14} /></button>
                <span style={{ fontSize: 14, fontWeight: 500, minWidth: 140, textAlign: 'center' }} aria-live="polite">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
                <button className="ghost" style={{ border: '1px solid #E7E5E1' }} type="button" aria-label="Mes siguiente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="right" size={14} /></button>
              </div>
            </div>
            <div className="cal">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <span key={d} className="dow">{d}</span>)}
              {cells.map(c => {
                const d = iso(c);
                const out = c.getMonth() !== month.getMonth();
                const r = !out && resOn(d);
                const cls = out ? 'out' : r ? 'res' : d === iso(today) ? 'today' : '';
                return <div key={d} className={`day ${cls} ${!out && d === iso(today) ? 'today' : ''}`} title={r ? `Reservado · ${projectName(r.projectId)} (${r.qty} und.)` : undefined}>{c.getDate()}</div>;
              })}
            </div>
            <div className="legend">
              {monthRes.length > 0
                ? monthRes.map(pid => <span key={pid}><span className="sw" style={{ background: '#FFF4DE', border: '1px solid #F1C67A' }} />Reservado para {projectName(pid)}</span>)
                : <span><span className="sw" style={{ background: '#FAFAF9', border: '1px solid #E7E5E1' }} />Sin reservas este mes</span>}
              <span><span className="sw" style={{ border: '1px solid #17171A' }} />Hoy</span>
            </div>
          </section>

          <section className="card card-pad" aria-labelledby="mov" style={{ gap: 8 }}>
            <h2 id="mov" style={{ marginBottom: 8 }}>Últimos movimientos</h2>
            {movements.length === 0 ? <p className="hint">Sin movimientos registrados.</p> : (
              <ul className="mv">
                {movements.map(m => (
                  <li key={m.id}>
                    <span className={`mv-ic tone-${MV[m.kind].tone}`}><Icon name={MV[m.kind].icon} /></span>
                    <span style={{ flex: 1 }}>{m.label}</span>
                    <span className="mono" style={{ fontSize: 12, color: '#6E6E76' }}>{shortDate(m.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
