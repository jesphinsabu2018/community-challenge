import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';
import { AuthPage } from '@/pages/AuthPage';
import { HomePage } from '@/pages/HomePage';
import { ChallengeDetailPage } from '@/pages/ChallengeDetailPage';
import { CreateChallengePage } from '@/pages/CreateChallengePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ModerationPage } from '@/pages/ModerationPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState('home');
  const [params, setParams] = useState<Record<string, string>>({});

  const navigate = (newPage: string, newParams: Record<string, string> = {}) => {
    setPage(newPage);
    setParams(newParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!loading && !user && page !== 'auth' && page !== 'home') {
      navigate('auth');
    }
  }, [user, loading, page]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user && page !== 'home' && page !== 'auth') {
    navigate('auth');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar currentPage={page} onNavigate={navigate} />
      <main>
        {page === 'auth' && <AuthPage />}
        {page === 'home' && <HomePage onNavigate={navigate} />}
        {page === 'challenge' && params.id && <ChallengeDetailPage challengeId={params.id} onNavigate={navigate} />}
        {page === 'create' && <CreateChallengePage onNavigate={navigate} />}
        {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
        {page === 'leaderboard' && <LeaderboardPage onNavigate={navigate} />}
        {page === 'profile' && <ProfilePage onNavigate={navigate} />}
        {page === 'moderation' && <ModerationPage onNavigate={navigate} />}
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        FairPlay — Fair competition, ranked by merit not popularity
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
