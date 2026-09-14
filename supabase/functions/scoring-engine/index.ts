import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============================================================
// SCORING ENGINE — Configurable weights (tune without rewrite)
// ============================================================
const CONFIG = {
  COMMUNITY_SIGNAL_MAX_PERCENT: 0.10, // likes/votes capped at ≤10% of total
  COMMUNITY_SIGNAL_NORMALIZATION: "percentile", // not raw counts
  CONSISTENCY_BONUS_MAX: 8.0, // max additive bonus points
  CONSISTENCY_STREAK_WEIGHT: 0.5, // per-streak-day bonus
  UNVERIFIED_PENALTY: 0.3, // verification_factor for unverified
  FLAGGED_PENALTY: 0.0, // verification_factor for flagged
  DUPLICATE_PENALTY: 0.1, // verification_factor for duplicate proof
  MIN_SCORE: 0,
  MAX_SCORE: 200, // 100 perf * 2.0 max difficulty
} as const;

// ============================================================
// PER-CHALLENGE-TYPE EVALUATORS (Strategy Pattern)
// Each outputs a normalized 0–100 performance score.
// ============================================================

interface EvaluatorInput {
  submission: {
    submission_payload: Record<string, unknown>;
    file_url: string | null;
    file_hash: string | null;
  };
  challenge: {
    submission_type: string;
    evaluation_criteria: Record<string, unknown>;
    benchmark_value: number | null;
    benchmark_unit: string | null;
  };
  cohortScores: number[]; // other raw scores in same challenge
}

type Evaluator = (input: EvaluatorInput) => number;

const numericEvaluator: Evaluator = (input) => {
  const payload = input.submission.submission_payload;
  const value = Number(payload.value ?? payload.numeric_value ?? 0);
  const benchmark = input.challenge.benchmark_value;

  if (benchmark && benchmark > 0) {
    // Score relative to benchmark: hitting benchmark = 80, exceeding = up to 100
    const ratio = value / benchmark;
    return Math.min(100, Math.max(0, ratio * 80));
  }
  // No benchmark: normalize against cohort
  return normalizeAgainstCohort(value, input.cohortScores);
};

const quizEvaluator: Evaluator = (input) => {
  const payload = input.submission.submission_payload;
  const answers = (payload.answers ?? []) as unknown[];
  const answerKey = (input.challenge.evaluation_criteria.answer_key ?? []) as unknown[];
  if (answerKey.length === 0) return 50; // no key = partial credit default
  let correct = 0;
  for (let i = 0; i < answerKey.length; i++) {
    if (i < answers.length && String(answers[i]) === String(answerKey[i])) correct++;
  }
  return (correct / answerKey.length) * 100;
};

const checklistEvaluator: Evaluator = (input) => {
  const payload = input.submission.submission_payload;
  const items = (payload.checklist ?? []) as boolean[];
  const required = (input.challenge.evaluation_criteria.checklist_items ?? []) as unknown[];
  if (required.length > 0) {
    let checked = 0;
    for (let i = 0; i < required.length; i++) {
      if (items[i] === true) checked++;
    }
    return (checked / required.length) * 100;
  }
  if (items.length === 0) return 0;
  const done = items.filter(Boolean).length;
  return (done / items.length) * 100;
};

const textEvaluator: Evaluator = (input) => {
  const payload = input.submission.submission_payload;
  const text = String(payload.text ?? "");
  const minWords = Number(input.challenge.evaluation_criteria.min_words ?? 50);
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount >= minWords) return 75; // meets minimum = baseline
  return (wordCount / minWords) * 75;
};

const subjectiveEvaluator: Evaluator = (input) => {
  // For photo/art/video: base score on rubric criteria + peer verification
  // Since we can't do image analysis, score based on completion + rubric self-assessment
  const payload = input.submission.submission_payload;
  const rubricScores = (payload.rubric_scores ?? []) as number[];
  if (rubricScores.length > 0) {
    const avg = rubricScores.reduce((a, b) => a + b, 0) / rubricScores.length;
    return Math.min(100, avg);
  }
  // Has file proof = baseline completion score
  return input.submission.file_url ? 60 : 0;
};

const evaluators: Record<string, Evaluator> = {
  numeric: numericEvaluator,
  quiz: quizEvaluator,
  checklist: checklistEvaluator,
  text: textEvaluator,
  photo: subjectiveEvaluator,
  video: subjectiveEvaluator,
  file: subjectiveEvaluator,
};

function normalizeAgainstCohort(value: number, cohort: number[]): number {
  if (cohort.length === 0) return 50;
  const sorted = [...cohort, value].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (max === min) return 75;
  return ((value - min) / (max - min)) * 100;
}

function percentile(value: number, cohort: number[]): number {
  if (cohort.length === 0) return 50;
  const below = cohort.filter((v) => v < value).length;
  return (below / cohort.length) * 100;
}

// ============================================================
// FINAL SCORE COMPUTATION
// ============================================================

interface ScoreInput {
  performanceNormalized: number;
  difficultyWeight: number;
  completionFactor: number;
  verificationStatus: string;
  isDuplicate: boolean;
  consistencyStreak: number;
  voteCount: number;
  maxVotesInCohort: number;
  challengeCompletionRate: number;
}

interface ScoreResult {
  finalScore: number;
  performance_normalized: number;
  difficulty_weight: number;
  completion_factor: number;
  verification_factor: number;
  consistency_bonus: number;
  community_signal_capped: number;
  breakdown: Record<string, unknown>;
}

function computeFinalScore(input: ScoreInput): ScoreResult {
  // Verification factor
  let verificationFactor = 1.0;
  if (input.verificationStatus === "flagged") {
    verificationFactor = CONFIG.FLAGGED_PENALTY;
  } else if (input.verificationStatus === "rejected") {
    verificationFactor = 0;
  } else if (input.verificationStatus === "pending") {
    verificationFactor = CONFIG.UNVERIFIED_PENALTY;
  }
  if (input.isDuplicate) {
    verificationFactor = Math.min(verificationFactor, CONFIG.DUPLICATE_PENALTY);
  }

  // Difficulty weight adjustment: challenges few people finish get weighted up
  let adjustedDifficulty = input.difficultyWeight;
  if (input.challengeCompletionRate < 0.2 && input.challengeCompletionRate > 0) {
    adjustedDifficulty = Math.min(2.0, input.difficultyWeight * 1.15);
  }

  // Consistency bonus
  const consistencyBonus = Math.min(
    CONFIG.CONSISTENCY_BONUS_MAX,
    input.consistencyStreak * CONFIG.CONSISTENCY_STREAK_WEIGHT
  );

  // Community signal: normalized (percentile), then hard-capped
  const votePercentile = input.maxVotesInCohort > 0
    ? (input.voteCount / input.maxVotesInCohort) * 100
    : 0;
  const baseScore = input.performanceNormalized * adjustedDifficulty * input.completionFactor * verificationFactor;
  const maxCommunityContribution = baseScore * CONFIG.COMMUNITY_SIGNAL_MAX_PERCENT;
  const communitySignalCapped = Math.min(
    maxCommunityContribution,
    (votePercentile / 100) * maxCommunityContribution
  );

  const finalScore = Math.max(
    CONFIG.MIN_SCORE,
    Math.min(CONFIG.MAX_SCORE, baseScore + consistencyBonus + communitySignalCapped)
  );

  return {
    finalScore,
    performance_normalized: input.performanceNormalized,
    difficulty_weight: adjustedDifficulty,
    completion_factor: input.completionFactor,
    verification_factor: verificationFactor,
    consistency_bonus: consistencyBonus,
    community_signal_capped: communitySignalCapped,
    breakdown: {
      base_score: baseScore,
      raw_difficulty_weight: input.difficultyWeight,
      adjusted_difficulty_weight: adjustedDifficulty,
      challenge_completion_rate: input.challengeCompletionRate,
      vote_count: input.voteCount,
      vote_percentile: votePercentile,
      max_community_contribution: maxCommunityContribution,
      is_duplicate: input.isDuplicate,
      config: {
        community_signal_max_percent: CONFIG.COMMUNITY_SIGNAL_MAX_PERCENT,
        consistency_bonus_max: CONFIG.CONSISTENCY_BONUS_MAX,
      },
    },
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/scoring-engine", "");
    const segments = path.split("/").filter(Boolean);

    // POST /recompute — recompute all scores (cron trigger)
    // GET /leaderboard/global — global leaderboard
    // GET /leaderboard/{challengeId} — per-challenge leaderboard
    // GET /breakdown/{submissionId} — score breakdown for a submission

    if (req.method === "POST" && segments[0] === "recompute") {
      return await recomputeAllScores(supabase);
    }

    if (req.method === "GET" && segments[0] === "leaderboard" && segments[1] === "global") {
      return await getGlobalLeaderboard(supabase, url.searchParams.get("limit") || "50");
    }

    if (req.method === "GET" && segments[0] === "leaderboard" && segments[1] && segments[1] !== "global") {
      return await getChallengeLeaderboard(supabase, segments[1]);
    }

    if (req.method === "GET" && segments[0] === "breakdown" && segments[1]) {
      return await getScoreBreakdown(supabase, segments[1]);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ============================================================
// RECOMPUTE ALL SCORES
// ============================================================

async function recomputeAllScores(supabase: ReturnType<typeof createClient>) {
  // Get all submissions
  const { data: submissions, error: subError } = await supabase
    .from("submissions")
    .select(`
      id, user_id, challenge_id, submission_payload, file_url, file_hash,
      verification_status, submitted_at
    `);

  if (subError) throw new Error(`Failed to fetch submissions: ${subError.message}`);
  if (!submissions || submissions.length === 0) {
    return jsonResponse({ message: "No submissions to score", scored: 0 });
  }

  // Get all challenges
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, submission_type, evaluation_criteria, benchmark_value, benchmark_unit, difficulty_weight, requires_verification");

  const challengeMap = new Map(challenges?.map((c) => [c.id, c]) ?? []);

  // Get all votes per submission
  const { data: votes } = await supabase
    .from("votes")
    .select("submission_id, voter_id");

  const voteMap = new Map<string, number>();
  for (const v of votes ?? []) {
    voteMap.set(v.submission_id, (voteMap.get(v.submission_id) ?? 0) + 1);
  }

  // Get profiles for consistency streaks
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, consistency_streak");

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  // Detect duplicates by file_hash
  const hashCounts = new Map<string, number>();
  for (const s of submissions) {
    if (s.file_hash) {
      hashCounts.set(s.file_hash, (hashCounts.get(s.file_hash) ?? 0) + 1);
    }
  }

  // Compute completion rates per challenge
  const challengeParticipantCounts = new Map<string, number>();
  const challengeCompletedCounts = new Map<string, number>();
  const { data: participants } = await supabase
    .from("participants")
    .select("challenge_id, status");
  for (const p of participants ?? []) {
    challengeParticipantCounts.set(p.challenge_id, (challengeParticipantCounts.get(p.challenge_id) ?? 0) + 1);
    if (p.status === "completed") {
      challengeCompletedCounts.set(p.challenge_id, (challengeCompletedCounts.get(p.challenge_id) ?? 0) + 1);
    }
  }

  // Group submissions by challenge for cohort normalization
  const submissionsByChallenge = new Map<string, typeof submissions>();
  for (const s of submissions) {
    const arr = submissionsByChallenge.get(s.challenge_id) ?? [];
    arr.push(s);
    submissionsByChallenge.set(s.challenge_id, arr);
  }

  // Compute raw performance scores per challenge cohort
  const rawScoreMap = new Map<string, number>(); // submission_id -> raw score
  for (const [challengeId, subs] of submissionsByChallenge) {
    const challenge = challengeMap.get(challengeId);
    if (!challenge) continue;
    const evaluator = evaluators[challenge.submission_type] ?? subjectiveEvaluator;
    const cohortRawScores: number[] = [];
    for (const s of subs) {
      const raw = evaluator({
        submission: { submission_payload: s.submission_payload, file_url: s.file_url, file_hash: s.file_hash },
        challenge: {
          submission_type: challenge.submission_type,
          evaluation_criteria: challenge.evaluation_criteria,
          benchmark_value: challenge.benchmark_value,
          benchmark_unit: challenge.benchmark_unit,
        },
        cohortScores: [],
      });
      cohortRawScores.push(raw);
      rawScoreMap.set(s.id, raw);
    }
  }

  // Find max votes in each challenge cohort for normalization
  const maxVotesByChallenge = new Map<string, number>();
  for (const [challengeId, subs] of submissionsByChallenge) {
    let maxVotes = 0;
    for (const s of subs) {
      const v = voteMap.get(s.id) ?? 0;
      if (v > maxVotes) maxVotes = v;
    }
    maxVotesByChallenge.set(challengeId, maxVotes);
  }

  // Compute final scores and write audit logs
  let scored = 0;
  for (const s of submissions) {
    const challenge = challengeMap.get(s.challenge_id);
    if (!challenge) continue;

    const cohort = submissionsByChallenge.get(s.challenge_id) ?? [];
    const cohortRawScores = cohort
      .map((c) => rawScoreMap.get(c.id) ?? 0)
      .filter((v) => v !== undefined);

    const rawScore = rawScoreMap.get(s.id) ?? 0;
    const performanceNormalized = normalizeAgainstCohort(rawScore, cohortRawScores);

    // Completion factor: if verification_status is verified or pending with proof
    let completionFactor = 0;
    if (s.verification_status === "verified") completionFactor = 1.0;
    else if (s.verification_status === "pending") completionFactor = 0.7;
    else if (s.verification_status === "flagged") completionFactor = 0.5;

    const isDuplicate = s.file_hash ? (hashCounts.get(s.file_hash) ?? 0) > 1 : false;
    const profile = profileMap.get(s.user_id);
    const consistencyStreak = profile?.consistency_streak ?? 0;

    const totalParticipants = challengeParticipantCounts.get(s.challenge_id) ?? 1;
    const completedCount = challengeCompletedCounts.get(s.challenge_id) ?? 0;
    const completionRate = totalParticipants > 0 ? completedCount / totalParticipants : 0;

    const result = computeFinalScore({
      performanceNormalized,
      difficultyWeight: challenge.difficulty_weight,
      completionFactor,
      verificationStatus: s.verification_status,
      isDuplicate,
      consistencyStreak,
      voteCount: voteMap.get(s.id) ?? 0,
      maxVotesInCohort: maxVotesByChallenge.get(s.challenge_id) ?? 0,
      challengeCompletionRate: completionRate,
    });

    // Write audit log
    const { error: auditError } = await supabase.from("score_audit_log").insert({
      submission_id: s.id,
      computed_final_score: result.finalScore,
      performance_normalized: result.performance_normalized,
      difficulty_weight: result.difficulty_weight,
      completion_factor: result.completion_factor,
      verification_factor: result.verification_factor,
      consistency_bonus: result.consistency_bonus,
      community_signal_capped: result.community_signal_capped,
      breakdown: result.breakdown,
    });

    if (auditError) {
      console.error(`Audit log error for ${s.id}: ${auditError.message}`);
    }

    // Update submission's raw_performance_score
    await supabase
      .from("submissions")
      .update({ raw_performance_score: result.finalScore })
      .eq("id", s.id);

    scored++;
  }

  // Update profile stats
  await updateProfileStats(supabase, submissions, profileMap);

  return jsonResponse({ message: "Scores recomputed", scored });
}

// ============================================================
// GLOBAL LEADERBOARD
// ============================================================

async function getGlobalLeaderboard(supabase: ReturnType<typeof createClient>, limitStr: string) {
  const limit = Math.min(parseInt(limitStr) || 50, 100);

  // Get latest audit log entry per submission (highest computed_at)
  const { data: auditLogs, error } = await supabase
    .from("score_audit_log")
    .select("submission_id, computed_final_score, breakdown, computed_at")
    .order("computed_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`);

  // Deduplicate: keep only latest entry per submission
  const latestPerSubmission = new Map<string, typeof auditLogs[0]>();
  for (const log of auditLogs ?? []) {
    if (!latestPerSubmission.has(log.submission_id)) {
      latestPerSubmission.set(log.submission_id, log);
    }
  }

  // Aggregate by user
  const userScores = new Map<string, { totalScore: number; submissionCount: number; bestScore: number }>();
  const submissionToUser = new Map<string, string>();

  // Get submissions to map to users
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, user_id, verification_status")
    .in("verification_status", ["verified", "pending"]);

  for (const s of submissions ?? []) {
    submissionToUser.set(s.id, s.user_id);
  }

  for (const [submissionId, log] of latestPerSubmission) {
    const userId = submissionToUser.get(submissionId);
    if (!userId) continue;
    const existing = userScores.get(userId) ?? { totalScore: 0, submissionCount: 0, bestScore: 0 };
    existing.totalScore += log.computed_final_score;
    existing.submissionCount += 1;
    existing.bestScore = Math.max(existing.bestScore, log.computed_final_score);
    userScores.set(userId, existing);
  }

  // Get profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, challenges_completed, consistency_streak")
    .in("id", [...userScores.keys()]);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  const leaderboard = [...userScores.entries()]
    .map(([userId, scores]) => ({
      user_id: userId,
      username: profileMap.get(userId)?.username ?? "Unknown",
      avatar_url: profileMap.get(userId)?.avatar_url,
      total_score: Math.round(scores.totalScore * 100) / 100,
      best_score: Math.round(scores.bestScore * 100) / 100,
      submission_count: scores.submissionCount,
      challenges_completed: profileMap.get(userId)?.challenges_completed ?? 0,
      consistency_streak: profileMap.get(userId)?.consistency_streak ?? 0,
    }))
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, limit)
    .map((entry, i) => ({ rank: i + 1, ...entry }));

  return jsonResponse({ leaderboard });
}

// ============================================================
// CHALLENGE LEADERBOARD
// ============================================================

async function getChallengeLeaderboard(supabase: ReturnType<typeof createClient>, challengeId: string) {
  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("id, user_id, verification_status, raw_performance_score")
    .eq("challenge_id", challengeId)
    .in("verification_status", ["verified", "pending"]);

  if (error) throw new Error(`Failed to fetch submissions: ${error.message}`);

  // Get latest audit logs for these submissions
  const submissionIds = (submissions ?? []).map((s) => s.id);
  if (submissionIds.length === 0) return jsonResponse({ leaderboard: [] });

  const { data: auditLogs } = await supabase
    .from("score_audit_log")
    .select("submission_id, computed_final_score, breakdown, performance_normalized, difficulty_weight, completion_factor, verification_factor, consistency_bonus, community_signal_capped")
    .in("submission_id", submissionIds)
    .order("computed_at", { ascending: false });

  const latestPerSubmission = new Map<string, typeof auditLogs[0]>();
  for (const log of auditLogs ?? []) {
    if (!latestPerSubmission.has(log.submission_id)) {
      latestPerSubmission.set(log.submission_id, log);
    }
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", [...new Set(submissions?.map((s) => s.user_id) ?? [])]);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  const leaderboard = (submissions ?? [])
    .map((s) => {
      const audit = latestPerSubmission.get(s.id);
      return {
        submission_id: s.id,
        user_id: s.user_id,
        username: profileMap.get(s.user_id)?.username ?? "Unknown",
        avatar_url: profileMap.get(s.user_id)?.avatar_url,
        verification_status: s.verification_status,
        final_score: audit?.computed_final_score ?? 0,
        breakdown: audit ? {
          performance_normalized: audit.performance_normalized,
          difficulty_weight: audit.difficulty_weight,
          completion_factor: audit.completion_factor,
          verification_factor: audit.verification_factor,
          consistency_bonus: audit.consistency_bonus,
          community_signal_capped: audit.community_signal_capped,
          details: audit.breakdown,
        } : null,
      };
    })
    .sort((a, b) => b.final_score - a.final_score)
    .map((entry, i) => ({ rank: i + 1, ...entry }));

  return jsonResponse({ leaderboard });
}

// ============================================================
// SCORE BREAKDOWN FOR A SINGLE SUBMISSION
// ============================================================

async function getScoreBreakdown(supabase: ReturnType<typeof createClient>, submissionId: string) {
  const { data: auditLog, error } = await supabase
    .from("score_audit_log")
    .select("*")
    .eq("submission_id", submissionId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch audit log: ${error.message}`);
  if (!auditLog) return jsonResponse({ error: "No score computed yet" }, 404);

  return jsonResponse({
    submission_id: submissionId,
    final_score: auditLog.computed_final_score,
    performance_normalized: auditLog.performance_normalized,
    difficulty_weight: auditLog.difficulty_weight,
    completion_factor: auditLog.completion_factor,
    verification_factor: auditLog.verification_factor,
    consistency_bonus: auditLog.consistency_bonus,
    community_signal_capped: auditLog.community_signal_capped,
    breakdown: auditLog.breakdown,
    computed_at: auditLog.computed_at,
  });
}

// ============================================================
// UPDATE PROFILE STATS
// ============================================================

async function updateProfileStats(
  supabase: ReturnType<typeof createClient>,
  submissions: Array<{ user_id: string; verification_status: string }>,
  _profileMap: Map<string, unknown>
) {
  const userStats = new Map<string, { completed: number; totalScore: number; count: number }>();
  for (const s of submissions) {
    const stat = userStats.get(s.user_id) ?? { completed: 0, totalScore: 0, count: 0 };
    if (s.verification_status === "verified") stat.completed++;
    stat.count++;
    userStats.set(s.user_id, stat);
  }

  for (const [userId, stat] of userStats) {
    const avgScore = stat.count > 0 ? stat.totalScore / stat.count : 0;
    await supabase
      .from("profiles")
      .update({
        challenges_completed: stat.completed,
        average_score: Math.round(avgScore * 100) / 100,
      })
      .eq("id", userId);
  }
}

// ============================================================
// HELPER
// ============================================================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
