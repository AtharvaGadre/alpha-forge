import {scholarSearchUrl} from './commodityResearch';
export interface DiscoveredPaper {title:string;authors:string;year:number|null;url:string;scholarUrl:string;abstractExcerpt:string|null;summaryBasis:string;doi:string}
export function plainAbstract(text:unknown):string|null{
  if(typeof text!=='string')return null;
  const clean=text.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#\d+;/g,' ').replace(/\s+/g,' ').trim();
  if(!clean)return null;
  const words=clean.split(' ');return words.slice(0,55).join(' ')+(words.length>55?'…':'');
}
export function normalizeCrossref(items:any[]):DiscoveredPaper[]{
  const seen=new Set<string>();
  return items.flatMap(p=>{
    if(!p||typeof p!=='object')return [];
    const doi=typeof p.DOI==='string'?p.DOI.trim():'';
    const title=Array.isArray(p.title)&&typeof p.title[0]==='string'?p.title[0]:'';
    if(!/^10\.\d{4,9}\/\S+$/i.test(doi)||!title||seen.has(doi.toLowerCase()))return [];
    seen.add(doi.toLowerCase());
    const year=p.published?.['date-parts']?.[0]?.[0];const abstractExcerpt=plainAbstract(p.abstract);
    return [{title,authors:(Array.isArray(p.author)?p.author:[]).slice(0,4).map((a:any)=>[a.given,a.family].filter(Boolean).join(' ')).join(', '),year:Number.isInteger(year)?year:null,doi,url:'https://doi.org/'+encodeURIComponent(doi),scholarUrl:scholarSearchUrl(title),abstractExcerpt,summaryBasis:abstractExcerpt?'Publisher-deposited abstract excerpt; not a reviewed full-paper summary.':'No abstract supplied by Crossref; summary unavailable.'}];
  }).slice(0,8);
}
