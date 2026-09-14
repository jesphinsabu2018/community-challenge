import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  Trophy,
  Home,
  PlusCircle,
  BarChart3,
  User,
  LogOut,
  Menu,
  X,
  Shield,
  Zap,
} from 'lucide-react';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const { user, profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Challenges', icon: Home },
    { id: 'create', label: 'Create', icon: PlusCircle },
    { id: 'dashboard', label: 'My Progress', icon: BarChart3 },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  if (profile?.is_moderator) {
    navItems.push({
      id: 'moderation',
      label: 'Moderation',
      icon: Shield,
    });
  }

  const handleNav = (id: string) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#0B1020]/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-18">

          {/* LOGO */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => handleNav('home')}
          >
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Trophy className="w-5 h-5 text-white" />

              <div className="absolute -top-1 -right-1">
                <Zap className="w-3.5 h-3.5 text-cyan-300 fill-cyan-300" />
              </div>
            </div>

            <div className="hidden sm:block">
              <div className="font-bold text-lg text-white leading-tight">
                Fair<span className="text-violet-400">Play</span>
              </div>

              <div className="text-[9px] font-bold tracking-[0.2em] text-cyan-400">
                COMPETE • PROVE • RISE
              </div>
            </div>
          </div>

          {/* DESKTOP NAVIGATION */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}

                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* PROFILE / SIGN IN */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <button
                  onClick={() => handleNav('profile')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover ring-2 ring-violet-500/30"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-violet-300" />
                    </div>
                  )}

                  <span className="text-sm font-semibold text-slate-200">
                    {profile?.username ?? 'Profile'}
                  </span>
                </button>

                <button
                  onClick={signOut}
                  className="p-2 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => handleNav('auth')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/20"
              >
                Sign In
              </button>
            )}
          </div>

          {/* MOBILE MENU BUTTON */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-300 hover:bg-white/5"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* MOBILE MENU */}
        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 space-y-1 border-t border-white/10">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    active
                      ? 'bg-violet-500/15 text-violet-300'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}

            {user ? (
              <button
                onClick={() => {
                  signOut();
                  setMobileOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            ) : (
              <button
                onClick={() => handleNav('auth')}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold"
              >
                Sign In
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}