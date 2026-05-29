"""Local filesystem storage — saves images directly to the /picture COS mount.

On the production server, /picture is a cosfs-mounted Tencent Cloud COS bucket.
Images written there are immediately available to Nginx as static files.
"""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
from datetime import datetime
from loguru import logger


class LocalStorage:
    """Save processed images to local filesystem (/picture mount)."""

    def __init__(self, base_path: str = "/picture", base_url: str = ""):
        self._base_path = Path(base_path)
        self._base_url = base_url.rstrip("/")
        self._enabled = True

    @property
    def enabled(self) -> bool:
        return self._enabled

    def _ensure_dir(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _make_filename(source_url: str, index: int, is_thumb: bool = False) -> str:
        url_hash = hashlib.md5(source_url.encode()).hexdigest()[:12]
        suffix = "thumb" if is_thumb else "full"
        return f"{url_hash}_{index:03d}_{suffix}.webp"

    def save_bytes(self, data: bytes, property_id: int, filename: str) -> tuple[str, str] | None:
        """Save image bytes to disk. Returns (file_path, url)."""
        if not data:
            return None

        prop_dir = self._base_path / "properties" / str(property_id)
        self._ensure_dir(prop_dir)

        file_path = prop_dir / filename
        try:
            file_path.write_bytes(data)
            rel_path = str(file_path.relative_to(self._base_path)).replace("\\", "/")
            url = f"{self._base_url}/{rel_path}" if self._base_url else ""
            return str(file_path), url
        except Exception as e:
            logger.error(f"Failed to save image {filename}: {e}")
            return None

    def save_property_images(
        self, property_id: int, source_url: str, images: list[dict]
    ) -> list[dict]:
        """Save processed images for a property to local disk.

        Returns list of {source_url, oss_url, thumb_url, error} — keeps 'oss_url' key
        name for backward compatibility with the engine.
        """
        results = []
        for i, img in enumerate(images):
            img_url = ""
            thumb_url = ""
            error = None

            if img.get("full_bytes"):
                filename = self._make_filename(source_url, i, is_thumb=False)
                result = self.save_bytes(img["full_bytes"], property_id, filename)
                if result:
                    _, img_url = result

            if img.get("thumb_bytes"):
                filename = self._make_filename(source_url, i, is_thumb=True)
                result = self.save_bytes(img["thumb_bytes"], property_id, filename)
                if result:
                    _, thumb_url = result

            if not img_url and not img.get("full_bytes"):
                error = img.get("error") or "No image data"

            results.append({
                "source_url": img.get("url", ""),
                "oss_url": img_url,
                "thumb_url": thumb_url,
                "error": error,
            })

        return results

    def set_lifecycle_rule(self, days_after_end: int = 30) -> bool:
        """Local storage doesn't support lifecycle rules — no-op."""
        return True
