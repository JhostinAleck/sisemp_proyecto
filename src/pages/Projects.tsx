import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dots, Icon } from '../components/Icon';
import { PageHeader, Pill, StatusPill } from '../components/ui';
import { dateRange, inventoryCheck, STATUS_LABEL } from '../data/logic';
import { uid, useStore } from '../data/store';
import type { ProjectStatus } from '../data/types';

const FILTERS: (ProjectStatus | 'todos')[] = ['todos', 'nuevo', 'cotizacion', 'enviado', 'aprobado'];

export function Projects() {
  const { state, update, toast } = useStore();
  const nav = useNavigate();
  const [filter, setFilter] = useState<ProjectStatus | 'todos'>('todos');
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const isManager = state.user.role === 'gerencia';

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  const count = (f: ProjectStatus | 'todos') => state.projects.filter(p => f === 'todos' || p.status === f).length;
  const needle = q.trim().toLowerCase();
  const rows = state.projects
    .filter(p => filter === 'todos' || p.status === filter)
    .filter(p => !needle || `${p.name} ${p.client} ${p.location}`.toLowerCase().includes(needle));

  const createProject = () => {
    const id = uid('p');
    update(s => {
      s.projects.unshift({
        id, name: 'Nuevo proyecto', client: '', location: '', start: '', end: '', status: 'nuevo', comments: '',
        effects: [], choices: {}, costs: { personal: 0, polizas: 0, margin: 0 }, createdAt: new Date().toISOString(),
      });
    });
    nav(`/proyectos/${id}`);
  };

  const remove = (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Se liberan sus reservas.`)) return;
    update(s => {
      s.projects = s.projects.filter(p => p.id !== id);
      s.reservations = s.reservations.filter(r => r.projectId !== id);
      s.offers = s.offers.filter(o => o.projectId !== id);
    });
    toast('Proyecto eliminado');
  };

  return (
    <>
      <PageHeader eyebrow="Proyectos" title="Mis proyectos" actions={
        <button className="btn btn-p" type="button" onClick={createProject} disabled={!isManager}
          title={isManager ? undefined : 'Solo gerencia puede crear proyectos'}>
          <Icon name="plus" />Nuevo proyecto<span className="btn-chip">Gerencia</span>
        </button>
      } />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="tabs" role="tablist" aria-label="Filtrar por estado">
          {FILTERS.map(f => (
            <button key={f} className="tab" role="tab" type="button" aria-selected={filter === f} onClick={() => setFilter(f)}>
              {f === 'todos' ? 'Todos' : STATUS_LABEL[f]} <span className="cnt">{count(f)}</span>
            </button>
          ))}
        </div>
        <div className="search">
          <Icon name="search" style={{ color: '#6E6E76' }} />
          <input className="in" type="search" aria-label="Buscar proyecto" placeholder="Buscar producción o cliente"
            value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      <section className="card">
        <div className="scroll-x">
          <table className="t" style={{ minWidth: 820 }}>
            <thead>
              <tr><th>Producción</th><th>Cliente</th><th>Rodaje</th><th>Locación</th><th>Estado</th><th>Faltantes</th><th><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody>
              {rows.map(p => {
                const missing = p.effects.length ? inventoryCheck(state, p).filter(r => r.shortage > 0).length : null;
                return (
                  <tr key={p.id}>
                    <td><Link className="row-link" to={`/proyectos/${p.id}`}>{p.name}</Link></td>
                    <td className="dim">{p.client || '—'}</td>
                    <td className="dim mono" style={{ fontSize: 13 }}>{dateRange(p)}</td>
                    <td>{p.location || '—'}</td>
                    <td><StatusPill status={p.status} /></td>
                    <td>
                      {missing === null ? <span style={{ color: '#8B8B94' }}>—</span>
                        : missing > 0 ? <Pill tone="red" dot={false}>{missing} faltante{missing > 1 ? 's' : ''}</Pill>
                          : <span className="dim">0</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="menu-wrap">
                        <button className="ghost" type="button" aria-label={`Más acciones para ${p.name}`} aria-expanded={menu === p.id}
                          onClick={e => { e.stopPropagation(); setMenu(menu === p.id ? null : p.id); }}><Dots /></button>
                        {menu === p.id && (
                          <div className="menu" role="menu">
                            <Link role="menuitem" to={`/proyectos/${p.id}`}>Abrir desglose</Link>
                            <Link role="menuitem" to={`/proyectos/${p.id}/comparador`}>Ver cotización</Link>
                            {isManager && <button role="menuitem" type="button" className="danger" onClick={() => remove(p.id, p.name)}>Eliminar</button>}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={7} className="empty">No hay proyectos que coincidan.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card-foot"><span>Mostrando {rows.length} de {state.projects.length} proyectos</span></div>
      </section>
    </>
  );
}
