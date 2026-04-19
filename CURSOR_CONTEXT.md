# VaultX — Cursor AI Handoff Context

## What This Project Is
A TikTok-style NSFW video feed web app + Telegram bot.
- Users open the web app, scroll through videos (full-screen snap feed)
- Videos are sourced from Redgifs API and stored in PostgreSQL
- Telegram bot (@XXreels_bot) lets users connect their Telegram account to the app
- Likes, saves, watch history are tracked per user

---

## Tech Stack
- **Frontend**: Next.js 16 App Router, TypeScript strict, Tailwind CSS, DaisyUI, Framer Motion, Lucide React
- **Backend**: Next.js API routes (App Router)
- **Database**: PostgreSQL via Prisma ORM
- **Cache**: Redis (ioredis)
- **Bot**: Telegraf (Telegram bot framework)
- **Video source**: Redgifs API v2 (no GCS/ffmpeg — direct CDN streaming via proxy)
- **Auth**: IP fingerprint (anonymous) + Telegram ID (connected users), httpOnly cookie `tg_id`

---

## VPS Info
- **IP**: 35.200.162.160
- **Port**: 3000
- **OS**: Ubuntu (GCP)
- **App path**: `/home/adii/tg-app`
- **Run app**: `npm run start` (after `npm run build`)
- **Run bot**: `npm run bot` (separate terminal/tmux window)
- **Run pipeline**: `npm run pipeline:run`

---

## Environment Variables (`.env` on VPS)
```
DATABASE_URL="postgresql://nfws_user:PASSWORD@localhost:5432/nfws_db"
REDIS_URL="redis://localhost:6379"
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://35.200.162.160:3000"
NEXT_PUBLIC_APP_URL="http://35.200.162.160:3000"
REDGIFS_SEARCH_TAGS="indian,desi,hindi,punjabi,bengali,tamil,telugu,malayalam,bangladeshi,pakistani,nepali,indian amateur,desi bhabhi,desi wife,indian teen,indian college,desi couple"
PIPELINE_LIMIT="50"
PIPELINE_CRON="0 */6 * * *"
TELEGRAM_BOT_TOKEN="..."
NODE_ENV="production"
LOG_LEVEL="info"
```

---

## Database Schema (Prisma)
```prisma
model User {
  id             String    @id @default(cuid())
  ip_fingerprint String?   @unique   // anonymous users
  telegram_id    BigInt?   @unique   // connected Telegram users
  username       String?             // Telegram @username
  is_premium     Boolean   @default(false)
  created_at     DateTime  @default(now())
  likes          Like[]
  saves          Save[]
  watch_events   WatchEvent[]
}

model Video {
  id          String   @id @default(cuid())
  url         String             // Redgifs CDN URL (may expire)
  thumbnail   String
  title       String
  category_id String
  duration    Int      @default(0)
  views       Int      @default(0)
  reddit_id   String?  @unique   // Redgifs gif ID (used as dedup key)
  created_at  DateTime @default(now())
  category    Category
  likes       Like[]
  saves       Save[]
  watch_events WatchEvent[]
}

model Category {
  id     String  @id @default(cuid())
  name   String  @unique
  slug   String  @unique
  videos Video[]
}

model Like      { user_id String; video_id String; @@id([user_id, video_id]) }
model Save      { user_id String; video_id String; @@id([user_id, video_id]) }
model WatchEvent { id String; user_id String; video_id String; watch_time Int; completed Boolean; created_at DateTime }
model PipelineLog { id String; status String; videos_fetched Int; errors Json?; ran_at DateTime }
```

---

## Project Structure

```
app/
  layout.tsx              — root layout, adds Telegram WebApp script, wraps with UserProvider + ToastProvider
  globals.css
  (main)/
    layout.tsx            — adds BottomNav (top nav bar)
    page.tsx              — main feed (full-screen snap scroll, randomized on refresh)
    explore/page.tsx      — category grid (2 cols), tap → /?cat=slug
    saved/page.tsx        — user's saved videos grid
    profile/page.tsx      — profile: stats, Telegram connect, subscription
  api/
    videos/route.ts       — GET feed (cursor pagination, shuffle on initial load)
    videos/[id]/like      — POST like/unlike
    videos/[id]/save      — POST save/unsave
    videos/[id]/view      — POST increment view count
    redgifs/[id]/route.ts — GET proxy: fetches from Redgifs with auth, streams video
    categories/route.ts   — GET all categories with video counts
    profile/route.ts      — GET user profile (stats + saved videos)
    auth/connect/route.ts — POST generate connect code / GET resolve code
    auth/telegram/route.ts — POST validate Telegram initData (HMAC), upsert user
    analytics/[id]        — GET video analytics
    pipeline/route.ts     — POST trigger pipeline manually
    health/route.ts       — GET health check

components/
  VideoCard.tsx           — full-screen video card (autoplay, mute/unmute, like/save/share)
  BottomNav.tsx           — top nav: Home/Explore/Saved/Profile icons (transparent on feed)
  ui/                     — Skeleton, Toast, Tag, BottomSheet, AnimatedCount, etc.

context/
  UserContext.tsx         — global user state (Telegram user from WebApp SDK)

hooks/
  useVideoFeed.ts         — infinite scroll feed with cursor pagination
  useInteraction.ts       — like/save state management
  useWatchEvent.ts        — watch time tracking
  useTelegramUser.ts      — re-exports useUser from UserContext
  useCategories.ts        — fetch categories list
  useIntersectionObserver.ts — visibility detection for autoplay

lib/
  db.ts                   — Prisma client singleton
  redis.ts                — ioredis client + cacheGet/cacheSet/cacheDel helpers
  fingerprint.ts          — getFingerprint() (IP hash) + getTelegramId() (header/cookie)
  telegram.ts             — getTelegramWebAppUser(), getTelegramInitData()
  user.ts                 — resolveUser() — finds user by telegram_id or ip_fingerprint
  logger.ts               — winston logger
  ratelimit.ts            — rate limiting middleware

pipeline/
  reddit.ts               — Redgifs API: getRedgifsToken(), fetchRedgifsVideos(), processGif()
  runner.ts               — runPipeline(): fetches videos, deduplicates, saves to DB
  scheduler.ts            — node-cron scheduler, --run flag for one-shot

bot/
  index.ts                — Telegraf bot: /start, /connect CODE, /profile commands
```

---

## Key Architecture Decisions

### Video Streaming
Videos are NOT stored anywhere — Redgifs CDN URLs are stored in DB.
On playback, `/api/redgifs/[id]` proxy:
1. Gets temp token from Redgifs (cached 1hr in Redis)
2. Fetches gif info to get HD/SD URL (cached 30min per ID)
3. Streams video through our server with proper range request support
This is needed because Redgifs CDN requires `Authorization: Bearer TOKEN` header which `<video src>` can't send directly.

### User Identity
- Anonymous: IP+UA+Lang hash stored as `ip_fingerprint`
- Telegram: `telegram_id` (BigInt) set via connect flow or bot registration
- Server reads `x-telegram-id` header OR `tg_id` httpOnly cookie
- `resolveUser()` in `lib/user.ts` handles both cases

### Telegram Connect Flow (HTTP-safe, no HTTPS needed)
1. User taps "Connect" in Profile page
2. App calls `POST /api/auth/connect` → generates 6-char code, stores `code → user_id` in Redis (10min TTL)
3. App redirects to `https://t.me/XXreels_bot?start=connect_CODE`
4. Bot receives `/start connect_CODE`, calls `GET /api/auth/connect?code=CODE` (via localhost:3000)
5. Bot updates user record with `telegram_id`
6. Profile page auto-refreshes via `visibilitychange` event when user returns

### Feed Randomization
On initial page load (no cursor): fetches up to 100 videos, shuffles randomly, returns first 10.
On scroll (cursor present): normal chronological order with Redis cache (5min TTL).

---

## What's Working
- ✅ Full video feed with autoplay, mute/unmute, like/save/share
- ✅ Video proxy streaming from Redgifs (with auth)
- ✅ Pipeline: fetches Indian/Desi content from Redgifs every 6 hours
- ✅ Bottom-style nav bar (actually at top, transparent on feed)
- ✅ Explore page with category grid
- ✅ Saved videos page
- ✅ Profile page with stats
- ✅ Telegram bot: /start welcome, /connect CODE, /profile
- ✅ Telegram account linking via deep link
- ✅ Profile shows green "Connected" badge after linking
- ✅ Anonymous user tracking via IP fingerprint
- ✅ Cursor-based infinite scroll pagination

---

## Known Issues / TODO

### High Priority
- ❌ **No HTTPS** — app runs on HTTP. Telegram Mini App WebApp button requires HTTPS. Need to set up domain + SSL (nginx + certbot or Cloudflare tunnel). Current workaround: use regular URL button in bot.
- ❌ **No sound on some videos** — Redgifs content may not have audio tracks. Mute toggle works but many videos are silent by nature.
- ❌ **Category tabs removed** — categories were moved to Explore page. Users might not discover the Explore tab. Consider adding category filter chips somewhere.

### Medium Priority
- ⚠️ **Telegram auth not fully wired** — `UserContext` reads from `Telegram.WebApp.initDataUnsafe` but since app is HTTP (not HTTPS Mini App), this is always null in browser. The connect-code flow works but `x-telegram-id` header isn't being sent automatically from frontend on every request.
- ⚠️ **Profile page doesn't reload after connect** unless user manually navigates away and back. `visibilitychange` helps but not 100% reliable on all mobile browsers.
- ⚠️ **Redgifs URL expiry** — stored URLs expire. The proxy fetches fresh URLs per-request but if Redis cache has stale URL, video may fail. TTL is 30min for URLs and 1hr for token.

### Low Priority
- Video comments (model not created yet — UI shows 0 comments placeholder)
- Premium subscription logic (is_premium flag exists but no payment integration)
- Share link → Telegram bot deep link (user asked to implement later)
- Admin dashboard (pipeline logs, video management)

---

## npm Scripts
```bash
npm run dev              # Next.js dev server
npm run build            # Production build
npm run start            # Production server
npm run bot              # Telegram bot (tsx --env-file .env bot/index.ts)
npm run pipeline:run     # One-shot pipeline run
npm run pipeline:scheduler # Pipeline with cron
npm run db:migrate       # Prisma migrate dev
npm run db:generate      # Prisma generate client
npm run db:studio        # Prisma Studio GUI
```

---

## Deployment (VPS)
Two processes must run simultaneously (use tmux):
```bash
tmux new-session -d -s app -n server 'npm run start'
tmux new-window -t app -n bot 'npm run bot'
tmux attach -t app
```
Switch windows: `Ctrl+B` then `0` or `1`.

After any code change:
```bash
git pull
npm install --legacy-peer-deps  # if package.json changed
npm run build
npm run start
# Restart bot separately
```

---

## GitHub Repo
`https://github.com/sixtyfourbitsquad/tg-app`
Auth: Personal Access Token in remote URL.

---

## Next Steps (Suggested)
1. **Set up HTTPS** with a domain + nginx + certbot so Telegram Mini App works properly
2. **Fix x-telegram-id header** — send it automatically from all frontend API calls using the UserContext
3. **Payment/premium** — integrate Telegram Stars or external payment
4. **Comments** — add Comment model to schema, comment UI in VideoCard
5. **Share button** — deep link to `t.me/XXreels_bot?start=video_VIDEO_ID`
6. **More video sources** — can extend pipeline/reddit.ts to add more APIs
