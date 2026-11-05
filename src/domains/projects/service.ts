import type {Project,Workspace} from '../shared/types';
import {ensure} from '../shared/errors';
import {validDates} from '../shared/validation';
export function findProject(s:Workspace,id:string):Project {const p=s.projects.find(x=>x.id===id);ensure(p,'No se encontró el proyecto',404);return p;}
export function editableProject(s:Workspace,id:string,structural=false):Project {const p=findProject(s,id);ensure(p.status!=='aprobado','La cotización está aprobada; no se pueden modificar sus compromisos');if(structural)ensure(!s.reservations.some(r=>r.projectId===id)&&!s.dispatches.some(d=>d.projectId===id),'Libera las reservas antes de modificar fechas o materiales. Las salidas conservan el desglose original.');return p;}
export function readyProject(p:Project){validDates(p.start,p.end);ensure(p.effects.length>0,'Agrega materiales al desglose');ensure(p.name.trim()&&p.responsible.trim(),'Completa el nombre y responsable del proyecto');}
