import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastPriceCurve,type ForecastPriceBar,type PriceCurveEvent} from './quantEngine';
import {calendarRuns} from './forecastBacktest';
import {normalizeContext,parseNewsRss} from './marketContext';
const bars:ForecastPriceBar[]=Array.from({length:130},(_,i)=>({date:new Date(Date.UTC(2026,3,1+i)).toISOString().slice(0,10),open:100+i*.1,close:100+i*.1+Math.sin(i/3)}));
const events:PriceCurveEvent[]=Array.from({length:90},(_,i)=>({id:String(i),availableAtUtc:new Date(Date.UTC(2026,4,1+i,8)).toISOString(),direction:'UP',label:'test',inputHash:'hash'+i,engineVersion:'test',weatherFeatures:[Math.sin(i/5),i%3,Math.cos(i/7)]}));
test('numeric targets are fit only on earlier matured labels and stay fixed when future outcomes change',()=>{
 const a=forecastPriceCurve(events,bars,3,'2026-06-15','2026-06-25','2026-07-01T00:00:00Z');const first=a.points[0];assert.ok(first.predictedPrice!=null);assert.ok(first.trainingCount>=12);for(const p of a.points)if(p.trainedThrough)assert.ok(p.trainedThrough<p.availableAtUtc.slice(0,10));
 const altered=bars.map(b=>b.date>='2026-06-15'?{...b,close:b.close*1.2}:b);const later=forecastPriceCurve(events,altered,3,'2026-06-15','2026-06-25','2026-07-01T00:00:00Z');assert.equal(first.predictedPrice,later.points[0].predictedPrice);assert.notEqual(first.actualPrice,later.points[0].actualPrice);assert.ok(a.metrics.count>0);
});
test('numeric scoring excludes uncompleted targets and out-of-range target dates without pretending issued prices exist',()=>{
 const a=forecastPriceCurve(events,bars,5,'2026-06-15','2026-06-25','2026-06-20T10:00:00Z');assert.ok(a.scoredTargetDates.every(d=>d!==null&&d<'2026-06-20'));assert.ok(a.points.some(p=>p.state==='PENDING'));assert.ok(a.points.filter(p=>p.targetDate&&p.targetDate>='2026-06-20').every(p=>p.actualPrice===null));
 const noHistory=forecastPriceCurve(events.slice(-3),bars,3,'2026-07-01','2026-07-31','2026-08-01T00:00:00Z');assert.equal(noHistory.metrics.count,0);assert.equal(noHistory.metrics.mae,null);assert.ok(noHistory.points.every(p=>p.predictedPrice===null));
 const missing=forecastPriceCurve(events.map(e=>({...e,weatherFeatures:undefined})),bars,3,'2026-06-15','2026-06-25','2026-07-01T00:00:00Z');assert.ok(missing.points.every(p=>p.state==='NO_FEATURES'));
});
test('daily ranges include each calendar date, including recent dates, and enforce a bounded window',()=>{
 assert.equal(calendarRuns('2026-10-29','2026-11-12').length,15);assert.throws(()=>calendarRuns('2026-09-01','2026-11-12'));assert.throws(()=>calendarRuns('2026-02-30','2026-03-02'));assert.equal(calendarRuns('2026-06-01','2026-08-17','WEEKLY').length,12);
});
test('news normalization preserves timestamps, rejects unsafe links, deduplicates and excludes outside dates',()=>{
 const rows=parseNewsRss('<rss><channel><item><title><![CDATA[Corn tariff &amp; trade]]></title><link>https://example.org/story</link><pubDate>Thu, 12 Nov 2026 10:00:00 GMT</pubDate><source>Publisher</source></item><item><title>Unsafe</title><link>javascript:alert(1)</link><pubDate>Thu, 12 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>');assert.equal(rows.length,1);assert.equal(rows[0].kind,'TRADE_POLICY');assert.equal(rows[0].title,'Corn tariff & trade');assert.equal(normalizeContext([...rows,...rows],'2026-11-01','2026-11-12').length,1);assert.equal(normalizeContext(rows,'2026-11-01','2026-11-11').length,0);
});

import {evaluateIssuedPriceTargets,type IssuedPriceTarget} from './quantEngine';
import {createForecastLedger} from './forecastBacktest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const recorded:IssuedPriceTarget={id:'recorded',commodityId:'corn',regionId:'iowa',issuedAtUtc:'2026-06-15T20:00:00Z',horizon:3,anchorDate:'2026-06-14',anchorPrice:100,predictedPrice:105,marketOnlyPrice:103,modelVersion:'test',inputHash:'proof',trainingCount:20,trainedThrough:'2026-06-12'};
test('recorded numerical targets are immutable and persist across ledger restarts',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'astraeus-targets-'));try{const ledger=createForecastLedger(dir);await Promise.all([ledger.appendNumerical(recorded),ledger.appendNumerical({...recorded,predictedPrice:999})]);const saved=await createForecastLedger(dir).readNumerical();assert.equal(saved.length,1);assert.equal(saved[0].predictedPrice,105);assert.equal(saved[0].issuedAtUtc,'2026-06-15T20:00:00Z');}finally{await rm(dir,{recursive:true,force:true});}
});
test('actual recorded targets are evaluated only once their future sessions complete',()=>{
 const pending=evaluateIssuedPriceTargets([recorded],bars,'2026-06-01','2026-06-30','2026-06-17T22:00:00Z');assert.equal(pending.count,0);assert.equal(pending.rows[0].actualPrice,null);assert.equal(pending.mae,null);
 const done=evaluateIssuedPriceTargets([recorded],bars,'2026-06-01','2026-06-30','2026-07-01T00:00:00Z');assert.equal(done.count,1);assert.equal(done.rows[0].targetDate,'2026-06-18');assert.equal(done.rows[0].predictedPrice,105);assert.equal(done.mae,Math.abs(105-bars.find(p=>p.date==='2026-06-18')!.close));
});
