import express,{type ErrorRequestHandler} from 'express';
import {randomUUID} from 'node:crypto';
import {z,ZodError} from 'zod';
import {pool} from './db';
import {authRouter,requireUser} from './access/router';
import {runCommand} from './commands';
import {can} from '../src/domains/access/policy';
import {commandSchema} from '../src/domains/shared/validation';
import {ensure} from '../src/domains/shared/errors';
import type {Command,User} from '../src/domains/shared/types';
export const app=express();
app.disable('x-powered-by');app.set('trust proxy',1);
app.use((_req,res,next)=>{res.locals.requestId=randomUUID();res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','X-Request-Id':res.locals.requestId});next();});
app.use((req,_res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method)){ensure(process.env.APP_ORIGIN,'El acceso no está configurado',503);ensure(req.get('Origin')===new URL(process.env.APP_ORIGIN).origin,'La solicitud no proviene de la aplicación autorizada',403);ensure(req.is('application/json'),'Envía la solicitud como JSON',415);}next();});
app.use(express.json({limit:'64kb',strict:true}));
app.get('/api/health',async(_req,res)=>{await pool.query('SELECT 1');res.json({status:'ok',database:'connected'});});
app.use('/api/auth',authRouter);
app.get('/api/state',requireUser,async(_req,res)=>{const row=(await pool.query("SELECT data,version FROM app_state WHERE id='main'")).rows[0];ensure(row,'El espacio de trabajo no está disponible',503);res.json({state:row.data,version:Number(row.version),user:res.locals.user});});
app.post('/api/commands',requireUser,async(req,res)=>{const command=commandSchema.parse(req.body) as Command;const requestId=z.uuid().parse(req.get('Idempotency-Key'));res.json(await runCommand(req.headers.cookie,command,requestId));});
app.get('/api/audit',requireUser,async(_req,res)=>{const user=res.locals.user as User;ensure(can(user.role,'audit.read'),'Esta vista requiere Gerencia',403);const rows=await pool.query('SELECT a.id,COALESCE(u.name,\'Sistema\')AS actor,a.action,a.entity_id AS "entityId",a.summary,a.created_at AS "createdAt" FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200');res.json({events:rows.rows});});
app.use('/api',(_req,res)=>{res.status(404).json({error:'No se encontró la operación solicitada.'});});
const errorHandler:ErrorRequestHandler=(error,_req,res,_next)=>{
 if(error instanceof ZodError){res.status(400).json({error:'Revisa los datos de la solicitud.',details:error.issues.map(i=>({field:i.path.join('.'),message:i.message}))});return;}
 const status=typeof error.status==='number'&&error.status>=400&&error.status<600?error.status:500;
 if(status>=500)console.error('api_error',{requestId:res.locals.requestId,code:error.code||error.name||'unknown'});
 res.status(status).json({error:status>=500?'No fue posible completar la operación. Intenta de nuevo.':error.message||'Solicitud inválida.'});
};app.use(errorHandler);
