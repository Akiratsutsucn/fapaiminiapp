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
# 单张图目标上限：≤180KB(留余量,避免卡200KB边缘)。压完超标则迭代降质/降分辨率。
TARGET_MAX_BYTES = 180 * 1024
REQUEST_TIMEOUT = 30
MAX_CONCURRENT_DOWNLOADS = 3


class ImageProcessor:
    """Download and process property images."""

    def __init__(self, http_client=None, extra_headers=None, cookies_str="", proxy=None):
        self._client = http_client
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
        self._extra_headers = extra_headers or {}
        # 图片下载代理（如住宅 socks5h://），用于规避 img.alicdn.com 对机房IP的 420 限流。
        self._proxy = proxy
        # 420 限流熔断:连续 N 次 420 → 进入冷却期,期间图片下载直接跳过(秒级返回),
        # 避免每张图重试5次×退避(~35s)在 IP 被风控时把整轮拖到 4h 超时。图片后续渐补。
        self._consec_420 = 0
        self._cooldown_until = 0.0   # time.monotonic() 时间戳,< 它则跳过下载
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

    async def _fetch_bytes(self, url: str, max_retries: int = 4) -> bytes | None:
        """Download image bytes from URL with retry and exponential backoff.

        img.alicdn.com 对机房IP「突发限流」返回 HTTP 420，但会自行恢复，直连退避重试即可。
        策略：直连为主，遇 420 加长退避后再直连重试；多次失败后若配了代理再兜底试一次代理。
        （实测住宅 socks5 对 alicdn 不稳定，仅作最后兜底，不作首选。）
        """
        import httpx
        import time as _time

        # 处于 420 冷却期:直接跳过下载(图片后续渐补),不再重试拖慢整轮
        if _time.monotonic() < self._cooldown_until:
            return None

        last_error = None
        for attempt in range(max_retries + 1):
            # 最后一次重试且前面都失败时，若有代理则兜底走代理
            use_proxy = bool(self._proxy) and attempt == max_retries
            try:
                async with self._semaphore:
                    if self._client and not use_proxy:
                        resp = await self._client.get(url)
                    else:
                        client_kwargs = dict(
                            timeout=REQUEST_TIMEOUT,
                            headers=self._extra_headers,
                            cookies=self._cookies if self._cookies else None,
                        )
                        if use_proxy:
                            client_kwargs["proxy"] = self._proxy
                        async with httpx.AsyncClient(**client_kwargs) as c:
                            resp = await c.get(url)
                    if resp.status_code == 200 and resp.content:
                        self._consec_420 = 0   # 成功 → 重置 420 计数
                        return resp.content
                    last_error = f"HTTP {resp.status_code}"
            except Exception as e:
                last_error = str(e)

            # 连续 420 累计:CDN 在限流本 IP,继续重试无意义 → 触发冷却,后续图片直接跳过
            if last_error == "HTTP 420":
                self._consec_420 += 1
                if self._consec_420 >= 8:
                    self._cooldown_until = _time.monotonic() + 600  # 冷却10分钟
                    logger.warning("[ImageProcessor] 连续420限流,图片下载冷却10分钟(图片后续渐补)")
                    return None
            else:
                self._consec_420 = 0

            if attempt < max_retries:
                # 420 限流:短退避即可(很快会触发冷却跳过);普通错误用较短退避
                is_420 = last_error == "HTTP 420"
                delay = (1.0 + attempt * 0.8) if is_420 else (1.5 * (attempt + 1))
                logger.debug(f"Image retry {attempt + 1}/{max_retries} after {delay:.0f}s "
                             f"(err={last_error}): {url[:70]}")
                await asyncio.sleep(delay)

        logger.warning(f"Image download failed after {max_retries + 1} attempts: {url} — {last_error}")
        return None

    @staticmethod
    def _resize_to_webp(
        image_bytes: bytes,
        max_width: int,
        quality: int = WEBP_QUALITY,
        max_bytes: int | None = TARGET_MAX_BYTES,
    ) -> bytes:
        """Resize to max_width (keep aspect ratio), convert to WebP, 保证 ≤ max_bytes。

        宽高比始终保留(不拉伸)。若首次编码后仍超过 max_bytes,则:
          1) 逐级降低 WebP 质量(quality → 70/60/50/40)——优先保分辨率、保清晰;
          2) 质量降到底仍超标,再逐级缩小分辨率(×0.85)后重新走质量阶梯;
          3) 兜底:最低质量(35)+ 最小宽度(720)一定能压到目标以下。
        max_bytes=None 时退回纯固定质量(用于缩略图,本就很小)。
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
            img = img.resize((max_width, int(original_h * ratio)), Image.LANCZOS)

        def encode(im, q) -> bytes:
            buf = io.BytesIO()
            im.save(buf, format="WEBP", quality=q)
            return buf.getvalue()

        out = encode(img, quality)
        if max_bytes is None or len(out) <= max_bytes:
            return out

        # 1) 先在当前分辨率下逐级降质
        for q in (70, 60, 50, 40):
            if q >= quality:
                continue
            out = encode(img, q)
            if len(out) <= max_bytes:
                return out

        # 2) 仍超标 → 逐级缩小分辨率(每次 ×0.85),每个分辨率再走质量阶梯
        cur = img
        min_width = 720
        while cur.size[0] > min_width:
            new_w = max(min_width, int(cur.size[0] * 0.85))
            new_h = int(cur.size[1] * new_w / cur.size[0])
            cur = cur.resize((new_w, new_h), Image.LANCZOS)
            for q in (60, 50, 40):
                out = encode(cur, q)
                if len(out) <= max_bytes:
                    return out

        # 3) 兜底:最小宽度 + 最低质量(几乎必达标)
        if cur.size[0] > min_width:
            ratio = min_width / cur.size[0]
            cur = cur.resize((min_width, int(cur.size[1] * ratio)), Image.LANCZOS)
        out = encode(cur, 35)
        if len(out) > max_bytes:
            logger.warning(f"图片压缩后仍 {len(out)//1024}KB > 目标 {max_bytes//1024}KB(已尽力)")
        return out

    async def download_and_process(
        self, url: str, generate_thumb: bool = True, platform: str = ""
    ) -> tuple[bytes | None, bytes | None, str | None]:
        """Download image, return (full_webp_bytes, thumb_webp_bytes, junk_reason).

        junk_reason: 非空表示该图为垃圾图(广告/二维码/logo)，应在前台隐藏。
        Returns (None, None, None) on failure.
        """
        transformed_url = self.transform_image_url(url, platform)

        if self.is_likely_non_photo(transformed_url):
            logger.debug(f"Skipping non-photo image: {transformed_url}")
            return None, None, None

        raw = await self._fetch_bytes(transformed_url)
        if raw is None:
            # Fallback: try original URL if transformed URL failed
            if transformed_url != url:
                logger.debug(f"Retrying with original URL: {url}")
                raw = await self._fetch_bytes(url)
        if raw is None:
            return None, None, None

        # 垃圾图检测（广告/二维码/logo）—— 仍下载保存，但标记 junk_reason 供前台隐藏
        junk_reason = None
        try:
            from .junk_image_filter import detect_junk
            junk_reason = detect_junk(raw)
            if junk_reason:
                logger.debug(f"垃圾图标记[{junk_reason}]: {url[:80]}")
        except Exception as e:
            logger.debug(f"junk detect skip: {e}")

        loop = asyncio.get_running_loop()
        full = await loop.run_in_executor(None, self._resize_to_webp, raw, MAX_WIDTH, WEBP_QUALITY)

        thumb = None
        if generate_thumb:
            thumb = await loop.run_in_executor(None, self._resize_to_webp, raw, THUMB_WIDTH, 75, None)

        return full, thumb, junk_reason

    async def process_batch(
        self, urls: list[str], generate_thumbs: bool = True, platform: str = ""
    ) -> list[dict]:
        """Process a batch of image URLs concurrently.

        Returns list of {url, full_bytes, thumb_bytes, junk_reason, error}.
        """
        tasks = [self.download_and_process(url, generate_thumbs, platform) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        output = []
        for url, result in zip(urls, results):
            if isinstance(result, Exception):
                output.append({"url": url, "full_bytes": None, "thumb_bytes": None,
                               "junk_reason": None, "error": str(result)})
            else:
                full, thumb, junk_reason = result
                output.append({"url": url, "full_bytes": full, "thumb_bytes": thumb,
                               "junk_reason": junk_reason, "error": None})
        return output
