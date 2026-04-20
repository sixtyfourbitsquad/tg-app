#!/usr/bin/env python3
"""
Download every video from a Telegram channel to a local folder.

Run this on a PC (not the VPS):

    pip install telethon tqdm
    python scripts/download-tg-channel.py

Fill in API_ID / API_HASH / CHANNEL below before running. Obtain the API
credentials at https://my.telegram.org (API development tools).

Behavior:
  * Iterates the channel history newest -> oldest in batches of BATCH_SIZE.
  * Keeps only messages whose media is a video (message.video, or a document
    with a video/* mime type, or common video extensions).
  * Skips files larger than MAX_SIZE_MB.
  * Skips files that already exist on disk with the expected size.
  * Saves every video to OUTPUT_DIR with a stable, collision-safe filename
    (<message_id>_<original_name>.<ext>).
  * Shows a per-file progress bar and prints a summary at the end.
"""

from __future__ import annotations

import asyncio
import mimetypes
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

try:
    from telethon import TelegramClient
    from telethon.tl.types import (
        Document,
        DocumentAttributeFilename,
        DocumentAttributeVideo,
        Message,
        MessageMediaDocument,
    )
except ImportError:  # pragma: no cover - user-facing import guard
    sys.stderr.write(
        "telethon is not installed. Run: pip install telethon tqdm\n"
    )
    sys.exit(1)

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    sys.stderr.write("tqdm is not installed. Run: pip install telethon tqdm\n")
    sys.exit(1)


# ──────────────────────────── Config ─────────────────────────────
API_ID = ""            # e.g. "1234567"  (string or int both work)
API_HASH = ""          # e.g. "abcdef0123456789abcdef0123456789"
CHANNEL = ""           # @username, public link, or numeric id
OUTPUT_DIR = "./downloaded_videos"
BATCH_SIZE = 500       # how many messages to pull per iter_messages() batch
MAX_SIZE_MB = 15       # videos larger than this are skipped
SESSION_NAME = "tg_downloader"  # creates tg_downloader.session next to script
# ─────────────────────────────────────────────────────────────────


MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024
VIDEO_EXTENSIONS = {
    ".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi", ".gif",
    ".3gp", ".ts", ".mpg", ".mpeg",
}
SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


@dataclass
class VideoMedia:
    message_id: int
    size: int
    filename: str


def _log(msg: str) -> None:
    print(msg, flush=True)


def _fatal(msg: str) -> "never":
    sys.stderr.write(f"error: {msg}\n")
    sys.exit(1)


def _sanitize(name: str) -> str:
    name = name.strip().replace(" ", "_")
    name = SAFE_NAME_RE.sub("_", name)
    return name.strip("._-") or "video"


def _ext_from_mime(mime: Optional[str]) -> str:
    if not mime:
        return ".mp4"
    guessed = mimetypes.guess_extension(mime)
    return guessed if guessed else ".mp4"


def _filename_for(message: Message, doc: Document) -> str:
    """Build <message_id>_<original or synthesized name>.<ext>."""
    original: Optional[str] = None
    for attr in doc.attributes:
        if isinstance(attr, DocumentAttributeFilename) and attr.file_name:
            original = attr.file_name
            break

    if original:
        stem, dot, ext = original.rpartition(".")
        if dot:
            safe = f"{_sanitize(stem)}.{_sanitize(ext).lower()}"
        else:
            safe = f"{_sanitize(original)}{_ext_from_mime(doc.mime_type)}"
    else:
        safe = f"video{_ext_from_mime(doc.mime_type)}"

    return f"{message.id}_{safe}"


def _classify(message: Message) -> Optional[VideoMedia]:
    """Return VideoMedia if the message contains a downloadable video."""
    # Fast path: telethon exposes message.video for native videos.
    doc: Optional[Document] = None
    if getattr(message, "video", None) is not None:
        doc = message.video  # type: ignore[assignment]
    elif isinstance(message.media, MessageMediaDocument) and isinstance(
        message.media.document, Document
    ):
        doc = message.media.document

    if doc is None:
        return None

    mime = (doc.mime_type or "").lower()
    has_video_attr = any(
        isinstance(a, DocumentAttributeVideo) for a in doc.attributes
    )
    looks_like_video = (
        mime.startswith("video/")
        or has_video_attr
        or any(
            isinstance(a, DocumentAttributeFilename)
            and a.file_name
            and Path(a.file_name).suffix.lower() in VIDEO_EXTENSIONS
            for a in doc.attributes
        )
    )
    if not looks_like_video:
        return None

    return VideoMedia(
        message_id=message.id,
        size=int(doc.size or 0),
        filename=_filename_for(message, doc),
    )


def _validate_config() -> None:
    missing: list[str] = []
    if not str(API_ID).strip():
        missing.append("API_ID")
    if not API_HASH.strip():
        missing.append("API_HASH")
    if not CHANNEL.strip():
        missing.append("CHANNEL")
    if missing:
        _fatal(
            "missing config values: "
            + ", ".join(missing)
            + ". Edit the Config block at the top of this script."
        )
    try:
        int(API_ID)
    except (TypeError, ValueError):
        _fatal("API_ID must be numeric (get it from https://my.telegram.org).")


async def run() -> int:
    _validate_config()

    out_dir = Path(OUTPUT_DIR).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    _log(f"Output folder : {out_dir}")
    _log(f"Channel       : {CHANNEL}")
    _log(f"Batch size    : {BATCH_SIZE}")
    _log(f"Max size      : {MAX_SIZE_MB} MB")
    _log("")

    # Keep session file next to the script so re-runs don't re-auth.
    session_path = Path(__file__).resolve().parent / SESSION_NAME

    stats = {
        "found": 0,
        "downloaded": 0,
        "skipped_exists": 0,
        "skipped_too_large": 0,
        "skipped_non_video": 0,
        "errors": 0,
    }

    async with TelegramClient(str(session_path), int(API_ID), API_HASH) as client:
        try:
            entity = await client.get_entity(CHANNEL)
        except Exception as exc:
            _fatal(f"could not resolve channel '{CHANNEL}': {exc}")

        title = getattr(entity, "title", None) or getattr(entity, "username", None) or str(entity)
        _log(f"Resolved channel: {title}")

        offset_id = 0
        batch_index = 0

        while True:
            batch_index += 1
            batch: list[Message] = []
            async for msg in client.iter_messages(
                entity, limit=BATCH_SIZE, offset_id=offset_id
            ):
                batch.append(msg)

            if not batch:
                break

            _log(f"\nBatch {batch_index}: scanning {len(batch)} messages (offset_id={offset_id})")

            videos: list[tuple[Message, VideoMedia]] = []
            for msg in batch:
                info = _classify(msg)
                if info is None:
                    if msg.media is not None:
                        stats["skipped_non_video"] += 1
                    continue
                stats["found"] += 1
                videos.append((msg, info))

            for msg, info in videos:
                target = out_dir / info.filename

                if info.size > MAX_SIZE_BYTES:
                    stats["skipped_too_large"] += 1
                    _log(
                        f"  skip (too large {info.size / 1024 / 1024:.1f} MB) "
                        f"msg#{info.message_id} {info.filename}"
                    )
                    continue

                if target.exists() and (info.size == 0 or target.stat().st_size == info.size):
                    stats["skipped_exists"] += 1
                    continue

                try:
                    with tqdm(
                        total=info.size if info.size > 0 else None,
                        unit="B",
                        unit_scale=True,
                        unit_divisor=1024,
                        desc=info.filename[:40],
                        leave=False,
                    ) as bar:
                        def _progress(current: int, total: int, _bar=bar) -> None:
                            if total and _bar.total is None:
                                _bar.total = total
                            _bar.n = current
                            _bar.refresh()

                        tmp = target.with_suffix(target.suffix + ".part")
                        await client.download_media(msg, file=str(tmp), progress_callback=_progress)
                        os.replace(tmp, target)

                    stats["downloaded"] += 1
                    _log(f"  done  msg#{info.message_id} {info.filename}")
                except Exception as exc:
                    stats["errors"] += 1
                    _log(f"  ERROR msg#{info.message_id} {info.filename}: {exc}")
                    tmp = target.with_suffix(target.suffix + ".part")
                    if tmp.exists():
                        try:
                            tmp.unlink()
                        except OSError:
                            pass

            # Paginate older: offset_id must be the smallest id we just saw.
            offset_id = min(m.id for m in batch)
            if len(batch) < BATCH_SIZE:
                break

    _log("")
    _log("──────── Summary ────────")
    _log(f"Videos found        : {stats['found']}")
    _log(f"Downloaded          : {stats['downloaded']}")
    _log(f"Skipped (exists)    : {stats['skipped_exists']}")
    _log(f"Skipped (>{MAX_SIZE_MB}MB)     : {stats['skipped_too_large']}")
    _log(f"Skipped (non-video) : {stats['skipped_non_video']}")
    _log(f"Errors              : {stats['errors']}")
    _log(f"Output              : {out_dir}")

    return 2 if stats["errors"] > 0 else 0


def main() -> None:
    try:
        code = asyncio.run(run())
    except KeyboardInterrupt:
        _log("\nInterrupted.")
        code = 130
    sys.exit(code)


if __name__ == "__main__":
    main()
