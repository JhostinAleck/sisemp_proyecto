import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { STATUS_LABEL } from '../data/logic';
import type { ProjectStatus } from '../data/types';
import { Icon } from './Icon';

const STATUS_TONE: Record<ProjectStatus, string> = {
  nuevo: 'gray', cotizacion: 'blue', enviado: 'amber', aprobado: 'green', rechazado: 'red',
};

export function Pill({ tone, children, dot = true }: { tone: string; children: ReactNode; dot?: boolean }) {
  return <span className={`pill tone-${tone}`}>{dot && <span className="dot" />}{children}</span>;
}

export function StatusPill({ status }: { status: ProjectStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>;
}

export function PageHeader({ eyebrow, title, back, backLabel, badge, actions }: {
  eyebrow?: ReactNode; title: string; back?: string; backLabel?: string; badge?: ReactNode; actions?: ReactNode;
}) {
  return (
    <header className="ph">
      <div className="ph-left">
        {back && <Link className="back" to={back} aria-label={backLabel ?? 'Volver'}><Icon name="back" size={18} /></Link>}
        <div className="ph-text">
          {eyebrow && <span className="ph-eyebrow">{eyebrow}</span>}
          <div className="ph-title"><h1>{title}</h1>{badge}</div>
        </div>
      </div>
      {actions && <div className="ph-actions no-print">{actions}</div>}
    </header>
  );
}

const STEPS = [
  { label: 'Desglose', path: '' },
  { label: 'Inventario', path: '/inventario' },
  { label: 'Proveedores', path: '/solicitud' },
  { label: 'Comparador y aprobación', path: '/comparador' },
];

export function Stepper({ projectId, current }: { projectId: string; current: number }) {
  return (
    <ol className="steps card no-print" aria-label="Flujo de cotización">
      {STEPS.map((s, i) => {
        const cls = i < current ? 'done' : i === current ? 'current' : '';
        return [
          i > 0 && <li key={`l${i}`} aria-hidden="true" className={`step-line ${i <= current ? 'done' : ''}`} />,
          <li key={s.label} className={`step ${cls}`} aria-current={i === current ? 'step' : undefined}>
            <span className="step-n">{i < current ? <Icon name="check" size={13} stroke={3} /> : i + 1}</span>
            {i < current ? <Link to={`/proyectos/${projectId}${s.path}`}>{s.label}</Link> : s.label}
          </li>,
        ];
      })}
    </ol>
  );
}

/** Native <dialog> wrapper. */
export function Dialog({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return <dialog ref={ref} className="dlg" onClose={onClose}>{open && children}</dialog>;
}

export function MoneyInput({ id, value, onChange, label }: { id?: string; value: number; onChange: (n: number) => void; label?: string }) {
  return (
    <input id={id} className="in mono" inputMode="numeric" aria-label={label}
      value={value ? value.toLocaleString('es-CO') : ''} placeholder="0"
      onChange={e => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)} />
  );
}
