import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { todayInZone } from '../src/lib/dates.js';

// Intentionally creates its own loopback server: this cannot target an external service.
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Use a disposable TEST_DATABASE_URL ending in _test.');
const config = loadConfig({ ...process.env, DATABASE_URL: url, NODE_ENV: 'test', API_PROCESSES: '1', RATE_LIMIT_REDIS_URL: '', DB_POOL_SIZE: '4', API_MAX_CONCURRENT: '8', API_MAX_QUEUED: '16', API_QUEUE_WAIT_MS: '1000' });
const admin = createPool(config);
const schema = `load_${randomUUID().replaceAll('-', '')}`;
let pool: Pool | undefined, server: Server | undefined, app: ReturnType<typeof createApp> | undefined;
try {
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url); scoped.searchParams.set('options', `-c search_path=${schema}`);
  pool = createPool({ ...config, DATABASE_URL: scoped.toString() });
  await migrate(pool);
  const patients: string[] = [];
  const hash = bcrypt.hashSync('SyntheticLoadFixture123!', 12);
  for (let i=0; i<10; i++) {
    const id = randomUUID(), token = randomBytes(32).toString('hex');
    await pool.query('INSERT INTO users(id,name,email,password_hash) VALUES($1,$2,$3,$4)',[id,'Synthetic load fixture',`${id}@example.com`,hash]);
    await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),id]);
    patients.push(`sweety_session=${token}`);
  }
  app = createApp(pool,config);
  server = app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server!.once('listening',resolve));
  const address=server.address(); if (!address || typeof address==='string') throw new Error('No loopback test listener');
  const base=`http://127.0.0.1:${address.port}/api`, date=todayInZone(config.APP_TIMEZONE);
  const results=[];
  for (const concurrency of [2,5,10]) {
    const durations: number[]=[];
    let peakWaiting=0;
    const sample=setInterval(()=>{peakWaiting=Math.max(peakWaiting,pool!.waitingCount);},10);
    const start=performance.now();
    async function call(cookie: string, path: string, expected: number, method='GET', data?: unknown) {
      const began=performance.now();
      const response=await fetch(`${base}${path}`,{method,headers:{Cookie:cookie,'X-Requested-With':'Sweety','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
      const body=response.status===204?undefined:await response.json();
      durations.push(performance.now()-began);
      if(response.status!==expected) throw new Error(`Load check ${method} ${path.split('?')[0]} returned ${response.status}`);
      return body;
    }
    try {
      await Promise.all(patients.slice(0,concurrency).map(async cookie=>{
        for(let cycle=0;cycle<3;cycle++) {
          await call(cookie,'/auth/me',200);
          const created=await call(cookie,'/readings',201,'POST',{date,slot:'fasting',value:111});
          const report=await call(cookie,`/reports?date=${date}&period=daily`,200);
          if(report.summary.count!==1) throw new Error('Load check report count mismatch');
          await call(cookie,`/readings/${created.reading.id}`,200,'PUT',{date,slot:'fasting',value:122,version:created.reading.version});
          await call(cookie,`/readings/${created.reading.id}`,204,'DELETE');
          const empty=await call(cookie,`/reports?date=${date}&period=daily`,200);
          if(empty.summary.count!==0) throw new Error('Load check deletion mismatch');
        }
      }));
    } finally { clearInterval(sample); }
    const elapsed=performance.now()-start;
    durations.sort((a,b)=>a-b);
    results.push({concurrency,requests:durations.length,elapsedMs:Math.round(elapsed),requestsPerSecond:Math.round(durations.length*1000/elapsed),p95Ms:Math.round(durations[Math.ceil(durations.length*0.95)-1]!),maxMs:Math.round(durations.at(-1)!),peakDatabaseWaiting:peakWaiting});
  }
  const evidence={scope:'isolated local reading/report workload; not a production capacity claim',databasePool:4,activeRequestLimit:8,results,metrics:app.locals.metrics.snapshot()};
  await mkdir(new URL('../.local/',import.meta.url),{recursive:true});
  await writeFile(new URL('../.local/load-check.json',import.meta.url),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence));
} finally {
  if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
  if(app)await app.locals.closeServices();
  if(pool)await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
