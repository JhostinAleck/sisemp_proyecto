import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../app/store";
import { can } from "../domains/access/policy";
import { dateRange, shortDate } from "../domains/shared/format";
import type { Dispatch } from "../domains/shared/types";
import {
  Back,
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHead,
  Table,
  num,
  str,
  today,
} from "../components/ui";
import { Icon } from "../components/Icon";
function DispatchForm({ close }: { close: () => void }) {
  const { state, command } = useStore(),
    [projectId, setProjectId] = useState("");
  const project = state.projects.find((p) => p.id === projectId),
    reservations = state.reservations.filter(
      (r) => r.projectId === projectId && r.qty > r.dispatchedQty,
    );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const lines = reservations
      .map((r) => ({ itemId: r.itemId, qty: num(d, r.id) }))
      .filter((l) => l.qty > 0);
    if (
      await command({
        type: "dispatch.create",
        projectId,
        responsible: str(d, "responsible"),
        dueDate: str(d, "dueDate"),
        notes: str(d, "notes"),
        prepared: d.get("prepared") === "on",
        loaded: d.get("loaded") === "on",
        lines,
      })
    )
      close();
  };
  return (
    <Modal title="Nueva salida de equipos" close={close}>
      <form onSubmit={submit}>
        <Field label="Proyecto con reservas pendientes">
          <select
            required
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Selecciona un proyecto</option>
            {state.projects
              .filter((p) =>
                state.reservations.some(
                  (r) => r.projectId === p.id && r.qty > r.dispatchedQty,
                ),
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        {project && (
          <>
            <p className="muted">
              Rodaje: {dateRange(project)}. La salida se registra desde las
              reservas propias.
            </p>
            <div className="form-grid">
              <Field label="Responsable de entrega">
                <input
                  name="responsible"
                  defaultValue={project.responsible}
                  required
                />
              </Field>
              <Field label="Retorno previsto">
                <input
                  name="dueDate"
                  type="date"
                  min={today()}
                  defaultValue={project.end > today() ? project.end : today()}
                  required
                />
              </Field>
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Artículo</th>
                  <th>Por despachar</th>
                  <th>Salida</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {state.inventory.find((i) => i.id === r.itemId)?.name}
                    </td>
                    <td>{r.qty - r.dispatchedQty}</td>
                    <td>
                      <input
                        className="quantity-input"
                        name={r.id}
                        type="number"
                        min="0"
                        step="1"
                        max={r.qty - r.dispatchedQty}
                        defaultValue={r.qty - r.dispatchedQty}
                        required
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="checklist">
              <label>
                <input name="prepared" type="checkbox" required />
                Equipos preparados y verificados
              </label>
              <label>
                <input name="loaded" type="checkbox" required />
                Carga verificada y entregada al responsable
              </label>
            </div>
            <Field label="Observaciones de entrega">
              <textarea name="notes" />
            </Field>
            <div className="form-actions">
              <Button type="submit" icon="truck">
                Registrar salida
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
function ReturnForm({
  dispatch,
  close,
}: {
  dispatch: Dispatch;
  close: () => void;
}) {
  const { state, command } = useStore();
  const pending = dispatch.lines.filter((l) => l.qty > l.returnedQty);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const lines = pending
      .map((l) => ({
        itemId: l.itemId,
        qty: num(d, `good-${l.itemId}`) + num(d, `damage-${l.itemId}`),
        damaged: num(d, `damage-${l.itemId}`),
        notes: str(d, `notes-${l.itemId}`),
      }))
      .filter((l) => l.qty > 0);
    if (
      await command({ type: "dispatch.return", dispatchId: dispatch.id, lines })
    )
      close();
  };
  return (
    <Modal title={`Registrar retorno · ${dispatch.code}`} close={close}>
      <form onSubmit={submit}>
        <p className="muted">
          Registra solo lo recibido hoy. Las unidades con novedad pasan a
          revisión. Es obligatorio describir el daño.
        </p>
        {pending.map((l) => (
          <div className="return-line" key={l.itemId}>
            <div className="return-title">
              <strong>
                {state.inventory.find((i) => i.id === l.itemId)?.name}
              </strong>
              <Badge tone="amber">{l.qty - l.returnedQty} pendientes</Badge>
            </div>
            <div className="form-grid">
              <Field label="En buen estado">
                <input
                  name={`good-${l.itemId}`}
                  type="number"
                  min="0"
                  max={l.qty - l.returnedQty}
                  step="1"
                  defaultValue="0"
                  required
                />
              </Field>
              <Field label="Con daño / novedad">
                <input
                  name={`damage-${l.itemId}`}
                  type="number"
                  min="0"
                  max={l.qty - l.returnedQty}
                  step="1"
                  defaultValue="0"
                  required
                />
              </Field>
              <Field label="Observación de la devolución" wide>
                <input
                  name={`notes-${l.itemId}`}
                  placeholder="Describe las novedades, si aplica"
                />
              </Field>
            </div>
          </div>
        ))}
        <div className="form-actions">
          <Button type="submit" icon="in">
            Confirmar retorno parcial o total
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Dispatches() {
  const { state, user } = useStore(),
    [create, setCreate] = useState(false),
    [returning, setReturning] = useState<string | null>(null),
    [filter, setFilter] = useState("pending");
  const allowed = !!user && can(user.role, "inventory.move"),
    dispatches = state.dispatches.filter(
      (d) => filter !== "pending" || d.lines.some((l) => l.qty > l.returnedQty),
    );
  const returnDispatch = state.dispatches.find((d) => d.id === returning);
  return (
    <>
      <PageHead
        title="Salidas y retornos"
        description="Trazabilidad del equipo, desde bodega hasta su regreso."
      >
        {allowed && (
          <Button icon="truck" onClick={() => setCreate(true)}>
            Nueva salida
          </Button>
        )}
      </PageHead>
      <div className="tabs">
        <button
          className={filter === "pending" ? "active" : ""}
          onClick={() => setFilter("pending")}
        >
          Retornos pendientes{" "}
          <Badge>
            {
              state.dispatches.filter((d) =>
                d.lines.some((l) => l.qty > l.returnedQty),
              ).length
            }
          </Badge>
        </button>
        <button
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          Todas las actas
        </button>
      </div>
      <section className="panel">
        {dispatches.length ? (
          <Table>
            <thead>
              <tr>
                <th>Acta / proyecto</th>
                <th>Responsable</th>
                <th>Fecha de salida</th>
                <th>Retorno previsto</th>
                <th>Pendiente</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...dispatches].reverse().map((d) => {
                const pending = d.lines.reduce(
                    (n, l) => n + l.qty - l.returnedQty,
                    0,
                  ),
                  overdue = d.dueDate < today() && pending > 0;
                return (
                  <tr key={d.id}>
                    <td>
                      <Link className="item-name mono" to={`/salidas/${d.id}`}>
                        {d.code}
                      </Link>
                      <small>
                        {state.projects.find((p) => p.id === d.projectId)?.name}
                      </small>
                    </td>
                    <td>{d.responsible}</td>
                    <td>{shortDate(d.date)}</td>
                    <td>
                      {shortDate(d.dueDate)}
                      {overdue && (
                        <small className="danger-text">Retorno vencido</small>
                      )}
                    </td>
                    <td>
                      <Badge tone={pending ? "amber" : "green"}>
                        {pending ? `${pending} unidades` : "Completo"}
                      </Badge>
                    </td>
                    <td>
                      <div className="button-group">
                        <Link
                          className="button small secondary"
                          to={`/salidas/${d.id}`}
                        >
                          Ver acta
                        </Link>
                        {allowed && pending > 0 && (
                          <Button
                            variant="small"
                            icon="in"
                            onClick={() => setReturning(d.id)}
                          >
                            Retorno
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty
            title={
              filter === "pending"
                ? "Sin retornos pendientes"
                : "Aún no hay actas de salida"
            }
            text="Las salidas se generan a partir de las reservas de un proyecto."
          />
        )}
      </section>
      {create && <DispatchForm close={() => setCreate(false)} />}
      {returnDispatch && (
        <ReturnForm
          dispatch={returnDispatch}
          close={() => setReturning(null)}
        />
      )}
    </>
  );
}
export function DispatchDetail() {
  const { id } = useParams(),
    { state, user } = useStore(),
    [returning, setReturning] = useState(false),
    dispatch = state.dispatches.find((d) => d.id === id);
  if (!dispatch) return <Empty title="Acta no encontrada" />;
  const project = state.projects.find((p) => p.id === dispatch.projectId),
    pending = dispatch.lines.reduce((n, l) => n + l.qty - l.returnedQty, 0);
  return (
    <>
      <div className="no-print">
        <Back to="/salidas">Salidas y retornos</Back>
        <PageHead
          title={dispatch.code}
          description="Acta de entrega y control de retorno"
        >
          <Button
            variant="secondary"
            icon="download"
            onClick={() => window.print()}
          >
            Imprimir / PDF
          </Button>
          {user && can(user.role, "inventory.move") && pending > 0 && (
            <Button icon="in" onClick={() => setReturning(true)}>
              Registrar retorno
            </Button>
          )}
        </PageHead>
      </div>
      <article className="panel dispatch-document">
        <div className="document-brand">
          <span className="brand-mark">
            <Icon name="flame" size={30} />
          </span>
          <div>
            <strong>BURNING BULL</strong>
            <small>STUNTS & SPECIAL EFFECTS</small>
          </div>
          <div className="document-code">
            <span>ACTA DE SALIDA</span>
            <strong>{dispatch.code}</strong>
          </div>
        </div>
        <h2>{project?.name}</h2>
        <dl className="details document-details">
          <div>
            <dt>Cliente</dt>
            <dd>{project?.client}</dd>
          </div>
          <div>
            <dt>Locación</dt>
            <dd>{project?.location}</dd>
          </div>
          <div>
            <dt>Responsable de entrega</dt>
            <dd>{dispatch.responsible}</dd>
          </div>
          <div>
            <dt>Registrado por</dt>
            <dd>{dispatch.actor}</dd>
          </div>
          <div>
            <dt>Fecha de salida</dt>
            <dd>{shortDate(dispatch.date)}</dd>
          </div>
          <div>
            <dt>Retorno previsto</dt>
            <dd>{shortDate(dispatch.dueDate)}</dd>
          </div>
        </dl>
        <div className="document-checks">
          <span>✓ Equipos preparados</span>
          <span>✓ Carga verificada</span>
          <Badge tone={pending ? "amber" : "green"}>
            {pending ? `${pending} unidades pendientes` : "Retorno completo"}
          </Badge>
        </div>
        <Table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Artículo</th>
              <th>Entregadas</th>
              <th>Retornadas</th>
              <th>Con novedad</th>
              <th>Pendientes</th>
            </tr>
          </thead>
          <tbody>
            {dispatch.lines.map((l) => {
              const item = state.inventory.find((i) => i.id === l.itemId);
              return (
                <tr key={l.itemId}>
                  <td className="mono">{item?.code}</td>
                  <td>{item?.name}</td>
                  <td>{l.qty}</td>
                  <td>{l.returnedQty}</td>
                  <td>{l.damagedQty}</td>
                  <td>{l.qty - l.returnedQty}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <div className="document-notes">
          <h3>Observaciones de entrega</h3>
          <p>{dispatch.notes || "Sin observaciones registradas."}</p>
          <h3>Registro de devoluciones</h3>
          {state.movements
            .filter((m) => m.dispatchId === dispatch.id && m.kind === "retorno")
            .map((m) => (
              <p key={m.id}>
                {shortDate(m.date)} ·{" "}
                {state.inventory.find((i) => i.id === m.itemId)?.name} · {m.qty}{" "}
                unidades · {m.actor}
                <br />
                {m.notes}
              </p>
            ))}
        </div>
        <div className="signatures">
          <div>Entrega · nombre y firma</div>
          <div>Recibe · nombre y firma</div>
        </div>
        <p className="footnote">
          Registro operativo generado por Burning Bull. Las novedades requieren
          revisión antes de liberar el equipo.
        </p>
      </article>
      {returning && (
        <ReturnForm dispatch={dispatch} close={() => setReturning(false)} />
      )}
    </>
  );
}
