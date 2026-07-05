# Kuwait Salons API

Backend API for Kuwait Women's Salons booking platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Edit `.env` and add your:
   - MongoDB password
   - Gmail app password
   - JWT secret

4. Start server:
```bash
npm start
```

## Deploy to Render.com

1. Push code to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Set environment variables from `.env`
5. Build Command: `npm install`
6. Start Command: `npm start`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| GET | /api/salons | List salons |
| GET | /api/salons/:id | Get salon details |
| POST | /api/salons | Create salon (admin) |
| PUT | /api/salons/:id | Update salon (admin) |
| DELETE | /api/salons/:id | Delete salon (admin) |
| POST | /api/bookings | Create booking |
| GET | /api/bookings | My bookings |
| PUT | /api/bookings/:id/cancel | Cancel booking |
| POST | /api/reviews | Leave review |
| POST | /api/favorites/:id | Toggle favorite |
| GET | /api/favorites | My favorites |
| GET | /api/admin/users | All users (admin) |
| GET | /api/admin/bookings | All bookings (admin) |
| GET | /api/admin/stats | Dashboard stats (admin) |
