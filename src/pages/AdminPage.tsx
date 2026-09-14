import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, LogOut, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import '@/styles/admin.css';

interface AdminPageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

interface DashboardData {
  challenge_count: number;
  submission_count: number;
  open_anomaly_count: number;
  recent_events: { event_type: string; actor_id: string | null; created_at: string; metadata: Record<string, unknown> }[];
}

export function AdminPage({ onNavigate }: AdminPageProps) {
  const { adminUsername, adminLogout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminUsername) return;
    fetch('http://127.0.0.1:8000/api/admin/dashboard/', {
      headers: { 'X-Admin-Token': localStorage.getItem('fairplay_admin_token') ?? '' },
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || 'Administrator access denied');
      setData(body);
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Administrator access denied'));
  }, [adminUsername]);

  return (
    <div className="admin-shell min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <section className="admin-hero relative overflow-hidden rounded-[2rem] min-h-[270px] flex items-end p-7 sm:p-10 text-white shadow-2xl">
          <div className="absolute inset-0 admin-grid opacity-30" />
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-2 text-teal-200 text-xs uppercase tracking-[0.24em] admin-mono mb-4"><Sparkles className="w-4 h-4" /> Operations / FairPlay</div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[0.95]">The merit<br />control room.</h1>
            <p className="mt-5 text-slate-300 max-w-lg">See participation pulse, scoring activity, and platform health at a glance.</p>
          </div>
          <div className="relative z-10 ml-auto hidden sm:flex flex-col items-end gap-3 text-right"><span className="text-xs text-slate-400 uppercase tracking-widest">Authenticated operator</span><strong className="text-lg">{adminUsername}</strong><button className="inline-flex items-center gap-2 text-sm text-teal-200 hover:text-white" onClick={() => { adminLogout(); onNavigate('home'); }}><LogOut className="w-4 h-4" /> Sign out</button></div>
        </section>
        <div className="flex items-center justify-between mt-7 mb-4"><div><p className="admin-mono text-xs uppercase tracking-[0.2em] text-teal-700">Live overview</p><h2 className="text-2xl font-bold text-slate-900">Platform pulse</h2></div><button className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-teal-800 transition-colors" onClick={() => onNavigate('create')}>Post challenge</button></div>
        {error && <p className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {data && <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <MetricTile icon={BarChart3} label="Challenges live" value={data.challenge_count} tone="teal" />
          <MetricTile icon={Activity} label="Proof submissions" value={data.submission_count} tone="blue" />
          <MetricTile icon={ShieldAlert} label="Open anomaly flags" value={data.open_anomaly_count} tone="amber" />
        </div>
        <section className="admin-tile bg-white/90 border border-white rounded-[1.5rem] p-6"><div className="flex items-start justify-between mb-5"><div><p className="admin-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Signal feed</p><h2 className="text-lg font-bold text-slate-900 mt-1">Recent audit events</h2></div><ArrowUpRight className="w-5 h-5 text-teal-600" /></div><div className="space-y-1">{data.recent_events.length ? data.recent_events.map((event, index) => <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0" key={`${event.event_type}-${index}`}><span className="w-2 h-2 rounded-full bg-teal-400 ring-4 ring-teal-50" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-700 truncate">{event.event_type.replace(/_/g, ' ')}</p><p className="text-xs text-slate-400">{event.actor_id ? `actor ${event.actor_id.slice(0, 8)}` : 'system event'}</p></div><time className="text-[11px] text-slate-400 whitespace-nowrap">{new Date(event.created_at).toLocaleDateString()}</time></div>) : <p className="text-sm text-slate-400 py-8 text-center">No audit events yet.</p>}</div></section>
      </>}
      </div>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: number; tone: 'teal' | 'blue' | 'amber' }) {
  const styles = { teal: 'bg-teal-50 text-teal-700 ring-teal-100', blue: 'bg-blue-50 text-blue-700 ring-blue-100', amber: 'bg-amber-50 text-amber-700 ring-amber-100' }[tone];
  return <div className="admin-tile bg-white/90 border border-white rounded-[1.5rem] p-5 flex items-center gap-4"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ring-8 ${styles}`}><Icon className="w-5 h-5" /></div><div><p className="text-xs uppercase tracking-widest text-slate-400 admin-mono">{label}</p><p className="text-3xl font-bold text-slate-900 mt-1">{value}</p></div></div>;
}