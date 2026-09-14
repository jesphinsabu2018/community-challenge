import os

import jwt
from rest_framework import authentication, exceptions


class SupabaseJWTAuthentication(authentication.BaseAuthentication):
    """Validate Supabase access tokens and expose the subject as request.user."""

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).split()
        if not header:
            return None
        if header[0].lower() != b'bearer' or len(header) != 2:
            raise exceptions.AuthenticationFailed('Use a Bearer access token.')
        secret = os.getenv('SUPABASE_JWT_SECRET', '')
        if not secret:
            raise exceptions.AuthenticationFailed('SUPABASE_JWT_SECRET is not configured.')
        try:
            payload = jwt.decode(header[1], secret, algorithms=['HS256'], audience='authenticated')
        except jwt.PyJWTError as error:
            raise exceptions.AuthenticationFailed('Invalid Supabase access token.') from error
        subject = payload.get('sub')
        if not subject:
            raise exceptions.AuthenticationFailed('Token has no user subject.')
        return SupabaseUser(subject, payload), payload


class SupabaseUser:
    is_authenticated = True

    def __init__(self, user_id, claims):
        self.id = user_id
        self.claims = claims

    def __str__(self):
        return self.id