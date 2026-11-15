import {windVector,RAIN_COLORS,type WeatherFrame} from './liveGlobeWeather';
export function forecastPosition(position:number,elapsedMs:number,frameCount:number):number{
  if(!Number.isFinite(position)||!Number.isFinite(elapsedMs)||elapsedMs<0||!Number.isInteger(frameCount)||frameCount<1)throw new Error('Invalid forecast playback inputs.');
  return Math.min(frameCount-1,Math.max(0,position)+elapsedMs/1400);
}
export function blendWeatherValue(a:number|null,b:number|null,t:number):number|null{
  if(t<=0)return a;if(t>=1)return b;
  return a!=null&&b!=null&&Number.isFinite(a)&&Number.isFinite(b)?a+(b-a)*t:null;
}
/** Intermediate times are visual interpolation, not newly retrieved forecasts. */
export function interpolateWeatherFrame(a:WeatherFrame,b:WeatherFrame,t:number):WeatherFrame{
  if(t<=0)return a;if(t>=1)return b;
  return {validAtUtc:new Date(Date.parse(a.validAtUtc)+(Date.parse(b.validAtUtc)-Date.parse(a.validAtUtc))*t).toISOString(),samples:a.samples.map((p,i)=>{
    const q=b.samples[i];if(!q||p.lat!==q.lat||p.lng!==q.lng)return {...p,precipitationMm:null,windMs:null,windFromDeg:null};
    const va=windVector(p.windMs,p.windFromDeg),vb=windVector(q.windMs,q.windFromDeg);
    const u=blendWeatherValue(va?.u??null,vb?.u??null,t),v=blendWeatherValue(va?.v??null,vb?.v??null,t);
    const speed=u!=null&&v!=null?Math.hypot(u,v):null;
    return {...p,precipitationMm:blendWeatherValue(p.precipitationMm,q.precipitationMm,t),windMs:speed,windFromDeg:u!=null&&v!=null?(Math.atan2(-u,-v)*180/Math.PI+360)%360:null};
  })};
}

export function continuousRainColor(mm:number):string{
  const stops=[.05,.5,2,5,10];
  const value=Math.max(stops[0],Math.min(stops[4],mm));
  const k=Math.min(3,Math.max(0,stops.findIndex((v,i)=>i<4&&value>=v&&value<=stops[i+1])));
  const t=(Math.log1p(value)-Math.log1p(stops[k]))/(Math.log1p(stops[k+1])-Math.log1p(stops[k]));
  const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const a=rgb(RAIN_COLORS[k]),b=rgb(RAIN_COLORS[k+1]);
  return `rgb(${a.map((v,i)=>Math.round(v+(b[i]-v)*t)).join(',')})`;
}
