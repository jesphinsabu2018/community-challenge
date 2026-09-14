from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AdminDashboardView, AdminLoginView, AdminParticipationView, ChallengeLeaderboardView, ChallengeViewSet, ParticipationViewSet, PeerReviewViewSet, ProfileView, ReviewAssignmentViewSet, SubmissionViewSet, VoteViewSet

router = DefaultRouter()
router.register('challenges', ChallengeViewSet, basename='challenge')
router.register('participations', ParticipationViewSet, basename='participation')
router.register('submissions', SubmissionViewSet, basename='submission')
router.register('peer-reviews', PeerReviewViewSet, basename='peer-review')
router.register('review-assignments', ReviewAssignmentViewSet, basename='review-assignment')
router.register('votes', VoteViewSet, basename='vote')

urlpatterns = [
    path('admin/login/', AdminLoginView.as_view(), name='admin-login'),
    path('admin/dashboard/', AdminDashboardView.as_view(), name='admin-dashboard'),
    path('admin/participation/', AdminParticipationView.as_view(), name='admin-participation'),
    path('', include(router.urls)),
    path('leaderboard/<uuid:challenge_id>/', ChallengeLeaderboardView.as_view(), name='challenge-leaderboard'),
    path('users/<uuid:user_id>/stats/', ProfileView.as_view(), name='profile'),
]
