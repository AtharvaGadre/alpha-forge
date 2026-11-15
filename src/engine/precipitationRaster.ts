import { type WeatherFrame } from './liveGlobeWeather';
import { blendWeatherValue, continuousRainColor } from './forecastPlayback';

/** Inverse orthographic projection; no artificial storm movement or synthetic observations. */
export function rasterCoordinate(x:number,y:number,lat:number,lng:number):{lat:number;lng:number}|null {
  const rho=Math.hypot(x,y); if(rho>1)return null;
  if(rho<1e-9)return {lat,lng};
  const c=Math.asin(rho),p=lat*Math.PI/180;
  return {lat:Math.asin(Math.cos(c)*Math.sin(p)+y*Math.sin(c)*Math.cos(p)/rho)*180/Math.PI,
    lng:lng+Math.atan2(x*Math.sin(c),rho*Math.cos(p)*Math.cos(c)-y*Math.sin(p)*Math.sin(c))*180/Math.PI};
}
/** Scalar-only sampling avoids allocating wind vectors for every rainfall pixel. */
export function rasterRainSample(frame:WeatherFrame,lat:number,lng:number):number|null{
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -70||lat>70)return null;
  const y=Math.min(6,Math.floor((lat+70)/20)),fy=(lat+70-y*20)/20;
  const xf=(((lng+180)%360+360)%360)/20,x=Math.floor(xf),fx=xf-x;
  let result=0;
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const weight=(dx?fx:1-fx)*(dy?fy:1-fy);if(weight===0)continue;
    const value=frame.samples[(y+dy)*18+(x+dx)%18]?.precipitationMm;
    if(value==null||!Number.isFinite(value))return null;result+=weight*value;
  }
  return result;
}
export function createRainRaster(from:WeatherFrame,to:WeatherFrame) {
  const size=192, canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d')!;const pixels=ctx.createImageData(size,size);
  const a=new Float32Array(size*size),b=new Float32Array(size*size);
  const colors=Array.from({length:1024},(_,i)=>continuousRainColor(i/1023*30).match(/[\d.]+/g)!.map(Number));
  let pose='',lastBlend=-1;
  return (lat:number,lng:number,blend:number):HTMLCanvasElement=>{
    const key=`${lat.toFixed(1)}:${lng.toFixed(1)}`;
    if(key!==pose){
      pose=key;lastBlend=-1;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const i=y*size+x,p=rasterCoordinate((x+.5-size/2)/(size/2),-(y+.5-size/2)/(size/2),lat,lng);
        a[i]=p?(rasterRainSample(from,p.lat,p.lng)??NaN):NaN;
        b[i]=p?(rasterRainSample(to,p.lat,p.lng)??NaN):NaN;
      }
    }
    if(Math.abs(lastBlend-blend)<.001)return canvas;lastBlend=blend;
    for(let i=0;i<a.length;i++){
      const mm=blendWeatherValue(Number.isNaN(a[i])?null:a[i],Number.isNaN(b[i])?null:b[i],blend),j=i*4;
      if(mm==null||mm<.05){pixels.data[j+3]=0;continue;}
      const color=colors[Math.min(1023,Math.round(mm/30*1023))];
      pixels.data[j]=color[0];pixels.data[j+1]=color[1];pixels.data[j+2]=color[2];pixels.data[j+3]=Math.round(220*Math.min(1,mm/.5));
    }
    ctx.putImageData(pixels,0,0);return canvas;
  };
}
