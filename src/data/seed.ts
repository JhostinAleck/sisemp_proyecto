import type { State } from './types';

/** Effect type -> materials suggested when that effect is added to a scene. */
export const EFFECT_MATERIALS: Record<string, { itemId: string; qty: number }[]> = {
  'Explosión': [
    { itemId: 'pyro', qty: 6 },
    { itemId: 'smoke', qty: 2 },
    { itemId: 'ext', qty: 4 },
  ],
  'Caída (stunt)': [
    { itemId: 'harness', qty: 2 },
    { itemId: 'mat', qty: 1 },
  ],
  'Fuego': [
    { itemId: 'gel', qty: 4 },
    { itemId: 'ext', qty: 4 },
  ],
  'Humo': [{ itemId: 'smoke', qty: 2 }],
};

export const EFFECT_TYPES = Object.keys(EFFECT_MATERIALS);

export const SEED_VERSION = 1;

export function seedState(): State {
  return {
    version: SEED_VERSION,
    user: { name: 'Stunt manager', initials: 'SM', role: 'produccion' },
    inventory: [
      { id: 'pyro', code: 'FX-001', name: 'Cargas pirotécnicas', category: 'Efectos', qty: 10, location: 'A-1', status: 'disponible', dailyRate: 0 },
      { id: 'smoke', code: 'FX-004', name: 'Máquina de humo', category: 'Efectos', qty: 3, location: 'A-4', status: 'disponible', dailyRate: 0 },
      { id: 'gel', code: 'FX-007', name: 'Gel ignífugo', category: 'Efectos', qty: 6, location: 'A-2', status: 'disponible', dailyRate: 0 },
      { id: 'ext', code: 'SG-002', name: 'Extintores', category: 'Seguridad', qty: 4, location: 'C-2', status: 'disponible', dailyRate: 0 },
      { id: 'harness', code: 'RG-003', name: 'Arnés + descensor', category: 'Stunts / rigging', qty: 0, location: 'B-3', status: 'mantenimiento', dailyRate: 0 },
      { id: 'mat', code: 'RG-010', name: 'Colchoneta de caída', category: 'Stunts / rigging', qty: 2, location: 'B-1', status: 'disponible', dailyRate: 0 },
    ],
    projects: [
      {
        id: 'p-a', name: 'Serie [Producción A]', client: '[Productora]', location: 'Bogotá',
        start: '2026-11-09', end: '2026-11-13', status: 'nuevo',
        comments: 'Supervisor FX: revisar distancia de seguridad con cámara.',
        effects: [
          { id: 'e1', scene: '12', effect: 'Explosión', itemId: 'pyro', qty: 6 },
          { id: 'e2', scene: '12', effect: 'Explosión', itemId: 'smoke', qty: 2 },
          { id: 'e3', scene: '12', effect: 'Explosión', itemId: 'ext', qty: 4 },
          { id: 'e4', scene: '18', effect: 'Caída (stunt)', itemId: 'harness', qty: 2 },
        ],
        choices: {}, costs: { personal: 0, polizas: 0, margin: 0 }, createdAt: '2026-11-01T12:00:00Z',
      },
      {
        id: 'p-b', name: 'Película [Producción B]', client: '[Service]', location: 'Cartagena',
        start: '2026-11-09', end: '2026-11-11', status: 'cotizacion', comments: '',
        effects: [
          { id: 'e5', scene: '4', effect: 'Fuego', itemId: 'ext', qty: 4 },
          { id: 'e6', scene: '4', effect: 'Fuego', itemId: 'gel', qty: 4 },
          { id: 'e7', scene: '9', effect: 'Caída (stunt)', itemId: 'harness', qty: 2 },
          { id: 'e8', scene: '9', effect: 'Caída (stunt)', itemId: 'mat', qty: 3 },
        ],
        choices: {}, costs: { personal: 0, polizas: 0, margin: 0 }, createdAt: '2026-10-28T12:00:00Z',
      },
      {
        id: 'p-c', name: 'Comercial [Cliente C]', client: '[Agencia]', location: 'Medellín',
        start: '2026-11-20', end: '2026-11-20', status: 'enviado', comments: '',
        effects: [{ id: 'e9', scene: '1', effect: 'Humo', itemId: 'smoke', qty: 2 }],
        choices: {}, costs: { personal: 0, polizas: 0, margin: 0 }, createdAt: '2026-10-20T12:00:00Z',
      },
      {
        id: 'p-d', name: 'Serie [Producción D]', client: '[Productora]', location: 'Villa de Leyva',
        start: '2026-12-01', end: '2026-12-05', status: 'aprobado', comments: '',
        effects: [{ id: 'e10', scene: '3', effect: 'Explosión', itemId: 'pyro', qty: 4 }],
        choices: {}, costs: { personal: 0, polizas: 0, margin: 0 }, createdAt: '2026-10-10T12:00:00Z',
      },
    ],
    reservations: [
      { id: 'r1', itemId: 'ext', projectId: 'p-b', qty: 4, from: '2026-11-09', to: '2026-11-11' },
      { id: 'r2', itemId: 'pyro', projectId: 'p-d', qty: 4, from: '2026-12-01', to: '2026-12-05' },
    ],
    movements: [
      { id: 'm1', itemId: 'harness', kind: 'escaneo', label: 'Escaneo QR · Daniela', date: '2026-10-30T15:00:00Z' },
      { id: 'm2', itemId: 'harness', kind: 'mantenimiento', label: 'Entrada a mantenimiento', date: '2026-11-02T15:00:00Z' },
      { id: 'm3', itemId: 'ext', kind: 'reserva', label: 'Reserva · Película [Producción B]', date: '2026-11-03T15:00:00Z' },
    ],
    suppliers: [
      { id: 's-soac', name: 'Soac', initials: 'SO', category: 'Seguridad y rigging', channel: 'portal', email: '' },
      { id: 's-b', name: '[Proveedor B]', initials: 'PB', category: 'Seguridad y rigging', channel: 'portal', email: '' },
      { id: 's-c', name: '[Proveedor C]', initials: 'PC', category: 'Seguridad y rigging', channel: 'email', email: '' },
    ],
    offers: [],
  };
}
