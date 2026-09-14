from rest_framework import authentication


class LocalUserAuthentication(authentication.BaseAuthentication):
    """Use the browser's local user ID for development authentication."""

    def authenticate(self, request):
        user_id = request.headers.get('X-User-ID')
        if not user_id:
            return None
        return LocalUser(user_id), None


class LocalUser:
    is_authenticated = True

    def __init__(self, user_id):
        self.id = user_id

    def __str__(self):
        return self.id