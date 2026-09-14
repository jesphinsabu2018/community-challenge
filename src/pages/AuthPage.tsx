import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Trophy, Mail, Lock, User, ArrowRight, Zap } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        await signUp(email, password, username);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#0B1020] flex items-center justify-center px-4 py-12">

      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex relative">

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-xl shadow-purple-500/30">
              <Trophy className="w-8 h-8 text-white" />
            </div>

            <Zap className="absolute -top-2 -right-2 w-5 h-5 text-cyan-300 fill-cyan-300" />
          </div>

          <h1 className="mt-5 text-3xl font-bold text-white">
            Welcome to Fair<span className="text-violet-400">Play</span>
          </h1>

          <p className="mt-2 text-slate-400">
            Compete fairly. Prove yourself. Rise.
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#11182B] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">

          {/* Tabs */}
          <div className="grid grid-cols-2 bg-[#0B1020] rounded-xl p-1 mb-7">

            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError('');
              }}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !isSignUp
                  ? 'bg-violet-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError('');
              }}
              className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                isSignUp
                  ? 'bg-violet-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>

          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Username
                </label>

                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />

                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    required
                    className="w-full bg-[#0B1020] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-600 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-[#0B1020] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-600 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={6}
                  className="w-full bg-[#0B1020] border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-600 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold shadow-lg shadow-purple-500/20 hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Please wait...'
                : isSignUp
                ? 'Create Account'
                : 'Sign In'}

              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

          </form>

          {/* Bottom text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              {isSignUp
                ? 'Already have an account?'
                : "Don't have an account?"}{' '}

              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                }}
                className="font-semibold text-violet-400 hover:text-violet-300"
              >
                {isSignUp ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          Fair competition • Merit over popularity
        </p>

      </div>
    </div>
  );
}