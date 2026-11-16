/**
 * Astraeus — forecast-to-price evaluation: deterministic price comparisons for issued and replayed
 * forecast events, the experimental expanding-ridge price curve, and numerical-target scoring.
 * (The former factor backtester and QuantPhysics SDE laboratory were retired with their routes.)
 */

import { mean } from './prng.ts';

// Forecast-event evaluation: deterministic price comparisons, never generated financial metrics.
export interface ForecastPriceBar { date:string; open:number|null; close:number; }
export interface ForecastTestSignal {
  id:string; availableAtUtc:string; initializedAtUtc?:string; direction:'UP'|'DOWN'|null;
  label:string; inputHash:string; engineVersion:string; note?:string;
}
export interface ForecastTestRow extends ForecastTestSignal {
  state:'EVALUATED'|'NO_DIRECTION'|'PENDING'|'OVERLAP'|'PRICE_GAP';
  entryDate:string|null; exitDate:string|null; entryPrice:number|null; exitPrice:number|null;
  actualReturnPct:number|null; signedReturnPct:number|null; netScenarioPct:number|null; hit:boolean|null;
}
export interface ForecastTestResult {
  rows:ForecastTestRow[]; evaluated:number; directional:number; hits:number;
  hitRatePct:number|null; alwaysUpHitRatePct:number|null; meanSignedReturnPct:number|null;
  meanNetScenarioPct:number|null; meanUnderlyingReturnPct:number|null; coveragePct:number;
}
/** Entry is the next UTC calendar day's OPEN after availability, deliberately avoiding
 * same-day intraday/settlement assumptions. Exit is the horizon-th session CLOSE.
 * No overlapping positions; continuous Yahoo prices remain a research proxy, not futures P&L. */
export function evaluateForecastPriceEvents(signals:ForecastTestSignal[],bars:ForecastPriceBar[],horizon:number,costBps:number,asOfUtc:string):ForecastTestResult {
  if(!Number.isInteger(horizon)||horizon<1||horizon>20||!Number.isFinite(costBps)||costBps<0||costBps>200)throw new Error('Use 1–20 sessions and 0–200 round-trip basis points.');
  const asOf=Date.parse(asOfUtc);if(!Number.isFinite(asOf))throw new Error('Invalid evaluation timestamp.');
  const prices=[...bars].sort((a,b)=>a.date.localeCompare(b.date));
  const seen=new Set<string>();for(const p of prices){if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||seen.has(p.date)||!Number.isFinite(p.close)||p.close<=0||(p.open!=null&&(!Number.isFinite(p.open)||p.open<=0)))throw new Error('Invalid, duplicate or non-positive daily price bars.');seen.add(p.date);}
  let lastExit='';const ids=new Set<string>();
  const rows:ForecastTestRow[]=[...signals].sort((a,b)=>a.availableAtUtc.localeCompare(b.availableAtUtc)||a.id.localeCompare(b.id)).map(s=>{
    const at=Date.parse(s.availableAtUtc);
    if(!Number.isFinite(at)||!s.id||ids.has(s.id)||!['UP','DOWN',null].includes(s.direction)||!s.inputHash||!s.engineVersion)throw new Error('Invalid or duplicate forecast event.');ids.add(s.id);
    if(s.initializedAtUtc&&(!Number.isFinite(Date.parse(s.initializedAtUtc))||Date.parse(s.initializedAtUtc)>at))throw new Error('Forecast availability precedes initialization.');
    const row:ForecastTestRow={...s,state:'PENDING',entryDate:null,exitDate:null,entryPrice:null,exitPrice:null,actualReturnPct:null,signedReturnPct:null,netScenarioPct:null,hit:null};
    if(s.direction==null){row.state='NO_DIRECTION';return row;}
    if(at>asOf)return row;
    const day=s.availableAtUtc.slice(0,10),i=prices.findIndex(p=>p.date>day);
    if(i<0)return row;
    const entry=prices[i];row.entryDate=entry.date;
    if(Date.parse(entry.date+'T00:00:00Z')-Date.parse(day+'T00:00:00Z')>7*86400_000){row.state='PRICE_GAP';return row;}
    if(entry.date<=lastExit){row.state='OVERLAP';return row;}
    if(entry.open==null){row.state='PRICE_GAP';return row;}
    const exit=prices[i+horizon-1];
    // Exclude today's incomplete session even when Yahoo supplies a provisional close.
    if(!exit||Date.parse(exit.date+'T00:00:00Z')>=Date.parse(asOfUtc.slice(0,10)+'T00:00:00Z'))return row;
    // Missing sessions must not silently stretch a nominal short-horizon test for months.
    if(Date.parse(exit.date+'T00:00:00Z')-Date.parse(entry.date+'T00:00:00Z')>(horizon*3+7)*86400_000){row.state='PRICE_GAP';return row;}
    row.state='EVALUATED';row.exitDate=exit.date;row.entryPrice=entry.open;row.exitPrice=exit.close;
    row.actualReturnPct=100*(exit.close/entry.open-1);row.signedReturnPct=row.actualReturnPct*(s.direction==='UP'?1:-1);
    row.netScenarioPct=row.signedReturnPct-costBps/100;row.hit=row.signedReturnPct>0;lastExit=exit.date;return row;
  });
  const done=rows.filter(r=>r.state==='EVALUATED'),n=done.length,hits=done.filter(r=>r.hit).length;
  const mean=(key:'signedReturnPct'|'netScenarioPct'|'actualReturnPct')=>n?done.reduce((s,r)=>s+r[key]!,0)/n:null;
  const directional=rows.filter(r=>r.direction!=null).length;
  return {rows,evaluated:n,directional,hits,hitRatePct:n?100*hits/n:null,alwaysUpHitRatePct:n?100*done.filter(r=>r.actualReturnPct!>0).length/n:null,meanSignedReturnPct:mean('signedReturnPct'),meanNetScenarioPct:mean('netScenarioPct'),meanUnderlyingReturnPct:mean('actualReturnPct'),coveragePct:directional?100*n/directional:0};
}

export interface PriceCurveEvent extends ForecastTestSignal {weatherFeatures?:number[]}
export interface PriceCurvePoint {
 id:string;availableAtUtc:string;anchorDate:string|null;anchorPrice:number|null;targetDate:string|null;
 predictedPrice:number|null;marketOnlyPrice:number|null;baselinePrice:number|null;actualPrice:number|null;
 lowerPrice:number|null;upperPrice:number|null;weatherAdjustmentPct:number|null;trainingCount:number;trainedThrough:string|null;
 state:'PREDICTED'|'PENDING'|'INSUFFICIENT_TRAINING'|'NO_FEATURES'|'PRICE_GAP'|'UNSTABLE';
}
export const PRICE_CURVE_CONFIG={version:'expanding-ridge-weather-v1',ridge:10,minTraining:12,maxTraining:60,marketFeatures:['five-session log momentum','twenty-session return volatility'],weatherFeatures:['rainfall z-score','heat-day z-score','dominant degree-day z-score'],band:'1.645 × training residual standard deviation; uncalibrated',target:'log(target close / prior completed close)'};
/** Refit each prediction only with labels completed BEFORE that forecast's date.
 * Market-only and weather models use identical training rows. No news or test-window
 * labels are used retroactively; historical numbers are reconstructions, not issued forecasts. */
export function forecastPriceCurve(events:PriceCurveEvent[],bars:ForecastPriceBar[],horizon:number,start:string,end:string,asOfUtc:string){
 evaluateForecastPriceEvents([],bars,horizon,0,asOfUtc);
 const p=[...bars].sort((a,b)=>a.date.localeCompare(b.date)),today=asOfUtc.slice(0,10),cutoff=end<today?end: new Date(Date.parse(today+'T00:00:00Z')-86400_000).toISOString().slice(0,10);
 const mean=(a:number[])=>a.reduce((s,v)=>s+v,0)/a.length;
 const obs=[...events].sort((a,b)=>a.availableAtUtc.localeCompare(b.availableAtUtc)).map(e=>{
  const day=e.availableAtUtc.slice(0,10),i=p.findIndex(b=>b.date>=day),anchorIndex=(i<0?p.length:i)-1,anchor=p[anchorIndex],entry=p.findIndex(b=>b.date>day),target=entry>=0?p[entry+horizon-1]:undefined;
  let market:number[]|null=null;
  if(anchorIndex>=20){const rets=p.slice(anchorIndex-20,anchorIndex+1).slice(1).map((b,j)=>Math.log(b.close/p[anchorIndex-20+j].close));const m=mean(rets);market=[Math.log(anchor.close/p[anchorIndex-5].close),Math.sqrt(mean(rets.map(v=>(v-m)**2)))];}
  const weather=e.weatherFeatures?.length===3&&e.weatherFeatures.every(Number.isFinite)?e.weatherFeatures:null;
  return {e,day,anchor,target,market,weather,y:anchor&&target?Math.log(target.close/anchor.close):null};
 });
 function fit(rows:{x:number[];y:number}[]){
  const d=rows[0].x.length,m=Array.from({length:d},(_,j)=>mean(rows.map(r=>r.x[j]))),sd=m.map((v,j)=>Math.sqrt(mean(rows.map(r=>(r.x[j]-v)**2)))||1),ym=mean(rows.map(r=>r.y));
  const x=rows.map(r=>r.x.map((v,j)=>(v-m[j])/sd[j]));
  const a=Array.from({length:d},(_,j)=>Array.from({length:d+1},(_,k)=>k===d?x.reduce((s,v,i)=>s+v[j]*(rows[i].y-ym),0):x.reduce((s,v)=>s+v[j]*v[k],0)+(j===k?PRICE_CURVE_CONFIG.ridge:0)));
  for(let j=0;j<d;j++){let pivot=j;for(let k=j+1;k<d;k++)if(Math.abs(a[k][j])>Math.abs(a[pivot][j]))pivot=k;[a[j],a[pivot]]=[a[pivot],a[j]];const v=a[j][j];if(Math.abs(v)<1e-12)throw new Error('Singular forecast fit.');for(let k=j;k<=d;k++)a[j][k]/=v;for(let i=0;i<d;i++)if(i!==j){const factor=a[i][j];for(let k=j;k<=d;k++)a[i][k]-=factor*a[j][k];}}
  const predict=(features:number[])=>ym+features.reduce((s,v,j)=>s+(v-m[j])/sd[j]*a[j][d],0);
  const residualSd=Math.sqrt(mean(rows.map(r=>(r.y-predict(r.x))**2)));
  return {predict,residualSd};
 }
 const points:PriceCurvePoint[]=obs.filter(o=>o.day>=start&&o.day<=end&&Date.parse(o.e.availableAtUtc)<=Date.parse(asOfUtc)).map(o=>{
  const point:PriceCurvePoint={id:o.e.id,availableAtUtc:o.e.availableAtUtc,anchorDate:o.anchor?.date??null,anchorPrice:o.anchor?.close??null,targetDate:o.target?.date??null,predictedPrice:null,marketOnlyPrice:null,baselinePrice:o.anchor?.close??null,actualPrice:o.target&&o.target.date<=cutoff?o.target.close:null,lowerPrice:null,upperPrice:null,weatherAdjustmentPct:null,trainingCount:0,trainedThrough:null,state:'NO_FEATURES'};
  if(!o.market||!o.anchor){point.state='PRICE_GAP';return point;}if(!o.weather)return point;
  const training=obs.filter(t=>t.e.id!==o.e.id&&t.day<o.day&&t.target&&t.target.date<o.day&&t.market&&t.weather&&t.y!=null&&t.target.date<=cutoff).slice(-PRICE_CURVE_CONFIG.maxTraining);
  point.trainingCount=training.length;point.trainedThrough=training.length?training.reduce((m,t)=>t.target!.date>m?t.target!.date:m,''):null;
  if(training.length<PRICE_CURVE_CONFIG.minTraining){point.state='INSUFFICIENT_TRAINING';return point;}
  const base=fit(training.map(t=>({x:t.market!,y:t.y!}))),full=fit(training.map(t=>({x:[...t.market!,...t.weather!],y:t.y!})));
  const log=full.predict([...o.market,...o.weather]),marketLog=base.predict(o.market);
  if(!Number.isFinite(log)||!Number.isFinite(marketLog)||Math.abs(log)>1||Math.abs(marketLog)>1){point.state='UNSTABLE';return point;}
  point.predictedPrice=o.anchor.close*Math.exp(log);point.marketOnlyPrice=o.anchor.close*Math.exp(marketLog);point.lowerPrice=o.anchor.close*Math.exp(log-1.645*full.residualSd);point.upperPrice=o.anchor.close*Math.exp(log+1.645*full.residualSd);point.weatherAdjustmentPct=100*(Math.exp(log-marketLog)-1);point.state=point.actualPrice==null?'PENDING':'PREDICTED';return point;
 });
 // One forecast per target session: use latest eligible origin, not the best-performing origin.
 const unique=new Map<string,PriceCurvePoint>();for(const row of points)if(row.targetDate&&row.targetDate>=start&&row.targetDate<=cutoff&&row.actualPrice!=null&&row.predictedPrice!=null)unique.set(row.targetDate,row);
 const scored=[...unique.values()],n=scored.length;
 const mae=(key:'predictedPrice'|'marketOnlyPrice'|'baselinePrice')=>n?mean(scored.map(r=>Math.abs(r[key]!-r.actualPrice!))):null;
 const fullMae=mae('predictedPrice'),marketMae=mae('marketOnlyPrice');
 return {config:PRICE_CURVE_CONFIG,points,scoredTargetDates:scored.map(p=>p.targetDate),metrics:{count:n,mae:fullMae,rmse:n?Math.sqrt(mean(scored.map(r=>(r.predictedPrice!-r.actualPrice!)**2))):null,noChangeMae:mae('baselinePrice'),marketOnlyMae:marketMae,weatherMaeSkillPct:marketMae!=null&&marketMae>1e-12?100*(1-fullMae!/marketMae):null,directionAccuracyPct:n?100*scored.filter(r=>(r.predictedPrice!-r.anchorPrice!)*(r.actualPrice!-r.anchorPrice!)>0).length/n:null},notes:['Retrospective expanding-window reconstruction, not a forecast previously issued by Astraeus.','Each target is forecast using only labels completed before its origin date; same-day provisional closes are excluded.','Market-only and weather fits use the same historical rows; their difference is a model adjustment, not causal attribution.','Scores use one latest-origin prediction per completed target session within the selected range. Horizons can overlap; observations are dependent.','Bands describe training residuals and are not calibrated confidence intervals. News is contextual and is not fitted into this model.']};
}

export interface IssuedPriceTarget {id:string;commodityId:string;regionId:string;issuedAtUtc:string;horizon:number;anchorDate:string;anchorPrice:number;predictedPrice:number;marketOnlyPrice:number;modelVersion:string;inputHash:string;trainingCount:number;trainedThrough:string|null}
export function evaluateIssuedPriceTargets(records:IssuedPriceTarget[],bars:ForecastPriceBar[],start:string,end:string,asOfUtc:string){
 const today=asOfUtc.slice(0,10),cutoff=end<today?end:today;
 const rows=records.filter(r=>r.issuedAtUtc.slice(0,10)>=start&&r.issuedAtUtc.slice(0,10)<=end).sort((a,b)=>a.issuedAtUtc.localeCompare(b.issuedAtUtc)).map(r=>{
  const entry=bars.findIndex(p=>p.date>r.issuedAtUtc.slice(0,10)),target=entry<0?undefined:bars[entry+r.horizon-1];
  const complete=!!target&&target.date<=end&&target.date<today&&target.date<=cutoff;
  return {...r,targetDate:target?.date??null,actualPrice:complete?target!.close:null,absoluteError:complete?Math.abs(r.predictedPrice-target!.close):null,state:complete?'EVALUATED':'PENDING'};
 });const done=rows.filter(r=>r.absoluteError!=null);return {rows,count:done.length,mae:done.length?done.reduce((s,r)=>s+r.absoluteError!,0)/done.length:null};
}
