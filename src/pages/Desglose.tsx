import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PageHeader, StatusPill, Stepper } from '../components/ui';
import { EFFECT_MATERIALS, EFFECT_TYPES } from '../data/seed';
import { uid, useStore } from '../data/store';
import type { Project } from '../data/types';
import { NotFound } from './NotFound';

export function Desglose() {
  const { id } = useParams();
  const { state, update, toast } = useStore();
  const project = state.projects.find(p => p.id === id);
  const [effect, setEffect] = useState(EFFECT_TYPES[0]);
  const [scene, setScene] = useState('');
  if (!project) return <NotFound />;

  const set = <K extends keyof Project>(k: K, v: Project[K]) =>
    update(s => { const p = s.projects.find(x => x.id === id)!; p[k] = v; });

  const addEffect = () => {
    if (!scene.trim()) { toast('Indica el número de escena'); return; }
    update(s => {
      const p = s.projects.find(x => x.id === id)!;
      for (const m of EFFECT_MATERIALS[effect]) {
        p.effects.push({ id: uid('e'), scene: scene.trim(), effect, itemId: m.itemId, qty: m.qty });
      }
    });
    toast(`${effect} agregado a la escena ${scene.trim()}`);
  };

  const setQty = (eid: string, qty: number) =>
    update(s => { const e = s.projects.find(x => x.id === id)!.effects.find(x => x.id === eid); if (e) e.qty = Math.max(0, qty); });
  const removeLine = (eid: string) =>
    update(s => { const p = s.projects.find(x => x.id === id)!; p.effects = p.effects.filter(e => e.id !== eid); });

  const itemName = (iid: string) => state.inventory.find(i => i.id === iid)?.name ?? iid;
  const scenes = new Set(project.effects.map(e => e.scene)).size;
  const sorted = [...project.effects].sort((a, b) => a.scene.localeCompare(b.scene, 'es', { numeric: true }));

  return (
    <>
      <PageHeader back="/" backLabel="Volver a proyectos" eyebrow={`Proyectos / ${project.name}`} title="Desglose"
        badge={<StatusPill status={project.status} />}
        actions={<>
          <button className="btn btn-s" type="button" onClick={() => toast('Cambios guardados')}>Guardar</button>
          {project.effects.length > 0
            ? <Link className="btn btn-p" to={`/proyectos/${id}/inventario`}>Verificar inventario <Icon name="next" /></Link>
            : <button className="btn btn-p" type="button" disabled>Verificar inventario <Icon name="next" /></button>}
        </>} />

      <Stepper projectId={project.id} current={0} />

      <div className="split">
        <section className="card card-pad" aria-labelledby="datos" style={{ flex: '1 1 340px' }}>
          <h2 id="datos">Datos del proyecto</h2>
          <div><label className="lb" htmlFor="prod">Producción</label><input className="in" id="prod" value={project.name} onChange={e => set('name', e.target.value)} /></div>
          <div><label className="lb" htmlFor="cli">Cliente</label><input className="in" id="cli" value={project.client} onChange={e => set('client', e.target.value)} /></div>
          <div><label className="lb" htmlFor="loc">Locación</label><input className="in" id="loc" value={project.location} onChange={e => set('location', e.target.value)} /></div>
          <div className="grid2">
            <div><label className="lb" htmlFor="ini">Inicio de rodaje</label><input className="in" id="ini" type="date" value={project.start} onChange={e => set('start', e.target.value)} /></div>
            <div><label className="lb" htmlFor="fin">Fin de rodaje</label><input className="in" id="fin" type="date" min={project.start} value={project.end} onChange={e => set('end', e.target.value)} /></div>
          </div>
          <div><label className="lb" htmlFor="com">Comentarios del equipo</label><textarea className="in" id="com" rows={3} value={project.comments} onChange={e => set('comments', e.target.value)} /></div>
        </section>

        <section className="card" aria-labelledby="efectos" style={{ flex: '999 1 520px', minWidth: 0 }}>
          <div className="card-pad" style={{ paddingBottom: 16 }}>
            <div className="card-head">
              <h2 id="efectos">Efectos por escena</h2>
              <span className="hint">{project.effects.length} materiales · {scenes} escena{scenes === 1 ? '' : 's'}</span>
            </div>
            <form style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }} onSubmit={e => { e.preventDefault(); addEffect(); }}>
              <div style={{ flex: '2 1 200px' }}>
                <label className="lb" htmlFor="tipo">Tipo de efecto</label>
                <select className="in" id="tipo" value={effect} onChange={e => setEffect(e.target.value)}>
                  {EFFECT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: '0 1 110px' }}>
                <label className="lb" htmlFor="esc">Escena</label>
                <input className="in mono" id="esc" value={scene} onChange={e => setScene(e.target.value)} placeholder="12" />
              </div>
              <button className="btn btn-s" type="submit"><Icon name="plus" />Agregar efecto</button>
            </form>
          </div>
          <div className="scroll-x">
            <table className="t" style={{ minWidth: 560 }}>
              <thead><tr><th style={{ width: 80 }}>Escena</th><th>Efecto</th><th>Material sugerido</th><th style={{ width: 120 }}>Cantidad</th><th style={{ width: 56 }}><span className="sr-only">Quitar</span></th></tr></thead>
              <tbody>
                {sorted.map(e => (
                  <tr key={e.id}>
                    <td><span className="scene">{e.scene}</span></td>
                    <td>{e.effect}</td>
                    <td>{itemName(e.itemId)}</td>
                    <td><input className="in mono" type="number" min={0} aria-label={`Cantidad de ${itemName(e.itemId)}`} value={e.qty}
                      onChange={ev => setQty(e.id, Number(ev.target.value))} style={{ height: 34, width: 88 }} /></td>
                    <td><button className="ghost" type="button" aria-label={`Quitar ${itemName(e.itemId)}`} onClick={() => removeLine(e.id)}><Icon name="trash" stroke={1.75} /></button></td>
                  </tr>
                ))}
                {sorted.length === 0 && <tr><td colSpan={5} className="empty">Agrega el primer efecto: elige el tipo y la escena.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
