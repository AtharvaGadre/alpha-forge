import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {COMMODITIES,type CommodityForecast,type CommodityDefinition,type CommodityRegion} from './commodityForecastEngine';
import {evaluateForecastPriceEvents,forecastPriceCurve,evaluateIssuedPriceTargets,type IssuedPriceTarget,type ForecastPriceBar,type ForecastTestSignal} from './quantEngine';
export const REPLAY_VERSION='gfs-seasonal-screen-v1';
export const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export interface ArchivedSignal extends ForecastTestSignal {commodityId:string;regionId:string;source:'ISSUED'|'REPLAY';sourceUrls:string[];weatherFeatures?:number[];weather?:{windowStart:string;windowEnd:string;rain:{value:number;mean:number;z:number|null};heat:{value:number;mean:number;z:number|null};demand:{value:number;mean:number;z:number|null};demandType:string}}
export function parseYahooDaily(data:any,symbol:string):ForecastPriceBar[]{
 const r=data?.chart?.result?.[0];if(data?.chart?.error||!r||r.meta?.symbol!==symbol||!Array.isArray(r.timestamp))throw new Error('Yahoo did not return the requested price history.');
 const q=r.indicators?.quote?.[0];const seen=new Set<string>();
 const rows:ForecastPriceBar[]=r.timestamp.flatMap((t:unknown,i:number)=>{
  if(typeof t!=='number'||!Number.isFinite(t))return [];
  const close=q?.close?.[i],open=q?.open?.[i];if(typeof close!=='number'||!Number.isFinite(close)||close<=0)return [];
  const date=new Date(t*1000).toISOString().slice(0,10);if(seen.has(date))throw new Error('Yahoo returned duplicate daily bars.');seen.add(date);
  return [{date,close,open:typeof open==='number'&&Number.isFinite(open)&&open>0?open:null}];
 });if(!rows.length)throw new Error('No usable Yahoo daily price bars.');return rows.sort((a,b)=>a.date.localeCompare(b.date));
}
export function weeklyRuns(start:string,end:string):string[]{
 const a=Date.parse(start+'T00:00:00Z'),b=Date.parse(end+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(a)||!Number.isFinite(b)||new Date(a).toISOString().slice(0,10)!==start||new Date(b).toISOString().slice(0,10)!==end||a>b)throw new Error('Choose valid ordered dates.');
 const dates:string[]=[];for(let t=a;t<=b;t+=7*86400_000)dates.push(new Date(t).toISOString());
 if(dates.length>12)throw new Error('Use at most 12 weekly forecast runs per replay.');
 if(start<'2026-04-02')throw new Error('This GFS single-run archive starts on 2 April 2026.');return dates;
}
export function calendarRuns(start:string,end:string,cadence:'DAILY'|'WEEKLY'='DAILY'):string[]{
 if(cadence==='WEEKLY')return weeklyRuns(start,end);
 const a=Date.parse(start+'T00:00:00Z'),b=Date.parse(end+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(a)||!Number.isFinite(b)||new Date(a).toISOString().slice(0,10)!==start||new Date(b).toISOString().slice(0,10)!==end||a>b)throw new Error('Choose valid ordered dates.');
 if(start<'2026-04-02')throw new Error('This GFS single-run archive starts on 2 April 2026.');
 if(b-a>30*86400_000)throw new Error('Daily replay supports up to 31 calendar dates. Use weekly sampling for a longer window.');
 return Array.from({length:Math.round((b-a)/86400_000)+1},(_,i)=>new Date(a+i*86400_000).toISOString());
}
interface WeekStats {rain:number;heat:number;temp:number;hdd:number;cdd:number}
export function weekStats(data:any,start:string):WeekStats|null{
 const d=data?.daily,u=data?.daily_units;
 if(!Array.isArray(d?.time)||u?.precipitation_sum!=='mm'||u?.temperature_2m_mean!=='°C'||u?.temperature_2m_max!=='°C')return null;
 const indices=Array.from({length:7},(_,k)=>d.time.indexOf(new Date(Date.parse(start.slice(0,10)+'T00:00:00Z')+k*86400_000).toISOString().slice(0,10)));
 const read=(key:string)=>indices.map(i=>i<0?null:d[key]?.[i]);const rain=read('precipitation_sum'),temp=read('temperature_2m_mean'),max=read('temperature_2m_max');
 if([...rain,...temp,...max].some(v=>typeof v!=='number'||!Number.isFinite(v))||rain.some(v=>v<0))return null;
 return {rain:rain.reduce((a,b)=>a+b,0),heat:max.filter(v=>v>32).length,temp:temp.reduce((a,b)=>a+b,0)/7,hdd:temp.reduce((s,t)=>s+Math.max(18-t,0),0),cdd:temp.reduce((s,t)=>s+Math.max(t-18,0),0)};
}
export function replaySignal(c:CommodityDefinition,region:CommodityRegion,run:string,forecast:any,climate:any,urls:string[]):ArchivedSignal{
 const validStart=new Date(Date.parse(run)+86400_000).toISOString();
 const value=weekStats(forecast,validStart),year=Number(run.slice(0,4));const history=Array.from({length:10},(_,i)=>weekStats(climate,`${year-10+i}${validStart.slice(4,10)}`)).filter((v):v is WeekStats=>v!=null);
 if(!value||history.length<8)throw new Error('Incomplete seven-day forecast or fewer than eight prior seasonal baseline windows.');
 const z=(key:keyof WeekStats)=>{const x=history.map(v=>v[key]),mean=x.reduce((a,b)=>a+b,0)/x.length,sd=Math.sqrt(x.reduce((s,v)=>s+(v-mean)**2,0)/(x.length-1));return {value:value[key],mean,z:sd>1e-9?(value[key]-mean)/sd:null};};
 let direction:'UP'|'DOWN'|null=null,label='No material directional screen';const month=Number(run.slice(5,7));
 if(c.id==='corn'){
  const rain=z('rain'),heat=z('heat');
  if(region.activeMonths&&!region.activeMonths.includes(month))label='Outside regional crop sensitivity window';
  else if((rain.z!=null&&(rain.z<=-1||rain.z>=2))||(heat.z!=null&&heat.z>=1&&heat.value>0)){direction='UP';label='Crop water / heat stress screen';}
 }else if(c.id==='natural-gas'){
  const h=z('hdd'),cool=z('cdd'),driver=h.mean>=cool.mean?h:cool;
  if(driver.z!=null&&Math.abs(driver.z)>=1){direction=driver.z>0?'UP':'DOWN';label=`${h.mean>=cool.mean?'Heating':'Cooling'} demand screen`;}
 }else throw new Error('Historical replay currently supports corn and natural gas. Issued-forecast evaluation supports the full catalogue.');
 const hdd=z('hdd'),cdd=z('cdd');
 const weatherFeatures=c.id==='corn'&&region.activeMonths&&!region.activeMonths.includes(month)?[0,0,0]:[z('rain').z??0,z('heat').z??0,(hdd.mean>=cdd.mean?hdd:cdd).z??0];
 const weather={windowStart:validStart.slice(0,10),windowEnd:new Date(Date.parse(validStart)+6*86400_000).toISOString().slice(0,10),rain:z('rain'),heat:z('heat'),demand:hdd.mean>=cdd.mean?hdd:cdd,demandType:hdd.mean>=cdd.mean?'Heating degree-days':'Cooling degree-days'};
 return {weather,weatherFeatures,id:`REPLAY-${c.id}-${region.id}-${run}`,commodityId:c.id,regionId:region.id,source:'REPLAY',availableAtUtc:new Date(Date.parse(run)+8*3600_000).toISOString(),initializedAtUtc:run,direction,label,inputHash:hash({run,value,history}),engineVersion:REPLAY_VERSION,sourceUrls:urls,note:'Retrospective fixed-rule experiment, not a forecast issued by Astraeus. GFS availability assumes an eight-hour publication lag. Prior-year climatology uses reanalysis; no future-season observations enter the rule. Local screening is not production-weighted.'};
}
export function issuedSignal(result:CommodityForecast,recordedAt=new Date().toISOString()):ArchivedSignal{
 const availableAtUtc=new Date(Math.max(Date.parse(recordedAt),Date.parse(result.generatedAtUtc),Date.parse(result.sourceGeneratedAtUtc))).toISOString();
 return {id:hash({commodityId:result.commodityId,regionId:result.regionId,input:result.evidence.inputHash,engine:result.evidence.engineVersion,parameters:result.evidence.parametersSha256}),commodityId:result.commodityId,regionId:result.regionId,source:'ISSUED',weatherFeatures:[result.drivers?.find(d=>d.signalId==='PRECIP_NEXT7')?.zScore??0,result.drivers?.find(d=>d.signalId==='HEAT_NEXT7')?.zScore??0,result.drivers?.find(d=>d.signalId==='HDD_NEXT7'||d.signalId==='CDD_NEXT7')?.zScore??0],availableAtUtc,direction:result.status==='UPWARD_PRESSURE'?'UP':result.status==='DOWNWARD_PRESSURE'?'DOWN':null,label:result.status,inputHash:result.evidence.inputHash,engineVersion:result.evidence.engineVersion,sourceUrls:result.sources.map(s=>s.url),note:'Availability is the first time this server recorded the result, never backdated to weather initialization.'};
}
export function createForecastLedger(dir:string){
 const file=path.join(dir,'forecast-events.json');let queue=Promise.resolve();
 const read=async():Promise<ArchivedSignal[]>=>{try{const raw=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(raw))throw new Error('Invalid forecast ledger.');return raw;}catch(e:any){if(e.code==='ENOENT')return [];throw e;}};
 const append=(event:ArchivedSignal)=>{const job=queue.then(async()=>{const rows=await read();if(rows.some(r=>r.id===event.id))return;await mkdir(dir,{recursive:true});await writeFile(file+'.tmp',JSON.stringify([...rows,event]),'utf8');await rename(file+'.tmp',file);});queue=job.catch(()=>{});return job;};
 const numericalFile=path.join(dir,'price-targets.json');
 const readNumericalRaw=async():Promise<IssuedPriceTarget[]>=>{try{const raw=JSON.parse(await readFile(numericalFile,'utf8'));if(!Array.isArray(raw))throw new Error('Invalid numerical forecast ledger.');return raw;}catch(e:any){if(e.code==='ENOENT')return [];throw e;}};
 const appendNumerical=(record:IssuedPriceTarget)=>{const job=queue.then(async()=>{const rows=await readNumericalRaw();if(rows.some(r=>r.id===record.id))return;await mkdir(dir,{recursive:true});await writeFile(numericalFile+'.tmp',JSON.stringify([...rows,record]),'utf8');await rename(numericalFile+'.tmp',numericalFile);});queue=job.catch(()=>{});return job;};
 return {read:async()=>{await queue;return read();},append,readNumerical:async()=>{await queue;return readNumericalRaw();},appendNumerical};
}
const memo=new Map<string,{expires:number,data:any}>();
let backtestFetch:(url:string,timeoutMs:number)=>Promise<any>=async(url,timeoutMs)=>{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (Astraeus research)'},signal:AbortSignal.timeout(timeoutMs)});if(!r.ok)throw new Error(`Data provider returned HTTP ${r.status}.`);return r.json();};
/** Lets the server route backtest requests through its shared cache and Open-Meteo budget (server/outbound.ts). */
export function configureBacktestFetch(fn:(url:string,timeoutMs:number)=>Promise<any>){backtestFetch=fn;}
async function fetchJson(url:string){
 const hit=memo.get(url);if(hit&&hit.expires>Date.now())return hit.data;
 const data=await backtestFetch(url,25000);if(data.error||data.chart?.error)throw new Error(data.reason||data.chart?.error?.description||'Provider rejected the request.');
 if(memo.size>=150)memo.delete(memo.keys().next().value!);memo.set(url,{expires:Date.now()+1800_000,data});return data;
}
export async function runForecastBacktest(options:{commodityId:string;regionId:string;mode:'REPLAY'|'ISSUED';start:string;end:string;horizon:number;costBps:number;cadence?:'DAILY'|'WEEKLY'},ledger:ReturnType<typeof createForecastLedger>){
 evaluateForecastPriceEvents([],[],options.horizon,options.costBps,new Date().toISOString());
 const c=COMMODITIES.find(c=>c.id===options.commodityId),region=c?.regions.find(r=>r.id===options.regionId);
 if(!c||!region)throw new Error('Choose a catalogue commodity and region.');
 if(!['REPLAY','ISSUED'].includes(options.mode))throw new Error('Choose replay or issued forecasts.');
 const cadence=options.cadence??'DAILY';if(!['DAILY','WEEKLY'].includes(cadence))throw new Error('Choose daily or weekly forecast sampling.');
 let trainingEvents:ArchivedSignal[]=[];let events:ArchivedSignal[]=[],sourceUrls:string[]=[],failures:{date:string;reason:string}[]=[];
 if(options.mode==='REPLAY'){
  if(!['corn','natural-gas'].includes(c.id))throw new Error('Historical replay currently supports corn and natural gas.');
  const runs=calendarRuns(options.start,options.end,cadence);
  if(runs.some(r=>r.slice(0,10)>new Date().toISOString().slice(0,10)))throw new Error('Forecast dates cannot be in the future.');
  const trainingRuns=Array.from({length:24},(_,i)=>new Date(Date.parse(runs[0])-(24-i)*7*86400_000).toISOString()).filter(r=>r.slice(0,10)>='2026-04-02');
  const allRuns=[...new Set([...trainingRuns,...runs])].sort();
  const minYear=Number(allRuns[0].slice(0,4))-10,maxYear=Number(allRuns.at(-1)!.slice(0,4))-1;
  const vars='precipitation_sum,temperature_2m_mean,temperature_2m_max';
  const climateUrl=`https://archive-api.open-meteo.com/v1/archive?latitude=${region.lat}&longitude=${region.lng}&start_date=${minYear}-01-01&end_date=${maxYear}-12-31&daily=${vars}&models=era5&timezone=UTC`;
  const climate=await fetchJson(climateUrl);sourceUrls.push(climateUrl);
  // Three requests at a time bounds load on the public archive.
  for(let i=0;i<allRuns.length;i+=3)await Promise.all(allRuns.slice(i,i+3).map(async run=>{
   const url=`https://single-runs-api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lng}&models=gfs_global&run=${run.slice(0,16)}&daily=${vars}&forecast_days=8&timezone=UTC`;sourceUrls.push(url);
   try{const forecast=await fetchJson(url);if(Math.abs(forecast.latitude-region.lat)>1||Math.abs(forecast.longitude-region.lng)>1)throw new Error('Archived forecast coordinate mismatch.');const event=replaySignal(c,region,run,forecast,climate,[url,climateUrl]);if(Date.parse(event.availableAtUtc)>Date.now())throw new Error('Run is not yet available under the eight-hour publication assumption.');if(runs.includes(run))events.push(event);else trainingEvents.push(event);}catch(e:any){failures.push({date:run,reason:(runs.includes(run)?'Evaluation run: ':'Training run: ')+e.message});}
  }));
 }else{
  const start=Date.parse(options.start+'T00:00:00Z'),end=Date.parse(options.end+'T23:59:59Z');if(!Number.isFinite(start)||!Number.isFinite(end)||start>end||end-start>366*86400_000)throw new Error('Use an ordered date range of at most one year.');
  const all=(await ledger.read()).filter(e=>e.commodityId===c.id&&e.regionId===region.id);events=all.filter(e=>Date.parse(e.availableAtUtc)>=start&&Date.parse(e.availableAtUtc)<=end);trainingEvents=all.filter(e=>Date.parse(e.availableAtUtc)<start);
 }
 const period1=Math.floor(Date.parse(options.start+'T00:00:00Z')/1000)-365*86400,period2=Math.min(Math.floor(Date.now()/1000),Math.floor(Date.parse(options.end+'T00:00:00Z')/1000)+65*86400);
 const priceUrl=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(c.symbol)}?period1=${period1}&period2=${period2}&interval=1d`;
 const raw=await fetchJson(priceUrl),prices=parseYahooDaily(raw,c.symbol);sourceUrls.push(priceUrl);

 events.sort((a,b)=>a.availableAtUtc.localeCompare(b.availableAtUtc)||a.id.localeCompare(b.id));
 const asOfUtc=new Date().toISOString(),rangeEnd=new Date(Date.parse(options.end+'T00:00:00Z')+86400_000).toISOString(),evaluationAsOf=asOfUtc<rangeEnd?asOfUtc:rangeEnd;
 const evaluation=evaluateForecastPriceEvents(events,prices,options.horizon,options.costBps,evaluationAsOf);
 const numerical=forecastPriceCurve([...trainingEvents,...events],prices,options.horizon,options.start,options.end,evaluationAsOf);
 const current=numerical.points.filter(p=>p.availableAtUtc.slice(0,10)===asOfUtc.slice(0,10)&&p.predictedPrice!=null).at(-1);
 if(current&&current.anchorDate&&current.anchorPrice&&current.marketOnlyPrice!=null){
  const issuedAtUtc=new Date().toISOString();
  await ledger.appendNumerical({id:hash({commodityId:c.id,regionId:region.id,horizon:options.horizon,model:numerical.config.version,day:issuedAtUtc.slice(0,10)}),commodityId:c.id,regionId:region.id,issuedAtUtc,horizon:options.horizon,anchorDate:current.anchorDate,anchorPrice:current.anchorPrice,predictedPrice:current.predictedPrice!,marketOnlyPrice:current.marketOnlyPrice,modelVersion:numerical.config.version,inputHash:hash({point:current,options,config:numerical.config,trainingEvents}),trainingCount:current.trainingCount,trainedThrough:current.trainedThrough});
 }
 const recorded=await ledger.readNumerical();
 const issuedNumerical=evaluateIssuedPriceTargets(recorded.filter(r=>r.commodityId===c.id&&r.regionId===region.id&&r.horizon===options.horizon),prices,options.start,options.end,evaluationAsOf);
 const chartPrices=prices.filter(p=>p.date>=options.start&&p.date<=options.end&&p.date<asOfUtc.slice(0,10));
 return {version:'forecast-price-backtest-v1',...options,commodityName:c.name,regionName:region.name,symbol:c.symbol,currency:raw.chart.result[0].meta.currency,asOfUtc,evaluationAsOf,numerical,issuedNumerical,chartPrices,forecastOrigins:events,trainingEvents:trainingEvents.length,cadence,evaluation,prices,failures,sourceUrls,priceHash:hash(prices),inputHash:hash({events,trainingEvents,prices,options,numericalConfig:numerical.config}),experimentId:`BT-${hash({events,trainingEvents,prices,options,numericalConfig:numerical.config}).slice(0,20)}`,notes:[
 'The rule screen predicts direction. A separate experimental expanding-window ridge model reconstructs numerical targets; those targets were not historically issued by Astraeus.',
 'Numerical forecasts are anchored to the prior completed close, using market momentum/volatility plus seasonal weather anomalies. Daily history is fetched before the display range only for training; the chart shows the selected dates.',
 'Completed-outcome scoring is limited to the selected end date. Recent origins remain pending. Test targets may overlap and are not independent.',
 'Entry is the first available daily OPEN on a later UTC calendar date than forecast availability. Exit is the horizon-th session CLOSE. Today’s provisional close is excluded.',
 'Events with overlapping holding windows are excluded; neutral/mixed signals, missing prices and unfinished horizons are shown separately.',
 'Yahoo =F symbols are provider continuous/front-contract price proxies. Roll jumps, basis and contract changes can distort returns. This is not an executable futures P&L backtest.',
 'Signed percentage moves and the optional cost scenario omit leverage, margin, financing and roll execution. No Sharpe ratio or compounded strategy return is reported.',
 'Always-up accuracy uses the same evaluated event windows. Small and selected samples do not establish predictive skill or causality.',
 ...(options.mode==='REPLAY'?['Fixed rules were selected retrospectively. This is exploratory historical rule replay, not an out-of-sample test of forecasts previously issued by Astraeus.','Replay uses the first seven complete UTC days after each archived GFS initialization (the initial day has incomplete precipitation), an assumed eight-hour availability lag and the matching calendar windows in the prior ten years of ERA5 climatology. It omits wind, intraday frost, production weights and inventories. Missing archives are excluded, never replaced by observations.']:['Issued forecasts are recorded on this server when generated. The ledger is local to this installation; no pre-installation history is invented.'])]};
}

export type ForecastBacktestResponse=Awaited<ReturnType<typeof runForecastBacktest>>;
