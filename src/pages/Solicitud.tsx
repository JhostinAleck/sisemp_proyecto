import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PageHeader, Stepper } from '../components/ui';
import { inventoryCheck } from '../data/logic';
import { useStore } from '../data/store';
import { NotFound } from './NotFound';

export function Solicitud() {
  const { id } = useParams();
  const nav = useNavigate();
  const { state, update, toast } = useStore();
  const project = state.projects.find(p => p.id === id);
  const missing = project ? inventoryCheck(state, project).filter(r => r.shortage > 0) : [];
  const prev = project?.rfq;

  const [items, setItems] = useState<Set<string>>(() => new Set(prev ? prev.lines.map(l => l.itemId) : missing.map(m => m.item.id)));
  const [suppliers, setSuppliers] = useState<Set<string>>(() => new Set(prev ? prev.supplierIds : state.suppliers.filter(s => s.channel === 'portal').map(s => s.id)));
  const [specs, setSpecs] = useState(prev?.specs ?? (project ? `Entrega en set, ${project.location || '[ciudad]'}.` : ''));
  const [deadline, setDeadline] = useState(prev?.deadline ?? '');
  if (!project) return <NotFound />;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const c = new Set(set); c.has(key) ? c.delete(key) : c.add(key); setter(c);
  };

  const send = () => {
    update(s => {
      const p = s.projects.find(x => x.id === id)!;
      p.rfq = {
        lines: missing.filter(m => items.has(m.item.id)).map(m => ({ itemId: m.item.id, qty: m.shortage, rental: m.state === 'reservado' })),
        specs, supplierIds: [...suppliers], deadline, sentAt: new Date().toISOString(),
      };
      if (p.status === 'nuevo') p.status = 'cotizacion';
    });
    toast(`Solicitud enviada a ${suppliers.size} proveedor${suppliers.size === 1 ? '' : 'es'}`);
    nav(`/proyectos/${id}/comparador`);
  };

  const canSend = items.size > 0 && suppliers.size > 0;

  return (
    <>
      <PageHeader back={`/proyectos/${id}/inventario`} backLabel="Volver a inventario" eyebrow={project.name} title="Solicitud de cotización" />
      <Stepper projectId={project.id} current={2} />

      <div className="split" style={{ alignItems: 'stretch' }}>
        <section className="card card-pad" aria-labelledby="falt" style={{ flex: '1 1 420px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="badge-num">1</span><h2 id="falt">Faltantes a cotizar</h2></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {missing.map(m => (
              <label key={m.item.id} className={`opt ${items.has(m.item.id) ? 'on' : ''}`}>
                <input className="cb" type="checkbox" checked={items.has(m.item.id)} onChange={() => toggle(items, setItems, m.item.id)} />
                <span className="opt-name">{m.item.name}{m.state === 'reservado' && <span style={{ fontWeight: 400, color: '#6E6E76' }}> (alquiler)</span>}</span>
                <span className="mono" style={{ fontSize: 13, color: '#55555C' }}>{m.shortage} und.</span>
              </label>
            ))}
            {missing.length === 0 && <p className="hint">No hay faltantes: todo el material está en bodega. <Link to={`/proyectos/${id}/comparador`}>Ir al resumen</Link></p>}
          </div>
          <div><label className="lb" htmlFor="spec">Especificaciones</label><textarea className="in" id="spec" rows={4} value={specs} onChange={e => setSpecs(e.target.value)} /></div>
        </section>

        <section className="card card-pad" aria-labelledby="prov" style={{ flex: '1 1 420px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="badge-num">2</span><h2 id="prov">Proveedores</h2><span className="chip">Seguridad y rigging</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.suppliers.map(s => {
              const on = suppliers.has(s.id);
              return (
                <label key={s.id} className={`opt ${on ? 'on' : ''}`}>
                  <input className="cb" type="checkbox" checked={on} onChange={() => toggle(suppliers, setSuppliers, s.id)} />
                  <span className={`sq ${on ? '' : 'off'}`}>{s.initials}</span>
                  <span className="opt-name">{s.name}</span>
                  {s.channel === 'portal'
                    ? <span className="tag"><span className="dot" style={{ background: '#22A05A' }} />Responde en el portal</span>
                    : <span className="tag"><Icon name="mail" size={14} />Invitado por correo</span>}
                </label>
              );
            })}
          </div>
          <div style={{ maxWidth: 240 }}><label className="lb" htmlFor="dl">Responder antes de</label><input className="in" id="dl" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></div>
        </section>
      </div>

      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <p style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#55555C', flex: '1 1 360px', lineHeight: 1.5 }}>
          <Icon name="info" style={{ flex: 'none', marginTop: 2 }} />
          Todos los proveedores reciben la misma solicitud y responden con precio, disponibilidad y tiempo de entrega.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-s" to={`/proyectos/${id}/inventario`}>Cancelar</Link>
          <button className="btn btn-p" type="button" disabled={!canSend} onClick={send}>
            <Icon name="send" />{prev ? 'Reenviar' : 'Enviar'} a {suppliers.size} proveedor{suppliers.size === 1 ? '' : 'es'}
          </button>
        </div>
      </div>
    </>
  );
}
