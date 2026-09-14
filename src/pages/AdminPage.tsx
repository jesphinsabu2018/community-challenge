import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-slate-800">Admin Panel</h1><p className="text-sm text-slate-500">Signed in as {adminUsername}</p></div>
        <div className="flex gap-2"><button className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg" onClick={() => onNavigate('create')}>Post challenge</button><button className="px-3 py-2 text-sm border rounded-lg" onClick={() => { adminLogout(); onNavigate('home'); }}>Sign out</button></div>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {data && <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border rounded-xl p-5"><p className="text-sm text-slate-500">Challenges</p><p className="text-3xl font-bold">{data.challenge_count}</p></div>
          <div className="bg-white border rounded-xl p-5"><p className="text-sm text-slate-500">Submissions</p><p className="text-3xl font-bold">{data.submission_count}</p></div>
          <div className="bg-white border rounded-xl p-5"><p className="text-sm text-slate-500">Open anomaly flags</p><p className="text-3xl font-bold text-amber-600">{data.open_anomaly_count}</p></div>
        </div>
        <div className="bg-white border rounded-xl p-5"><h2 className="font-semibold mb-4">Recent audit events</h2><div className="space-y-2 text-sm">{data.recent_events.map((event, index) => <div className="flex justify-between border-b pb-2" key={`${event.event_type}-${index}`}><span>{event.event_type}</span><span className="text-slate-500">{new Date(event.created_at).toLocaleString()}</span></div>)}</div></div>
      </>}
    </div>
  );
}