import type { Challenge, ChallengeLeaderboardEntry, Comment, LeaderboardEntry, Profile, Report, ScoreBreakdown, Submission, Vote } from '@/types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api';

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const savedUser = localStorage.getItem('fairplay_user');
  if (savedUser) headers.set('X-User-ID', (JSON.parse(savedUser) as { id: string }).id);
  const adminToken = localStorage.getItem('fairplay_admin_token');
  if (adminToken) headers.set('X-Admin-Token', adminToken);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `Request failed (${response.status})` }));
    throw new Error(error.detail || error.error || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export function fetchChallenges(section: 'active' | 'new' | 'popular' = 'active') { return apiRequest<Challenge[]>(`/challenges/?section=${section}`); }
export function fetchChallenge(id: string) { return apiRequest<Challenge>(`/challenges/${id}/`); }
export function createChallenge(challenge: Partial<Challenge>) { return apiRequest<Challenge>('/challenges/', { method: 'POST', body: JSON.stringify(challenge) }); }
export async function joinChallenge(challengeId: string) { await apiRequest(`/challenges/${challengeId}/join/`, { method: 'POST' }); }
export async function leaveChallenge(challengeId: string) { void challengeId; throw new Error('Leaving a challenge is not enabled after joining.'); }
export async function getParticipantStatus(challengeId: string) { return (await apiRequest<{ status: string | null }>(`/challenges/${challengeId}/participant-status/`)).status; }
export async function getUserParticipations() { return [] as { challenge_id: string; status: string; joined_at: string }[]; }
export function fetchSubmissions(challengeId: string) { return apiRequest<Submission[]>(`/challenges/${challengeId}/submit/`); }
export function fetchUserSubmissions() { return apiRequest<Submission[]>('/submissions/mine/'); }
export function submitProof(challengeId: string, payload: Record<string, unknown>, fileUrl?: string | null, fileHash?: string | null) { return apiRequest<Submission>(`/challenges/${challengeId}/submit/`, { method: 'POST', body: JSON.stringify({ submission_payload: payload, file_url: fileUrl, file_hash: fileHash }) }); }
export function getMySubmission(challengeId: string) { return fetchSubmissions(challengeId).then((submissions) => submissions[0] ?? null); }
export async function castVote(submissionId: string) { await apiRequest(`/submissions/${submissionId}/vote/`, { method: 'POST' }); }
export async function removeVote(submissionId: string) { await apiRequest(`/submissions/${submissionId}/vote/`, { method: 'DELETE' }); }
export async function getVotesForSubmission(submissionId: string): Promise<Vote[]> { return apiRequest<Vote[]>(`/submissions/${submissionId}/votes/`); }
export async function hasVoted(submissionId: string) {
  const savedUser = localStorage.getItem('fairplay_user');
  return savedUser ? (await getVotesForSubmission(submissionId)).some((vote) => vote.voter_id === (JSON.parse(savedUser) as { id: string }).id) : false;
}
export async function getVoteCount(submissionId: string) { return (await getVotesForSubmission(submissionId)).length; }
export function fetchComments(submissionId: string): Promise<(Comment & { username: string; avatar_url: string | null })[]> { return apiRequest(`/submissions/${submissionId}/comments/`); }
export async function addComment(submissionId: string, text: string) { await apiRequest(`/submissions/${submissionId}/comments/`, { method: 'POST', body: JSON.stringify({ text }) }); }
export async function reportSubmission(submissionId: string, reason: string) { await apiRequest(`/submissions/${submissionId}/report/`, { method: 'POST', body: JSON.stringify({ reason }) }); }
export function fetchReports() { return apiRequest<(Report & { username: string; submission_payload: Record<string, unknown> })[]>('/moderation/reports/'); }
export async function updateReportStatus(reportId: string, status: 'reviewed' | 'resolved' | 'dismissed') { await apiRequest(`/moderation/reports/${reportId}/`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
export async function updateSubmissionVerification(submissionId: string, status: 'verified' | 'rejected' | 'flagged') { await apiRequest(`/submissions/${submissionId}/verification/`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
export async function fetchGlobalLeaderboard(limit = 50) { return (await apiRequest<LeaderboardEntry[]>(`/leaderboard/global/?limit=${limit}`)).slice(0, limit); }
export function fetchChallengeLeaderboard(challengeId: string) { return apiRequest<ChallengeLeaderboardEntry[]>(`/leaderboard/${challengeId}/`); }
export function fetchScoreBreakdown(submissionId: string) { return apiRequest<ScoreBreakdown | null>(`/submissions/${submissionId}/score/`).catch((error: Error) => { if (error.message.includes('(404)')) return null; throw error; }); }
export async function recomputeScores() { return undefined; }
export function fetchProfile(userId: string) { return apiRequest<Profile>(`/users/${userId}/stats/`); }
export async function updateProfile(updates: Partial<Profile>) { await apiRequest(`/users/${updates.id}/stats/`, { method: 'PATCH', body: JSON.stringify(updates) }); }
export function fetchProfileByUsername(username: string) { return apiRequest<Profile>(`/users/by-username/${encodeURIComponent(username)}/stats/`); }