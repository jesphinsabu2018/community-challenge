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

interface ParticipantRecord {
  user_id: string;
  username: string;
  bio: string;
  status: string;
  joined_at: string;
  submitted: boolean;
  merit_score: number | null;
}

interface ParticipationGroup {
  challenge_id: string;
  title: string;
  points: number;
  difficulty: number;
  participant_count: number;
  participants: ParticipantRecord[];
}

export function AdminPage({ onNavigate }: AdminPageProps) {
  const { adminUsername, adminLogout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [participation, setParticipation] = useState<ParticipationGroup[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminUsername) return;
    const headers = { 'X-Admin-Token': localStorage.getItem('fairplay_admin_token') ?? '' };
    fetch('http://127.0.0.1:8000/api/admin/dashboard/', { headers }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || 'Administrator access denied');
      setData(body);
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Administrator access denied'));
    fetch('http://127.0.0.1:8000/api/admin/participation/', { headers }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || 'Unable to load participation data');
      setParticipation(body);
      setSelectedChallenge((current) => current || body[0]?.challenge_id || '');
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Unable to load participation data'));
  }, [adminUsername]);

  const selectedGroup = participation.find((group) => group.challenge_id === selectedChallenge);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div><h1 className="text-2xl font-bold text-slate-800">Admin Panel</h1><p className="text-sm text-slate-500">Signed in as {adminUsername}</p></div>
        <div className="flex gap-2"><button className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg" onClick={() => onNavigate('create')}>Post challenge</button><button className="px-3 py-2 text-sm border rounded-lg" onClick={() => { adminLogout(); onNavigate('home'); }}>Sign out</button></div>
      </div>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {data && <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border rounded-xl p-5"><p className="text-sm text-slate-500">Challenges</p><p className="text-3xl font-bold">{data.challenge_count}</p></div>
          <div className="bg-white border rounded-xl p-5"><p className="text-sm text-slate-500">Submissions</p><p className="text-3xl font-bold">{data.submission_count}</p></div>
          <div className="bg-white border rounded-xl p-5"><p className="text-sm text-slate-500">Open anomaly flags</p><p className="text-3xl font-bold text-amber-600">{data.open_anomaly_count}</p></div>
        </div>
        <div className="bg-white border rounded-xl p-5"><h2 className="font-semibold mb-4">Recent audit events</h2><div className="space-y-2 text-sm">{data.recent_events.map((event, index) => <div className="flex justify-between border-b pb-2" key={`${event.event_type}-${index}`}><span>{event.event_type}</span><span className="text-slate-500">{new Date(event.created_at).toLocaleString()}</span></div>)}</div></div>
        <div className="bg-white border rounded-xl p-5 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"><div><h2 className="font-semibold">Challenge participation</h2><p className="text-sm text-slate-500">View current and past participants by event.</p></div><select value={selectedChallenge} onChange={(event) => setSelectedChallenge(event.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm"><option value="">Select a challenge</option>{participation.map((group) => <option key={group.challenge_id} value={group.challenge_id}>{group.title}</option>)}</select></div>
          {selectedGroup ? <><div className="flex flex-wrap gap-3 mb-4 text-sm"><span className="bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2 font-semibold">{selectedGroup.points} points</span><span className="bg-slate-100 text-slate-600 rounded-lg px-3 py-2">Difficulty {selectedGroup.difficulty}/5</span><span className="bg-slate-100 text-slate-600 rounded-lg px-3 py-2">{selectedGroup.participant_count} participants</span></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500 border-b"><th className="py-2 pr-4">Participant</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Joined</th><th className="py-2">Submission</th></tr></thead><tbody>{selectedGroup.participants.map((participant) => <tr key={participant.user_id} className="border-b last:border-0"><td className="py-3 pr-4"><p className="font-medium text-slate-700">{participant.username}</p><p className="text-xs text-slate-400 truncate max-w-xs">{participant.bio || participant.user_id}</p></td><td className="py-3 pr-4 capitalize">{participant.status.replace('_', ' ')}</td><td className="py-3 pr-4 text-slate-500">{new Date(participant.joined_at).toLocaleDateString()}</td><td className="py-3">{participant.submitted ? <span className="text-emerald-600">Submitted{participant.merit_score !== null ? ` · ${participant.merit_score.toFixed(1)} score` : ''}</span> : <span className="text-amber-600">In progress</span>}</td></tr>)}</tbody></table></div></> : <p className="text-sm text-slate-500">No participation data yet.</p>}
        </div>
      </>}
    </div>
  );
}
