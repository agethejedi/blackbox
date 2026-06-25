import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, Brain, FileText, HeartHandshake, MessageSquare, Search, Upload, Zap } from 'lucide-react';
import './styles.css';

type Conversation = { id: string; title: string; source_type: string; created_at: string; message_count?: number };
type Analysis = { id: string; conversation_quality: number; escalation_score: number; validation_score: number; collaboration_score: number; topic_drift_score: number; resolution_probability: number; outcome: string; created_at: string; report_json: string };

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const sampleTrend = [
  { month: 'Jan', quality: 61, criticism: 45, defensiveness: 52, contempt: 18, stonewalling: 35, repair: 42 },
  { month: 'Feb', quality: 58, criticism: 49, defensiveness: 55, contempt: 21, stonewalling: 39, repair: 45 },
  { month: 'Mar', quality: 64, criticism: 41, defensiveness: 48, contempt: 17, stonewalling: 32, repair: 54 },
  { month: 'Apr', quality: 52, criticism: 57, defensiveness: 64, contempt: 26, stonewalling: 50, repair: 39 },
  { month: 'May', quality: 67, criticism: 43, defensiveness: 50, contempt: 15, stonewalling: 34, repair: 61 },
  { month: 'Jun', quality: 72, criticism: 38, defensiveness: 45, contempt: 12, stonewalling: 29, repair: 69 }
];

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <div className="stat"><div className="stat-icon">{icon}</div><div><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div></div>;
}

function App() {
  const [view, setView] = useState('dashboard');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [details, setDetails] = useState<any>(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [coach, setCoach] = useState<any>(null);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adminToken, setAdminToken] = useState('');

  async function load() {
    try { const data = await api('/api/conversations'); setConversations(data.conversations || []); }
    catch (e: any) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function createConversation() {
    setBusy(true); setError('');
    try { const data = await api('/api/conversations', { method: 'POST', body: JSON.stringify({ title: title || 'Imported conversation', text, source_type: 'pasted_text' }) }); setText(''); setTitle(''); await load(); setSelected(data.conversation_id); setView('conversations'); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function openConversation(id: string) {
    setSelected(id); setBusy(true); setError('');
    try { const data = await api(`/api/conversations/${id}`); setDetails(data); setView('conversations'); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function analyze() {
    if (!selected) return;
    setBusy(true); setError('');
    try { await api('/api/analyze', { method: 'POST', body: JSON.stringify({ conversation_id: selected }) }); await openConversation(selected); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function runCoach() {
    setBusy(true); setError(''); setCoach(null);
    try { const data = await api('/api/coach', { method: 'POST', body: JSON.stringify({ draft }) }); setCoach(data.report); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function search() {
    setBusy(true); setError('');
    try { const data = await api(`/api/search?q=${encodeURIComponent(searchQ)}`); setSearchResults(data.results || []); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function initDb() {
    setBusy(true); setError('');
    try { await fetch('/api/admin/init-db', { method: 'POST', headers: { 'X-Admin-Token': adminToken } }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }); await load(); alert('Database initialized.'); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  const latestReport = useMemo(() => {
    const a = details?.analyses?.[0];
    if (!a) return null;
    try { return JSON.parse(a.report_json); } catch { return null; }
  }, [details]);

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="orb"></div><div><b>Project Black Box</b><span>JARVIS communication intelligence</span></div></div>
      {[
        ['dashboard', Activity, 'Dashboard'], ['conversations', MessageSquare, 'Conversations'], ['four', Brain, 'Four Horsemen'], ['repair', HeartHandshake, 'Repair Index'], ['history', Search, 'Smart History'], ['coach', Zap, 'Coach Mode'], ['setup', Upload, 'Setup']
      ].map(([key, Icon, label]: any) => <button key={key} className={view===key?'active':''} onClick={()=>setView(key)}><Icon size={18}/>{label}</button>)}
    </aside>
    <main className="main">
      <header><h1>{viewTitle(view)}</h1><div className="pill">Production prototype · Real OpenAI analysis</div></header>
      {error && <div className="error">{error}</div>}
      {view === 'dashboard' && <section>
        <div className="grid stats"><Stat label="Conversation quality" value="72" icon={<Activity/>}/><Stat label="Repair score" value="69" icon={<HeartHandshake/>}/><Stat label="Topic drift" value="29" icon={<Search/>}/><Stat label="Resolution probability" value="64%" icon={<Zap/>}/></div>
        <div className="card"><h2>Relationship trend</h2><ResponsiveContainer width="100%" height={260}><LineChart data={sampleTrend}><XAxis dataKey="month"/><YAxis/><Tooltip/><Line dataKey="quality" strokeWidth={3}/><Line dataKey="repair" strokeWidth={3}/></LineChart></ResponsiveContainer></div>
      </section>}
      {view === 'conversations' && <section className="split">
        <div className="card"><h2>Import conversation</h2><input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)}/><textarea placeholder="Paste text thread or email here..." value={text} onChange={e=>setText(e.target.value)} /><button disabled={busy || !text} onClick={createConversation}>Create from text</button><h2>Conversations</h2>{conversations.map(c=><div className="row" key={c.id} onClick={()=>openConversation(c.id)}><b>{c.title}</b><span>{c.message_count || 0} messages · {new Date(c.created_at).toLocaleString()}</span></div>)}</div>
        <div className="card wide"><h2>Selected conversation</h2>{details ? <><button onClick={analyze} disabled={busy}>Run analysis</button><div className="messages">{details.messages.map((m:any)=><p key={m.id}><b>{m.speaker}:</b> {m.body}</p>)}</div>{latestReport && <pre>{JSON.stringify(latestReport, null, 2)}</pre>}</> : <p>Select or create a conversation.</p>}</div>
      </section>}
      {view === 'four' && <section><div className="card"><h2>Four Horsemen trends</h2><ResponsiveContainer width="100%" height={300}><LineChart data={sampleTrend}><XAxis dataKey="month"/><YAxis/><Tooltip/><Line dataKey="criticism" strokeWidth={3}/><Line dataKey="defensiveness" strokeWidth={3}/><Line dataKey="contempt" strokeWidth={3}/><Line dataKey="stonewalling" strokeWidth={3}/></LineChart></ResponsiveContainer></div><div className="grid"><div className="card"><h3>Relationship level</h3><p>Tracks criticism, defensiveness, contempt, and stonewalling across conversations.</p></div><div className="card"><h3>Individual level</h3><p>Speaker-level scoring is stored in D1 after each analysis run.</p></div></div></section>}
      {view === 'repair' && <section><div className="card"><h2>Repair Index</h2><ResponsiveContainer width="100%" height={300}><BarChart data={sampleTrend}><XAxis dataKey="month"/><YAxis/><Tooltip/><Bar dataKey="repair" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></div><div className="card"><p>Tracks validation, accountability, appreciation, compromise, reconnection, and successful repair attempts.</p></div></section>}
      {view === 'history' && <section><div className="card"><h2>Smart Conversation History</h2><div className="search"><input placeholder="Search topics, keywords, themes..." value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}/><button onClick={search}>Search</button></div>{searchResults.map((r,i)=><div className="row" key={i}><b>{r.title}</b><span>{r.speaker}: {r.body}</span></div>)}</div></section>}
      {view === 'coach' && <section><div className="card"><h2>Coach Mode</h2><textarea placeholder="Paste a draft response before sending..." value={draft} onChange={e=>setDraft(e.target.value)}/><button disabled={busy || !draft} onClick={runCoach}>Analyze draft</button>{coach && <div className="coach"><h3>Risk score: {coach.risk_score}</h3><p>{coach.summary}</p><h3>Suggested rewrite</h3><p>{coach.suggested_rewrite}</p><h3>What they may hear</h3><ul>{coach.what_they_may_hear?.map((x:string)=><li key={x}>{x}</li>)}</ul></div>}</div></section>}
      {view === 'setup' && <section><div className="card"><h2>No-terminal setup</h2><p>Create Cloudflare Pages, D1, KV, and R2 in the dashboard. Add bindings named DB, BLACKBOX_KV, UPLOADS and secrets OPENAI_API_KEY, ADMIN_INIT_TOKEN. Then initialize the database here.</p><input placeholder="ADMIN_INIT_TOKEN" value={adminToken} onChange={e=>setAdminToken(e.target.value)} /><button onClick={initDb} disabled={!adminToken || busy}>Initialize D1 schema</button><p className="muted">This endpoint creates all D1 tables from the app using your admin token.</p></div></section>}
    </main>
  </div>;
}

function viewTitle(view: string) {
  return ({ dashboard: 'Dashboard', conversations: 'Conversations', four: 'Four Horsemen', repair: 'Repair Index', history: 'Smart History', coach: 'Coach Mode', setup: 'Setup' } as any)[view] || 'Dashboard';
}

createRoot(document.getElementById('root')!).render(<App />);
