# Challenge Platform API

This Django REST API is the policy boundary for challenge data, submissions, votes, reports, and leaderboard scoring. It uses the database configured by Django's `DATABASE_URL` and local browser sessions for development authentication.

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