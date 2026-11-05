import { z } from "zod";
const text = z.string().trim().max(1000),
  name = z.string().trim().min(1).max(160),
  id = z.string().min(1).max(100);
const qty = z.number().int().min(1).max(1000000),
  stock = z.number().int().min(0).max(1000000),
  amount = z.number().finite().min(0).max(1000000000000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Fecha inválida",
  );
const project = z
  .object({
    name,
    client: name,
    responsible: name,
    location: name,
    start: date,
    end: date,
    comments: text,
  })
  .strict()
  .refine(
    (p) => p.end >= p.start,
    "La fecha final debe ser posterior al inicio",
  );
const itemMeta = z
  .object({
    code: name,
    name,
    category: name,
    brand: text,
    size: text,
    location: name,
    notes: text,
    minQty: stock,
    dailyRate: amount,
  })
  .strict();
const supplier = z
  .object({
    name,
    category: name,
    email: z.union([z.literal(""), z.email()]),
    phone: z.string().max(80),
    notes: text,
  })
  .strict();
const costs = z
  .object({
    personal: amount,
    polizas: amount,
    margin: z.number().finite().min(0).max(100),
  })
  .strict();
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("project.create"), input: project }).strict(),
  z.object({ type: z.literal("project.update"), id, input: project }).strict(),
  z.object({ type: z.literal("project.delete"), id }).strict(),
  z
    .object({
      type: z.literal("effect.add"),
      projectId: id,
      input: z.object({ scene: name, effect: name, itemId: id, qty }).strict(),
    })
    .strict(),
  z
    .object({ type: z.literal("effect.update"), projectId: id, id, qty })
    .strict(),
  z.object({ type: z.literal("effect.remove"), projectId: id, id }).strict(),
  z
    .object({
      type: z.literal("inventory.create"),
      input: itemMeta.extend({ qty: stock, maintenanceQty: stock }),
    })
    .strict(),
  z
    .object({ type: z.literal("inventory.update"), id, input: itemMeta })
    .strict(),
  ...(
    ["inventory.receive", "inventory.maintain", "inventory.release"] as const
  ).map((type) =>
    z.object({ type: z.literal(type), itemId: id, qty, notes: name }).strict(),
  ),
  z
    .object({
      type: z.literal("reservation.reserve"),
      projectId: id,
      itemIds: z.array(id).min(1).max(300),
    })
    .strict(),
  z.object({ type: z.literal("reservation.release"), projectId: id }).strict(),
  z
    .object({
      type: z.literal("dispatch.create"),
      projectId: id,
      responsible: name,
      dueDate: date,
      notes: text,
      prepared: z.literal(true),
      loaded: z.literal(true),
      lines: z
        .array(z.object({ itemId: id, qty }).strict())
        .min(1)
        .max(300),
    })
    .strict(),
  z
    .object({
      type: z.literal("dispatch.return"),
      dispatchId: id,
      lines: z
        .array(
          z.object({ itemId: id, qty, damaged: stock, notes: text }).strict(),
        )
        .min(1)
        .max(300),
    })
    .strict(),
  z
    .object({
      type: z.literal("supplier.save"),
      id: id.optional(),
      input: supplier,
    })
    .strict(),
  z
    .object({
      type: z.literal("rfq.save"),
      projectId: id,
      specs: text,
      supplierIds: z.array(id).min(1).max(50),
      deadline: date,
      itemIds: z.array(id).min(1).max(300),
    })
    .strict(),
  z
    .object({
      type: z.literal("offer.save"),
      id: id.optional(),
      input: z
        .object({
          projectId: id,
          supplierId: id,
          itemId: id,
          qty,
          price: amount,
          leadDays: z.number().int().min(0).max(365),
          available: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("offer.choose"),
      projectId: id,
      itemId: id,
      supplierId: id,
    })
    .strict(),
  z.object({ type: z.literal("quote.costs"), projectId: id, costs }).strict(),
  z.object({ type: z.literal("quote.submit"), projectId: id }).strict(),
  z.object({ type: z.literal("quote.approve"), projectId: id }).strict(),
  z
    .object({ type: z.literal("quote.reject"), projectId: id, notes: name })
    .strict(),
]);
export function validDates(start: string, end: string) {
  date.parse(start);
  date.parse(end);
  if (end < start) throw new Error("Revisa las fechas del proyecto");
}
