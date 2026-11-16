/** Contextual visual semantics, not universal claims about emotion or investment outcomes. */
/** Map marker colours. Selection uses the brand gold and unselected regions a warm neutral; the pressure
 *  colours (up/down/mixed/neutral) are unchanged. */
export const SEMANTIC_COLORS={selection:'#DFC484',information:'#CFC8B8',up:'#F59E0B',down:'#60A5FA',mixed:'#C4B5FD',neutral:'#94A3B8',error:'#B42318'};
export function pressureColor(status?:string){return status==='UPWARD_PRESSURE'?SEMANTIC_COLORS.up:status==='DOWNWARD_PRESSURE'?SEMANTIC_COLORS.down:status==='MIXED'?SEMANTIC_COLORS.mixed:SEMANTIC_COLORS.neutral;}
