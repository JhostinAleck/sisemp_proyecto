import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Server} from 'node:http';
const db=process.env.TEST_APP_DATABASE_URL;
test('authenticated HTTP commands serialize stock and reject forged roles, CSRF and duplicate retries',{skip:!db},async()=>{
 process.env.DATABASE_URL=db;process.env.APP_ORIGIN='http://localhost:5173';process.env.NODE_ENV='test';
 const {pool}=await import('../server/db');const {migrate}=await import('../server/migrate');const {seedWorkspace}=await import('../src/domains/shared/seed');const {newToken,tokenDigest,hashPassword}=await import('../server/access/crypto');
 await migrate();await pool.query('TRUNCATE command_requests,audit_events,sessions,invitations,auth_limits,users,app_state CASCADE');
 const {app}=await import('../server/app');const {initializeState}=await import('../server/commands');await initializeState();
 const server:Server=await new Promise(resolve=>{const srv=app.listen(0,'127.0.0.1',()=>resolve(srv));});const port=(server.address() as {port:number}).port;const base=`http://127.0.0.1:${port}/api`;
 const token=newToken(),uid=randomUUID();const headers={'Content-Type':'application/json','Origin':'http://localhost:5173','Cookie':`bb_session=${token}`};
 try{
  assert.equal((await fetch(`${base}/state`)).status,401);assert.equal((await fetch(`${base}/health`)).status,200);
  await pool.query('INSERT INTO users(id,email,name,role,password_hash)VALUES($1,$2,$3,$4,$5)',[uid,'api@example.test','API tester','gerencia',await hashPassword('Long-test-password-123!')]);await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at)VALUES($1,$2,now()+interval '1 day')",[tokenDigest(token),uid]);
  const command={type:'inventory.receive',itemId:'S00001',qty:1,notes:'Recepción de prueba'};const key=randomUUID();
  const post=(body:object,requestId=randomUUID(),overrides:Record<string,string>={})=>fetch(`${base}/commands`,{method:'POST',headers:{...headers,'Idempotency-Key':requestId,...overrides},body:JSON.stringify(body)});
  assert.equal((await post(command,randomUUID(),{'Origin':'https://evil.example'})).status,403);
  const first=await post(command,key);assert.equal(first.status,200);const firstData=await first.json();assert.equal(firstData.state.inventory.find((i:{id:string})=>i.id==='S00001').qty,3);
  const retried=await post(command,key);assert.equal(retried.status,200);const retryData=await retried.json();assert.equal(retryData.state.inventory.find((i:{id:string})=>i.id==='S00001').qty,3);assert.equal(retryData.version,firstData.version);
  assert.equal((await post({...command,qty:2},key)).status,409);
  await pool.query("UPDATE users SET role='produccion' WHERE id=$1",[uid]);assert.equal((await post(command)).status,403);assert.equal((await post({...command,role:'gerencia'})).status,400);
  await pool.query("UPDATE users SET role='gerencia' WHERE id=$1",[uid]);
  const seed=seedWorkspace();seed.reservations=[];seed.projects[0].effects=[{id:'race',itemId:'S00001',scene:'1',effect:'set',qty:2}];seed.projects[1].effects=[{id:'race2',itemId:'S00001',scene:'1',effect:'set',qty:2}];await pool.query('UPDATE app_state SET data=$1,version=0 WHERE id=\'main\'',[JSON.stringify(seed)]);
  const concurrent=await Promise.all([post({type:'reservation.reserve',projectId:'rodaje-demo',itemIds:['S00001']}),post({type:'reservation.reserve',projectId:'comercial-demo',itemIds:['S00001']})]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,422]);
  const state=await(await fetch(`${base}/state`,{headers})).json();assert.equal(state.state.reservations.length,1);assert.equal(state.state.reservations[0].qty,2);
  const dispatch=await post({type:'dispatch.create',projectId:state.state.reservations[0].projectId,responsible:'Tester',dueDate:'2026-12-01',notes:'',prepared:true,loaded:true,lines:[{itemId:'S00001',qty:2}]});assert.equal(dispatch.status,200);const dispatched=await dispatch.json();const did=dispatched.entityId;
  const returns=await Promise.all([post({type:'dispatch.return',dispatchId:did,lines:[{itemId:'S00001',qty:2,damaged:0,notes:''}]}),post({type:'dispatch.return',dispatchId:did,lines:[{itemId:'S00001',qty:2,damaged:0,notes:''}]})]);assert.deepEqual(returns.map(r=>r.status).sort(),[200,422]);
  await pool.query('UPDATE users SET active=false WHERE id=$1',[uid]);assert.equal((await fetch(`${base}/state`,{headers})).status,401);
 }finally{await new Promise<void>((resolve,reject)=>server.close(err=>err?reject(err):resolve()));await pool.end();}
});
