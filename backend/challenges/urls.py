from django.urls import path

from .views import ChallengeDetailView, ChallengeListView, CommentView, JoinChallengeView, LeaderboardView, ModerationReportStatusView, ModerationReportsView, ModerationVerificationView, MySubmissionListView, ParticipantStatusView, ProfileByUsernameView, ProfileView, ReportView, ScoreBreakdownView, SubmissionListView, VoteListView, VoteView

urlpatterns = [
    path('challenges/', ChallengeListView.as_view()),
    path('challenges/<uuid:challenge_id>/', ChallengeDetailView.as_view()),
    path('challenges/<uuid:challenge_id>/join/', JoinChallengeView.as_view()),
    path('challenges/<uuid:challenge_id>/participant-status/', ParticipantStatusView.as_view()),
    path('challenges/<uuid:challenge_id>/submit/', SubmissionListView.as_view()),
    path('submissions/mine/', MySubmissionListView.as_view()),
    path('submissions/<uuid:submission_id>/vote/', VoteView.as_view()),
    path('submissions/<uuid:submission_id>/votes/', VoteListView.as_view()),
    path('submissions/<uuid:submission_id>/report/', ReportView.as_view()),
    path('submissions/<uuid:submission_id>/verification/', ModerationVerificationView.as_view()),
    path('submissions/<uuid:submission_id>/comments/', CommentView.as_view()),
    path('moderation/reports/', ModerationReportsView.as_view()),
    path('moderation/reports/<uuid:report_id>/', ModerationReportStatusView.as_view()),
    path('leaderboard/global/', LeaderboardView.as_view()),
    path('leaderboard/<uuid:challenge_id>/', LeaderboardView.as_view()),
    path('submissions/<uuid:submission_id>/score/', ScoreBreakdownView.as_view()),
    path('users/<uuid:user_id>/stats/', ProfileView.as_view()),
    path('users/by-username/<str:username>/stats/', ProfileByUsernameView.as_view()),
]