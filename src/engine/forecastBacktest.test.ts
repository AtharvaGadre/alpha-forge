import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {evaluateForecastPriceEvents,type ForecastTestSignal} from './quantEngine';
import {createForecastLedger,issuedSignal,parseYahooDaily,replaySignal,weeklyRuns,weekStats} from './forecastBacktest';
import {COMMODITIES,type CommodityForecast} from './commodityForecastEngine';
const signal=(id:string,at='2026-06-01T08:00:00Z',direction:'UP'|'DOWN'|null='UP'):ForecastTestSignal=>({id,availableAtUtc:at,direction,label:'test',inputHash:'abc',engineVersion:'test-v1'});
const bars=[{date:'2026-06-01',open:99,close:100},{date:'2026-06-02',open:100,close:102},{date:'2026-06-03',open:103,close:104},{date:'2026-06-04',open:105,close:110},{date:'2026-06-05',open:110,close:108},{date:'2026-06-08',open:108,close:106}];
test('price evaluation enters strictly after signal date, uses later open and horizon-th close, and applies round-trip costs once',()=>{
 const r=evaluateForecastPriceEvents([signal('a')],bars,3,20,'2026-06-10T00:00:00Z');
 assert.equal(r.rows[0].entryDate,'2026-06-02');assert.equal(r.rows[0].exitDate,'2026-06-04');assert.ok(Math.abs(r.meanSignedReturnPct!-10)<1e-10);assert.ok(Math.abs(r.meanNetScenarioPct!-9.8)<1e-10);assert.equal(r.hitRatePct,100);
 const down=evaluateForecastPriceEvents([signal('a',undefined,'DOWN')],bars,3,0,'2026-06-10T00:00:00Z');assert.equal(down.hitRatePct,0);assert.equal(down.alwaysUpHitRatePct,100);
});
test('pending horizons, neutral forecasts, overlaps and absent opens do not become successes or synthetic trades',()=>{
 const r=evaluateForecastPriceEvents([signal('a'),signal('b','2026-06-02T08:00:00Z'),signal('c','2026-06-03T08:00:00Z',null),signal('d','2026-06-05T08:00:00Z')],bars,3,0,'2026-06-09T00:00:00Z');assert.deepEqual(r.rows.map(x=>x.state),['EVALUATED','OVERLAP','NO_DIRECTION','PENDING']);assert.equal(r.evaluated,1);
 const current=evaluateForecastPriceEvents([signal('a')],bars,3,0,'2026-06-04T23:59:00Z');assert.equal(current.rows[0].state,'PENDING');assert.equal(current.hitRatePct,null);
 const missing=evaluateForecastPriceEvents([signal('a')],bars.map(p=>({...p,open:null})),3,0,'2026-06-10T00:00:00Z');assert.equal(missing.rows[0].state,'PRICE_GAP');
});
test('missing price histories, duplicate dates, invalid costs and future-before-initialization events cannot silently evaluate',()=>{
 assert.equal(evaluateForecastPriceEvents([signal('a')],[],5,0,'2026-06-10T00:00:00Z').evaluated,0);
 assert.throws(()=>evaluateForecastPriceEvents([],bars,0,0,'2026-06-10T00:00:00Z'));
 assert.throws(()=>evaluateForecastPriceEvents([],bars,5,NaN,'2026-06-10T00:00:00Z'));
 assert.throws(()=>evaluateForecastPriceEvents([],[...bars,bars[0]],5,0,'2026-06-10T00:00:00Z'));
 assert.throws(()=>evaluateForecastPriceEvents([{...signal('a'),initializedAtUtc:'2026-06-02T00:00:00Z'}],bars,5,0,'2026-06-10T00:00:00Z'));
});
test('Yahoo parser validates symbol, retains missing opens and omits invalid closes rather than forward-filling',()=>{
 const d={chart:{result:[{meta:{symbol:'ZC=F'},timestamp:[1780272000,1780358400,1780444800],indicators:{quote:[{open:[100,null,102],close:[101,102,null]}]}}]}};
 const p=parseYahooDaily(d,'ZC=F');assert.equal(p.length,2);assert.equal(p[1].open,null);assert.throws(()=>parseYahooDaily(d,'NG=F'));assert.throws(()=>parseYahooDaily({chart:{error:{description:'rate limit'}}},'ZC=F'));
});
test('weekly archive selection enforces real dates, archive limits and a bounded sample',()=>{
 assert.equal(weeklyRuns('2026-06-01','2026-08-17').length,12);assert.throws(()=>weeklyRuns('2026-06-01','2026-09-17'));assert.throws(()=>weeklyRuns('2026-02-30','2026-03-05'));assert.throws(()=>weeklyRuns('2025-06-01','2025-06-03'));
});
const series=(years:number[],rain:(y:number)=>number)=>({daily_units:{precipitation_sum:'mm',temperature_2m_mean:'°C',temperature_2m_max:'°C'},daily:{time:years.flatMap(y=>Array.from({length:8},(_,i)=>`${y}-06-${String(i+1).padStart(2,'0')}`)),precipitation_sum:years.flatMap(y=>Array(8).fill(rain(y))),temperature_2m_mean:years.flatMap(()=>Array(8).fill(20)),temperature_2m_max:years.flatMap(()=>Array(8).fill(26))}});
test('historical replay uses original seven-day run and prior years only, abstains on zero-variance normals, and rejects incomplete weeks',()=>{
 const corn=COMMODITIES.find(c=>c.id==='corn')!,region=corn.regions[0];const climate=series(Array.from({length:10},(_,i)=>2016+i),y=>y%2?3:4),forecast=series([2026],()=>0);
 forecast.daily.precipitation_sum[0]=NaN;
 const r=replaySignal(corn,region,'2026-06-01T00:00:00Z',forecast,climate,['archive']);assert.equal(r.direction,'UP');assert.equal(r.availableAtUtc,'2026-06-01T08:00:00.000Z');assert.equal(r.source,'REPLAY');
 assert.equal(replaySignal(corn,region,'2026-06-01T00:00:00Z',forecast,series(Array.from({length:10},(_,i)=>2016+i),()=>3),['archive']).direction,null);
 forecast.daily.time.pop();assert.equal(weekStats(forecast,'2026-06-02'),null);assert.throws(()=>replaySignal(corn,region,'2026-06-01T00:00:00Z',forecast,climate,['archive']));
});
test('issued ledger records first availability and deduplicates concurrent writes without backdating',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'astraeus-ledger-'));
 try{const ledger=createForecastLedger(dir);const forecast={commodityId:'corn',regionId:'iowa',generatedAtUtc:'2026-06-01T08:00:00Z',sourceGeneratedAtUtc:'2026-06-01T06:00:00Z',status:'UPWARD_PRESSURE',evidence:{inputHash:'same',engineVersion:'v1'},sources:[]} as unknown as CommodityForecast;
 const event=issuedSignal(forecast,'2026-06-02T12:00:00Z');await Promise.all([ledger.append(event),ledger.append({...event,availableAtUtc:'2026-06-03T00:00:00Z'}),ledger.append({...event,id:'another'})]);const rows=await ledger.read();assert.equal(rows.length,2);assert.equal(rows[0].availableAtUtc,'2026-06-02T12:00:00.000Z');assert.equal((await createForecastLedger(dir).read()).length,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
