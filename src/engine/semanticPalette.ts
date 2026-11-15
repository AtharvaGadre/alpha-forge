/** Contextual visual semantics, not universal claims about emotion or investment outcomes. */
export const SEMANTIC_COLORS={selection:'#2DD4BF',information:'#087F8C',up:'#F59E0B',down:'#60A5FA',mixed:'#C4B5FD',neutral:'#94A3B8',error:'#B42318'};
export function pressureColor(status?:string){return status==='UPWARD_PRESSURE'?SEMANTIC_COLORS.up:status==='DOWNWARD_PRESSURE'?SEMANTIC_COLORS.down:status==='MIXED'?SEMANTIC_COLORS.mixed:SEMANTIC_COLORS.neutral;}
