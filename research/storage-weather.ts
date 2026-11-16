/**
 * research/storage-weather.ts — the weather side of the storage and price-revision studies.
 *
 *  - Truth: NOAA CPC daily CONUS gas-customer-weighted HDD (UtilityGas.Heating) and
 *    population-weighted CDD (Population.Cooling), °F·day, base 65 °F.
 *  - Forecasts: Open-Meteo Previous Runs 2 m temperature at one city per census division,
 *    local-day (Tmax + Tmin)/2 per lead, minus a trailing 28-day mean bias against ERA5 at the
 *    city, converted to city degree days, mapped to the CPC division average with a linear map
 *    fitted on ERA5 in a calibration period, and combined with CPC's own division weights.
 */
import { addDaysIso, type DailySeries } from '../src/engine/priceSkill';
import { cddF, cToF, fitLinearMap, hddF, leastSquares, trailingMeanDifference, type LinearMap } from '../src/engine/storageSkill';
import { CITIES, FORECAST_MODELS, LEADS, loadCpc, loadEra5, loadPrevRuns, type City, type DayTemps, type LeadTemps } from './storage-data';

export interface WeatherConfig {
  cpcFirstYear: number;
  cpcLastYear: number;
  era5Start: string;
  dataEnd: string;
  calibration: { start: string; end: string };
  bias: { days: number; lagDays: number; minDays: number };
}

export interface DD { hdd: number; cdd: number }

export interface MappingSummary {
  hdd: Record<string, LinearMap>;
  cdd: Record<string, LinearMap>;
  weightsHdd: Record<string, number>;
  weightsCdd: Record<string, number>;
  /** How well CPC CONUS is reproduced from CPC divisions with these weights (daily, calibration period). */
  divisionWeightFit: { hddR2: number; cddR2: number; hddRmse: number; cddRmse: number };
  /** How well CPC CONUS is reproduced from ERA5 at the nine cities through the maps (daily, calibration period). */
  era5CityFit: { hddR2: number; cddR2: number; hddRmse: number; cddRmse: number; n: number };
}

const tavgSeries = (m: Map<string, DayTemps>): DailySeries => new Map([...m].map(([d, t]) => [d, (t.tmax + t.tmin) / 2]));

function r2rmse(y: number[], f: number[]) {
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  const sse = y.reduce((s, v, i) => s + (v - f[i]) ** 2, 0);
  const sst = y.reduce((s, v) => s + (v - my) ** 2, 0);
  return { r2: 1 - sse / sst, rmse: Math.sqrt(sse / y.length) };
}

export class WeatherContext {
  cpcHdd!: DailySeries;
  cpcCdd!: DailySeries;
  cpcDivHdd = new Map<string, DailySeries>();
  cpcDivCdd = new Map<string, DailySeries>();
  era5Tavg = new Map<string, DailySeries>();
  /** model → city → lead → local day → (Tmax + Tmin)/2 (°C). */
  fcTavg = new Map<string, Map<string, Map<number, DailySeries>>>();
  mapping!: MappingSummary;
  cpcFetchedAt: Record<string, Record<number, string>> = {};
  private biasCache = new Map<string, number | null>();

  constructor(readonly cfg: WeatherConfig) {}

  async loadTruth() {
    const gas = await loadCpc('UtilityGas.Heating', this.cfg.cpcFirstYear, this.cfg.cpcLastYear);
    const cool = await loadCpc('Population.Cooling', this.cfg.cpcFirstYear, this.cfg.cpcLastYear);
    this.cpcFetchedAt = { 'UtilityGas.Heating': gas.fetchedAt, 'Population.Cooling': cool.fetchedAt };
    this.cpcHdd = gas.regions.get('CONUS')!;
    this.cpcCdd = cool.regions.get('CONUS')!;
    for (const c of CITIES) {
      this.cpcDivHdd.set(c.division, gas.regions.get(c.division)!);
      this.cpcDivCdd.set(c.division, cool.regions.get(c.division)!);
    }
  }

  async loadCities(withForecasts: boolean) {
    for (const c of CITIES) {
      this.era5Tavg.set(c.id, tavgSeries(await loadEra5(c, this.cfg.era5Start, this.cfg.dataEnd)));
    }
    if (!withForecasts) return;
    for (const m of FORECAST_MODELS) {
      const byCity = new Map<string, Map<number, DailySeries>>();
      for (const c of CITIES) {
        const lt: LeadTemps = await loadPrevRuns(c, m, this.cfg.dataEnd);
        byCity.set(c.id, new Map(LEADS.map((l) => [l, tavgSeries(lt.get(l)!)])));
      }
      this.fcTavg.set(m.id, byCity);
    }
  }

  /** Fits the city → division maps and CPC division weights on the calibration period (ERA5 only). */
  calibrate() {
    const { start, end } = this.cfg.calibration;
    const days: string[] = [];
    for (let d = start; d <= end; d = addDaysIso(d, 1)) days.push(d);
    const hdd: Record<string, LinearMap> = {};
    const cdd: Record<string, LinearMap> = {};
    for (const c of CITIES) {
      const t = this.era5Tavg.get(c.id)!;
      const ph: Array<[number, number]> = [];
      const pc: Array<[number, number]> = [];
      for (const d of days) {
        const tc = t.get(d);
        const h = this.cpcDivHdd.get(c.division)!.get(d);
        const k = this.cpcDivCdd.get(c.division)!.get(d);
        if (tc === undefined) continue;
        if (h !== undefined) ph.push([hddF(cToF(tc)), h]);
        if (k !== undefined) pc.push([cddF(cToF(tc)), k]);
      }
      hdd[c.division] = fitLinearMap(ph.map((p) => p[0]), ph.map((p) => p[1]));
      cdd[c.division] = fitLinearMap(pc.map((p) => p[0]), pc.map((p) => p[1]));
    }
    const divs = CITIES.map((c) => c.division);
    const weightFit = (div: Map<string, DailySeries>, conus: DailySeries) => {
      const X: number[][] = [];
      const y: number[] = [];
      for (const d of days) {
        const row = divs.map((k) => div.get(k)!.get(d));
        const v = conus.get(d);
        if (v === undefined || row.some((x) => x === undefined)) continue;
        X.push(row as number[]);
        y.push(v);
      }
      const w = leastSquares(X, y);
      const fit = r2rmse(y, X.map((r) => r.reduce((s, x, j) => s + x * w[j], 0)));
      return { w: Object.fromEntries(divs.map((k, j) => [k, w[j]])), ...fit };
    };
    const wh = weightFit(this.cpcDivHdd, this.cpcHdd);
    const wc = weightFit(this.cpcDivCdd, this.cpcCdd);
    this.mapping = {
      hdd,
      cdd,
      weightsHdd: wh.w,
      weightsCdd: wc.w,
      divisionWeightFit: { hddR2: wh.r2, cddR2: wc.r2, hddRmse: wh.rmse, cddRmse: wc.rmse },
      era5CityFit: { hddR2: NaN, cddR2: NaN, hddRmse: NaN, cddRmse: NaN, n: 0 },
    };
    const yh: number[] = [], fh: number[] = [], yc: number[] = [], fc: number[] = [];
    for (const d of days) {
      const m = this.era5MappedDay(d);
      const h = this.cpcHdd.get(d);
      const k = this.cpcCdd.get(d);
      if (!m || h === undefined || k === undefined) continue;
      yh.push(h); fh.push(m.hdd); yc.push(k); fc.push(m.cdd);
    }
    const a = r2rmse(yh, fh);
    const b = r2rmse(yc, fc);
    this.mapping.era5CityFit = { hddR2: a.r2, cddR2: b.r2, hddRmse: a.rmse, cddRmse: b.rmse, n: yh.length };
  }

  /** CONUS degree days (CPC basis) from one daily mean temperature (°C) per city. */
  conusFromCityTemps(tempsC: Record<string, number>): DD {
    let hdd = 0, cdd = 0;
    for (const c of CITIES) {
      const tF = cToF(tempsC[c.id]);
      const mh = this.mapping.hdd[c.division];
      const mc = this.mapping.cdd[c.division];
      hdd += this.mapping.weightsHdd[c.division] * Math.max(0, mh.a + mh.b * hddF(tF));
      cdd += this.mapping.weightsCdd[c.division] * Math.max(0, mc.a + mc.b * cddF(tF));
    }
    return { hdd, cdd };
  }

  /** Truth (CPC CONUS) for one local day. */
  truthDay(day: string): DD | null {
    const hdd = this.cpcHdd.get(day);
    const cdd = this.cpcCdd.get(day);
    return hdd === undefined || cdd === undefined ? null : { hdd, cdd };
  }

  /** ERA5 at the nine cities pushed through the same maps (representativeness diagnostic). */
  era5MappedDay(day: string): DD | null {
    const t: Record<string, number> = {};
    for (const c of CITIES) {
      const v = this.era5Tavg.get(c.id)!.get(day);
      if (v === undefined) return null;
      t[c.id] = v;
    }
    return this.conusFromCityTemps(t);
  }

  /** Trailing mean (forecast − ERA5) of daily mean temperature for one city/model/lead, known when the week starting `issueStart` begins. */
  bias(model: string, city: City, lead: number, issueStart: string): number | null {
    const key = `${model}|${city.id}|${lead}|${issueStart}`;
    if (this.biasCache.has(key)) return this.biasCache.get(key)!;
    const fc = this.fcTavg.get(model)?.get(city.id)?.get(lead);
    const b = fc ? trailingMeanDifference(fc, this.era5Tavg.get(city.id)!, addDaysIso(issueStart, -this.cfg.bias.lagDays), this.cfg.bias.days, this.cfg.bias.minDays) : null;
    this.biasCache.set(key, b);
    return b;
  }

  /**
   * Forecast CONUS degree days for local `day`, from previous_day `lead` of each model in `models`
   * (multi-model mean of bias-corrected temperatures), with biases estimated as of `issueStart`.
   */
  forecastDay(models: string[], lead: number, day: string, issueStart: string, corrected: boolean): DD | null {
    const t: Record<string, number> = {};
    for (const c of CITIES) {
      let s = 0;
      for (const m of models) {
        const v = this.fcTavg.get(m)?.get(c.id)?.get(lead)?.get(day);
        if (v === undefined) return null;
        let b = 0;
        if (corrected) {
          const bb = this.bias(m, c, lead, issueStart);
          if (bb === null) return null;
          b = bb;
        }
        s += v - b;
      }
      t[c.id] = s / models.length;
    }
    return this.conusFromCityTemps(t);
  }

  /** Forecast for the storage week ending `weekEnd`, issued before it starts: day i (0 = Friday) uses lead i + 1. */
  forecastWeek(models: string[], weekEnd: string, corrected: boolean): DD | null {
    const start = addDaysIso(weekEnd, -7);
    let hdd = 0, cdd = 0;
    for (let i = 0; i < 7; i++) {
      const v = this.forecastDay(models, i + 1, addDaysIso(start, i), start, corrected);
      if (!v) return null;
      hdd += v.hdd;
      cdd += v.cdd;
    }
    return { hdd, cdd };
  }

  truthWeek(weekEnd: string): DD | null {
    const start = addDaysIso(weekEnd, -7);
    let hdd = 0, cdd = 0;
    for (let i = 0; i < 7; i++) {
      const v = this.truthDay(addDaysIso(start, i));
      if (!v) return null;
      hdd += v.hdd;
      cdd += v.cdd;
    }
    return { hdd, cdd };
  }

  era5MappedWeek(weekEnd: string): DD | null {
    const start = addDaysIso(weekEnd, -7);
    let hdd = 0, cdd = 0;
    for (let i = 0; i < 7; i++) {
      const v = this.era5MappedDay(addDaysIso(start, i));
      if (!v) return null;
      hdd += v.hdd;
      cdd += v.cdd;
    }
    return { hdd, cdd };
  }
}
