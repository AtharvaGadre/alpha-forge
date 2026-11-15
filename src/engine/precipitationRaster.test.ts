import test from 'node:test';
import assert from 'node:assert/strict';
import {rasterCoordinate,rasterRainSample} from './precipitationRaster';
test('raster projection preserves centre and excludes outside the globe',()=>{assert.deepEqual(rasterCoordinate(0,0,42,-93),{lat:42,lng:-93});assert.equal(rasterCoordinate(1,1,0,0),null);});
test('raster projection respects geographic orientation and dateline',()=>{assert.ok(rasterCoordinate(0,.5,0,0)!.lat>29.99);assert.ok(Math.abs(rasterCoordinate(.5,0,0,170)!.lng-200)<1e-8);assert.ok(Math.abs(rasterCoordinate(0,-.5,45,0)!.lat-15)<1e-8);});

import {WEATHER_GRID,sampleWeather} from './liveGlobeWeather';
test('raster scalar sampling matches the source field including gaps and dateline',()=>{
 const frame={validAtUtc:'2026-11-12T00:00:00Z',samples:WEATHER_GRID.map((p,i)=>({...p,precipitationMm:i%9,windMs:null,windFromDeg:null}))};
 for(const [lat,lng] of [[0,179],[70,-180],[-70,180],[31.4,-93.2],[80,0]]){const actual=rasterRainSample(frame,lat,lng),expected=sampleWeather(frame,lat,lng)?.precipitationMm??null;if(expected===null)assert.equal(actual,null);else assert.ok(actual!==null&&Math.abs(actual-expected)<1e-10);}
 frame.samples[0].precipitationMm=NaN;assert.equal(rasterRainSample(frame,-70,-180),null);
});
