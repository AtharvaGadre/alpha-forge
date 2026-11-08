// Live smoke test: runs the full predict → consequences → explain → verify pipeline
// against the real public APIs for a few questions and prints the key numbers.
// Usage: npx tsx scripts/live-smoke.ts ["your question" ...]
import { runLiveAtmospherePipeline } from '../src/engine/liveAtmospherePipeline.ts';

const queries = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'What happens if Brazilian rainfall forecasts change for coffee?',
      'How will the weather in Texas affect power demand next week?',
      'Hey ARGON, what is the weather outlook for Nairobi?',
    ];

for (const query of queries) {
  const t0 = Date.now();
  try {
    const r = await runLiveAtmospherePipeline({ query });
    const v = r.verification;
    console.log(`\n=== ${query}  (${Date.now() - t0} ms)`);
    console.log(`target: ${r.target.label} [${r.target.resolution}] points=${r.target.points.length}`);
    console.log(`fresh models: ${r.modelInputs.map((m) => `${m.modelName}=${m.predictedPrecipitationMm}mm w${m.weight}`).join(' | ')}`);
    console.log(`stale: ${r.provenance.filter((p) => !p.gate.accepted).map((p) => `${p.name} (${p.gate.forecastAgeHours}h)`).join(', ') || 'none'}`);
    console.log(`ensemble: ${r.ensemble.ensemblePrecipitationMm} mm PI ${r.ensemble.calibrated90PctIntervalMm} members ECMWF ${r.ensembleMembers.ecmwfMembers} GEFS ${r.ensembleMembers.gefsMembers}`);
    console.log(`signals: ${r.signals.map((s) => `${s.id} ${s.value}/${s.normal} z=${s.zScore}`).join('; ')}`);
    if (v) console.log(`verification: n=${v.nTrain}/${v.nTest} k=${v.calibrationInflation} CRPS skill ${v.skillWeighted.crps} vs equal ${v.equalWeight.crps} cov ${v.skillWeighted.predictionIntervalCoverage90Pct}% BSS ${v.skillWeighted.brierSkillScore} → ${v.verdict}`);
    else console.log('verification: none');
    for (const c of r.consequences) console.log(`  ${c.exposure.symbol}: ${c.hypothesisDirection} ${c.confidence} | obs ${c.observedMove?.return5dPct ?? 'n/a'}% | hist ${c.historical ? `${c.historical.sameMonthR}/${c.historical.sameMonthP} ${c.historical.verdict}` : 'n/a'}`);
    console.log(`fetches: ${r.dataLog.filter((d) => d.ok).length} ok / ${r.dataLog.filter((d) => !d.ok).length} failed ${r.dataLog.filter((d) => !d.ok).map((d) => d.source + ': ' + d.note).join('; ')}`);
    console.log(`reconciled: ${r.reproducibility.reconciliationPassed} sha ${r.reproducibility.inputsSha256.slice(0, 12)}`);
    console.log(`basic: ${r.briefingBasic}`);
  } catch (err) {
    console.log(`\n=== ${query}  FAILED: ${(err as Error).message}`);
  }
}
