# TEST GUIDE — NFWS TG Reddit API

Complete instructions for testing every feature locally and on a VPS.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| PostgreSQL | 14+ |
| Redis | 7+ |
| ffmpeg | system binary |
| GCP account | for GCS (optional for seed-only tests) |

---

## 1. Initial Setup

```bash
# Clone & install
npm install

# Copy env
cp .env.example .env
# Edit .env with your real values

# Generate Prisma client
npm run db:generate
```

---

## 2. Database

### Start PostgreSQL locally
```bash
# macOS (Homebrew)
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Create database
psql -U postgres -c "CREATE DATABASE nfws_db;"
```

### Run migrations
```bash
npm run db:migrate
# Prompts for migration name — use "init"
```

### Seed test data (10 videos, no pipeline needed)
```bash
npm run db:seed
```

Expected output:
```
Seeding categories...
Seeding test videos...
Seeding test user...
Seed complete.
```

### Inspect data
```bash
npm run db:studio
# Opens Prisma Studio at http://localhost:5555
```

---

## 3. Redis

### Start Redis locally
```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Verify
redis-cli ping  # → PONG
```

### Test cache manually
```bash
redis-cli SET test "hello" EX 60
redis-cli GET test  # → hello
redis-cli DEL test
```

---

## 4. Run the Dev Server

```bash
npm run dev
# → http://localhost:3000
```

---

## 5. API Routes — Manual Testing

All routes can be tested with `curl` or any REST client (Postman, Bruno, etc).

### GET /api/videos
```bash
# All videos (paginated)
curl "http://localhost:3000/api/videos?page=1&per_page=5"

# Filter by category
curl "http://localhost:3000/api/videos?category=amateur"

# Sort by popular
curl "http://localhost:3000/api/videos?sort=popular"
```

**Expected:** JSON with `{ data, total, page, per_page, has_more }`

---

### GET /api/categories
```bash
curl "http://localhost:3000/api/categories"
```

**Expected:** Array of `{ id, name, slug }`

---

### POST /api/interactions — Like / Save
```bash
# First, get a video ID from /api/videos response

# Like a video
curl -X POST "http://localhost:3000/api/interactions" \
  -H "Content-Type: application/json" \
  -d '{"video_id":"<ID>","action":"like"}'

# Unlike
curl -X POST "http://localhost:3000/api/interactions" \
  -H "Content-Type: application/json" \
  -d '{"video_id":"<ID>","action":"unlike"}'

# Save
curl -X POST "http://localhost:3000/api/interactions" \
  -H "Content-Type: application/json" \
  -d '{"video_id":"<ID>","action":"save"}'
```

**Expected:** `{ "ok": true }`

---

### POST /api/interactions/watch — Watch event
```bash
curl -X POST "http://localhost:3000/api/interactions/watch" \
  -H "Content-Type: application/json" \
  -d '{"video_id":"<ID>","watch_time":45,"completed":false}'
```

**Expected:** `{ "ok": true }`
**Side effect:** `views` counter increments on the video row.

---

### POST /api/pipeline — Trigger pipeline
```bash
# Requires NEXTAUTH_SECRET in .env
curl -X POST "http://localhost:3000/api/pipeline" \
  -H "x-pipeline-token: <your NEXTAUTH_SECRET value>"
```

**Expected:** `{ status, videos_fetched, errors }`

### GET /api/pipeline — View logs
```bash
curl "http://localhost:3000/api/pipeline" \
  -H "x-pipeline-token: <your NEXTAUTH_SECRET value>"
```

---

## 6. UI Testing

1. Open `http://localhost:3000`
2. **Category filter** — click each tag, feed should refetch
3. **Video playback** — tap thumbnail, native HTML5 player opens
4. **Like button** — heart turns red (accent), optimistic update
5. **Save button** — bookmark fills in
6. **Share sheet** — tap share icon, bottom sheet slides up
7. **Load more** — click button, next page appends
8. **Skeleton states** — throttle network in DevTools → Network → Slow 3G, reload

---

## 7. Redis Caching Verification

```bash
# 1. Hit the endpoint once to populate cache
curl "http://localhost:3000/api/videos"

# 2. Check Redis
redis-cli KEYS "videos:*"
redis-cli GET "videos:all:latest:p1:pp10"

# 3. Second request should show "cache hit" in dev server logs
curl "http://localhost:3000/api/videos"
```

---

## 8. Pipeline — Local Test (requires Reddit API + GCS)

```bash
# Set in .env:
# REDDIT_CLIENT_ID, REDDIT_SECRET
# GCP_BUCKET, GCP_PROJECT_ID, GCP_KEY_FILE
# PIPELINE_SUBREDDITS=gifs
# PIPELINE_LIMIT=3

# Run directly (no upload — dry run if GCS not configured)
npm run pipeline:run
```

**Expected log output:**
```
info: Fetching r/gifs
info: Processed video abc123 from r/gifs
info: Pipeline complete { status: 'success', videos_fetched: 3, errors_count: 0 }
```

---

## 9. Google Cloud Storage — Integration Test

```bash
# Requires valid GCP_KEY_FILE and GCP_BUCKET in .env
node -e "
const { uploadBuffer } = require('./lib/gcs');
const buf = Buffer.from('test');
uploadBuffer(buf, 'test/hello.txt', 'text/plain')
  .then(url => console.log('Upload OK:', url))
  .catch(console.error);
"
```

---

## 10. Logger Output

```bash
# Development — colorized console
npm run dev

# Production — JSON to logs/
NODE_ENV=production npm start
tail -f logs/combined.log
tail -f logs/error.log
```

---

## 11. VPS Deployment Checklist

```bash
# 1. Install deps
npm ci --omit=dev

# 2. Generate Prisma client
npm run db:generate

# 3. Run migrations against production DB
DATABASE_URL="..." npx prisma migrate deploy

# 4. Build Next.js
npm run build

# 5. Start with PM2
pm2 start npm --name nfws -- start
pm2 save

# 6. Cron for pipeline (every 6 hours)
crontab -e
# Add: 0 */6 * * * cd /var/www/nfws && npm run pipeline:run >> /var/log/nfws-pipeline.log 2>&1
```

### Required environment variables on VPS
Ensure these are set (via `.env` file or systemd `EnvironmentFile`):

```
DATABASE_URL
REDIS_URL
GCP_BUCKET
GCP_PROJECT_ID
GCP_KEY_FILE
REDDIT_CLIENT_ID
REDDIT_SECRET
REDDIT_USER_AGENT
NEXTAUTH_SECRET
PIPELINE_SUBREDDITS
PIPELINE_LIMIT
NODE_ENV=production
LOG_LEVEL=info
```

---

## 12. Health Check Endpoints

After deploying, verify:

```bash
# App is up
curl https://your-domain.com/api/categories

# Pipeline auth works
curl -X GET https://your-domain.com/api/pipeline \
  -H "x-pipeline-token: <NEXTAUTH_SECRET>"
```

---

## 13. Troubleshooting

| Problem | Solution |
|---------|----------|
| `PrismaClientInitializationError` | Check `DATABASE_URL` and that Postgres is running |
| Redis connection refused | Check `REDIS_URL` and that Redis is running |
| `ENOENT gcp-service-account.json` | Create `secrets/` dir and place key file |
| ffmpeg not found | `sudo apt install ffmpeg` (Linux) or `brew install ffmpeg` (Mac) |
| Pipeline returns 0 videos | Verify subreddit has NSFW video posts and Reddit API credentials |
| Videos not streaming | Check `video.url` is publicly accessible or generate a signed URL |
