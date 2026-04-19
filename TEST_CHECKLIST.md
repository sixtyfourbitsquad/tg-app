# TEST CHECKLIST — NFWS App

Quick-reference checklist for verifying every system component.

---

## Setup

```bash
cp .env.example .env           # fill in your values
npm install --legacy-peer-deps
npm run db:generate
npm run db:migrate              # enter migration name: "init"
npm run db:seed                 # seeds 10 test videos
npm run dev                     # http://localhost:3000
```

Replace `<VIDEO_ID>` below with any ID from `GET /api/videos`.

---

## Health Check

```bash
# Expect: { "status": "ok", "services": { "database": "ok", "redis": "ok" } }
curl http://localhost:3000/api/health | jq
```

| Check | Expected |
|-------|----------|
| `status` = `"ok"` | Both DB and Redis connected |
| `status` = `"degraded"` | One service down |
| `status` = `"down"` | HTTP 503 |

---

## GET /api/videos — Feed with Cursor Pagination

```bash
# First page
curl "http://localhost:3000/api/videos" | jq

# With limit
curl "http://localhost:3000/api/videos?limit=3" | jq

# Filtered by category
curl "http://localhost:3000/api/videos?category=amateur" | jq

# Next page — use nextCursor from previous response
curl "http://localhost:3000/api/videos?cursor=2025-01-01T00:00:00.000Z" | jq

# Sorted by popular
curl "http://localhost:3000/api/videos?sort=popular" | jq
```

**Expected fields:** `videos[]`, `nextCursor`, `hasMore`, `like_count`, `save_count`

---

## GET /api/categories — With Video Counts

```bash
curl http://localhost:3000/api/categories | jq
```

**Expected:** Array with `id, name, slug, video_count`

---

## POST /api/videos/[id]/like — Toggle Like

```bash
VIDEO_ID="<paste a real video ID>"

# Like
curl -X POST "http://localhost:3000/api/videos/$VIDEO_ID/like" | jq
# Expected: { "liked": true, "count": 1 }

# Unlike (same request)
curl -X POST "http://localhost:3000/api/videos/$VIDEO_ID/like" | jq
# Expected: { "liked": false, "count": 0 }
```

---

## POST /api/videos/[id]/save — Toggle Save

```bash
VIDEO_ID="<paste a real video ID>"

# Save
curl -X POST "http://localhost:3000/api/videos/$VIDEO_ID/save" | jq
# Expected: { "saved": true, "count": 1 }

# Unsave
curl -X POST "http://localhost:3000/api/videos/$VIDEO_ID/save" | jq
# Expected: { "saved": false, "count": 0 }
```

---

## POST /api/videos/[id]/view — Record Watch Event

```bash
VIDEO_ID="<paste a real video ID>"

# Partial view
curl -X POST "http://localhost:3000/api/videos/$VIDEO_ID/view" \
  -H "Content-Type: application/json" \
  -d '{"watch_time":30,"completed":false}' | jq

# Completed view
curl -X POST "http://localhost:3000/api/videos/$VIDEO_ID/view" \
  -H "Content-Type: application/json" \
  -d '{"watch_time":90,"completed":true}' | jq

# Expected: { "ok": true }
# Side effect: video.views incremented by 1 in DB
```

Verify in DB:
```bash
npm run db:studio
# → check watch_events table and video.views column
```

---

## GET /api/analytics/[id] — Video Analytics

```bash
VIDEO_ID="<paste a real video ID>"

curl "http://localhost:3000/api/analytics/$VIDEO_ID" | jq
```

**Expected:**
```json
{
  "video_id": "...",
  "total_views": 4,
  "avg_watch_time": 60,
  "completion_rate": 50,
  "views_per_day": [
    { "date": "2026-04-13", "views": 0 },
    ...
    { "date": "2026-04-19", "views": 4 }
  ]
}
```

---

## POST /api/pipeline — Trigger Pipeline via API

```bash
# Requires NEXTAUTH_SECRET set in .env
SECRET=$(grep NEXTAUTH_SECRET .env | cut -d= -f2 | tr -d '"')

curl -X POST "http://localhost:3000/api/pipeline" \
  -H "x-pipeline-token: $SECRET" | jq
```

```bash
# View last 20 pipeline logs
curl "http://localhost:3000/api/pipeline" \
  -H "x-pipeline-token: $SECRET" | jq
```

---

## Redis Caching Verification

```bash
# 1. First request — populates cache
curl "http://localhost:3000/api/videos" > /dev/null

# 2. Check Redis keys
redis-cli KEYS "videos:*"
redis-cli KEYS "categories:*"

# 3. Inspect cached value
redis-cli GET "videos:all:initial" | python3 -m json.tool | head -20

# 4. Second request — check dev server logs for "cache hit"
curl "http://localhost:3000/api/videos" > /dev/null

# 5. After a like, the cache key is invalidated:
curl -X POST "http://localhost:3000/api/videos/<ID>/like"
redis-cli GET "videos:all:initial"   # should be nil
```

---

## Rate Limiting

```bash
# Hammer 110 requests — should get 429 after 100
for i in $(seq 1 110); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/videos")
  echo "Request $i: $STATUS"
done
```

Expected: requests 101–110 return `429 Too Many Requests`.

---

## Pipeline — Manual One-Shot

```bash
# Requires REDDIT_CLIENT_ID, REDDIT_SECRET, GCP_* in .env
npm run pipeline:run

# Expected output:
# {
#   "status": "success",
#   "videos_fetched": 5,
#   "errors": []
# }
```

Check pipeline logs table:
```bash
npm run db:studio
# → pipeline_logs table
```

---

## Pipeline — Scheduler Daemon

```bash
# Start scheduler (runs on PIPELINE_CRON schedule)
npm run pipeline:scheduler

# Output: "Pipeline scheduler starting — cron: 0 */6 * * *"
# Ctrl+C to stop
```

---

## UI Testing — Browser Checklist

1. Open `http://localhost:3000`
2. **Scroll-snap feed** — swipe/scroll between videos, each card should snap to full screen
3. **Autoplay** — video at 90% visibility plays; scrolling away pauses it
4. **Category tabs** — tap each tab, animated underline follows; feed reloads for that category
5. **Like button** — heart turns red, count animates up; tap again → undone
6. **Save button** — bookmark fills, count animates up; tap again → undone
7. **Share button** — native share sheet or bottom sheet opens
8. **Loading more** — scroll to end of feed, spinner appears, new videos append
9. **Skeleton states** — in DevTools → Network → Slow 3G, reload; skeleton cards appear before videos
10. **Memory cleanup** — scroll past 10+ videos; verify no memory leak in DevTools → Performance

---

## Verify DB Records (Prisma Studio)

```bash
npm run db:studio
# http://localhost:5555
```

| Table | What to check |
|-------|---------------|
| `videos` | 10 seeded entries with correct URLs |
| `categories` | 10 categories with slugs |
| `likes` | toggles correctly |
| `saves` | toggles correctly |
| `watch_events` | created on pause/end events |
| `pipeline_logs` | created after each pipeline run |

---

## Docker Compose — Full Stack

```bash
# Build and start
docker compose up -d --build

# Check all containers are healthy
docker compose ps

# App logs
docker compose logs -f app

# Pipeline logs
docker compose logs -f pipeline

# Run migrations inside container
docker compose exec app npx prisma migrate deploy

# Seed inside container
docker compose exec app npm run db:seed

# Verify health
curl http://localhost:3000/api/health | jq

# Stop
docker compose down
```

---

## VPS Health Check URLs (after deploy)

```
GET  https://your-domain.com/api/health
GET  https://your-domain.com/api/categories
GET  https://your-domain.com/api/videos
GET  https://your-domain.com/api/analytics/<video-id>
POST https://your-domain.com/api/pipeline   (x-pipeline-token header)
```

All should return JSON with HTTP 200.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `PrismaClientInitializationError` | Check `DATABASE_URL`, run `npm run db:migrate` |
| `ECONNREFUSED redis` | Start Redis: `redis-server` or `docker compose up redis` |
| Videos not playing | Check `video.url` is reachable; open URL directly in browser |
| `429 Too Many Requests` in tests | Wait 60s for rate limit window to reset |
| Pipeline: `0 videos_fetched` | Verify Reddit credentials; check score filter (MIN_SCORE=100) |
| Docker build fails | Run `docker compose build --no-cache` |
| Nginx 502 Bad Gateway | Check `docker compose ps` — app container must be healthy |
| SSL cert fails | Ensure port 80 is open; check domain DNS points to VM IP |
