# Challenge Platform API

This Django REST API is the policy boundary for challenge data, submissions, votes, reports, and leaderboard scoring. It uses Supabase Postgres through Django's `DATABASE_URL`, validates Supabase JWTs with `SUPABASE_JWT_SECRET`, and leaves Supabase Auth and Storage as the identity and file-upload providers.

## Local setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver
```

The API is available at `http://127.0.0.1:8000/api/`. The frontend can target it with `VITE_API_URL`.