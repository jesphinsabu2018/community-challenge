import uuid

from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed


class LocalUserAuthentication(authentication.BaseAuthentication):
    """Authenticate the local frontend's X-User-ID header during development."""

    def authenticate(self, request):
        user_id = request.headers.get('X-User-ID')
        if not user_id:
            return None
        try:
            return LocalUser(uuid.UUID(user_id)), None
        except ValueError as error:
            raise AuthenticationFailed('X-User-ID must be a UUID.') from error


class LocalUser:
    is_authenticated = True

    def __init__(self, user_id):
        self.id = user_id
        self.pk = user_id

    def __str__(self):
        return self.id