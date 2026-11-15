import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMODITIES,buildCommodityForecast,commodityTarget} from './commodityForecastEngine';
import {COMMODITY_RESEARCH,papersFor,scholarSearchUrl,teachingEquilibrium} from './commodityResearch';
import {COMMODITY_PAPERS} from './commodityPapers';
import {normalizeCrossref,plainAbstract} from './paperDiscovery';
import type {LiveAtmosphereInvestigation} from './liveAtmospherePipeline';

test('Expanded coverage preserves every commodity, unique regions and explicit exposure context',()=>{
  assert.equal(COMMODITIES.length,28);assert.ok(COMMODITIES.reduce((n,c)=>n+c.regions.length,0)>160);
  const countries=new Set<string>();
  for(const c of COMMODITIES){assert.ok(c.regions.length>=4,c.id);assert.equal(new Set(c.regions.map(r=>r.id)).size,c.regions.length);
    for(const r of c.regions){countries.add(r.country);assert.ok(Math.abs(r.lat)<=90&&Math.abs(r.lng)<=180);assert.ok(r.role);assert.match(r.source!.url,/^https:\/\//);assert.ok(r.coordinateNote);}}
  assert.ok(countries.size>=30);
});
test('Every commodity has a traceable paper set, distinct channel explanations and evidence boundaries',()=>{
  assert.equal(COMMODITY_RESEARCH.length,28);assert.equal(COMMODITY_PAPERS.length,20);
  const ids=new Set(COMMODITY_PAPERS.map(p=>p.id));assert.equal(ids.size,20);
  for(const c of COMMODITIES){const p=COMMODITY_RESEARCH.find(p=>p.commodityId===c.id)!;assert.ok(p);assert.ok(p.production.length>30&&p.priceLink.length>30&&p.evidenceGap.length>30);assert.ok(p.paperIds.every(id=>ids.has(id)));assert.ok(papersFor(c.id).length>=2);}
  for(const p of COMMODITY_PAPERS){assert.match(p.url,/^https:\/\//);assert.ok(p.summary.length>50&&p.limitation.length>30);assert.ok(p.year>=1984&&p.year<=2026);}
});
test('Export locations use logistics rules, not crop-yield rules or borrowed climate studies',()=>{
  const c=COMMODITIES.find(c=>c.id==='corn')!,r=c.regions.find(r=>r.role==='EXPORT')!;
  const live={generatedAtUtc:'2026-07-01T00:00:00Z',signals:[{id:'PRECIP_NEXT7',value:1,normal:10,anomaly:-9,zScore:-2,unit:'mm'}],modelForecasts:[],climatology:{years:10},verification:null,reproducibility:{inputsSha256:'test'},consequences:[],dataLog:[],windows:{forecastLabel:'Next seven days'},target:commodityTarget(c,r),provenance:[]} as unknown as LiveAtmosphereInvestigation;
  const result=buildCommodityForecast(c,r,live);assert.equal(result.drivers.length,1);assert.equal(result.drivers[0].label,'Physical disruption');assert.equal(result.status,'NO_MATERIAL_SIGNAL');assert.ok(result.limitations.some(l=>l.includes('EXPORT')));
});
test('Teaching equilibrium satisfies both equations and responds monotonically to buffering and elasticities',()=>{
  assert.equal(teachingEquilibrium(0,0,.2,.3).priceRatio,1);assert.equal(teachingEquilibrium(20,100,.2,.3).priceRatio,1);
  const r=teachingEquilibrium(10,30,.25,.35);assert.ok(Math.abs((1-r.effectiveLoss)*r.priceRatio**.25-r.quantityRatio)<1e-12);
  assert.ok(teachingEquilibrium(10,80,.25,.35).priceRatio<r.priceRatio);assert.ok(teachingEquilibrium(10,30,.8,.8).priceRatio<r.priceRatio);
  for(const x of [NaN,-1,31])assert.throws(()=>teachingEquilibrium(x,0,.2,.3));assert.throws(()=>teachingEquilibrium(10,101,.2,.3));
});
test('Paper discovery never invents abstracts, accepts unsafe links or duplicates DOI records',()=>{
  const paper={DOI:'10.1234/example',title:['Heat & crops'],author:[{given:'A',family:'B'}],published:{'date-parts':[[2020]]}};
  const result=normalizeCrossref([paper,paper,{DOI:'javascript:alert(1)',title:['Bad']}]);assert.equal(result.length,1);assert.equal(result[0].abstractExcerpt,null);assert.match(result[0].summaryBasis,/unavailable/);assert.ok(result[0].url.startsWith('https://doi.org/'));
  assert.equal(plainAbstract(null),null);assert.equal(plainAbstract('<jats:p>Some &amp; evidence</jats:p>'),'Some & evidence');
  assert.ok(plainAbstract(Array(100).fill('word').join(' '))!.split(' ').length<=55);
  assert.ok(scholarSearchUrl('coffee rain & yield').includes('coffee%20rain%20%26%20yield'));
});
