# /videos/

Served to the browser as `/videos/<filename>` (the exact value stored in
`Video.url` in the database).

You have three production-ready options — pick ONE:

## 1. Nginx alias (recommended for production)

Nginx intercepts `/videos/` **before** Next.js and streams the file directly
with Range support. See `nginx.conf` in the repo root for the exact block.

```nginx
location /videos/ {
    alias /home/adii/videos/;
    add_header Accept-Ranges bytes;
    add_header Cache-Control "public, max-age=3600";
}
```

With this in place, the `public/videos/` directory and the fallback Next
route are unused in production — nginx short-circuits everything.

## 2. Symlink this directory to the VPS store

On the VPS, replace this directory with a symlink to `/home/adii/videos`:

```bash
cd /path/to/app/public
rm -rf videos               # remove the placeholder dir
ln -s /home/adii/videos videos
```

or run the helper script from the repo root:

```bash
./scripts/setup-videos-symlink.sh
```

Next.js serves everything in `public/` with Range support out of the box.

## 3. Custom Next.js route (dev / no-nginx fallback)

`app/videos/[...path]/route.ts` streams files from `$VIDEOS_DIR` (default
`/home/adii/videos`) with Range support. It only activates when the file
does not already exist in `public/videos/` (Next's public/ takes precedence).

## Docker

`docker-compose.yml` mounts `$VIDEOS_DIR` into the container at
`/app/public/videos` read-only. Set `VIDEOS_DIR` in `.env` to point at the
host directory; default is `/home/adii/videos`.

Keep this README in the folder so the setup is discoverable. Do not commit
video files here.
