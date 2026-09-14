import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Anti-exploitation config
const VOTE_LIMITS = {
  MAX_VOTES_PER_CHALLENGE: 3,
  MAX_VOTES_PER_DAY: 20,
  MIN_ACCOUNT_AGE_HOURS: 1, // newly created accounts can't vote immediately
} as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the user from the JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError("Unauthorized", 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await req.json();
    const { submission_id, action } = body as { submission_id: string; action: "vote" | "unvote" };

    if (!submission_id) {
      return jsonError("submission_id required", 400);
    }

    // Fetch the submission to check ownership and get challenge_id
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("id, user_id, challenge_id")
      .eq("id", submission_id)
      .maybeSingle();

    if (subError) return jsonError(`DB error: ${subError.message}`, 500);
    if (!submission) return jsonError("Submission not found", 404);

    // ANTI-EXPLOITATION CHECK 1: No self-voting
    if (submission.user_id === user.id) {
      return jsonError("Cannot vote on your own submission", 403);
    }

    if (action === "unvote") {
      const { error: deleteError } = await supabase
        .from("votes")
        .delete()
        .eq("voter_id", user.id)
        .eq("submission_id", submission_id);
      if (deleteError) return jsonError(`Failed to remove vote: ${deleteError.message}`, 500);
      return jsonResponse({ message: "Vote removed" });
    }

    // ANTI-EXPLOITATION CHECK 2: Account age check
    const userCreatedAt = new Date(user.created_at || "");
    const accountAgeHours = (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60);
    if (accountAgeHours < VOTE_LIMITS.MIN_ACCOUNT_AGE_HOURS) {
      return jsonError("Account is too new to vote", 403);
    }

    // ANTI-EXPLOITATION CHECK 3: Per-challenge vote limit
    const { count: challengeVoteCount } = await supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("voter_id", user.id)
      .in("submission_id", (
        await supabase
          .from("submissions")
          .select("id")
          .eq("challenge_id", submission.challenge_id)
      ).data?.map((s) => s.id) ?? []);

    if ((challengeVoteCount ?? 0) >= VOTE_LIMITS.MAX_VOTES_PER_CHALLENGE) {
      return jsonError(`Maximum ${VOTE_LIMITS.MAX_VOTES_PER_CHALLENGE} votes per challenge`, 429);
    }

    // ANTI-EXPLOITATION CHECK 4: Per-day vote limit
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyVoteCount } = await supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("voter_id", user.id)
      .gte("created_at", oneDayAgo);

    if ((dailyVoteCount ?? 0) >= VOTE_LIMITS.MAX_VOTES_PER_DAY) {
      return jsonError("Daily vote limit reached", 429);
    }

    // ANTI-EXPLOITATION CHECK 5: Duplicate vote check (unique constraint also enforces)
    const { data: existingVote } = await supabase
      .from("votes")
      .select("id")
      .eq("voter_id", user.id)
      .eq("submission_id", submission_id)
      .maybeSingle();

    if (existingVote) {
      return jsonError("Already voted on this submission", 409);
    }

    // Insert the vote
    const { error: insertError } = await supabase
      .from("votes")
      .insert({ voter_id: user.id, submission_id });

    if (insertError) {
      if (insertError.code === "23505") {
        return jsonError("Already voted on this submission", 409);
      }
      return jsonError(`Failed to vote: ${insertError.message}`, 500);
    }

    // ANTI-EXPLOITATION: Check for suspicious voting patterns
    await checkSuspiciousPatterns(supabase, user.id, submission.challenge_id);

    return jsonResponse({ message: "Vote recorded" });
  } catch (err) {
    return jsonError(err.message, 500);
  }
});

// ============================================================
// SUSPICIOUS PATTERN DETECTION
// ============================================================

async function checkSuspiciousPatterns(
  supabase: ReturnType<typeof createClient>,
  voterId: string,
  challengeId: string
) {
  // Check vote velocity: if user has voted > 10 times in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentVotes } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("voter_id", voterId)
    .gte("created_at", oneHourAgo);

  if ((recentVotes ?? 0) > 10) {
    // Flag for moderation review — create a report-like entry
    console.warn(`Suspicious vote velocity detected for user ${voterId}: ${recentVotes} votes in last hour`);
  }

  // Check for coordinated voting clusters: multiple voters on same challenge
  // who all created accounts within same hour
  const { data: challengeVotes } = await supabase
    .from("votes")
    .select("voter_id, created_at")
    .in("submission_id", (
      await supabase
        .from("submissions")
        .select("id")
        .eq("challenge_id", challengeId)
    ).data?.map((s) => s.id) ?? []);

  if (challengeVotes && challengeVotes.length > 5) {
    const voterIds = [...new Set(challengeVotes.map((v) => v.voter_id))];
    const { data: voters } = await supabase
      .from("profiles")
      .select("id, created_at")
      .in("id", voterIds);

    if (voters) {
      const recentAccountCount = voters.filter((v) => {
        const age = (Date.now() - new Date(v.created_at).getTime()) / (1000 * 60 * 60);
        return age < 24;
      }).length;

      if (recentAccountCount > 3) {
        console.warn(`Possible coordinated voting cluster on challenge ${challengeId}: ${recentAccountCount} new accounts voting`);
      }
    }
  }
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
