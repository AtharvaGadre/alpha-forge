import test from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER_GRID, windVector, parseWeatherFrame, forecastSlots, sampleWeather, fetchGlobeWeather, type WeatherFrame } from './liveGlobeWeather';
const now=new Date('2026-11-11T10:35:00Z');
const row=(lat:number,lng:number,precip:number|null=1,speed:number|null=10,direction:number|null=0)=>({latitude:lat,longitude:lng,hourly_units:{precipitation:'mm',wind_speed_10m:'m/s',wind_direction_10m:'°'},hourly:{time:['2026-11-11T10:00'],precipitation:[precip],wind_speed_10m:[speed],wind_direction_10m:[direction]}});
test('Meteorological wind directions become correct flow vectors',()=>{
  assert.ok(windVector(10,0)!.v<0);assert.ok(windVector(10,90)!.u<0);
  assert.ok(windVector(10,180)!.v>0);assert.ok(windVector(10,270)!.u>0);
  assert.equal(windVector(null,0),null);assert.equal(windVector(-1,0),null);assert.equal(windVector(1,NaN),null);
});
test('Null, invalid units and unmatched timestamps never become dry or calm weather',()=>{
  const p=[{lat:10,lng:-20}];
  const frame=parseWeatherFrame(p,[row(10,-20,null,null,null)],'2026-11-11T10:00:00.000Z');
  assert.equal(frame.samples[0].precipitationMm,null);assert.equal(frame.samples[0].windMs,null);
  const bad=row(10,-20);bad.hourly_units.wind_speed_10m='km/h';
  assert.equal(parseWeatherFrame(p,[bad],'2026-11-11T10:00:00.000Z').samples[0].windMs,null);
  assert.equal(parseWeatherFrame(p,[row(10,-20)],'2026-11-11T11:00:00.000Z').samples[0].precipitationMm,null);
  assert.equal(parseWeatherFrame(p,[row(40,-20)],'2026-11-11T10:00:00.000Z').samples[0].precipitationMm,null);
});
test('Forecast slots cover 72 hours from the actual current UTC hour',()=>{
  const slots=forecastSlots(now);assert.equal(slots.length,25);assert.equal(slots[0],'2026-11-11T10:00:00.000Z');assert.equal(slots.at(-1),'2026-11-14T10:00:00.000Z');
});
test('Grid interpolation handles the dateline, missing neighbours and circular wind',()=>{
  const frame: WeatherFrame={validAtUtc:now.toISOString(),samples:WEATHER_GRID.map(p=>({...p,precipitationMm:2,windMs:10,windFromDeg:p.lng===-180?359:1}))};
  const sample=sampleWeather(frame,0,179)!;assert.equal(sample.precipitationMm,2);assert.ok(sample.v!< -9.9);assert.ok(Math.abs(sample.u!)<.2);
  assert.equal(sampleWeather(frame,85,0),null);
  frame.samples[0].precipitationMm=null;
  assert.equal(sampleWeather(frame,-65,-175)!.precipitationMm,null);
});
test('Provider failure rejects the overlay; successful partial grids retain explicit gaps',async()=>{
  await assert.rejects(()=>fetchGlobeWeather(async()=>{throw new Error('offline');},now),/unavailable/);
  const result=await fetchGlobeWeather(async url=>{
    if(url.includes('meta.json'))return {last_run_initialisation_time:(now.getTime()-6*3600_000)/1000};
    const params=new URL(url).searchParams;const lats=params.get('latitude')!.split(',').map(Number),lngs=params.get('longitude')!.split(',').map(Number);
    return lats.map((lat,i)=>row(lat,lngs[i],lat>0?1:null,lat>0?10:null,lat>0?0:null));
  },now);
  assert.equal(result.totalPoints,144);assert.equal(result.availablePoints,72);assert.match(result.warnings.join(' '),/Partial/);
  assert.equal(result.frames[0].samples[0].windMs,null);assert.equal(result.frames[1].samples[100].windMs,null);
});
test('Stale model runs are withheld even if the forecast endpoint responds',async()=>{
  await assert.rejects(()=>fetchGlobeWeather(async url=>{
    if(url.includes('meta.json'))return {last_run_initialisation_time:(now.getTime()-48*3600_000)/1000};
    const p=new URL(url).searchParams;return p.get('latitude')!.split(',').map((lat,i)=>row(Number(lat),Number(p.get('longitude')!.split(',')[i])));
  },now),/older than 24/);
});
