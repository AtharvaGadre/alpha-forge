import React,{useEffect,useRef,useState} from 'react';
import {CircleHelp,Sun,Moon,X,ArrowRight} from 'lucide-react';
import type {WorkspaceView} from '../engine/workspaceNavigation';
const OPEN_GUIDE='astraeus-open-guide';
export function AppearanceControls(){
  const [theme,setTheme]=useState<'light'|'dark'>(()=>typeof document!=='undefined'&&document.documentElement.dataset.theme==='light'?'light':'dark');
  const toggle=()=>{const next=theme==='dark'?'light':'dark';setTheme(next);document.documentElement.dataset.theme=next;document.documentElement.style.colorScheme=next;try{localStorage.setItem('astraeus-theme',next);}catch{}};
  return <div className="as-tools"><button onClick={()=>window.dispatchEvent(new Event(OPEN_GUIDE))}><CircleHelp size={15}/> Quick tour</button><button onClick={toggle} aria-label={`Switch to ${theme==='dark'?'light':'dark'} theme`}>{theme==='dark'?<Sun size={15}/>:<Moon size={15}/>}<span>{theme==='dark'?'Light':'Dark'}</span></button></div>;
}
const steps:[string,string,WorkspaceView,string][]=[
  ['Welcome to Astraeus','Follow weather through the real economy. Start with a place, inspect the forecast, then test the mechanism linking it to a commodity.','globe','Explore the globe'],
  ['Read the weather layers','Blue shading shows forecast precipitation for the preceding hour. Flowing teal trails show wind direction; their animation speed is illustrative. Play blends forecast snapshots continuously. The 20° global grid gives broad context, not local rainfall precision.','globe','Open the weather map'],
  ['Choose a commodity and a region','Select a marker or search for a commodity. Run forecast compares regional weather models with climatology. An anomaly means unusual conditions relative to normal; it does not directly measure a future price change.','markets','Explore commodities'],
  ['Understand the transmission','Heat can stress a crop, rain can interrupt transport, and cold can increase gas demand. Open Weather & evidence to explore causal chains, scenario sliders and linked research papers. Timing, inventories and policy can offset the effect.','research','Explore mechanisms'],
  ['Check before trusting','Forecast lab exposes model agreement and available weather verification. Source timestamps, missing inputs and hashes stay attached to each analysis. Conditional price pressure is a research hypothesis, not a validated price prediction.','advanced','Open forecast lab'],
];
export function AstraeusGuide({onNavigate}:{onNavigate:(view:WorkspaceView)=>void}){
  const [open,setOpen]=useState(false),[step,setStep]=useState(0);const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{try{if(localStorage.getItem('astraeus-tour-v1')!=='done')setOpen(true);}catch{}const show=()=>{setStep(0);setOpen(true);};window.addEventListener(OPEN_GUIDE,show);return()=>window.removeEventListener(OPEN_GUIDE,show);},[]);
  useEffect(()=>{const el=dialog.current;if(open&&!el?.open)el?.showModal();else if(!open&&el?.open)el.close();},[open]);
  const close=()=>{setOpen(false);try{localStorage.setItem('astraeus-tour-v1','done');}catch{}};
  const [title,text,view,action]=steps[step];
  return <dialog ref={dialog} className="as-tour" aria-labelledby="as-tour-title" onCancel={close} onClick={e=>{if(e.target===e.currentTarget)close();}}><button className="as-tour-close" aria-label="Close tutorial" onClick={close}><X size={19}/></button><div className="af-eyebrow">ASTRAEUS / A FIELD GUIDE</div><p className="as-tour-number">0{step+1} <span>/ 0{steps.length}</span></p><h2 id="as-tour-title">{title}</h2><p>{text}</p><div className="as-tour-progress" aria-label={`Step ${step+1} of ${steps.length}`}>{steps.map((s,i)=><button key={s[0]} aria-label={`Go to step ${i+1}`} aria-current={i===step?'step':undefined} onClick={()=>setStep(i)}/>)}</div><div className="as-tour-actions"><button onClick={()=>{onNavigate(view);close();}}>{action} <ArrowRight size={14}/></button><button className="af-primary" onClick={()=>step===steps.length-1?close():setStep(step+1)}>{step===steps.length-1?'Start exploring':'Next'}</button></div><small>Replay this guide anytime from Quick tour.</small></dialog>;
}
