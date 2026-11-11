import { COMMODITIES, type CommodityForecast } from './commodityForecastEngine';

export const TRANSMISSION_VERSION = 'commodity-transmission-v1';
export type Measure = 'PRICE' | 'INPUT_COST' | 'DEMAND' | 'MARGIN' | 'CONTEXT';
export type Direction = 'UP' | 'DOWN';
export interface TransmissionNode { id: string; name: string; commodity: boolean }
export interface TransmissionLink {
  id: string; from: string; to: string; sourceMeasure: Measure; targetMeasure: Measure;
  polarity: 1 | -1 | 0; channel: string; mechanism: string; lag: string; condition: string;
  source: { title: string; url: string }; evidence: 'MECHANISM_ONLY';
}
const SOURCES = {
  industry: { title: 'EIA · Energy use in industry', url: 'https://www.eia.gov/energyexplained/use-of-energy/industry.php' },
  power: { title: 'EIA · Natural gas use in power generation', url: 'https://www.eia.gov/energyexplained/natural-gas/use-of-natural-gas.php' },
  transport: { title: 'EIA · Energy use for transportation', url: 'https://www.eia.gov/energyexplained/use-of-energy/transportation.php' },
  gas: { title: 'EIA · Natural gas and chemical feedstocks', url: 'https://www.eia.gov/todayinenergy/detail.php?id=21432' },
  farm: { title: 'USDA ERS · Commodity costs and returns', url: 'https://www.ers.usda.gov/data-products/commodity-costs-and-returns' },
  feed: { title: 'USDA ERS · Corn and other feed grains', url: 'https://www.ers.usda.gov/topics/crops/corn-and-other-feed-grains' },
  crush: { title: 'USDA ERS · Soybean meal and oil processing', url: 'https://www.ers.usda.gov/data-products/charts-of-note/112861' },
  oil: { title: 'EIA · Factors affecting gasoline prices', url: 'https://www.eia.gov/energyexplained/gasoline/factors-affecting-gasoline-prices.php' },
  sugar: { title: 'International Sugar Organization · Market outlook', url: 'https://isosugar.org/publication/460/quarterly-market-outlook---august-2026' },
};
export const TRANSMISSION_NODES: TransmissionNode[] = [
  ...COMMODITIES.map(c => ({ id: c.id, name: c.name, commodity: true })),
  { id: 'nitrogen', name: 'Nitrogen fertilizer', commodity: false },
  { id: 'freight', name: 'Freight & transport', commodity: false },
  { id: 'ethanol', name: 'Ethanol production', commodity: false },
  { id: 'power', name: 'Power-intensive production', commodity: false },
];
const link = (from: string, to: string, channel: string, mechanism: string, targetMeasure: Measure, source: keyof typeof SOURCES, options: Partial<TransmissionLink> = {}): TransmissionLink => ({
  id: `${from}:${to}:${channel}`, from, to, channel, mechanism, sourceMeasure: 'PRICE', targetMeasure, polarity: 1,
  lag: 'Days to months; regime dependent', condition: 'Requires local exposure and pass-through; inventories, contracts and substitution can offset the effect.', source: SOURCES[source], evidence: 'MECHANISM_ONLY', ...options,
});
/** Explicit economic hypotheses, not fitted elasticities or empirical correlation estimates. */
export const TRANSMISSION_LINKS: TransmissionLink[] = [
  link('natural-gas', 'nitrogen', 'Fertilizer feedstock', 'Gas is a feedstock and energy input to ammonia production. Higher gas prices can raise nitrogen production costs.', 'INPUT_COST', 'gas'),
  ...['corn','wheat','rice','cotton','sugar'].map(id => link('nitrogen', id, 'Fertilizer costs', 'Higher nitrogen costs can raise crop production costs; this does not mechanically determine the crop selling price.', 'INPUT_COST', 'farm', { sourceMeasure: 'INPUT_COST', lag: 'Next input purchase / planting cycle' })),
  link('crude-oil', 'gasoline', 'Refinery feedstock', 'Crude is the main refinery input. Higher crude costs can put upward pressure on gasoline prices, conditional on refinery margins.', 'PRICE', 'oil'),
  link('crude-oil', 'heating-oil', 'Distillate feedstock', 'Crude feedstock costs can pass into distillate prices; refinery yields and product inventories matter.', 'PRICE', 'oil'),
  link('brent', 'gasoline', 'Global feedstock', 'Brent-linked feedstock costs can affect product pricing in exposed refining markets.', 'PRICE', 'oil'),
  link('brent', 'heating-oil', 'Global distillate costs', 'International crude costs can affect distillate prices, subject to regional basis and refinery capacity.', 'PRICE', 'oil'),
  link('heating-oil', 'freight', 'Diesel cost proxy', 'The distillate contract is a proxy for diesel input costs in road and marine transport; basis and hedges can break pass-through.', 'INPUT_COST', 'oil'),
  ...COMMODITIES.filter(c => !['Energy'].includes(c.sector)).map(c => link('freight', c.id, 'Delivered costs', 'More expensive transport can raise delivered costs. Exposure depends on distance, mode, fuel contracts and regional logistics.', 'INPUT_COST', 'transport', { sourceMeasure: 'INPUT_COST', lag: 'Freight repricing / delivery cycle' })),
  ...['cattle','hogs'].flatMap(id => [
    link('corn', id, 'Feed costs', 'Corn is a feed input. Higher corn prices can increase feed costs and compress producer margins; livestock selling-price direction is not implied.', 'INPUT_COST', 'feed'),
    link('soy-meal', id, 'Protein feed', 'Soybean meal supplies feed protein. Higher meal prices can increase feed-ration costs, subject to substitution.', 'INPUT_COST', 'crush'),
  ]),
  link('corn', 'ethanol', 'Biofuel margins', 'Higher corn feedstock prices can compress ethanol production margins when output prices are unchanged.', 'MARGIN', 'feed', { polarity: -1 }),
  link('gasoline', 'ethanol', 'Fuel substitution', 'More expensive gasoline may improve ethanol competitiveness; blending mandates and fuel specifications constrain substitution.', 'DEMAND', 'feed'),
  link('crude-oil', 'sugar', 'Cane allocation', 'If energy prices improve ethanol economics, flexible Brazilian mills may divert cane from sugar to ethanol, potentially tightening sugar supply.', 'PRICE', 'sugar', { lag: 'Weeks to a crushing season', condition: 'Conditional on ethanol parity, flexible mill capacity, fuel policy and local sugar/ethanol margins.' }),
  link('soybeans', 'soy-oil', 'Crush input', 'More expensive beans increase crush input costs, conditional on extraction yields and meal co-product revenue.', 'INPUT_COST', 'crush'),
  link('soybeans', 'soy-meal', 'Crush input', 'Soymeal and oil are joint outputs. Bean input prices affect crush economics, not a fixed independent price response for each output.', 'INPUT_COST', 'crush'),
  link('soy-oil', 'soy-meal', 'Joint production', 'Oil and meal share crush economics. Stronger oil demand can change crush volumes and meal supply; the net price sign is not fixed.', 'CONTEXT', 'crush', { polarity: 0 }),
  link('soy-meal', 'soybeans', 'Crush economics', 'Meal revenue contributes to bean-processing demand. Direction depends on oil revenue, margins, capacity and inventories.', 'CONTEXT', 'crush', { polarity: 0 }),
  link('corn', 'wheat', 'Feed substitution', 'When corn becomes relatively expensive, feasible feed rations may switch toward wheat, supporting wheat feed demand.', 'DEMAND', 'feed'),
  link('wheat', 'corn', 'Feed substitution', 'When wheat becomes relatively expensive, feasible feed rations may switch toward corn. Absolute prices alone do not establish substitution.', 'DEMAND', 'feed'),
  link('natural-gas', 'power', 'Marginal generation', 'Higher gas prices may raise costs where gas-fired generation sets the marginal electricity price.', 'INPUT_COST', 'power'),
  ...['aluminium','copper','nickel','silver','platinum','palladium'].map(id => link('power', id, 'Energy-intensive processing', 'Higher local electricity costs can raise processing or smelting costs. Fuel mix, power contracts and curtailments determine actual exposure.', 'INPUT_COST', 'industry', { sourceMeasure: 'INPUT_COST' })),
];
export interface TransmissionPath {
  nodes: string[]; links: TransmissionLink[]; direction: Direction; measure: Measure;
  target: string; assumptions: string[];
}
export function linksForCommodity(id: string) {
  return { incoming: TRANSMISSION_LINKS.filter(l => l.to === id), outgoing: TRANSMISSION_LINKS.filter(l => l.from === id) };
}
/** Preserve route/measure identity: a cost shock cannot become a commodity price shock on the next hop. */
export function traceTransmission(sourceId: string, direction: Direction, maxHops = 2): TransmissionPath[] {
  if (!TRANSMISSION_NODES.some(n => n.id === sourceId)) throw new Error('Unknown transmission source.');
  if (direction !== 'UP' && direction !== 'DOWN') throw new Error('Choose an up or down scenario.');
  if (!Number.isInteger(maxHops) || maxHops < 1 || maxHops > 3) throw new Error('Use one to three transmission steps.');
  const paths: TransmissionPath[] = [];
  const visit = (nodes: string[], links: TransmissionLink[], dir: Direction, measure: Measure) => {
    if (links.length >= maxHops) return;
    for (const edge of TRANSMISSION_LINKS.filter(e => e.from === nodes.at(-1) && e.sourceMeasure === measure && e.polarity !== 0)) {
      if (nodes.includes(edge.to)) continue;
      const nextDir = edge.polarity === -1 ? dir === 'UP' ? 'DOWN' : 'UP' : dir;
      const path: TransmissionPath = { nodes: [...nodes, edge.to], links: [...links, edge], direction: nextDir, measure: edge.targetMeasure, target: edge.to, assumptions: [...links, edge].map(l => l.condition) };
      paths.push(path); visit(path.nodes, path.links, nextDir, edge.targetMeasure);
    }
  };
  visit([sourceId], [], direction, 'PRICE');
  return paths;
}
export interface ForecastRevision { comparable: boolean; reason: string; changes: { label: string; fromZ: number; toZ: number; deltaZ: number }[]; pressureChanged: boolean }
export function compareForecasts(previous: CommodityForecast, current: CommodityForecast): ForecastRevision {
  if (previous.commodityId !== current.commodityId || previous.regionId !== current.regionId) return { comparable: false, reason: 'Choose the same commodity and region.', changes: [], pressureChanged: false };
  if (previous.evidence.engineVersion !== current.evidence.engineVersion) return { comparable: false, reason: 'Forecast rule version changed; compare weather snapshots under the same rule set.', changes: [], pressureChanged: false };
  if (previous.evidence.inputHash === current.evidence.inputHash) return { comparable: false, reason: 'Same source snapshot; cached responses are not new forecast revisions.', changes: [], pressureChanged: false };
  return { comparable: true, reason: 'Change in standardized anomaly between retrieved snapshots; rolling seven-day windows can differ.',
    changes: current.drivers.flatMap(d => { const p = previous.drivers.find(x => x.label === d.label && x.signalId === d.signalId); return p?.zScore != null && d.zScore != null && Number.isFinite(p.zScore) && Number.isFinite(d.zScore) ? [{ label: d.label, fromZ: p.zScore, toZ: d.zScore, deltaZ: d.zScore - p.zScore }] : []; }), pressureChanged: previous.status !== current.status };
}
export function directionFromForecast(result?: CommodityForecast): Direction | null {
  return result?.status === 'UPWARD_PRESSURE' ? 'UP' : result?.status === 'DOWNWARD_PRESSURE' ? 'DOWN' : null;
}
export function appendForecastSnapshot(history: CommodityForecast[], result: CommodityForecast): CommodityForecast[] {
  const last = history.at(-1);
  if (last?.evidence.inputHash === result.evidence.inputHash && last?.evidence.engineVersion === result.evidence.engineVersion) return history;
  return [...history, result].slice(-12);
}
