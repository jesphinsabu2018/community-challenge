import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createChallenge } from '@/lib/api';
import type { ChallengeCategory, DifficultyTier, SubmissionType } from '@/types';
import { DIFFICULTY_WEIGHTS } from '@/types';
import {
  Dumbbell,
  Code,
  Camera,
  HeartHandshake,
  Palette,
  BookOpen,
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  ArrowLeft,
  ArrowRight,
  Trophy,
  ShieldCheck,
  Target,
  Clock,
} from 'lucide-react';

interface CreateChallengePageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const categories: {
  value: ChallengeCategory;
  icon: typeof Dumbbell;
  label: string;
}[] = [
  { value: 'Fitness', icon: Dumbbell, label: 'Fitness' },
  { value: 'Coding', icon: Code, label: 'Coding' },
  { value: 'Photography', icon: Camera, label: 'Photography' },
  { value: 'Community', icon: HeartHandshake, label: 'Community' },
  { value: 'Art', icon: Palette, label: 'Art' },
  { value: 'Study', icon: BookOpen, label: 'Study' },
  { value: 'Custom', icon: Sparkles, label: 'Custom' },
];

const submissionTypes: {
  value: SubmissionType;
  label: string;
  description: string;
}[] = [
  {
    value: 'numeric',
    label: 'Numeric',
    description: 'Distance, time, reps — measurable results',
  },
  {
    value: 'text',
    label: 'Text',
    description: 'Written submission or essay',
  },
  {
    value: 'photo',
    label: 'Photo',
    description: 'Image upload as proof',
  },
  {
    value: 'video',
    label: 'Video',
    description: 'Video upload as proof',
  },
  {
    value: 'file',
    label: 'File',
    description: 'Document or code file upload',
  },
  {
    value: 'quiz',
    label: 'Quiz',
    description: 'Answer questions with an answer key',
  },
  {
    value: 'checklist',
    label: 'Checklist',
    description: 'Complete a list of tasks',
  },
];

export function CreateChallengePage({
  onNavigate,
}: CreateChallengePageProps) {
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [category, setCategory] =
    useState<ChallengeCategory>('Fitness');
  const [difficulty, setDifficulty] =
    useState<DifficultyTier>('Medium');
  const [submissionType, setSubmissionType] =
    useState<SubmissionType>('numeric');
  const [deadline, setDeadline] = useState('');
  const [requiresVerification, setRequiresVerification] =
    useState(true);
  const [benchmarkValue, setBenchmarkValue] = useState('');
  const [benchmarkUnit, setBenchmarkUnit] = useState('');
  const [answerKey, setAnswerKey] = useState('');
  const [checklistItems, setChecklistItems] = useState('');

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1020] flex items-center justify-center px-4">
        <div className="text-center bg-[#11182B] border border-white/10 rounded-2xl p-8 max-w-md">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
            <Trophy className="w-7 h-7 text-violet-400" />
          </div>

          <h2 className="text-xl font-bold text-white">
            Sign in required
          </h2>

          <p className="text-slate-500 mt-2 mb-6">
            Sign in to create your own community challenge.
          </p>

          <button
            onClick={() => onNavigate('auth')}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold hover:from-violet-500 hover:to-purple-500 transition-all"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const evaluationCriteria: Record<string, unknown> = {};

      if (submissionType === 'quiz' && answerKey.trim()) {
        evaluationCriteria.answer_key = answerKey
          .split(',')
          .map((a) => a.trim());
      }

      if (submissionType === 'checklist' && checklistItems.trim()) {
        evaluationCriteria.checklist_items = checklistItems
          .split('\n')
          .map((i) => i.trim())
          .filter(Boolean);
      }

      const challenge = await createChallenge({
        title: title.trim(),
        description: description.trim(),
        rules: rules.trim(),
        category,
        difficulty_tier: difficulty,
        difficulty_weight: DIFFICULTY_WEIGHTS[difficulty],
        submission_type: submissionType,
        evaluation_criteria: evaluationCriteria,
        benchmark_value: benchmarkValue
          ? parseFloat(benchmarkValue)
          : null,
        benchmark_unit: benchmarkUnit || null,
        deadline: deadline
          ? new Date(deadline).toISOString()
          : null,
        requires_verification: requiresVerification,
      });

      onNavigate('challenge', { id: challenge.id });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Failed to create challenge'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-[#0B1020] border border-white/10 text-sm text-white placeholder-slate-600 outline-none transition-all focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20';

  return (
    <div className="min-h-screen bg-[#0B1020] text-white">

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="mb-8">

          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to challenges
          </button>

          <div className="flex items-start gap-4">

            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Trophy className="w-6 h-6 text-white" />
            </div>

            <div>
              <h1 className="text-3xl font-black">
                Create a Challenge
              </h1>

              <p className="text-slate-500 mt-1">
                Design a fair competition for your community.
              </p>
            </div>

          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center mb-8">

          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="flex items-center flex-1 last:flex-none"
            >

              <div className="flex flex-col items-center">

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                    step >= s
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-white/5 border border-white/10 text-slate-600'
                  }`}
                >
                  {step > s ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    s
                  )}
                </div>

                <span
                  className={`text-[10px] mt-2 font-semibold ${
                    step >= s
                      ? 'text-violet-400'
                      : 'text-slate-600'
                  }`}
                >
                  {s === 1
                    ? 'Basics'
                    : s === 2
                    ? 'Competition'
                    : 'Scoring'}
                </span>

              </div>

              {s < 3 && (
                <div
                  className={`h-0.5 flex-1 mx-3 rounded ${
                    step > s
                      ? 'bg-gradient-to-r from-violet-500 to-cyan-400'
                      : 'bg-white/10'
                  }`}
                />
              )}

            </div>
          ))}

        </div>

        {/* Main card */}
        <div className="bg-[#11182B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="p-6 sm:p-8 space-y-6">

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-violet-400" />
                  <h2 className="font-bold text-white">
                    Challenge basics
                  </h2>
                </div>

                <p className="text-xs text-slate-500">
                  Tell participants what they are competing in.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">
                  Title
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., 30-Day Running Challenge"
                  className={inputClass}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">
                  Description
                </label>

                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this challenge about?"
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Rules */}
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">
                  Rules
                </label>

                <textarea
                  rows={4}
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  placeholder="Any specific rules participants must follow?"
                  className={`${inputClass} resize-none`}
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-3 block">
                  Category
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const active = category === cat.value;

                    return (
                      <button
                        type="button"
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                          active
                            ? 'border-violet-500 bg-violet-500/10 text-violet-300 shadow-lg shadow-violet-500/5'
                            : 'border-white/10 bg-white/[0.02] text-slate-500 hover:border-white/20 hover:bg-white/5 hover:text-slate-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />

                        <span className="text-xs font-semibold">
                          {cat.label}
                        </span>
                      </button>
                    );
                  })}

                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!title.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>

            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="p-6 sm:p-8 space-y-6">

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-violet-400" />
                  <h2 className="font-bold">
                    Competition settings
                  </h2>
                </div>

                <p className="text-xs text-slate-500">
                  Decide how participants will compete.
                </p>
              </div>

              {/* Difficulty */}
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-3 block">
                  Difficulty Level
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                  {(
                    ['Easy', 'Medium', 'Hard', 'Expert'] as DifficultyTier[]
                  ).map((d) => {

                    const active = difficulty === d;

                    return (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          active
                            ? 'border-violet-500 bg-violet-500/10 text-violet-300'
                            : 'border-white/10 bg-white/[0.02] text-slate-500 hover:border-white/20'
                        }`}
                      >
                        <span className="text-sm font-bold block">
                          {d}
                        </span>

                        <span className="text-xs opacity-60">
                          {DIFFICULTY_WEIGHTS[d]}x weight
                        </span>
                      </button>
                    );
                  })}

                </div>
              </div>

              {/* Submission type */}
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-3 block">
                  Submission Type
                </label>

                <div className="space-y-2">

                  {submissionTypes.map((st) => {
                    const active =
                      submissionType === st.value;

                    return (
                      <button
                        type="button"
                        key={st.value}
                        onClick={() =>
                          setSubmissionType(st.value)
                        }
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          active
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5'
                        }`}
                      >
                        <div
                          className={`text-sm font-semibold ${
                            active
                              ? 'text-violet-300'
                              : 'text-slate-300'
                          }`}
                        >
                          {st.label}
                        </div>

                        <div className="text-xs text-slate-500 mt-1">
                          {st.description}
                        </div>
                      </button>
                    );
                  })}

                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">
                  Deadline
                </label>

                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className={`${inputClass} pl-10`}
                  />
                </div>

                <p className="text-xs text-slate-600 mt-2">
                  Optional — leave empty for no deadline.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 rounded-xl border border-white/10 text-slate-400 font-semibold hover:bg-white/5 hover:text-white transition-all"
                >
                  <ArrowLeft className="w-4 h-4 inline mr-2" />
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 transition-all"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>

              </div>

            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="p-6 sm:p-8 space-y-6">

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <h2 className="font-bold">
                    Scoring & verification
                  </h2>
                </div>

                <p className="text-xs text-slate-500">
                  Configure how submissions will be evaluated.
                </p>
              </div>

              {/* Info */}
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 flex gap-3">

                <ShieldCheck className="w-5 h-5 text-cyan-400 flex-shrink-0" />

                <p className="text-xs text-slate-400 leading-relaxed">
                  Evaluation criteria helps the scoring engine
                  compute fair scores. Fill in what applies to
                  your challenge type.
                </p>

              </div>

              {/* Numeric */}
              {submissionType === 'numeric' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 block">
                      Benchmark Value
                    </label>

                    <input
                      type="number"
                      step="any"
                      value={benchmarkValue}
                      onChange={(e) =>
                        setBenchmarkValue(e.target.value)
                      }
                      placeholder="e.g., 5"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-300 mb-2 block">
                      Unit
                    </label>

                    <input
                      type="text"
                      value={benchmarkUnit}
                      onChange={(e) =>
                        setBenchmarkUnit(e.target.value)
                      }
                      placeholder="e.g., km, reps, minutes"
                      className={inputClass}
                    />
                  </div>

                </div>
              )}

              {/* Quiz */}
              {submissionType === 'quiz' && (
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">
                    Answer Key
                  </label>

                  <input
                    type="text"
                    value={answerKey}
                    onChange={(e) =>
                      setAnswerKey(e.target.value)
                    }
                    placeholder="e.g., A, B, C, D"
                    className={inputClass}
                  />

                  <p className="text-xs text-slate-600 mt-2">
                    Correct answers in order, separated by commas.
                  </p>
                </div>
              )}

              {/* Checklist */}
              {submissionType === 'checklist' && (
                <div>
                  <label className="text-sm font-semibold text-slate-300 mb-2 block">
                    Checklist Items
                  </label>

                  <textarea
                    rows={6}
                    value={checklistItems}
                    onChange={(e) =>
                      setChecklistItems(e.target.value)
                    }
                    placeholder={`Item 1
Item 2
Item 3`}
                    className={`${inputClass} resize-none`}
                  />

                  <p className="text-xs text-slate-600 mt-2">
                    Add one item per line.
                  </p>
                </div>
              )}

              {/* Verification */}
              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/5 transition-all">

                <input
                  type="checkbox"
                  checked={requiresVerification}
                  onChange={(e) =>
                    setRequiresVerification(e.target.checked)
                  }
                  className="mt-1 w-4 h-4 accent-violet-600"
                />

                <div>
                  <span className="text-sm font-semibold text-slate-200">
                    Requires verification
                  </span>

                  <p className="text-xs text-slate-500 mt-1">
                    Submissions go through a review queue before
                    scoring.
                  </p>
                </div>

              </label>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                  className="px-5 py-3 rounded-xl border border-white/10 text-slate-400 font-semibold hover:bg-white/5 hover:text-white transition-all disabled:opacity-40"
                >
                  <ArrowLeft className="w-4 h-4 inline mr-2" />
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/20"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4" />
                      Create Challenge
                    </>
                  )}
                </button>

              </div>

            </div>
          )}

        </div>

        {/* Bottom note */}
        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5" />
          Designed for fair, merit-based competition
        </div>

      </div>
    </div>
  );
}