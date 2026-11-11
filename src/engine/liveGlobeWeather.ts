export interface WeatherGridPoint { lat: number; lng: number }
export interface WeatherSample extends WeatherGridPoint { precipitationMm: number | null; windMs: number | null; windFromDeg: number | null }
export interface WeatherFrame { validAtUtc: string; samples: WeatherSample[] }
export interface GlobeWeatherField {
  version: 'live-globe-weather-v1'; provider: string; model: string;
  fetchedAtUtc: string; modelInitializedAtUtc: string | null; inputSha256: string;
  spacingDeg: number; latitudeRange: [number, number]; frames: WeatherFrame[];
  sourceUrls: string[]; availablePoints: number; totalPoints: number; warnings: string[];
}
export const WEATHER_GRID: WeatherGridPoint[] = Array.from({ length: 8 }, (_, y) => -70 + y * 20)
  .flatMap(lat => Array.from({ length: 18 }, (_, x) => ({ lat, lng: -180 + x * 20 })));
export function windVector(speed: number | null, fromDeg: number | null): { u: number; v: number } | null {
  if (speed == null || fromDeg == null || !Number.isFinite(speed) || !Number.isFinite(fromDeg) || speed < 0 || fromDeg < 0 || fromDeg > 360) return null;
  const a = fromDeg * Math.PI / 180;
  return { u: -speed * Math.sin(a), v: -speed * Math.cos(a) };
}
const numeric = (v: unknown, max: number): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
/** Keep null weather as missing, never turn it into zero rainfall or calm wind. */
export function parseWeatherFrame(points: WeatherGridPoint[], rows: any[], validAtUtc: string): WeatherFrame {
  const time = validAtUtc.slice(0,16);
  return { validAtUtc, samples: points.map((p,i) => {
    const row = rows[i]; const h = row?.hourly;
    const matchesPoint = row && Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && Math.abs(row.latitude-p.lat)<3 && Math.abs((((row.longitude-p.lng)+540)%360)-180)<3;
    const index = matchesPoint && Array.isArray(h?.time) ? h.time.indexOf(time) : -1;
    const units = row?.hourly_units;
    return { ...p,
      precipitationMm: index >= 0 && units?.precipitation === 'mm' ? numeric(h.precipitation?.[index],1000) : null,
      windMs: index >= 0 && units?.wind_speed_10m === 'm/s' ? numeric(h.wind_speed_10m?.[index],150) : null,
      windFromDeg: index >= 0 && units?.wind_direction_10m === '°' ? numeric(h.wind_direction_10m?.[index],360) : null,
    };
  }) };
}
export function forecastSlots(now: Date): string[] {
  const hour = new Date(now); hour.setUTCMinutes(0,0,0);
  return Array.from({length:25},(_,i)=>new Date(hour.getTime()+i*3*3600_000).toISOString());
}
export async function fetchGlobeWeather(fetchJson: (url: string) => Promise<any>, now = new Date()): Promise<Omit<GlobeWeatherField,'inputSha256'>> {
  const urls: string[] = [];
  const metadataUrl = 'https://api.open-meteo.com/data/ncep_gfs025/static/meta.json';
  const chunks = Array.from({length:4},(_,i)=>WEATHER_GRID.slice(i*36,(i+1)*36));
  const request = async (url: string) => { urls.push(url); try { return await fetchJson(url); } catch { return null; } };
  const [responses,metadata] = await Promise.all([
    Promise.all(chunks.map(points => request(`https://api.open-meteo.com/v1/forecast?latitude=${points.map(p=>p.lat).join(',')}&longitude=${points.map(p=>p.lng).join(',')}&hourly=precipitation,wind_speed_10m,wind_direction_10m&models=gfs_global&wind_speed_unit=ms&forecast_days=4&timezone=UTC&cell_selection=nearest`))),
    request(metadataUrl),
  ]);
  const rows = responses.flatMap((data,i) => { const arr = Array.isArray(data) ? data : data ? [data] : []; return chunks[i].map((_,j)=>arr[j] ?? null); });
  const frames = forecastSlots(now).map(t=>parseWeatherFrame(WEATHER_GRID,rows,t));
  const availablePoints = frames[0].samples.filter(s=>s.precipitationMm!=null || windVector(s.windMs,s.windFromDeg)!=null).length;
  if (availablePoints < WEATHER_GRID.length * .25) throw new Error('Global weather grid unavailable or incomplete. No example weather was substituted.');
  const timestamp = Number(metadata?.last_run_initialisation_time);
  const initMs = timestamp*1000;
  const init = Number.isFinite(initMs) && initMs > 0 && initMs <= now.getTime()+3600_000 ? new Date(initMs).toISOString() : null;
  if (init && now.getTime()-initMs > 24*3600_000) throw new Error('The weather model run is older than 24 hours. Overlay withheld.');
  return { version:'live-globe-weather-v1',provider:'Open-Meteo · NOAA GFS',model:'GFS Global',fetchedAtUtc:now.toISOString(),modelInitializedAtUtc:init,spacingDeg:20,latitudeRange:[-70,70],frames,sourceUrls:urls,availablePoints,totalPoints:WEATHER_GRID.length,
    warnings:[...(!init?['Model initialization time unavailable; run freshness is unverified.']:[]),...(availablePoints<WEATHER_GRID.length?['Partial grid coverage. Missing areas remain uncoloured.']:[]),'Coarse 20° global samples, smoothed for context; not a local hazard or high-resolution rainfall map.','Precipitation is the model total for the preceding hour, including rain and snow water equivalent.'] };
}

/** Cyclic longitude and vector interpolation avoid a 359°/1° wind-direction discontinuity. */
export function sampleWeather(frame: WeatherFrame, lat: number, lng: number): { precipitationMm: number | null; u: number | null; v: number | null } | null {
  if (!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -70 || lat > 70) return null;
  const y = Math.min(6,Math.floor((lat+70)/20)), fy=(lat-(-70+y*20))/20;
  const xfloat=((((lng+180)%360)+360)%360)/20, x=Math.floor(xfloat), fx=xfloat-x;
  const indices=[y*18+x,y*18+(x+1)%18,(y+1)*18+x,(y+1)*18+(x+1)%18];
  const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
  const samples=indices.map(i=>frame.samples[i]);
  const sum=(values:(number|null|undefined)[])=>values.every((v,i)=>weights[i]===0 || v!=null&&Number.isFinite(v))?values.reduce<number>((s,v,i)=>s+(weights[i]===0?0:v!*weights[i]),0):null;
  const vectors=samples.map(s=>s?windVector(s.windMs,s.windFromDeg):null);
  return { precipitationMm:sum(samples.map(s=>s?.precipitationMm)),u:sum(vectors.map(v=>v?.u)),v:sum(vectors.map(v=>v?.v)) };
}
export const RAIN_COLORS = ['#467bc6','#43b7c6','#73c393','#dcc56f','#de8765'];
export function rainColor(mm: number): string { return RAIN_COLORS[mm<.5?0:mm<2?1:mm<5?2:mm<10?3:4]; }
