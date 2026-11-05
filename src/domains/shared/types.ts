export type Role = 'produccion' | 'bodega' | 'compras' | 'gerencia';
export interface User { id: string; name: string; email: string; role: Role; active: boolean }
export type ProjectStatus = 'nuevo' | 'cotizacion' | 'enviado' | 'aprobado' | 'rechazado';
export interface InventoryItem { id: string; code: string; name: string; category: string; brand: string; size: string; location: string; notes: string; qty: number; maintenanceQty: number; minQty: number; dailyRate: number }
export interface EffectLine { id: string; scene: string; effect: string; itemId: string; qty: number }
export interface RfqLine { itemId: string; qty: number; rental: boolean }
export interface Rfq { lines: RfqLine[]; specs: string; supplierIds: string[]; deadline: string; sentAt: string }
export interface Project { id: string; name: string; client: string; responsible: string; location: string; start: string; end: string; status: ProjectStatus; comments: string; effects: EffectLine[]; rfq?: Rfq; choices: Record<string,string>; costs: { personal: number; polizas: number; margin: number }; createdAt: string }
export interface Reservation { id: string; projectId: string; itemId: string; qty: number; dispatchedQty: number; from: string; to: string }
export interface DispatchLine { itemId: string; qty: number; returnedQty: number; damagedQty: number }
export interface Dispatch { id: string; code: string; projectId: string; responsible: string; dueDate: string; date: string; actor: string; notes: string; prepared: boolean; loaded: boolean; lines: DispatchLine[] }
export type MovementKind = 'reserva' | 'liberacion' | 'salida' | 'retorno' | 'ingreso' | 'mantenimiento' | 'ajuste';
export interface Movement { id: string; itemId: string; projectId?: string; dispatchId?: string; kind: MovementKind; qty: number; label: string; actor: string; date: string; notes: string }
export interface Supplier { id: string; name: string; category: string; email: string; phone: string; notes: string }
export interface Offer { id: string; projectId: string; supplierId: string; itemId: string; qty: number; price: number; leadDays: number; available: boolean }
export interface AuditEvent { id: string; actor: string; action: string; entityId: string; summary: string; createdAt: string }
export interface Workspace { inventory: InventoryItem[]; projects: Project[]; reservations: Reservation[]; dispatches: Dispatch[]; movements: Movement[]; suppliers: Supplier[]; offers: Offer[] }
export type ProjectInput = Pick<Project,'name'|'client'|'responsible'|'location'|'start'|'end'|'comments'>;
export type Command =
 | {type:'project.create'; input:ProjectInput}
 | {type:'project.update'; id:string; input:ProjectInput}
 | {type:'project.delete'; id:string}
 | {type:'effect.add'; projectId:string; input:Omit<EffectLine,'id'>}
 | {type:'effect.update'; projectId:string; id:string; qty:number}
 | {type:'effect.remove'; projectId:string; id:string}
 | {type:'inventory.create'; input:Omit<InventoryItem,'id'>}
 | {type:'inventory.update'; id:string; input:Omit<InventoryItem,'id'|'qty'|'maintenanceQty'>}
 | {type:'inventory.receive'; itemId:string; qty:number; notes:string}
 | {type:'inventory.maintain'; itemId:string; qty:number; notes:string}
 | {type:'inventory.release'; itemId:string; qty:number; notes:string}
 | {type:'reservation.reserve'; projectId:string; itemIds:string[]}
 | {type:'reservation.release'; projectId:string}
 | {type:'dispatch.create'; projectId:string; responsible:string; dueDate:string; notes:string; prepared:boolean; loaded:boolean; lines:{itemId:string;qty:number}[]}
 | {type:'dispatch.return'; dispatchId:string; lines:{itemId:string;qty:number;damaged:number;notes:string}[]}
 | {type:'supplier.save'; id?:string; input:Omit<Supplier,'id'>}
 | {type:'rfq.save'; projectId:string; specs:string; supplierIds:string[]; deadline:string; itemIds:string[]}
 | {type:'offer.save'; id?:string; input:Omit<Offer,'id'>}
 | {type:'offer.choose'; projectId:string; itemId:string; supplierId:string}
 | {type:'quote.costs'; projectId:string; costs:Project['costs']}
 | {type:'quote.submit'; projectId:string}
 | {type:'quote.approve'; projectId:string}
 | {type:'quote.reject'; projectId:string; notes:string};
export interface StateResponse { state: Workspace; version:number; user:User }
export interface CommandResult extends StateResponse { summary:string; entityId:string }
export interface CheckRow { item:InventoryItem; required:number; free:number; shortage:number; reservedHere:number; state:'disponible'|'reservado'|'faltante'; conflict?:string }
export interface StockSummary { total:number; out:number; maintenance:number; physical:number; reserved:number; available:number }
