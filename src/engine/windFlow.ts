import { sampleWeather, type WeatherFrame } from './liveGlobeWeather';

export interface WindFlowPath { points: { lat: number; lng: number }[]; speedMs: number; phase: number }
/** Spatial streamlines through the selected forecast slice, not travel-time contours. */
export function buildWindFlowPaths(frame: WeatherFrame): WindFlowPath[] {
  const paths: WindFlowPath[] = [];
  const vectorAt = (lat: number, lng: number) => {
    const v = sampleWeather(frame, lat, lng);
    if (v?.u == null || v.v == null) return null;
    const speed = Math.hypot(v.u,v.v);
    if (speed < .25) return null;
    return { lat: v.v/speed*1.2, lng: v.u/speed*1.2/Math.max(.3,Math.cos(lat*Math.PI/180)), speed };
  };
  for(let lat=-64;lat<=64;lat+=8) for(let lng=-176;lng<180;lng+=12) {
    const seed=vectorAt(lat,lng);if(!seed)continue;
    const trace = (sign: number) => {
      const points: {lat:number;lng:number}[]=[];let current={lat,lng};
      for(let step=0;step<28;step++) {
        const v=vectorAt(current.lat,current.lng);if(!v)break;
        const mid=vectorAt(current.lat+sign*v.lat/2,current.lng+sign*v.lng/2);if(!mid)break;
        const next={lat:current.lat+sign*mid.lat,lng:((current.lng+sign*mid.lng+540)%360)-180};
        if(!vectorAt(next.lat,next.lng))break;
        points.push(next);current=next;
      }
      return points;
    };
    const points=[...trace(-1).reverse(),{lat,lng},...trace(1)];
    if(points.length>=8) paths.push({points,speedMs:seed.speed,phase:((lat+90)*.073+(lng+180)*.037)%1});
  }
  return paths;
}
