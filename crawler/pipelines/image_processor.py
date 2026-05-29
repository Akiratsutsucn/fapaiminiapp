"""Image download / resize / WebP compression pipeline.

Rules:
- Download real property photos from source URLs
- Resize for mobile viewing (max 1080px wide), maintain aspect ratio — never distort
- Convert to WebP (quality 80) for bandwidth efficiency
- Generate thumbnail variant (max 300px wide) for list cards
- Transform platform-specific thumbnail URLs to full-resolution
- Retry failed downloads with exponential backoff
"""
from __future__ import annotations

import asyncio
import io
import re
from PIL import Image, ImageFile
from loguru import logger

ImageFile.LOAD_TRUNCATED_IMAGES = True

MAX_WIDTH = 1080
THUMB_WIDTH = 300
WEBP_QUALITY = 80
REQUEST_TIMEOUT = 30
MAX_CONCURRENT_DOWNLOADS = 5


class ImageProcessor:
    """Download and process property images."""

    def __init__(self, http_client=None, extra_headers=None, cookies_str=""):
        self._client = http_client
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
        self._extra_headers = extra_headers or {}
        self._cookies = {}
        if cookies_str:
            for pair in cookies_str.split(";"):
                pair = pair.strip()
                if "=" in pair:
                    name, value = pair.split("=", 1)
                    self._cookies[name.strip()] = value.strip()

    @staticmethod
    def transform_image_url(url: str, platform: str = "") -> str:
        """Transform platform-specific thumbnail URLs to full-resolution."""
        if platform == "京东拍卖":
            # JD: replace small size markers with larger ones
            # s50x50 -> s800x800, n1.s -> n5.s (higher quality CDN node)
            url = re.sub(r'/s\d+x\d+', '/s800x800', url)
            url = re.sub(r'/n1\.s/', '/n0.s/', url)
        elif platform == "阿里拍卖":
            # Taobao CDN: _400x400.jpg -> .jpg (original size)
            url = re.sub(r'_\d+x\d+(.*?)\.(jpg|jpeg|png|webp)', r'\1.\2', url)
        return url

    @staticmethod
    def is_likely_non_photo(url: str) -> bool:
        """Filter out likely non-photo images (icons, logos, badges, SVGs)."""
        skip_patterns = [
            '/icon/', '/logo/', '/badge/', '/banner/',
            '.svg', 'btn_', 'button_', 'qr_code', 'qrcode',
        ]
        url_lower = url.lower()
        return any(p in url_lower for p in skip_patterns)

    async def _fetch_bytes(self, url: str, max_retries: int = 2) -> bytes | None:
        """Download image bytes from URL with retry and exponential backoff."""
        import httpx

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                async with self._semaphore:
                    if self._client:
                        resp = await self._client.get(url)
                    else:
                        async with httpx.AsyncClient(
                            timeout=REQUEST_TIMEOUT,
                            headers=self._extra_headers,
                            cookies=self._cookies if self._cookies else None,
                        ) as c:
                            resp = await c.get(url)
                    if resp.status_code == 200:
                        return resp.content
                    last_error = f"HTTP {resp.status_code}"
            except Exception as e:
                last_error = str(e)

            if attempt < max_retries:
                delay = 1.5 * (attempt + 1)
                logger.debug(f"Image download retry {attempt + 1}/{max_retries} after {delay}s: {url}")
                await asyncio.sleep(delay)

        logger.warning(f"Image download failed after {max_retries + 1} attempts: {url} — {last_error}")
        return None

    @staticmethod
    def _resize_to_webp(image_bytes: bytes, max_width: int, quality: int = WEBP_QUALITY) -> bytes:
        """Resize image to max_width (maintaining aspect ratio), convert to WebP.

        Aspect ratio is preserved — width constrained to max_width, height scaled proportionally.
        """
        img = Image.open(io.BytesIO(image_bytes))

        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            background = Image.new("RGBA", img.size, (255, 255, 255, 255))
            img = Image.alpha_composite(background, img).convert("RGB")
        elif img.mode != "RGB":
            img = img.convert("RGB")

        original_w, original_h = img.size
        if original_w > max_width:
            ratio = max_width / original_w
            new_w = max_width
            new_h = int(original_h * ratio)
            img = img.resize((new_w, new_h), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=quality)
        return buf.getvalue()

    async def download_and_process(
        self, url: str, generate_thumb: bool = True, platform: str = ""
    ) -> tuple[bytes | None, bytes | None]:
        """Download image, return (full_webp_bytes, thumb_webp_bytes).

        Returns (None, None) on failure.
        """
        transformed_url = self.transform_image_url(url, platform)

        if self.is_likely_non_photo(transformed_url):
            logger.debug(f"Skipping non-photo image: {transformed_url}")
            return None, None

        raw = await self._fetch_bytes(transformed_url)
        if raw is None:
            # Fallback: try original URL if transformed URL failed
            if transformed_url != url:
                logger.debug(f"Retrying with original URL: {url}")
                raw = await self._fetch_bytes(url)
        if raw is None:
            return None, None

        loop = asyncio.get_running_loop()
        full = await loop.run_in_executor(None, self._resize_to_webp, raw, MAX_WIDTH, WEBP_QUALITY)

        thumb = None
        if generate_thumb:
            thumb = await loop.run_in_executor(None, self._resize_to_webp, raw, THUMB_WIDTH, 75)

        return full, thumb

    async def process_batch(
        self, urls: list[str], generate_thumbs: bool = True, platform: str = ""
    ) -> list[dict]:
        """Process a batch of image URLs concurrently.

        Returns list of {url, full_bytes, thumb_bytes, error}.
        """
        tasks = [self.download_and_process(url, generate_thumbs, platform) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        output = []
        for url, result in zip(urls, results):
            if isinstance(result, Exception):
                output.append({"url": url, "full_bytes": None, "thumb_bytes": None, "error": str(result)})
            else:
                full, thumb = result
                output.append({"url": url, "full_bytes": full, "thumb_bytes": thumb, "error": None})
        return output
