import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCommand } from "../src/domains/shared/commands";
import { inventoryCheck, stockSummary } from "../src/domains/inventory/service";
import { can } from "../src/domains/access/policy";
import type {
  Workspace,
  User,
  Project,
  Command,
} from "../src/domains/shared/types";
const user: User = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Operador",
  email: "test@example.test",
  role: "gerencia",
  active: true,
};
function project(
  id: string,
  start = "2026-11-09",
  end = "2026-11-11",
): Project {
  return {
    id,
    name: id,
    client: "Productora",
    responsible: "Supervisor",
    location: "Bogotá",
    start,
    end,
    status: "nuevo",
    comments: "",
    effects: [{ id: "e1", scene: "1", effect: "Caída", itemId: "a", qty: 3 }],
    choices: {},
    costs: { personal: 0, polizas: 0, margin: 0 },
    createdAt: "2026-11-05T12:00:00Z",
  };
}
function fixture(): Workspace {
  return {
    inventory: [
      {
        id: "a",
        code: "S00001",
        name: "Equipo",
        category: "Rigging",
        brand: "",
        size: "",
        location: "A1",
        notes: "",
        qty: 4,
        maintenanceQty: 0,
        minQty: 1,
        dailyRate: 1000,
      },
    ],
    projects: [project("p1"), project("p2")],
    reservations: [],
    dispatches: [],
    movements: [],
    suppliers: [],
    offers: [],
  };
}
function run(s: Workspace, c: Command, u = user) {
  return applyCommand(s, u, c, {
    now: "2026-11-05T12:00:00.000Z",
    id: () => crypto.randomUUID(),
  });
}
test("overlapping projects cannot reserve more than physical stock", () => {
  let s = fixture();
  s = run(s, {
    type: "reservation.reserve",
    projectId: "p1",
    itemIds: ["a"],
  }).state;
  assert.equal(inventoryCheck(s, s.projects[1])[0].free, 1);
  s = run(s, {
    type: "reservation.reserve",
    projectId: "p2",
    itemIds: ["a"],
  }).state;
  assert.equal(s.reservations.find((x) => x.projectId === "p2")?.qty, 1);
});
test("nonoverlapping reservations reuse stock and boundary days are inclusive", () => {
  let s = fixture();
  s = run(s, {
    type: "reservation.reserve",
    projectId: "p1",
    itemIds: ["a"],
  }).state;
  s.projects[1].start = "2026-11-12";
  s.projects[1].end = "2026-11-13";
  assert.equal(inventoryCheck(s, s.projects[1])[0].free, 4);
  s.projects[1].start = "2026-11-11";
  assert.equal(inventoryCheck(s, s.projects[1])[0].free, 1);
});
test("repeating a reservation is idempotent without duplicate movements", () => {
  const s = run(fixture(), {
    type: "reservation.reserve",
    projectId: "p1",
    itemIds: ["a"],
  }).state;
  const result = run(s, {
    type: "reservation.reserve",
    projectId: "p1",
    itemIds: ["a"],
  });
  assert.equal(result.state.reservations.length, 1);
  assert.equal(result.state.movements.length, 1);
  assert.equal(s.reservations.length, 1);
});
test("invalid dates and fractional quantities fail before mutation", () => {
  const s = fixture();
  s.projects[0].end = "2026-11-01";
  assert.throws(() =>
    run(s, { type: "reservation.reserve", projectId: "p1", itemIds: ["a"] }),
  );
  assert.throws(() =>
    run(fixture(), {
      type: "inventory.receive",
      itemId: "a",
      qty: 1.5,
      notes: "Compra",
    }),
  );
  assert.equal(s.reservations.length, 0);
});
test("dispatch requires both checklist confirmations and reserved stock", () => {
  const s = fixture();
  const c: Command = {
    type: "dispatch.create",
    projectId: "p1",
    responsible: "Supervisor",
    dueDate: "2026-11-11",
    notes: "",
    prepared: true,
    loaded: true,
    lines: [{ itemId: "a", qty: 2 }],
  };
  assert.throws(() => run(s, c));
  const reserved = run(s, {
    type: "reservation.reserve",
    projectId: "p1",
    itemIds: ["a"],
  }).state;
  assert.throws(() => run(reserved, { ...c, loaded: false }));
  assert.throws(() =>
    run(reserved, { ...c, lines: [{ itemId: "a", qty: 4 }] }),
  );
});
function dispatched() {
  let s = run(fixture(), {
    type: "reservation.reserve",
    projectId: "p1",
    itemIds: ["a"],
  }).state;
  return run(s, {
    type: "dispatch.create",
    projectId: "p1",
    responsible: "Supervisor",
    dueDate: "2026-11-11",
    notes: "",
    prepared: true,
    loaded: true,
    lines: [{ itemId: "a", qty: 3 }],
  }).state;
}
test("dispatch consumes reservation once and never changes owned total", () => {
  const s = dispatched();
  assert.equal(stockSummary(s, "a", "2026-11-09").out, 3);
  assert.equal(s.inventory[0].qty, 4);
  assert.equal(s.reservations[0].dispatchedQty, 3);
  assert.throws(() =>
    run(s, {
      type: "dispatch.create",
      projectId: "p1",
      responsible: "Supervisor",
      dueDate: "2026-11-11",
      notes: "",
      prepared: true,
      loaded: true,
      lines: [{ itemId: "a", qty: 1 }],
    }),
  );
});
test("partial returns keep pending units out and damaged units quarantined", () => {
  const s = dispatched();
  const id = s.dispatches[0].id;
  const next = run(s, {
    type: "dispatch.return",
    dispatchId: id,
    lines: [{ itemId: "a", qty: 2, damaged: 1, notes: "Correa desgastada" }],
  }).state;
  assert.equal(stockSummary(next, "a", "2026-11-09").out, 1);
  assert.equal(next.inventory[0].maintenanceQty, 1);
  assert.equal(stockSummary(next, "a", "2026-11-09").physical, 2);
  assert.equal(s.dispatches[0].lines[0].returnedQty, 0);
});
test("over-return and duplicate line requests cannot inflate stock", () => {
  const s = dispatched();
  const id = s.dispatches[0].id;
  assert.throws(() =>
    run(s, {
      type: "dispatch.return",
      dispatchId: id,
      lines: [{ itemId: "a", qty: 4, damaged: 0, notes: "" }],
    }),
  );
  assert.throws(() =>
    run(s, {
      type: "dispatch.return",
      dispatchId: id,
      lines: [
        { itemId: "a", qty: 2, damaged: 0, notes: "" },
        { itemId: "a", qty: 2, damaged: 0, notes: "" },
      ],
    }),
  );
  assert.throws(() =>
    run(s, {
      type: "dispatch.return",
      dispatchId: id,
      lines: [{ itemId: "a", qty: 1, damaged: 1, notes: "" }],
    }),
  );
});
test("overdue units stay unavailable even outside planned dates", () => {
  const s = dispatched();
  s.projects[1].start = "2026-12-01";
  s.projects[1].end = "2026-12-02";
  assert.equal(inventoryCheck(s, s.projects[1])[0].free, 1);
});
test("maintenance is only released within quarantined quantity", () => {
  const s = fixture();
  s.inventory[0].maintenanceQty = 2;
  assert.throws(() =>
    run(s, {
      type: "inventory.release",
      itemId: "a",
      qty: 3,
      notes: "Revisión",
    }),
  );
  const next = run(s, {
    type: "inventory.release",
    itemId: "a",
    qty: 1,
    notes: "Revisión completa",
  }).state;
  assert.equal(next.inventory[0].maintenanceQty, 1);
});
test("permission enforcement rejects production stock edits and disabled users", () => {
  assert.equal(can("produccion", "inventory.move"), false);
  assert.throws(() =>
    run(
      fixture(),
      { type: "inventory.receive", itemId: "a", qty: 1, notes: "Compra" },
      { ...user, role: "produccion" },
    ),
  );
  assert.throws(() =>
    run(
      fixture(),
      { type: "reservation.reserve", projectId: "p1", itemIds: ["a"] },
      { ...user, active: false },
    ),
  );
});
test("project with commitments cannot be silently rescheduled or delete its history", () => {
  const s = dispatched();
  const p = s.projects[0];
  assert.throws(() =>
    run(s, {
      type: "project.update",
      id: p.id,
      input: {
        name: p.name,
        client: p.client,
        responsible: p.responsible,
        location: p.location,
        start: "2026-12-01",
        end: "2026-12-02",
        comments: "",
      },
    }),
  );
  assert.throws(() => run(s, { type: "project.delete", id: p.id }));
});
test("quotes cannot be approved with uncovered shortage or unavailable offer", () => {
  const s = fixture();
  s.inventory[0].qty = 1;
  s.projects[0].status = "enviado";
  assert.throws(() => run(s, { type: "quote.approve", projectId: "p1" }));
  s.suppliers = [
    {
      id: "sup",
      name: "Proveedor",
      category: "Rigging",
      email: "",
      phone: "",
      notes: "",
    },
  ];
  s.projects[0].rfq = {
    lines: [{ itemId: "a", qty: 2, rental: true }],
    specs: "",
    supplierIds: ["sup"],
    deadline: "2026-11-08",
    sentAt: "2026-11-05T12:00:00Z",
  };
  s.projects[0].choices = { a: "sup" };
  s.offers = [
    {
      id: "off",
      projectId: "p1",
      supplierId: "sup",
      itemId: "a",
      qty: 2,
      price: 300000,
      leadDays: 1,
      available: false,
    },
  ];
  assert.throws(() => run(s, { type: "quote.approve", projectId: "p1" }));
  s.offers[0].available = true;
  const next = run(s, { type: "quote.approve", projectId: "p1" }).state;
  assert.equal(next.projects[0].status, "aprobado");
  assert.equal(next.inventory[0].qty, 1);
  assert.equal(next.reservations[0].qty, 1);
});
test("changing approved project costs is rejected", () => {
  const s = fixture();
  s.projects[0].status = "aprobado";
  assert.throws(() =>
    run(s, {
      type: "quote.costs",
      projectId: "p1",
      costs: { personal: 100, polizas: 0, margin: 0 },
    }),
  );
});
test("approved quotation pricing survives catalogue and availability changes", async () => {
  const { quoteTotals } = await import("../src/domains/procurement/service");
  const s = fixture();
  s.projects[0].status = "enviado";
  const approved = run(s, { type: "quote.approve", projectId: "p1" }).state;
  assert.equal(quoteTotals(approved, approved.projects[0]).total, 9000);
  approved.inventory[0].dailyRate = 2000;
  approved.inventory[0].maintenanceQty = 1;
  assert.equal(quoteTotals(approved, approved.projects[0]).total, 9000);
});
function quotedFixture() {
  const s = fixture();
  s.inventory[0].qty = 1;
  s.projects[0].status = "cotizacion";
  s.suppliers = [
    {
      id: "sup",
      name: "Proveedor",
      category: "Rigging",
      email: "",
      phone: "",
      notes: "",
    },
  ];
  s.projects[0].rfq = {
    lines: [{ itemId: "a", qty: 2, rental: true }],
    specs: "Solo fechas originales",
    supplierIds: ["sup"],
    deadline: "2026-11-08",
    sentAt: "2026-11-05T12:00:00Z",
  };
  s.projects[0].choices = { a: "sup" };
  s.offers = [
    {
      id: "off",
      projectId: "p1",
      supplierId: "sup",
      itemId: "a",
      qty: 2,
      price: 300000,
      leadDays: 1,
      available: true,
    },
  ];
  return s;
}
test("rescheduling invalidates procurement promises made for the old dates", () => {
  const s = quotedFixture(),
    p = s.projects[0];
  const next = run(s, {
    type: "project.update",
    id: p.id,
    input: {
      name: p.name,
      client: p.client,
      responsible: p.responsible,
      location: p.location,
      start: "2026-12-01",
      end: "2026-12-02",
      comments: "",
    },
  }).state;
  assert.equal(next.projects[0].rfq, undefined);
  assert.deepEqual(next.projects[0].choices, {});
  assert.equal(next.offers.length, 0);
});
test("every structural material edit invalidates obsolete supplier coverage", () => {
  for (const command of [
    {
      type: "effect.add",
      projectId: "p1",
      input: { scene: "2", effect: "Caída", itemId: "a", qty: 1 },
    },
    { type: "effect.update", projectId: "p1", id: "e1", qty: 4 },
    { type: "effect.remove", projectId: "p1", id: "e1" },
  ] as Command[]) {
    const next = run(quotedFixture(), command).state;
    assert.equal(next.projects[0].rfq, undefined);
    assert.equal(next.offers.length, 0);
    assert.deepEqual(next.projects[0].choices, {});
  }
});
test("submitted quotation cannot be modified without management rejection", () => {
  const s = quotedFixture();
  s.projects[0].status = "enviado";
  assert.throws(() =>
    run(s, {
      type: "quote.costs",
      projectId: "p1",
      costs: { personal: 123456, polizas: 0, margin: 0 },
    }),
  );
  assert.throws(() =>
    run(s, {
      type: "offer.save",
      id: "off",
      input: {
        projectId: "p1",
        supplierId: "sup",
        itemId: "a",
        qty: 2,
        price: 123456,
        leadDays: 1,
        available: true,
      },
    }),
  );
  assert.throws(() =>
    run(s, { type: "effect.update", projectId: "p1", id: "e1", qty: 5 }),
  );
});
test("review and approval retain the same submitted prices after rate changes", async () => {
  const { quoteTotals } = await import("../src/domains/procurement/service");
  const sent = run(fixture(), { type: "quote.submit", projectId: "p1" }).state;
  sent.inventory[0].dailyRate = 2000;
  assert.equal(quoteTotals(sent, sent.projects[0]).total, 9000);
  const approved = run(sent, { type: "quote.approve", projectId: "p1" }).state;
  assert.equal(quoteTotals(approved, approved.projects[0]).total, 9000);
});
test("Bogotá same-day deadlines remain valid after UTC midnight", () => {
  const s = fixture();
  s.inventory[0].qty = 1;
  s.suppliers = [
    {
      id: "sup",
      name: "Proveedor",
      category: "Rigging",
      email: "",
      phone: "",
      notes: "",
    },
  ];
  const next = applyCommand(
    s,
    user,
    {
      type: "rfq.save",
      projectId: "p1",
      itemIds: ["a"],
      supplierIds: ["sup"],
      specs: "Hoy",
      deadline: "2026-11-05",
    },
    { now: "2026-11-06T00:30:00.000Z", id: () => crypto.randomUUID() },
  );
  assert.equal(next.state.projects[0].rfq?.deadline, "2026-11-05");
});
