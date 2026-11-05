import type {Project,ProjectStatus} from './types';
export const STATUS_LABEL:Record<ProjectStatus,string>={nuevo:'Nuevo',cotizacion:'En cotización',enviado:'En revisión',aprobado:'Aprobado',rechazado:'Rechazado'};
const cop=new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0});
export const money=(n:number)=>cop.format(n||0);
export function shortDate(iso:string):string {if(!iso)return 'Sin fecha';const parts=iso.slice(0,10).split('-').map(Number);if(parts.length!==3||!parts.every(Number.isFinite))return 'Sin fecha';return new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(parts[0],parts[1]-1,parts[2])));}
export function dateRange(p:Pick<Project,'start'|'end'>):string{return p.start===p.end?shortDate(p.start):`${shortDate(p.start)} – ${shortDate(p.end)}`;}
export function shootingDays(p:Pick<Project,'start'|'end'>):number{return Math.max(1,Math.round((Date.parse(p.end)-Date.parse(p.start))/86400000)+1);}
