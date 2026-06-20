/**
 * Browser-side Virtual Try-On using MediaPipe Pose.
 * Runs entirely client-side - no backend required.
 *
 * Pipeline:
 *  1. Detect 33 body landmarks with MediaPipe Pose (via CDN).
 *  2. Use shoulder + hip landmarks to compute torso geometry.
 *  3. Resize & affine-warp the garment PNG onto the torso region.
 *  4. Render onto a canvas (still image OR live webcam stream).
 *
 * Exposed API:
 *   BrowserTryOn.init()                         -> preload MediaPipe once
 *   BrowserTryOn.composite(userImg, garmentImg) -> Promise<dataURL>
 *   BrowserTryOn.startWebcam(videoEl, canvasEl, garmentImg)
 *   BrowserTryOn.stopWebcam()
 */
(function (global) {
    const MP_VERSION = '0.5.1675469404';
    const SCRIPTS = [
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MP_VERSION}/pose.js`
    ];

    let _poseInstance = null;
    let _ready = false;
    let _loadingPromise = null;
    let _webcamStream = null;
    let _rafHandle = null;

    function _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) return resolve();
            const s = document.createElement('script');
            s.src = src;
            s.crossOrigin = 'anonymous';
            s.onload = resolve;
            s.onerror = () => reject(new Error('Failed to load ' + src));
            document.head.appendChild(s);
        });
    }

    async function init() {
        if (_ready) return;
        if (_loadingPromise) return _loadingPromise;

        _loadingPromise = (async () => {
            for (const src of SCRIPTS) await _loadScript(src);
            // global `Pose` constructor is now available.
            _poseInstance = new global.Pose({
                locateFile: (file) =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MP_VERSION}/${file}`
            });
            _poseInstance.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            _ready = true;
        })();
        return _loadingPromise;
    }

    function _loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    /**
     * Trim background from a garment image and feather edges.
     *
     * Strategy:
     *  1. Sample the four corners to estimate the dominant background colour.
     *  2. Mark any pixel within a tolerance of that colour as background.
     *  3. Flood-fill from the borders so we only strip *contiguous* background
     *     (interior pixels with the same colour - e.g. a white logo - survive).
     *  4. Feather the alpha mask so the overlay blends.
     */
    function _prepGarment(img) {
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, W, H);
        const px = data.data;

        const sampleAt = (x, y) => {
            const i = (y * W + x) * 4;
            return [px[i], px[i + 1], px[i + 2]];
        };
        const samples = [
            sampleAt(0, 0), sampleAt(W - 1, 0),
            sampleAt(0, H - 1), sampleAt(W - 1, H - 1),
            sampleAt(W >> 1, 0), sampleAt(W >> 1, H - 1)
        ];
        // Background candidate = mean of border samples.
        let bgR = 0, bgG = 0, bgB = 0;
        for (const s of samples) { bgR += s[0]; bgG += s[1]; bgB += s[2]; }
        bgR /= samples.length; bgG /= samples.length; bgB /= samples.length;

        // If the corners disagree wildly, fall back to "strip near-white" mode.
        const variance = samples.reduce((acc, s) =>
            acc + Math.abs(s[0] - bgR) + Math.abs(s[1] - bgG) + Math.abs(s[2] - bgB), 0);
        const noisyBackground = variance / samples.length > 60;
        const tolerance = noisyBackground ? 35 : 55;

        // Build initial background mask.
        const mask = new Uint8Array(W * H); // 0 = unknown, 1 = bg, 2 = fg
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = (y * W + x) * 4;
                const dr = Math.abs(px[i] - bgR);
                const dg = Math.abs(px[i + 1] - bgG);
                const db = Math.abs(px[i + 2] - bgB);
                if (dr + dg + db < tolerance * 3) mask[y * W + x] = 1;
            }
        }

        // Flood-fill from borders so only contiguous border-touching bg is removed.
        const visited = new Uint8Array(W * H);
        const stack = [];
        const push = (x, y) => {
            if (x < 0 || y < 0 || x >= W || y >= H) return;
            const idx = y * W + x;
            if (visited[idx] || mask[idx] !== 1) return;
            visited[idx] = 1;
            stack.push(idx);
        };
        for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
        for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
        while (stack.length) {
            const idx = stack.pop();
            const x = idx % W;
            const y = (idx / W) | 0;
            push(x + 1, y); push(x - 1, y);
            push(x, y + 1); push(x, y - 1);
        }

        // Apply alpha: contiguous bg => 0; interior bg-like pixels keep alpha.
        for (let i = 0, p = 0; i < px.length; i += 4, p++) {
            if (visited[p]) px[i + 3] = 0;
        }

        ctx.putImageData(data, 0, 0);

        // Feather edges with a small blur for smoother compositing.
        const out = document.createElement('canvas');
        out.width = W; out.height = H;
        const octx = out.getContext('2d');
        octx.filter = 'blur(1.2px)';
        octx.drawImage(c, 0, 0);
        octx.filter = 'none';
        octx.globalCompositeOperation = 'source-atop';
        octx.drawImage(c, 0, 0);
        return out;
    }

    /**
     * Given pose landmarks (normalized 0-1) and the canvas size,
     * compute the destination quad on the canvas that the garment should warp into.
     */
    function _computeTorsoQuad(lm, W, H) {
        // 11 = left shoulder, 12 = right shoulder, 23 = left hip, 24 = right hip
        const ls = { x: lm[11].x * W, y: lm[11].y * H };
        const rs = { x: lm[12].x * W, y: lm[12].y * H };
        const lh = { x: lm[23].x * W, y: lm[23].y * H };
        const rh = { x: lm[24].x * W, y: lm[24].y * H };

        const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
        const torsoH = (Math.hypot(ls.x - lh.x, ls.y - lh.y) +
            Math.hypot(rs.x - rh.x, rs.y - rh.y)) / 2;

        // Expand shoulders ~1.4x outward so sleeves drape over arms.
        const expand = 1.4;
        const sCenter = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
        const sDirX = (ls.x - rs.x) / shoulderW;
        const sDirY = (ls.y - rs.y) / shoulderW;
        const halfW = (shoulderW * expand) / 2;
        const lsX = sCenter.x + sDirX * halfW;
        const lsY = sCenter.y + sDirY * halfW;
        const rsX = sCenter.x - sDirX * halfW;
        const rsY = sCenter.y - sDirY * halfW;

        // Anchor top above the shoulder line (collar).
        const upY = -torsoH * 0.18;
        const perpX = -sDirY;
        const perpY = sDirX;
        const tl = { x: lsX + perpX * upY, y: lsY + perpY * upY };
        const tr = { x: rsX + perpX * upY, y: rsY + perpY * upY };

        // Extend bottom past hips so the garment hem reaches mid-thigh.
        const downExtra = torsoH * 0.55;
        const hCenter = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
        const torsoDirX = (hCenter.x - sCenter.x) / Math.max(torsoH, 1);
        const torsoDirY = (hCenter.y - sCenter.y) / Math.max(torsoH, 1);
        const blX = lh.x + torsoDirX * downExtra;
        const blY = lh.y + torsoDirY * downExtra;
        const brX = rh.x + torsoDirX * downExtra;
        const brY = rh.y + torsoDirY * downExtra;

        return {
            tl, tr,
            bl: { x: blX, y: blY },
            br: { x: brX, y: brY }
        };
    }

    /**
     * Render an axis-aligned source rectangle onto a destination quadrilateral
     * via 2-triangle affine slicing. Works for small rotations / scales.
     */
    function _drawWarpedQuad(ctx, src, dst) {
        const sw = src.width;
        const sh = src.height;

        // Top-left -> top-right -> bottom-left triangle
        _drawTri(ctx, src,
            [0, 0], [sw, 0], [0, sh],
            [dst.tl.x, dst.tl.y], [dst.tr.x, dst.tr.y], [dst.bl.x, dst.bl.y]);
        // Top-right -> bottom-right -> bottom-left triangle
        _drawTri(ctx, src,
            [sw, 0], [sw, sh], [0, sh],
            [dst.tr.x, dst.tr.y], [dst.br.x, dst.br.y], [dst.bl.x, dst.bl.y]);
    }

    function _drawTri(ctx, img, s0, s1, s2, d0, d1, d2) {
        const [x0, y0] = d0, [x1, y1] = d1, [x2, y2] = d2;
        const [u0, v0] = s0, [u1, v1] = s1, [u2, v2] = s2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.clip();
        // Affine matrix solving: dst = M * src
        const denom = u0 * (v1 - v2) - v0 * (u1 - u2) + u1 * v2 - u2 * v1;
        if (Math.abs(denom) < 1e-6) { ctx.restore(); return; }
        const a = (x0 * (v1 - v2) - v0 * (x1 - x2) + v1 * x2 - v2 * x1) / denom;
        const b = (u0 * (x1 - x2) - x0 * (u1 - u2) + u1 * x2 - u2 * x1) / denom;
        const c = (u0 * (v1 * x2 - v2 * x1) - v0 * (u1 * x2 - u2 * x1)
                  + x0 * (u1 * v2 - u2 * v1)) / denom;
        const d = (y0 * (v1 - v2) - v0 * (y1 - y2) + v1 * y2 - v2 * y1) / denom;
        const e = (u0 * (y1 - y2) - y0 * (u1 - u2) + u1 * y2 - u2 * y1) / denom;
        const f = (u0 * (v1 * y2 - v2 * y1) - v0 * (u1 * y2 - u2 * y1)
                  + y0 * (u1 * v2 - u2 * v1)) / denom;
        ctx.setTransform(a, d, b, e, c, f);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /**
     * Composite a garment onto a still photo of the user.
     * @param {string|HTMLImageElement} userInput  data URL or <img>
     * @param {string|HTMLImageElement} garmentInput  data URL or <img>
     * @returns {Promise<string>} data URL of the composited image
     */
    async function composite(userInput, garmentInput) {
        await init();
        const userImg = typeof userInput === 'string' ? await _loadImage(userInput) : userInput;
        const garmentImg = typeof garmentInput === 'string' ? await _loadImage(garmentInput) : garmentInput;

        // Cap working size to keep MediaPipe snappy.
        const MAX_W = 720;
        const ratio = Math.min(1, MAX_W / userImg.naturalWidth);
        const W = Math.round(userImg.naturalWidth * ratio);
        const H = Math.round(userImg.naturalHeight * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(userImg, 0, 0, W, H);

        const garmentCanvas = _prepGarment(garmentImg);

        // Run pose detection on the resized user image.
        const result = await new Promise((resolve) => {
            _poseInstance.onResults((r) => resolve(r));
            _poseInstance.send({ image: canvas });
        });

        if (result && result.poseLandmarks) {
            const quad = _computeTorsoQuad(result.poseLandmarks, W, H);
            _drawWarpedQuad(ctx, garmentCanvas, quad);
        } else {
            // Fallback: simple centered overlay so the demo still produces output.
            const tw = W * 0.6;
            const th = tw * (garmentCanvas.height / garmentCanvas.width);
            ctx.globalAlpha = 0.92;
            ctx.drawImage(garmentCanvas, (W - tw) / 2, H * 0.22, tw, th);
            ctx.globalAlpha = 1;
        }

        return canvas.toDataURL('image/jpeg', 0.92);
    }

    /**
     * Start live webcam try-on. Continuously detects pose on each frame and
     * overlays the garment. Use stopWebcam() to release the camera.
     */
    async function startWebcam(videoEl, canvasEl, garmentInput) {
        await init();
        const garmentImg = typeof garmentInput === 'string' ? await _loadImage(garmentInput) : garmentInput;
        const garmentCanvas = _prepGarment(garmentImg);

        if (_webcamStream) stopWebcam();
        _webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false
        });
        videoEl.srcObject = _webcamStream;
        await videoEl.play();

        const W = videoEl.videoWidth;
        const H = videoEl.videoHeight;
        canvasEl.width = W;
        canvasEl.height = H;
        const ctx = canvasEl.getContext('2d');

        let latestLandmarks = null;
        _poseInstance.onResults((r) => { latestLandmarks = r.poseLandmarks || null; });

        let processing = false;
        const loop = async () => {
            if (!_webcamStream) return;
            if (!processing) {
                processing = true;
                try {
                    await _poseInstance.send({ image: videoEl });
                } catch (e) {/* mediapipe occasionally throws on first frames */}
                processing = false;
            }
            ctx.save();
            // Mirror so it feels like a mirror.
            ctx.translate(W, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoEl, 0, 0, W, H);
            if (latestLandmarks) {
                const quad = _computeTorsoQuad(latestLandmarks, W, H);
                _drawWarpedQuad(ctx, garmentCanvas, quad);
            }
            ctx.restore();
            _rafHandle = requestAnimationFrame(loop);
        };
        loop();
    }

    function stopWebcam() {
        if (_rafHandle) cancelAnimationFrame(_rafHandle);
        _rafHandle = null;
        if (_webcamStream) {
            _webcamStream.getTracks().forEach((t) => t.stop());
            _webcamStream = null;
        }
    }

    global.BrowserTryOn = { init, composite, startWebcam, stopWebcam };
})(window);
