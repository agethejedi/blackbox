import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar} from 'recharts';
import {Upload, Search, Brain, HeartPulse, MessageSquareText, ShieldCheck, Activity, Sparkles} from 'lucide-react';
import './style.css';

type Analysis = {
  conversation_id: string;
  summary: string;
  quality_score: number;
  escalation_score: number;
  validation_score: number;
  collaboration_score: number;
  topic_drift_score: number;
  resolution_probability: number;
  outcome: 'resolved'|'escalated'|'unresolved'|'deferred';
  topics: string[];
  themes: string[];
  horsemen: { relationship: Horsemen; speakers: Record<string,Horsemen>; evidence: any[] };
  repair: { relationship: Repair; speakers: Record<string,Repair>; evidence: any[] };
  loops: string[];
  unanswered_questions: string[];
  coaching: string[];
};
type Horsemen = { criticism:number; defensiveness:number; contempt:number; stonewalling:number };
type Repair = { validation:number; accountability:number; appreciation:number; compromise:number; reconnection:number; successful_repairs:number; failed_repairs:number };
type Conv = {id:string; title:string; created_at:string; outcome:string; quality_score:number; themes:string; topics:string};

const API = import.meta.env.VITE_API_BASE || 'http://localhost:8787';
const nav = ['Dashboard','Conversations','Conversation Quality','Four Horsemen','Repair Index','Topic Drift','Loops','Smart History','Coach Mode','Reports'];

function scoreColor(n:number){return n>=70?'good':n>=40?'warn':'bad'}
function Card({title,children,icon}:{title:string,children:React.ReactNode,icon?:React.ReactNode}){return <section className="card"><div className="card-title">{icon}{title}</div>{children}</section>}
function Metric({label,value}:{label:string,value:number}){return <div className="metric"><span>{label}</span><b className={scoreColor(value)}>{value}</b></div>}

function App(){
 const [active,setActive]=useState('Dashboard');
 const [raw,setRaw]=useState('');
 const [title,setTitle]=useState('New conversation');
 const [analysis,setAnalysis]=useState<Analysis|null>(null);
 const [history,setHistory]=useState<Conv[]>([]);
 const [query,setQuery]=useState('');
 const [draft,setDraft]=useState('');
 const [coach,setCoach]=useState<any|null>(null);
 const [loading,setLoading]=useState(false);
 useEffect(()=>{loadHistory()},[]);
 async function loadHistory(q=''){const r=await fetch(`${API}/api/conversations${q?'?q='+encodeURIComponent(q):''}`); if(r.ok) setHistory(await r.json());}
 async function analyze(){setLoading(true); try{const r=await fetch(`${API}/api/analyze`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,raw_text:raw,source_type:'pasted_text'})}); const data=await r.json(); setAnalysis(data); await loadHistory(); setActive('Dashboard')} finally{setLoading(false)}}
 async function coachDraft(){setLoading(true); try{const r=await fetch(`${API}/api/coach`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({draft})}); setCoach(await r.json()); setActive('Coach Mode')} finally{setLoading(false)}}
 async function upload(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0]; if(!f) return; const fd=new FormData(); fd.append('file',f); setLoading(true); try{const r=await fetch(`${API}/api/upload`,{method:'POST',body:fd}); const data=await r.json(); setRaw(data.extracted_text || data.note || 'Upload stored. Run extraction/analysis from Worker response.'); setTitle(f.name)} finally{setLoading(false)}}
 const trend = useMemo(()=> history.slice(0,8).reverse().map((h,i)=>({month:`#${i+1}`,quality:h.quality_score||0})),[history]);
 const horseData = analysis ? [{name:'Criticism',value:analysis.horsemen.relationship.criticism},{name:'Defensiveness',value:analysis.horsemen.relationship.defensiveness},{name:'Contempt',value:analysis.horsemen.relationship.contempt},{name:'Stonewalling',value:analysis.horsemen.relationship.stonewalling}] : [];
 return <div className="app"><aside><div className="brand"><div className="orb"/>Project Black Box</div>{nav.map(n=><button className={active===n?'active':''} onClick={()=>setActive(n)} key={n}>{n}</button>)}</aside><main><header><h1>{active}</h1><div className="pill">Jarvis-callable relationship intelligence</div></header>{loading&&<div className="loading">Processing real input…</div>}
 {active==='Dashboard'&&<div className="grid"><Card title="Conversation Intake" icon={<Upload/>}><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title"/><textarea value={raw} onChange={e=>setRaw(e.target.value)} placeholder="Paste a text thread, email, or transcript…"/><div className="row"><label className="upload">Upload screenshot/file/audio<input type="file" onChange={upload}/></label><button onClick={analyze} disabled={!raw}>Analyze</button></div></Card><Card title="Quality Snapshot" icon={<Activity/>}>{analysis?<><Metric label="Quality" value={analysis.quality_score}/><Metric label="Resolution probability" value={analysis.resolution_probability}/><Metric label="Validation" value={analysis.validation_score}/><Metric label="Topic drift" value={analysis.topic_drift_score}/></>:<p>No analysis yet. Paste or upload a real conversation.</p>}</Card><Card title="Quality Trend" icon={<Sparkles/>}><ResponsiveContainer width="100%" height={220}><LineChart data={trend}><XAxis dataKey="month"/><YAxis domain={[0,100]}/><Tooltip/><Line type="monotone" dataKey="quality" strokeWidth={3}/></LineChart></ResponsiveContainer></Card><Card title="Latest Summary" icon={<MessageSquareText/>}><p>{analysis?.summary||'Run an analysis to see summary, risks, topics, and next best actions.'}</p></Card></div>}
 {active==='Four Horsemen'&&<div className="grid"><Card title="Relationship Level"><ResponsiveContainer width="100%" height={280}><RadarChart data={horseData}><PolarGrid/><PolarAngleAxis dataKey="name"/><PolarRadiusAxis angle={30} domain={[0,100]}/><Radar dataKey="value" fillOpacity={0.45}/><Tooltip/></RadarChart></ResponsiveContainer></Card><Card title="Speaker Level">{analysis&&Object.entries(analysis.horsemen.speakers).map(([s,v])=><div key={s} className="speaker"><b>{s}</b><Metric label="Criticism" value={v.criticism}/><Metric label="Defensiveness" value={v.defensiveness}/><Metric label="Contempt" value={v.contempt}/><Metric label="Stonewalling" value={v.stonewalling}/></div>)}</Card><Card title="Evidence Examples"><pre>{JSON.stringify(analysis?.horsemen.evidence||[],null,2)}</pre></Card></div>}
 {active==='Repair Index'&&<div className="grid"><Card title="Repair Relationship Score">{analysis?<><Metric label="Validation" value={analysis.repair.relationship.validation}/><Metric label="Accountability" value={analysis.repair.relationship.accountability}/><Metric label="Appreciation" value={analysis.repair.relationship.appreciation}/><Metric label="Compromise" value={analysis.repair.relationship.compromise}/><Metric label="Reconnection" value={analysis.repair.relationship.reconnection}/></>:null}</Card><Card title="Repair Evidence"><pre>{JSON.stringify(analysis?.repair.evidence||[],null,2)}</pre></Card></div>}
 {active==='Conversations'&&<History history={history}/>} {active==='Smart History'&&<Card title="Search History" icon={<Search/>}><input placeholder="Search keyword, theme, topic…" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={()=>loadHistory(query)}>Search</button><History history={history}/></Card>}
 {active==='Coach Mode'&&<div className="grid"><Card title="Draft Coach" icon={<Brain/>}><textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Paste draft response before sending…"/><button onClick={coachDraft} disabled={!draft}>Coach my draft</button></Card><Card title="Coaching Report" icon={<ShieldCheck/>}><pre>{coach?JSON.stringify(coach,null,2):'Paste a draft to receive risk analysis, what they may hear, and a safer rewrite.'}</pre></Card></div>}
 {['Conversation Quality','Topic Drift','Loops','Reports'].includes(active)&&<Card title={active}>{analysis?<pre>{JSON.stringify(analysis,null,2)}</pre>:<p>Run an analysis first.</p>}</Card>}
 </main></div>
}
function History({history}:{history:Conv[]}){return <div className="history">{history.map(h=><div className="history-item" key={h.id}><b>{h.title}</b><span>{new Date(h.created_at).toLocaleString()} • {h.outcome} • Quality {h.quality_score}</span><small>{h.themes}</small></div>)}</div>}
createRoot(document.getElementById('root')!).render(<App/>);
