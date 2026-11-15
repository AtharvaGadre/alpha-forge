import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastPosition,interpolateWeatherFrame,blendWeatherValue} from './forecastPlayback';
import type {WeatherFrame} from './liveGlobeWeather';
const frame=(time:string,rain:number|null,dir:number):WeatherFrame=>({validAtUtc:time,samples:[{lat:10,lng:20,precipitationMm:rain,windMs:10,windFromDeg:dir}]});
test('Playback advances fractionally and independently of display frame rate, without extrapolation',()=>{
  const p=forecastPosition(0,350,25);assert.equal(p,.25);
  let position=0;for(let i=0;i<100;i++)position=forecastPosition(position,14,25);assert.ok(Math.abs(position-1)<1e-12);
  assert.equal(forecastPosition(23.9,1400,25),24);assert.equal(forecastPosition(.5,0,25),.5);assert.equal(forecastPosition(0,1400,1),0);
});
test('Weather interpolation blends timestamps and rainfall while respecting circular wind directions',()=>{
  const a=frame('2026-11-12T00:00:00Z',2,350),b=frame('2026-11-12T03:00:00Z',6,10);
  const mid=interpolateWeatherFrame(a,b,.5);assert.equal(mid.validAtUtc,'2026-11-12T01:30:00.000Z');assert.equal(mid.samples[0].precipitationMm,4);
  assert.ok(mid.samples[0].windFromDeg!<.001||mid.samples[0].windFromDeg!>359.999);
  assert.equal(interpolateWeatherFrame(a,b,0),a);assert.equal(interpolateWeatherFrame(a,b,1),b);
});
test('Gaps remain missing during interpolation; absent values do not become calm or dry',()=>{
  assert.equal(blendWeatherValue(null,5,.5),null);
  const a=frame('2026-11-12T00:00:00Z',null,0),b=frame('2026-11-12T03:00:00Z',5,0);b.samples[0].windMs=null;
  const mid=interpolateWeatherFrame(a,b,.5);assert.equal(mid.samples[0].precipitationMm,null);assert.equal(mid.samples[0].windMs,null);
  b.samples[0].lat=20;assert.equal(interpolateWeatherFrame(a,b,.5).samples[0].windMs,null);
});
