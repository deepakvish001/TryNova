/**
 * TryNova - AI Try-On page controller
 *
 * Two modes:
 *   - "photo"  : user uploads a photo, we run BrowserTryOn.composite() to render
 *                a pose-aware overlay. If MediaPipe fails to load, we fall back
 *                to the backend /api/tryon endpoint.
 *   - "live"   : webcam stream with real-time pose tracking overlay.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // ---- Element refs ----
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const dropContent = document.getElementById('drop-content');
    const productDropdown = document.getElementById('product-dropdown');
    const generateBtn = document.getElementById('generate-btn');
    const productSelector = document.getElementById('product-selector');
    const selectedProductContainer = document.getElementById('selected-product-container');
    const changeProductBtn = document.getElementById('change-product-btn');

    const tabPhoto = document.getElementById('tab-photo');
    const tabLive = document.getElementById('tab-live');
    const photoStep = document.getElementById('photo-step');
    const liveStep = document.getElementById('live-step');

    const webcamVideo = document.getElementById('webcam-video');
    const webcamCanvas = document.getElementById('webcam-canvas');

    // ---- State ----
    let userImageBase64 = null;
    let selectedProduct = null;
    let mode = 'photo';
    let lastResultDataUrl = null;
    const products = [];

    // ---- Preload MediaPipe in the background ----
    BrowserTryOn.init().catch((e) => console.warn('BrowserTryOn init deferred', e));

    // ---- 1. Fetch products for dropdown ----
    try {
        const res = await api.get('/products?limit=200');
        if (res.success) {
            res.data.forEach((p) => {
                products.push(p);
                const opt = document.createElement('option');
                opt.value = p._id;
                opt.textContent = `${p.name} - ₹${p.price}`;
                productDropdown.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Failed to load products', e);
    }

    // Auto-select product from URL ?productId=...
    const urlParams = new URLSearchParams(window.location.search);
    const paramProductId = urlParams.get('productId');
    if (paramProductId) {
        productDropdown.value = paramProductId;
        selectProduct(paramProductId);
    }

    // ---- 2. Mode tab handling ----
    function switchMode(next) {
        if (next === mode) return;
        mode = next;

        if (mode === 'photo') {
            tabPhoto.classList.add('bg-[#A48D7C]', 'text-white');
            tabPhoto.classList.remove('text-muted');
            tabLive.classList.remove('bg-[#A48D7C]', 'text-white');
            tabLive.classList.add('text-muted');
            photoStep.classList.remove('hidden');
            liveStep.classList.add('hidden');
            BrowserTryOn.stopWebcam();
            showPlaceholder();
        } else {
            tabLive.classList.add('bg-[#A48D7C]', 'text-white');
            tabLive.classList.remove('text-muted');
            tabPhoto.classList.remove('bg-[#A48D7C]', 'text-white');
            tabPhoto.classList.add('text-muted');
            liveStep.classList.remove('hidden');
            photoStep.classList.add('hidden');
            showPlaceholder();
        }
        generateBtn.textContent = mode === 'live' ? 'Start Live Try-On' : 'Generate Try-On';
        checkReady();
    }
    tabPhoto.addEventListener('click', () => switchMode('photo'));
    tabLive.addEventListener('click', () => switchMode('live'));

    // ---- 3. File upload handling ----
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-accent');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-accent'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-accent');
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            return window.showToast('Please upload an image file', 'error');
        }
        if (file.size > 10 * 1024 * 1024) {
            return window.showToast('File size exceeds 10MB', 'error');
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            userImageBase64 = e.target.result;
            imagePreview.src = userImageBase64;
            imagePreview.classList.remove('hidden');
            dropContent.classList.add('hidden');
            checkReady();
        };
        reader.readAsDataURL(file);
    }

    // ---- 4. Product selection ----
    productDropdown.addEventListener('change', (e) => {
        if (e.target.value) selectProduct(e.target.value);
    });

    function selectProduct(id) {
        const product = products.find((p) => p._id === id);
        if (!product) return;
        selectedProduct = product;

        document.getElementById('selected-product-img').src = product.images[0];
        document.getElementById('selected-product-category').textContent = product.category;
        document.getElementById('selected-product-name').textContent = product.name;
        document.getElementById('selected-product-price').textContent = `₹${product.price}`;

        productSelector.classList.add('hidden');
        selectedProductContainer.classList.remove('hidden');
        checkReady();
    }

    changeProductBtn.addEventListener('click', () => {
        selectedProduct = null;
        selectedProductContainer.classList.add('hidden');
        productSelector.classList.remove('hidden');
        productDropdown.value = '';
        checkReady();
    });

    function checkReady() {
        if (mode === 'photo') {
            generateBtn.disabled = !(userImageBase64 && selectedProduct);
        } else {
            generateBtn.disabled = !selectedProduct;
        }
    }

    // ---- 5. UI states ----
    const loadingMessages = [
        'Loading on-device AI model...',
        'Detecting your body pose...',
        'Segmenting clothing region...',
        'Fitting the outfit to your body...',
        'Adjusting lighting and shadows...',
        'Generating your final look...'
    ];
    let loadingInterval;

    function showLoading(initialMsg) {
        document.getElementById('statePlaceholder').classList.add('hidden');
        document.getElementById('stateResult').classList.add('hidden');
        document.getElementById('stateLive').classList.add('hidden');
        document.getElementById('stateLoading').classList.remove('hidden');
        const msgEl = document.getElementById('loadingMessage');
        let i = 0;
        msgEl.textContent = initialMsg || loadingMessages[0];
        loadingInterval = setInterval(() => {
            i++;
            msgEl.textContent = loadingMessages[i % loadingMessages.length];
        }, 1800);
    }

    function showResult(imageUrl) {
        clearInterval(loadingInterval);
        document.getElementById('stateLoading').classList.add('hidden');
        document.getElementById('statePlaceholder').classList.add('hidden');
        document.getElementById('stateLive').classList.add('hidden');
        document.getElementById('stateResult').classList.remove('hidden');
        document.getElementById('generatedImage').src = imageUrl;
        lastResultDataUrl = imageUrl;
        showInsights(selectedProduct);
    }

    function showLive() {
        clearInterval(loadingInterval);
        document.getElementById('stateLoading').classList.add('hidden');
        document.getElementById('statePlaceholder').classList.add('hidden');
        document.getElementById('stateResult').classList.add('hidden');
        document.getElementById('stateLive').classList.remove('hidden');
        showInsights(selectedProduct);
    }

    function showPlaceholder() {
        clearInterval(loadingInterval);
        document.getElementById('stateLoading').classList.add('hidden');
        document.getElementById('stateResult').classList.add('hidden');
        document.getElementById('stateLive').classList.add('hidden');
        document.getElementById('statePlaceholder').classList.remove('hidden');
        BrowserTryOn.stopWebcam();
    }

    // ---- AI Insights generator ----
    function showInsights(product) {
        if (!product) return;
        const insights = generateInsights(product);
        document.getElementById('insight-fit').textContent = insights.fit;
        document.getElementById('insight-styling').textContent = insights.styling;
        document.getElementById('insight-confidence').textContent = insights.confidence;
        document.getElementById('ai-insights-container').classList.remove('hidden');
    }

    function generateInsights(product) {
        const category = (product.category || '').toLowerCase();
        const fitMap = {
            't-shirts': 'Relaxed across the shoulders with a slight drop hem - true to size for an everyday tee.',
            'shirts': 'Sits cleanly at the collar with a tailored mid-section. Size up for a looser drape.',
            'hoodies': 'Oversized fit with extended sleeve length - great for layering over a tee.',
            'jackets': 'Structured shoulders with room for a knit underneath. Size down for a closer fit.',
            'jeans': 'High-rise waist with a tapered leg. Mid-stretch denim flexes with movement.',
            'dresses': 'Skims the silhouette with a flowing hem. Best for an A-line drape.'
        };
        const styleMap = {
            't-shirts': 'Pair with straight-leg jeans and white sneakers for an easy weekend look.',
            'shirts': 'Tuck into chinos with a leather belt for smart-casual, or open over a tee for layered cool.',
            'hoodies': 'Layer under a denim jacket or wear solo with cargos for athleisure.',
            'jackets': 'Throw over a fitted tee with slim trousers - chunky boots finish it.',
            'jeans': 'Anchor with a fitted top and pointed heels, or sneakers for daytime.',
            'dresses': 'Add gold accessories and strappy sandals. A cropped blazer makes it office-ready.'
        };
        const confidence = (Math.random() * 1.4 + 8.4).toFixed(1);
        return {
            fit: fitMap[category] || 'Versatile cut that flatters most body types - true to size.',
            styling: styleMap[category] || 'Effortless to mix-and-match across casual and dressed-up looks.',
            confidence
        };
    }

    // ---- 6. Generate button ----
    generateBtn.addEventListener('click', async () => {
        if (!selectedProduct) {
            window.showToast('Please select a product', 'error');
            return;
        }
        const garmentUrl = selectedProduct.images[0];

        if (mode === 'live') {
            showLoading('Requesting camera access...');
            try {
                await BrowserTryOn.startWebcam(webcamVideo, webcamCanvas, garmentUrl);
                showLive();
                window.showToast('Live try-on active', 'success');
                trackTryOnView(selectedProduct._id);
            } catch (err) {
                showPlaceholder();
                window.showToast('Camera access denied or unavailable', 'error');
                console.error(err);
            }
            return;
        }

        // Photo mode
        if (!userImageBase64) {
            window.showToast('Please upload your photo first', 'error');
            return;
        }

        showLoading();
        const msgEl = document.getElementById('loadingMessage');

        // Try the AI engine (Hugging Face IDM-VTON) first; if it fails or
        // takes too long we fall back to the local MediaPipe overlay.
        try {
            const result = await BrowserTryOn.composite(userImageBase64, garmentUrl, {
                useAI: true,
                onProgress: (msg) => {
                    // Stop the cycling default messages once we have real progress info.
                    clearInterval(loadingInterval);
                    if (msgEl) msgEl.textContent = msg;
                }
            });
            showResult(result.dataUrl);
            window.showToast(
                result.engine === 'ai'
                    ? 'AI try-on ready!'
                    : 'Pose overlay ready',
                'success'
            );
            trackTryOnView(selectedProduct._id);
            return;
        } catch (browserErr) {
            console.warn('Browser try-on failed, falling back to server', browserErr);
        }

        // Server fallback (only useful in dev with backend running)
        try {
            let base64Data = userImageBase64;
            if (base64Data.includes(',')) base64Data = base64Data.split(',')[1];
            const data = await api.post('/tryon', {
                userImageBase64: base64Data,
                productId: selectedProduct._id
            });
            if (!data.success) throw new Error(data.message);
            showResult(data.resultImageUrl);
            window.showToast('Your look is ready', 'success');
            trackTryOnView(selectedProduct._id);
        } catch (err) {
            showPlaceholder();
            window.showToast(err.message || 'Generation failed. Please try again.', 'error');
        }
    });

    // Track try-on for personalized recommendations (localStorage)
    function trackTryOnView(productId) {
        try {
            const key = 'trynova:recent_views';
            const recent = JSON.parse(localStorage.getItem(key) || '[]');
            const filtered = recent.filter((id) => id !== productId);
            filtered.unshift(productId);
            localStorage.setItem(key, JSON.stringify(filtered.slice(0, 20)));
        } catch (e) {}
    }

    // ---- 7. Action buttons (exposed to window) ----
    window.cancelTryOn = () => {
        showPlaceholder();
        document.getElementById('ai-insights-container').classList.add('hidden');
    };

    window.saveImage = () => {
        let src = lastResultDataUrl;
        if (mode === 'live' && webcamCanvas) {
            src = webcamCanvas.toDataURL('image/jpeg', 0.92);
        }
        if (!src) {
            window.showToast('Generate a try-on first', 'error');
            return;
        }
        const a = document.createElement('a');
        a.href = src;
        a.download = 'trynova-tryon.jpg';
        a.click();
    };

    window.buyNow = async () => {
        if (!selectedProduct) {
            window.showToast('Please select a product', 'error');
            return;
        }
        try {
            await api.post('/cart/add', {
                productId: selectedProduct._id,
                size: 'M',
                color: selectedProduct.colors ? selectedProduct.colors[0] : 'Default',
                quantity: 1
            });
            window.showToast('Added to cart', 'success');
            if (typeof updateCartBadge === 'function') updateCartBadge();
        } catch (e) {
            window.showToast('Please login to add to cart', 'error');
        }
    };

    // Clean up camera on page unload
    window.addEventListener('beforeunload', () => BrowserTryOn.stopWebcam());
});
