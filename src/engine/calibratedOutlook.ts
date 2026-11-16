/**
 * Live calibrated 7-day outlook (Astraeus v2).
 *
 * For the region being analysed, the frozen v2 method — skill-weighted NGR for temperature (minimum CRPS,
 * cf. Gneiting et al. 2005) and a skill-weighted ensemble for rain — is fitted on up to 90 days of what each
 * global model forecast at the matching lead, verified against ERA5, using the same membership (≥ 90 %
 * availability) and day-aggregation rules as the benchmark. It is applied to today's run to give calibrated
 * daily quantiles and event probabilities. A time-ordered held-out check (older half → newer half) is
 * published alongside as local, small-sample evidence.
 */
import {
  fitNgrSkill, predictNgrSkill, skillWeights, crpsOf, crpsEnsemble,
  quantileOf, exceedanceOf, pointOf, type PredictiveForecast, type TrainingRow,
} from './weatherPostprocessing';

/** Method frozen from the development-period benchmark (docs/results/archive/weather-dev-period.json). */
export const OUTLOOK_METHOD_VERSION = 'astraeus-v2';
type Predict = (f: number[]) => PredictiveForecast;
function fitV2(rows: TrainingRow[], kind: 'temperature' | 'precipitation'): Predict | null {
  if (rows.length < 10) return null;
  if (kind === 'temperature') {
    const m = fitNgrSkill(rows);
    return m ? (f) => predictNgrSkill(m, f) : null;
  }
  const w = skillWeights(rows, 0.25);
  return (f) => ({ kind: 'weighted-ensemble', members: f, weights: w });
}

export type OutlookVariable = 'tmean' | 'tmax' | 'precip';

export interface OutlookBand {
  rawMean: number; rawMin: number; rawMax: number;
  mean: number; p10: number; p50: number; p90: number;
  /** false when no calibration model could be fitted; quantiles then come from the raw model spread. */
  calibrated: boolean;
  /** P(precip ≥ 1 mm) for rain, P(Tmax ≥ 32 °C) for maximum temperature. */
  prob?: number;
  members: number;
}

export interface OutlookDay {
  date: string;
  /** Previous-run lead (days) whose verification trained the calibration for this day. */
  trainingLead: number;
  tmean?: OutlookBand;
  tmax?: OutlookBand;
  precip?: OutlookBand;
}

export interface OutlookHeldOut {
  variable: OutlookVariable;
  lead: number;
  nTrain: number;
  nTest: number;
  crpsRaw: number;
  crpsCalibrated: number;
  /** CRPS skill of calibration relative to the raw multi-model ensemble on unseen days (positive = better). */
  skill: number;
}

export interface CalibratedOutlook {
  version: 'astraeus-v2';
  method: string;
  truth: string;
  trainingDates: { start: string; end: string };
  models: string[];
  days: OutlookDay[];
  heldOut: OutlookHeldOut[];
  notes: string[];
}

interface ModelRef { apiId: string; name: string }

const VARS: Array<{ id: OutlookVariable; hourly: string; agg: 'mean' | 'max' | 'sum'; eraDaily: string; fcDaily: string; kind: 'temperature' | 'precipitation'; threshold?: number }> = [
  { id: 'tmean', hourly: 'temperature_2m', agg: 'mean', eraDaily: 'temperature_2m_mean', fcDaily: 'temperature_2m_mean', kind: 'temperature' },
  { id: 'tmax', hourly: 'temperature_2m', agg: 'max', eraDaily: 'temperature_2m_max', fcDaily: 'temperature_2m_max', kind: 'temperature', threshold: 32 },
  { id: 'precip', hourly: 'precipitation', agg: 'sum', eraDaily: 'precipitation_sum', fcDaily: 'precipitation_sum', kind: 'precipitation', threshold: 1 },
];

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Hourly → UTC daily aggregate; all 24 hours are required, exactly as in the benchmark. */
export function hourlyAggregate(times: string[] | undefined, values: Array<number | null> | undefined, mode: 'mean' | 'max' | 'sum'): Map<string, number> {
  const groups = new Map<string, number[]>();
  (times ?? []).forEach((t, i) => {
    const v = values?.[i];
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    const d = t.slice(0, 10);
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(Number(v));
  });
  const out = new Map<string, number>();
  for (const [d, xs] of groups) {
    if (xs.length < 24) continue;
    out.set(d, mode === 'sum' ? xs.reduce((a, b) => a + b, 0) : mode === 'max' ? Math.max(...xs) : avg(xs));
  }
  return out;
}

/** Leads fetched live (previous_dayN); forecast day i (0 = today) is calibrated with lead max(1, i). */
export const OUTLOOK_LEADS = [1, 2, 3, 4, 5, 6];
export const trainingLeadFor = (dayIndex: number) => Math.min(6, Math.max(1, dayIndex));
/** Same membership rule as the benchmark, and a minimum training size well above the parameter count. */
const MIN_AVAILABILITY = 0.9;
const MIN_TRAINING_ROWS = 60;

function areal(values: Array<number | undefined>): number | null {
  return values.every((v) => v !== undefined && Number.isFinite(v)) && values.length ? avg(values as number[]) : null;
}

export function buildCalibratedOutlook(input: {
  models: ModelRef[];
  usable: boolean[];
  fcLocs: any[];
  prevLocs: any[];
  eraLocs: any[];
  nextDates: string[];
  verifyDates: string[];
}): CalibratedOutlook | null {
  const { models, usable, fcLocs, prevLocs, eraLocs, nextDates, verifyDates } = input;
  if (!fcLocs.length || !prevLocs.length || !eraLocs.length || prevLocs.length !== fcLocs.length || eraLocs.length !== fcLocs.length) return null;
  const live = models.map((m, i) => ({ ...m, i })).filter((m) => usable[m.i]);
  if (live.length < 2) return null;

  // ERA5 areal truth per variable/date
  const truth = new Map<OutlookVariable, Map<string, number>>();
  for (const v of VARS) {
    const map = new Map<string, number>();
    for (const d of verifyDates) {
      const val = areal(eraLocs.map((loc) => {
        const k = loc?.daily?.time?.indexOf(d) ?? -1;
        const x = k >= 0 ? loc.daily[v.eraDaily]?.[k] : undefined;
        return x === null ? undefined : x;
      }));
      if (val !== null) map.set(d, val);
    }
    truth.set(v.id, map);
  }

  // Previous-run areal forecasts: [var][lead][model] → date → value
  const prev = (v: (typeof VARS)[number], lead: number, apiId: string) => {
    const perPoint = prevLocs.map((loc) => hourlyAggregate(loc?.hourly?.time, loc?.hourly?.[`${v.hourly}_previous_day${lead}_${apiId}`], v.agg));
    const out = new Map<string, number>();
    for (const d of verifyDates) {
      const val = areal(perPoint.map((p) => p.get(d)));
      if (val !== null) out.set(d, val);
    }
    return out;
  };

  // Today's run, areal per model/variable/day
  const current = (v: (typeof VARS)[number], apiId: string, date: string) =>
    areal(fcLocs.map((loc) => {
      const k = loc?.daily?.time?.indexOf(date) ?? -1;
      const x = k >= 0 ? loc.daily[`${v.fcDaily}_${apiId}`]?.[k] : undefined;
      return x === null ? undefined : x;
    }));

  const days: OutlookDay[] = nextDates.map((date, i) => ({ date, trainingLead: trainingLeadFor(i) }));
  const heldOut: OutlookHeldOut[] = [];
  const usedModels = new Set<string>();
  let trainStart = '';
  let trainEnd = '';

  for (const v of VARS) {
    const t = truth.get(v.id)!;
    for (const lead of OUTLOOK_LEADS) {
      const dayIdx = days.map((d, i) => (d.trainingLead === lead ? i : -1)).filter((i) => i >= 0);
      if (!dayIdx.length) continue;
      const series = live.map((m) => ({ m, s: prev(v, lead, m.apiId) }));
      // members with training history AND a value for every day this lead serves
      const truthDays = verifyDates.filter((d) => t.has(d));
      const members = series.filter(({ m, s }) => truthDays.length > 0 && truthDays.filter((d) => s.has(d)).length >= MIN_AVAILABILITY * truthDays.length && dayIdx.every((i) => current(v, m.apiId, days[i].date) !== null));
      if (members.length < 2) continue;
      const rows: Array<TrainingRow & { date: string }> = [];
      for (const d of verifyDates) {
        const y = t.get(d);
        if (y === undefined) continue;
        const f = members.map(({ s }) => s.get(d));
        if (f.every((x) => x !== undefined)) rows.push({ date: d, f: f as number[], y });
      }
      rows.sort((a, b) => a.date.localeCompare(b.date));
      if (rows.length) {
        trainStart = !trainStart || rows[0].date < trainStart ? rows[0].date : trainStart;
        trainEnd = rows[rows.length - 1].date > trainEnd ? rows[rows.length - 1].date : trainEnd;
      }
      const fit = (r: TrainingRow[]) => fitV2(r, v.kind);

      // honest local check: older half → newer half
      if (rows.length >= 20) {
        const cut = Math.floor(rows.length / 2);
        const model = fit(rows.slice(0, cut));
        const test = rows.slice(cut);
        if (model) {
          const crpsRaw = avg(test.map((r) => crpsEnsemble(r.f, r.y)));
          const crpsCal = avg(test.map((r) => crpsOf(model(r.f), r.y)));
          heldOut.push({ variable: v.id, lead, nTrain: cut, nTest: test.length, crpsRaw: r2(crpsRaw), crpsCalibrated: r2(crpsCal), skill: r2(1 - crpsCal / Math.max(1e-9, crpsRaw)) });
        }
      }

      const model = rows.length >= MIN_TRAINING_ROWS ? fit(rows) : null;
      members.forEach(({ m }) => usedModels.add(m.name));
      for (const i of dayIdx) {
        const f = members.map(({ m }) => current(v, m.apiId, days[i].date) as number);
        const raw: PredictiveForecast = { kind: 'ensemble', members: f };
        const fc = model ? model(f) : raw;
        const band: OutlookBand = {
          rawMean: r2(avg(f)), rawMin: r2(Math.min(...f)), rawMax: r2(Math.max(...f)),
          mean: r2(pointOf(fc)), p10: r2(quantileOf(fc, 0.1)), p50: r2(quantileOf(fc, 0.5)), p90: r2(quantileOf(fc, 0.9)),
          calibrated: !!model, members: f.length,
          ...(v.threshold !== undefined ? { prob: r2(exceedanceOf(fc, v.threshold)) } : {}),
        };
        days[i][v.id] = band;
      }
    }
  }

  if (!days.some((d) => d.tmean || d.tmax || d.precip)) return null;
  return {
    version: 'astraeus-v2',
    method: 'Astraeus v2: bias-corrected, skill-weighted non-homogeneous Gaussian regression for temperature (minimum-CRPS fit, Gneiting et al. 2005) and a skill-weighted multi-model ensemble for rainfall, trained on up to 90 days of previous-run forecasts verified against ERA5. Chosen on a development period and confirmed on a later held-out period (see the forecast-skill report).',
    truth: 'ERA5 reanalysis (Open-Meteo archive), areal mean of the region’s sample points',
    trainingDates: { start: trainStart, end: trainEnd },
    models: [...usedModels],
    days,
    heldOut,
    notes: [
      'Day 0 and day 1 use lead-1 training; day i (2–6) uses lead-i training, matching each forecast to previous runs of the same age.',
      `Models enter only with ≥ ${Math.round(MIN_AVAILABILITY * 100)} % availability in the training window, and calibration needs ≥ ${MIN_TRAINING_ROWS} complete training days; otherwise the raw spread is shown and labelled uncalibrated.`,
      'Quantiles are marginal for each day; they do not add up to a weekly total distribution.',
      'Calibration is local and recent (≤90 days): it corrects the current regime’s biases but cannot anticipate a regime change.',
      'Where a calibration model could not be fitted (e.g. a bone-dry training window), the raw model spread is shown and labelled uncalibrated.',
    ],
  };
}
