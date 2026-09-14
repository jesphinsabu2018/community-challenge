import { useEffect, useState } from 'react';
import {
  Trophy,
  Search,
  Clock,
  Users,
  ArrowRight,
  Zap,
  Target,
  Flame,
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  category?: string;
  participants?: number;
  ends_at?: string;
  difficulty?: string;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [search, setSearch] = useState('');

  /*
   * Keep your existing challenge-fetching logic here if your
   * original HomePage already loads challenges from the backend.
   *
   * The design below can also work with an empty challenge list.
   */

  useEffect(() => {
    // Your existing API/database loading logic can stay here.
  }, []);

  const filteredChallenges = challenges.filter((challenge) =>
    challenge.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0B1020] text-white">

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/4 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
          <div className="absolute top-40 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-12">

          <div className="max-w-3xl">

            {/* Small badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-semibold mb-5">
              <Zap className="w-3.5 h-3.5" />
              FAIR COMPETITION PLATFORM
            </div>

            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Compete.
              <br />

              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Prove yourself.
              </span>
              <br />

              Rise.
            </h1>

            <p className="mt-5 text-lg text-slate-400 max-w-2xl leading-relaxed">
              Take on community challenges, submit your best work,
              and climb the leaderboard based on merit — not popularity.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-3 mt-8">

              <button
                onClick={() => {
                  document
                    .getElementById('challenges')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold shadow-lg shadow-purple-500/20 hover:from-violet-500 hover:to-purple-500 transition-all"
              >
                Explore Challenges
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('create')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-semibold hover:bg-white/10 transition-all"
              >
                <Target className="w-4 h-4" />
                Create Challenge
              </button>

            </div>
          </div>

          {/* ================= STATS ================= */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-12">

            <StatCard
              icon={<Trophy />}
              number={challenges.length || '—'}
              label="Challenges"
            />

            <StatCard
              icon={<Users />}
              number="—"
              label="Participants"
            />

            <StatCard
              icon={<Target />}
              number="Fair"
              label="Ranking"
            />

            <StatCard
              icon={<Flame />}
              number="Live"
              label="Competition"
            />

          </div>
        </div>
      </section>

      {/* ================= CHALLENGES ================= */}
      <section id="challenges" className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">

        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-7">

          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-cyan-400 mb-2">
              DISCOVER
            </p>

            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Active Challenges
            </h2>

            <p className="text-slate-500 mt-1">
              Find your next competition.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search challenges..."
              className="w-full bg-[#11182B] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />

          </div>
        </div>

        {/* ================= CHALLENGE GRID ================= */}

        {filteredChallenges.length > 0 ? (

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

            {filteredChallenges.map((challenge) => (

              <div
                key={challenge.id}
                onClick={() =>
                  onNavigate('challenge', { id: challenge.id })
                }
                className="group cursor-pointer bg-[#11182B] border border-white/10 rounded-2xl p-5 hover:border-violet-500/40 hover:-translate-y-1 transition-all duration-300"
              >

                <div className="flex items-center justify-between mb-5">

                  <span className="px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 text-xs font-semibold">
                    {challenge.category || 'Challenge'}
                  </span>

                  <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />

                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                  {challenge.title}
                </h3>

                <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                  {challenge.description}
                </p>

                <div className="flex items-center gap-4 mt-6 pt-4 border-t border-white/5 text-xs text-slate-500">

                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {challenge.participants || 0}
                  </span>

                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {challenge.ends_at || 'Open'}
                  </span>

                </div>

              </div>

            ))}

          </div>

        ) : (

          /* ================= EMPTY STATE ================= */

          <div className="bg-[#11182B] border border-white/10 rounded-2xl p-10 sm:p-16 text-center">

            <div className="mx-auto w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-5">
              <Trophy className="w-8 h-8 text-violet-400" />
            </div>

            <h3 className="text-xl font-bold text-white">
              No challenges found
            </h3>

            <p className="text-slate-500 mt-2 max-w-md mx-auto">
              Be the first to create a challenge and give the
              community something to compete for.
            </p>

            <button
              onClick={() => onNavigate('create')}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
            >
              <Zap className="w-4 h-4" />
              Create the First Challenge
            </button>

          </div>

        )}

      </section>

    </div>
  );
}


/* ================= STAT CARD ================= */

function StatCard({
  icon,
  number,
  label,
}: {
  icon: React.ReactNode;
  number: string | number;
  label: string;
}) {
  return (
    <div className="bg-[#11182B] border border-white/10 rounded-2xl p-4">

      <div className="flex items-center gap-3">

        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
          <span className="w-4 h-4">
            {icon}
          </span>
        </div>

        <div>
          <div className="font-bold text-white">
            {number}
          </div>

          <div className="text-xs text-slate-500">
            {label}
          </div>
        </div>

      </div>

    </div>
  );
}
