"""
TryNova AI Virtual Try-On Pipeline
-----------------------------------
Tiered strategy:
  1. If REPLICATE_API_TOKEN is configured -> use Replicate IDM-VTON (best quality).
  2. Otherwise -> local MediaPipe + OpenCV pose-aware overlay (works offline).
  3. As a last resort -> simple Pillow blend so the demo never breaks.
"""

import os
import io
import base64
import requests
import numpy as np
from PIL import Image

# Lazy imports for heavy deps so the service can boot even if a library is missing.
_mp_pose = None
_cv2 = None


def _ensure_cv():
    global _cv2
    if _cv2 is None:
        import cv2  # noqa: WPS433
        _cv2 = cv2
    return _cv2


def _ensure_mediapipe():
    global _mp_pose
    if _mp_pose is None:
        try:
            import mediapipe as mp  # noqa: WPS433
            _mp_pose = mp.solutions.pose
        except Exception as exc:  # pragma: no cover - best-effort
            print(f"[tryon] MediaPipe not available: {exc}")
            _mp_pose = False
    return _mp_pose


def _strip_data_uri(b64: str) -> str:
    if b64.startswith("data:image"):
        return b64.split(",", 1)[1]
    return b64


def _decode_image(b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(_strip_data_uri(b64)))).convert("RGBA")


def _download_image(url: str) -> Image.Image:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        )
    }
    if url.startswith("data:image"):
        return _decode_image(url)
    res = requests.get(url, headers=headers, timeout=20)
    res.raise_for_status()
    return Image.open(io.BytesIO(res.content)).convert("RGBA")


def _encode_pil(img: Image.Image) -> str:
    buffered = io.BytesIO()
    img.convert("RGB").save(buffered, format="JPEG", quality=92)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def run_pipeline(user_image_b64: str, product_image_url: str) -> str:
    """Main entry point. Returns base64-encoded JPEG (no data URI prefix)."""
    token = os.getenv("REPLICATE_API_TOKEN")
    if token and token != "your_replicate_token_here":
        try:
            return _run_replicate(user_image_b64, product_image_url, token)
        except Exception as exc:  # pragma: no cover
            print(f"[tryon] Replicate failed, falling back: {exc}")

    try:
        return _run_local_pose_overlay(user_image_b64, product_image_url)
    except Exception as exc:
        print(f"[tryon] Pose overlay failed, falling back to simple blend: {exc}")
        return _run_simple_blend(user_image_b64, product_image_url)


# ---------------------------------------------------------------------------
# Tier 1: Replicate IDM-VTON
# ---------------------------------------------------------------------------
def _run_replicate(user_b64: str, product_url: str, token: str) -> str:
    import replicate  # noqa: WPS433

    user_b64 = _strip_data_uri(user_b64)
    output = replicate.run(
        "cuuupid/idm-vton:906425dbca90663ff5427624839572cc56ea7d380343d13e2a4c4b09d3f0c30f",
        input={
            "human_img": f"data:image/jpeg;base64,{user_b64}",
            "garm_img": product_url,
            "garment_des": "fashion clothing item",
            "is_checked": True,
            "is_checked_crop": False,
            "denoise_steps": 30,
            "seed": 42,
        },
    )
    if isinstance(output, list):
        output = output[0]
    if not output:
        raise RuntimeError("Replicate returned empty output")
    res = requests.get(output, timeout=30)
    res.raise_for_status()
    return base64.b64encode(res.content).decode("utf-8")


# ---------------------------------------------------------------------------
# Tier 2: MediaPipe + OpenCV pose-aware overlay
# ---------------------------------------------------------------------------
def _remove_background(prod_img: Image.Image) -> Image.Image:
    """Drop near-white background from a product cutout and feather the edges."""
    cv2 = _ensure_cv()
    arr = np.array(prod_img.convert("RGBA"))
    rgb = arr[:, :, :3]
    # Treat near-white/very-light pixels as background.
    luminance = rgb.mean(axis=2)
    bg_mask = luminance > 235

    # Connected-component fill from the borders for robustness.
    h, w = bg_mask.shape
    flood = bg_mask.astype(np.uint8) * 255
    pad = cv2.copyMakeBorder(flood, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    mask = np.zeros((h + 3, w + 3), np.uint8)
    cv2.floodFill(pad, mask, (0, 0), 128)
    bg = (pad[1:-1, 1:-1] == 128)

    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # Feather the edges so the overlay doesn't look pasted on.
    alpha = cv2.GaussianBlur(alpha, (5, 5), 0)
    arr[:, :, 3] = alpha
    return Image.fromarray(arr, mode="RGBA")


def _detect_torso(img: Image.Image):
    """Return a dict of torso landmarks in pixel space, or None if pose missed."""
    mp_pose = _ensure_mediapipe()
    if not mp_pose:
        return None
    cv2 = _ensure_cv()
    rgb = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
    rgb = cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB)
    with mp_pose.Pose(static_image_mode=True, model_complexity=1) as pose:
        result = pose.process(rgb)
    if not result.pose_landmarks:
        return None
    lm = result.pose_landmarks.landmark
    w, h = img.size
    return {
        "left_shoulder": (lm[11].x * w, lm[11].y * h),
        "right_shoulder": (lm[12].x * w, lm[12].y * h),
        "left_hip": (lm[23].x * w, lm[23].y * h),
        "right_hip": (lm[24].x * w, lm[24].y * h),
    }


def _run_local_pose_overlay(user_b64: str, product_url: str) -> str:
    cv2 = _ensure_cv()
    user_img = _decode_image(user_b64)
    prod_img = _download_image(product_url)
    prod_img = _remove_background(prod_img)

    landmarks = _detect_torso(user_img)
    if landmarks is None:
        # No pose detected -> use a heuristic center placement that is still nice.
        return _run_simple_blend_with_imgs(user_img, prod_img)

    ls = np.array(landmarks["left_shoulder"])
    rs = np.array(landmarks["right_shoulder"])
    lh = np.array(landmarks["left_hip"])
    rh = np.array(landmarks["right_hip"])

    shoulder_w = np.linalg.norm(ls - rs)
    torso_h = ((np.linalg.norm(ls - lh) + np.linalg.norm(rs - rh)) / 2.0)
    if shoulder_w < 20 or torso_h < 30:
        return _run_simple_blend_with_imgs(user_img, prod_img)

    # Target width = shoulders * 2.2 so the garment drapes naturally.
    target_w = int(shoulder_w * 2.2)
    aspect = prod_img.height / prod_img.width
    target_h = int(target_w * aspect)
    prod_resized = prod_img.resize((target_w, target_h), Image.LANCZOS)

    shoulder_center = ((ls + rs) / 2.0)
    # Anchor garment so its top sits a little above the shoulder line (neck area).
    anchor_x = int(shoulder_center[0] - target_w / 2)
    anchor_y = int(shoulder_center[1] - target_h * 0.15)

    canvas = user_img.copy()
    canvas.alpha_composite(prod_resized, (anchor_x, anchor_y))

    # Subtle color match: tint the overlay slightly toward the user's lighting.
    final = _harmonise_lighting(canvas, user_img)
    return _encode_pil(final)


def _harmonise_lighting(composited: Image.Image, original: Image.Image) -> Image.Image:
    cv2 = _ensure_cv()
    comp = cv2.cvtColor(np.array(composited.convert("RGB")), cv2.COLOR_RGB2LAB)
    orig = cv2.cvtColor(np.array(original.convert("RGB")), cv2.COLOR_RGB2LAB)
    mean_c, std_c = cv2.meanStdDev(comp)
    mean_o, std_o = cv2.meanStdDev(orig)
    std_c[std_c == 0] = 1
    adjusted = ((comp.astype(np.float32) - mean_c.reshape(1, 1, 3)) *
                (std_o / std_c).reshape(1, 1, 3) +
                mean_o.reshape(1, 1, 3))
    adjusted = np.clip(adjusted, 0, 255).astype(np.uint8)
    rgb = cv2.cvtColor(adjusted, cv2.COLOR_LAB2RGB)
    return Image.fromarray(rgb)


# ---------------------------------------------------------------------------
# Tier 3: Plain Pillow blend (final safety net)
# ---------------------------------------------------------------------------
def _run_simple_blend(user_b64: str, product_url: str) -> str:
    user_img = _decode_image(user_b64)
    prod_img = _download_image(product_url)
    return _run_simple_blend_with_imgs(user_img, prod_img)


def _run_simple_blend_with_imgs(user_img: Image.Image, prod_img: Image.Image) -> str:
    target_w = int(user_img.width * 0.55)
    aspect = prod_img.height / prod_img.width
    target_h = int(target_w * aspect)
    prod_img = prod_img.resize((target_w, target_h), Image.LANCZOS)
    new_data = []
    for r, g, b, a in prod_img.getdata():
        if r > 230 and g > 230 and b > 230:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append((r, g, b, int(a * 0.9)))
    prod_img.putdata(new_data)
    paste_x = int((user_img.width - target_w) / 2)
    paste_y = int(user_img.height * 0.22)
    user_img = user_img.copy()
    user_img.paste(prod_img, (paste_x, paste_y), prod_img)
    return _encode_pil(user_img)
