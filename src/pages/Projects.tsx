import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../app/store";
import { can } from "../domains/access/policy";
import { inventoryCheck } from "../domains/inventory/service";
import { dateRange, STATUS_LABEL } from "../domains/shared/format";
import type { Project, ProjectInput } from "../domains/shared/types";
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
export function ProjectForm({
  project,
  close,
}: {
  project?: Project;
  close: () => void;
}) {
  const { command } = useStore(),
    navigate = useNavigate();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget),
      input = Object.fromEntries(
        [
          "name",
          "client",
          "responsible",
          "location",
          "start",
          "end",
          "comments",
        ].map((k) => [k, str(d, k)]),
      ) as unknown as ProjectInput;
    const result = await command(
      project
        ? { type: "project.update", id: project.id, input }
        : { type: "project.create", input },
    );
    if (result) {
      close();
      if (!project) navigate(`/proyectos/${result.entityId}`);
    }
  };
  return (
    <Modal title={project ? "Editar proyecto" : "Nuevo proyecto"} close={close}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Nombre del proyecto" wide>
            <input
              name="name"
              required
              defaultValue={project?.name}
              maxLength={160}
              placeholder="Ej. Comercial · Secuencia de acción"
            />
          </Field>
          <Field label="Cliente">
            <input
              name="client"
              required
              defaultValue={project?.client}
              maxLength={160}
            />
          </Field>
          <Field label="Responsable">
            <input
              name="responsible"
              required
              defaultValue={project?.responsible}
              maxLength={160}
            />
          </Field>
          <Field label="Inicio de rodaje">
            <input
              name="start"
              type="date"
              required
              defaultValue={project?.start || today()}
            />
          </Field>
          <Field label="Fin de rodaje">
            <input
              name="end"
              type="date"
              required
              defaultValue={project?.end || today()}
            />
          </Field>
          <Field label="Locación" wide>
            <input name="location" required defaultValue={project?.location} />
          </Field>
          <Field label="Notas de producción" wide>
            <textarea name="comments" defaultValue={project?.comments} />
          </Field>
        </div>
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit">
            {project ? "Guardar cambios" : "Crear proyecto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Projects() {
  const { state, user } = useStore(),
    [create, setCreate] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const projects = state.projects.filter(
    (p) =>
      (!status || p.status === status) &&
      `${p.name} ${p.client} ${p.responsible}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Proyectos"
        description="Planea el rodaje. Asegura cada material. Coordina al equipo."
      >
        {user && can(user.role, "projects.write") && (
          <Button icon="plus" onClick={() => setCreate(true)}>
            Nuevo proyecto
          </Button>
        )}
      </PageHead>
      <section className="panel">
        <div className="filter-bar">
          <div className="search-box">
            <Icon name="search" />
            <input
              placeholder="Buscar proyecto, cliente o responsable…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar proyectos"
            />
          </div>
          <select
            aria-label="Filtrar estado"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <span className="muted">{projects.length} proyectos</span>
        </div>
        {projects.length ? (
          <Table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Rodaje / locación</th>
                <th>Responsable</th>
                <th>Materiales</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const check = inventoryCheck(state, p);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link className="item-name" to={`/proyectos/${p.id}`}>
                        {p.name}
                      </Link>
                      <small>{p.client}</small>
                    </td>
                    <td>
                      {dateRange(p)}
                      <small>{p.location}</small>
                    </td>
                    <td>{p.responsible}</td>
                    <td>
                      <Badge
                        tone={check.some((r) => r.shortage) ? "amber" : "green"}
                      >
                        {check.some((r) => r.shortage)
                          ? "Con faltantes"
                          : check.length
                            ? "Disponibles"
                            : "Sin materiales"}
                      </Badge>
                    </td>
                    <td>
                      <Badge tone={p.status === "aprobado" ? "green" : ""}>
                        {STATUS_LABEL[p.status]}
                      </Badge>
                    </td>
                    <td>
                      <Link
                        className="round-link"
                        aria-label={`Abrir ${p.name}`}
                        to={`/proyectos/${p.id}`}
                      >
                        <Icon name="next" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty
            title="Un nuevo proyecto, una nueva historia"
            text="Crea un proyecto para organizar fechas, materiales y cotización."
          />
        )}
      </section>
      {create && <ProjectForm close={() => setCreate(false)} />}
    </>
  );
}
export function ProjectDetail() {
  const { id } = useParams(),
    { state, user, command } = useStore(),
    [edit, setEdit] = useState(false),
    [adding, setAdding] = useState(false),
    [releasing, setReleasing] = useState(false),
    [deleting, setDeleting] = useState(false),
    navigate = useNavigate();
  const project = state.projects.find((p) => p.id === id);
  if (!project)
    return (
      <Empty title="Proyecto no encontrado">
        <Link to="/proyectos">Volver a proyectos</Link>
      </Empty>
    );
  const rows = inventoryCheck(state, project),
    editable = !!user && can(user.role, "projects.write"),
    reservable = !!user && can(user.role, "reservations.write");
  const locked =
    ["aprobado", "enviado"].includes(project.status) ||
    state.dispatches.some((d) => d.projectId === id);
  const reservations = state.reservations.filter((r) => r.projectId === id);
  const addEffect = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (
      await command({
        type: "effect.add",
        projectId: project.id,
        input: {
          scene: str(d, "scene"),
          effect: str(d, "effect"),
          itemId: str(d, "itemId"),
          qty: num(d, "qty"),
        },
      })
    )
      setAdding(false);
  };
  return (
    <>
      <Back to="/proyectos">Proyectos</Back>
      <PageHead
        title={project.name}
        description={`${project.client} · ${dateRange(project)}`}
      >
        <Badge tone={project.status === "aprobado" ? "green" : ""}>
          {STATUS_LABEL[project.status]}
        </Badge>
        {editable && (
          <Button
            variant="secondary"
            disabled={locked}
            onClick={() => setEdit(true)}
          >
            Editar proyecto
          </Button>
        )}
        <Link className="button" to={`/proyectos/${id}/cotizacion`}>
          <Icon name="file" />
          Ver cotización
        </Link>
      </PageHead>
      <div className="project-strip">
        <div>
          <span>RESPONSABLE</span>
          <strong>{project.responsible}</strong>
        </div>
        <div>
          <span>LOCACIÓN</span>
          <strong>{project.location}</strong>
        </div>
        <div>
          <span>PERIODO DE RESERVA</span>
          <strong>{dateRange(project)}</strong>
        </div>
        <div>
          <span>DESGLOSE</span>
          <strong>
            {project.effects.length} líneas ·{" "}
            {rows.reduce((n, r) => n + r.required, 0)} unidades
          </strong>
        </div>
      </div>
      {project.comments && (
        <p className="project-comments">{project.comments}</p>
      )}
      {locked && (
        <div className="info-banner">
          <Icon name="lock" />
          El proyecto está enviado a aprobación, aprobado o tiene un despacho.
          Sus fechas y materiales están protegidos.
        </div>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">PLAN DE PRODUCCIÓN</span>
            <h2>Desglose de materiales</h2>
          </div>
          {editable && (
            <Button
              icon="plus"
              variant="secondary"
              disabled={locked}
              onClick={() => setAdding(true)}
            >
              Añadir material
            </Button>
          )}
        </div>
        {project.effects.length ? (
          <Table>
            <thead>
              <tr>
                <th>Escena</th>
                <th>Efecto / actividad</th>
                <th>Artículo</th>
                <th>Cantidad</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {project.effects.map((e) => {
                const item = state.inventory.find((i) => i.id === e.itemId);
                return (
                  <tr key={e.id}>
                    <td>{e.scene}</td>
                    <td>{e.effect}</td>
                    <td>
                      <Link to={`/inventario/${e.itemId}`}>{item?.name}</Link>
                      <small className="mono">{item?.code}</small>
                    </td>
                    <td>
                      {editable && !locked ? (
                        <input
                          className="quantity-input"
                          type="number"
                          min="1"
                          step="1"
                          aria-label={`Cantidad ${item?.name}`}
                          defaultValue={e.qty}
                          key={e.id}
                          onBlur={(event) => {
                            const qty = Number(event.target.value);
                            if (qty !== e.qty)
                              void command({
                                type: "effect.update",
                                projectId: project.id,
                                id: e.id,
                                qty,
                              });
                          }}
                        />
                      ) : (
                        e.qty
                      )}
                    </td>
                    <td>
                      {editable && (
                        <Button
                          icon="trash"
                          variant="ghost danger"
                          aria-label={`Eliminar ${item?.name}`}
                          disabled={locked}
                          onClick={() =>
                            void command({
                              type: "effect.remove",
                              projectId: project.id,
                              id: e.id,
                            })
                          }
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty
            title="Prepara el desglose"
            text="Añade los equipos que requiere cada escena del proyecto."
          />
        )}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">DISPONIBILIDAD POR FECHAS</span>
            <h2>Equipos y reservas</h2>
          </div>
          {reservable && (
            <div className="button-group">
              {!!reservations.length && (
                <Button variant="secondary" onClick={() => setReleasing(true)}>
                  Liberar reservas
                </Button>
              )}
              <Button
                icon="bookmark"
                disabled={!rows.length}
                onClick={() =>
                  void command({
                    type: "reservation.reserve",
                    projectId: project.id,
                    itemIds: rows
                      .filter((r) => Math.min(r.required, r.free) > 0)
                      .map((r) => r.item.id),
                  })
                }
              >
                Reservar disponibles
              </Button>
            </div>
          )}
        </div>
        {rows.length ? (
          <Table>
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Requeridas</th>
                <th>Capacidad para el proyecto</th>
                <th>Reserva propia</th>
                <th>Faltante</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item.id}>
                  <td>
                    <Link className="item-name" to={`/inventario/${r.item.id}`}>
                      {r.item.name}
                    </Link>
                    <small>{r.conflict || r.item.code}</small>
                  </td>
                  <td>{r.required}</td>
                  <td>{r.free}</td>
                  <td>{r.reservedHere}</td>
                  <td>{r.shortage || "—"}</td>
                  <td>
                    <Badge
                      tone={
                        r.shortage ? "amber" : r.reservedHere ? "green" : ""
                      }
                    >
                      {r.shortage
                        ? "Requiere cobertura"
                        : r.reservedHere
                          ? "Reservado"
                          : "Disponible"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty title="Sin materiales para consultar" />
        )}
        <div className="panel-bottom">
          <p>
            Se reservan únicamente unidades propias disponibles. Las ofertas
            externas se gestionan en la cotización.
          </p>
          <Link className="text-link" to="/salidas">
            Ir a salidas y retornos <Icon name="next" />
          </Link>
        </div>
      </section>
      {editable && !locked && (
        <div className="danger-zone">
          <span>¿Este proyecto ya no se realizará?</span>
          <Button variant="ghost danger" onClick={() => setDeleting(true)}>
            Eliminar proyecto
          </Button>
        </div>
      )}
      {edit && <ProjectForm project={project} close={() => setEdit(false)} />}
      {adding && (
        <Modal
          title="Añadir material al proyecto"
          close={() => setAdding(false)}
        >
          <form onSubmit={addEffect}>
            <div className="form-grid">
              <Field label="Escena">
                <input name="scene" required placeholder="Ej. Escena 03" />
              </Field>
              <Field label="Efecto / actividad">
                <input
                  name="effect"
                  required
                  placeholder="Ej. Caída controlada"
                />
              </Field>
              <Field label="Artículo" wide>
                <select name="itemId" required>
                  <option value="">Selecciona un artículo</option>
                  {state.inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} · {i.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unidades requeridas">
                <input
                  type="number"
                  min="1"
                  step="1"
                  name="qty"
                  defaultValue="1"
                  required
                />
              </Field>
            </div>
            <div className="form-actions">
              <Button type="submit">Añadir al desglose</Button>
            </div>
          </form>
        </Modal>
      )}
      {releasing && (
        <Modal title="Liberar reservas" close={() => setReleasing(false)}>
          <p>
            Las unidades todavía sin despachar quedarán disponibles para otros
            proyectos. Los equipos que ya están fuera conservan su trazabilidad.
          </p>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setReleasing(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (
                  await command({
                    type: "reservation.release",
                    projectId: project.id,
                  })
                )
                  setReleasing(false);
              }}
            >
              Confirmar liberación
            </Button>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal title="Eliminar proyecto" close={() => setDeleting(false)}>
          <p>
            Se eliminará {project.name} y su planeación. Esta acción requiere
            que no existan compromisos operativos.
          </p>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (await command({ type: "project.delete", id: project.id }))
                  navigate("/proyectos");
              }}
            >
              Eliminar proyecto
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
