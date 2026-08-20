/**
 * Browser-side Virtual Try-On.
 *
 * Two engines, in order of preference:
 *
 * 1. **Hugging Face IDM-VTON** (the killer feature) — calls the public
 *    `yisol/IDM-VTON` Gradio Space which is a real diffusion-based try-on
 *    model. Produces photorealistic results. Slower (~30-60s) but free.
 *
 * 2. **MediaPipe Pose overlay** (instant fallback) — detects 33 body
 *    landmarks, removes the garment's background and draws the cutout
 *    over the torso. Fast and works offline; quality is "good demo" not
 *    photoreal.
 *
 * Exposed API:
 *   BrowserTryOn.init()
 *   BrowserTryOn.composite(userImg, garmentImg, opts)
 *     -> { dataUrl, engine: 'ai'|'overlay' }
 *   BrowserTryOn.startWebcam(videoEl, canvasEl, garmentImg)
 *   BrowserTryOn.stopWebcam()
 */
(function (global) {
    const MP_VERSION = '0.5.1675469404';
    const MP_SCRIPT = `https://cdn.jsdelivr.net/npm/@mediapipe/pose@${MP_VERSION}/pose.js`;
    const HF_SPACE = 'yisol/IDM-VTON';
    const GRADIO_CLIENT_SRC = 'https://cdn.jsdelivr.net/npm/@gradio/client@1.7.1/dist/index.min.js';

    let _poseInstance = null;
    let _mpReady = false;
    let _mpLoadingPromise = null;
    let _webcamStream = null;
    let _rafHandle = null;
    let _gradioClient = null;
    let _gradioPromise = null;

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

    async function _initMediaPipe() {
        if (_mpReady) return;
        if (_mpLoadingPromise) return _mpLoadingPromise;
        _mpLoadingPromise = (async () => {
            await _loadScript(MP_SCRIPT);
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
            _mpReady = true;
        })();
        return _mpLoadingPromise;
    }

    async function init() { return _initMediaPipe(); }

    // ------------------------------------------------------------------
    // Hugging Face IDM-VTON via Gradio client
    // ------------------------------------------------------------------
    async function _initGradio() {
        if (_gradioClient) return _gradioClient;
        if (_gradioPromise) return _gradioPromise;
        _gradioPromise = (async () => {
            // ESM dynamic import of the Gradio JS client.
            const mod = await import(/* @vite-ignore */
                'https://cdn.jsdelivr.net/npm/@gradio/client@1.7.1/dist/index.min.js'
            );
            const Client = mod.Client || mod.client || mod.default;
            if (!Client) throw new Error('Gradio client missing Client export');
            const connect = Client.connect || Client;
            _gradioClient = await connect(HF_SPACE);
            return _gradioClient;
        })();
        return _gradioPromise;
    }

    async function _toBlob(src) {
        if (src instanceof Blob) return src;
        if (typeof src === 'string') {
            if (src.startsWith('data:')) {
                const [meta, data] = src.split(',');
                const mime = (meta.match(/data:(.*?);/) || [null, 'image/jpeg'])[1];
                const bin = atob(data);
                const arr = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                return new Blob([arr], { type: mime });
            }
            // Network image (e.g. Pollinations URL) — fetch as Blob.
            const r = await fetch(src, { mode: 'cors' });
            return await r.blob();
        }
        if (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement) {
            const c = src instanceof HTMLCanvasElement ? src : (() => {
                const cv = document.createElement('canvas');
                cv.width = src.naturalWidth; cv.height = src.naturalHeight;
                cv.getContext('2d').drawImage(src, 0, 0);
                return cv;
            })();
            return await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92));
        }
        throw new Error('Unsupported image source');
    }

    /**
     * Run IDM-VTON on Hugging Face. Returns data URL on success or null on
     * failure (caller falls back to the overlay engine).
     */
    async function _tryHuggingFace(userImg, garmentImg, onProgress) {
        try {
            onProgress && onProgress('Connecting to AI model...');
            const client = await _initGradio();
            onProgress && onProgress('Uploading your photo...');
            const userBlob = await _toBlob(userImg.src || userImg);
            const garmBlob = await _toBlob(garmentImg.src || garmentImg);
            onProgress && onProgress('Running diffusion model (this can take a minute)...');

            // IDM-VTON's primary endpoint signature:
            // (dict: {background, layers, composite}, garm_img, garment_des,
            //  is_checked, is_checked_crop, denoise_steps, seed)
            const result = await client.predict('/tryon', [
                { background: userBlob, layers: [], composite: null },
                garmBlob,
                'A fashion garment',
                true,   // auto-mask
                false,  // crop
                30,     // denoise steps
                42      // seed
            ]);

            const data = result && result.data;
            if (!data || !data.length) throw new Error('Empty result');
            const first = data[0];
            const url = (first && (first.url || first.path)) || first;
            if (typeof url !== 'string') throw new Error('No image URL in result');
            return await _urlToDataUrl(url);
        } catch (e) {
            console.warn('[BrowserTryOn] Hugging Face engine failed:', e.message || e);
            return null;
        }
    }

    async function _urlToDataUrl(url) {
        const r = await fetch(url, { mode: 'cors' });
        const blob = await r.blob();
        return await new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.readAsDataURL(blob);
        });
    }

    // ------------------------------------------------------------------
    // Browser overlay engine (instant fallback)
    // ------------------------------------------------------------------
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
     * Remove the garment's background by sampling border pixels, building
     * a tolerance mask and flood-filling from the borders so internal
     * detail (logos, prints) is preserved.
     */
    function _prepGarment(img) {
        const W = img.naturalWidth || img.width;
        const H = img.naturalHeight || img.height;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, W, H);
        const px = data.data;

        const sample = (x, y) => {
            const i = (y * W + x) * 4;
            return [px[i], px[i + 1], px[i + 2]];
        };
        const samples = [
            sample(0, 0), sample(W - 1, 0), sample(0, H - 1), sample(W - 1, H - 1),
            sample(W >> 1, 0), sample(W >> 1, H - 1),
            sample(0, H >> 1), sample(W - 1, H >> 1)
        ];
        let bgR = 0, bgG = 0, bgB = 0;
        samples.forEach((s) => { bgR += s[0]; bgG += s[1]; bgB += s[2]; });
        bgR /= samples.length; bgG /= samples.length; bgB /= samples.length;
        const variance = samples.reduce((acc, s) =>
            acc + Math.abs(s[0] - bgR) + Math.abs(s[1] - bgG) + Math.abs(s[2] - bgB), 0) / samples.length;

        // Higher tolerance if the corners agree (clean studio shot).
        const tolerance = variance < 30 ? 70 : 45;

        const mask = new Uint8Array(W * H);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const i = (y * W + x) * 4;
                const d = Math.abs(px[i] - bgR) + Math.abs(px[i + 1] - bgG) + Math.abs(px[i + 2] - bgB);
                if (d < tolerance * 3) mask[y * W + x] = 1;
            }
        }

        // Flood-fill only contiguous border-touching bg.
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
            push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
        }

        for (let i = 0, p = 0; i < px.length; i += 4, p++) {
            if (visited[p]) {
                px[i + 3] = 0;
            }
        }
        ctx.putImageData(data, 0, 0);

        // Tight crop around the non-transparent region for a snug fit.
        let minX = W, minY = H, maxX = 0, maxY = 0;
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                if (px[(y * W + x) * 4 + 3] > 0) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
        }
        if (minX >= maxX || minY >= maxY) return c;
        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        const out = document.createElement('canvas');
        out.width = cropW; out.height = cropH;
        out.getContext('2d').drawImage(c, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
        return out;
    }

    /**
     * Place the garment cutout over the torso. Simple placement (no warp)
     * — this looks much more like a sticker overlay but is more robust
     * than affine distortion against an inaccurate pose.
     */
    function _overlayOnTorso(ctx, garmentCanvas, lm, W, H) {
        const ls = { x: lm[11].x * W, y: lm[11].y * H, v: lm[11].visibility };
        const rs = { x: lm[12].x * W, y: lm[12].y * H, v: lm[12].visibility };
        const lh = { x: lm[23].x * W, y: lm[23].y * H, v: lm[23].visibility };
        const rh = { x: lm[24].x * W, y: lm[24].y * H, v: lm[24].visibility };

        const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y);
        const torsoH = ((lh.y + rh.y) / 2) - ((ls.y + rs.y) / 2);
        if (shoulderW < 20 || torsoH < 30) return false;

        // Target garment width = shoulder * 2.4 (sleeves drape past arms).
        // Garments tend to look too small if scaled tightly; over-shoot.
        const targetW = shoulderW * 2.4;
        const aspect = garmentCanvas.height / garmentCanvas.width;
        const targetH = targetW * aspect;

        const shoulderCx = (ls.x + rs.x) / 2;
        const shoulderCy = (ls.y + rs.y) / 2;

        // Top of garment sits a touch above shoulders (collar area).
        const x = shoulderCx - targetW / 2;
        const y = shoulderCy - targetH * 0.12;

        // Compute rotation from shoulder line for natural tilt.
        const angle = Math.atan2(ls.y - rs.y, ls.x - rs.x);

        ctx.save();
        // Slight drop shadow for depth.
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;

        // Rotate around shoulder center.
        ctx.translate(shoulderCx, shoulderCy);
        ctx.rotate(angle);
        ctx.drawImage(
            garmentCanvas,
            -targetW / 2, -targetH * 0.12,
            targetW, targetH
        );
        ctx.restore();
        return true;
    }

    async function _runOverlay(userInput, garmentInput) {
        await _initMediaPipe();
        const userImg = typeof userInput === 'string' ? await _loadImage(userInput) : userInput;
        const garmentImg = typeof garmentInput === 'string' ? await _loadImage(garmentInput) : garmentInput;

        // Cap user image at 720px wide for MediaPipe speed.
        const MAX_W = 720;
        const ratio = Math.min(1, MAX_W / (userImg.naturalWidth || userImg.width));
        const W = Math.round((userImg.naturalWidth || userImg.width) * ratio);
        const H = Math.round((userImg.naturalHeight || userImg.height) * ratio);

        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(userImg, 0, 0, W, H);

        const garmentCanvas = _prepGarment(garmentImg);

        const result = await new Promise((resolve) => {
            _poseInstance.onResults((r) => resolve(r));
            _poseInstance.send({ image: canvas });
        });

        if (result && result.poseLandmarks) {
            _overlayOnTorso(ctx, garmentCanvas, result.poseLandmarks, W, H);
        } else {
            // No pose: just center the garment over the upper-middle area.
            const tw = W * 0.7;
            const th = tw * (garmentCanvas.height / garmentCanvas.width);
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = 10;
            ctx.drawImage(garmentCanvas, (W - tw) / 2, H * 0.18, tw, th);
            ctx.restore();
        }
        return canvas.toDataURL('image/jpeg', 0.92);
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------
    async function composite(userInput, garmentInput, opts = {}) {
        const useAI = opts.useAI !== false;
        const onProgress = opts.onProgress;

        if (useAI) {
            const userImgEl = typeof userInput === 'string' ? await _loadImage(userInput) : userInput;
            const garmentImgEl = typeof garmentInput === 'string' ? await _loadImage(garmentInput) : garmentInput;
            const aiResult = await _tryHuggingFace(userImgEl, garmentImgEl, onProgress);
            if (aiResult) return { dataUrl: aiResult, engine: 'ai' };
        }

        onProgress && onProgress('Falling back to local pose overlay...');
        const dataUrl = await _runOverlay(userInput, garmentInput);
        return { dataUrl, engine: 'overlay' };
    }

    async function startWebcam(videoEl, canvasEl, garmentInput) {
        await _initMediaPipe();
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
        canvasEl.width = W; canvasEl.height = H;
        const ctx = canvasEl.getContext('2d');

        let latestLandmarks = null;
        _poseInstance.onResults((r) => { latestLandmarks = r.poseLandmarks || null; });

        let processing = false;
        const loop = async () => {
            if (!_webcamStream) return;
            if (!processing) {
                processing = true;
                try { await _poseInstance.send({ image: videoEl }); }
                catch (e) { /* mediapipe transient errors */ }
                processing = false;
            }
            ctx.save();
            ctx.translate(W, 0); ctx.scale(-1, 1);
            ctx.drawImage(videoEl, 0, 0, W, H);
            if (latestLandmarks) {
                _overlayOnTorso(ctx, garmentCanvas, latestLandmarks, W, H);
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
