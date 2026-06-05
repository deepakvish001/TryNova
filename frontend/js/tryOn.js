document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const dropContent = document.getElementById('drop-content');
    const productDropdown = document.getElementById('product-dropdown');
    const generateBtn = document.getElementById('generate-btn');
    const productSelector = document.getElementById('product-selector');
    const selectedProductContainer = document.getElementById('selected-product-container');
    const changeProductBtn = document.getElementById('change-product-btn');
    
    // Result elements
    const resultPlaceholder = document.getElementById('result-placeholder');
    const resultContainer = document.getElementById('result-container');
    const resultBefore = document.getElementById('result-before');
    const resultAfter = document.getElementById('result-after');
    const sliderHandle = document.getElementById('slider-handle');
    const sliderClip = document.getElementById('slider-clip');
    const resetBtn = document.getElementById('reset-btn');

    // Loading elements
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const loadingProgress = document.getElementById('loading-progress');

    let userImageBase64 = null;
    let selectedProductId = null;

    // 1. Fetch products for dropdown
    try {
        const res = await api.get('/products?limit=100');
        if (res.success) {
            res.data.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p._id;
                opt.textContent = `${p.name} - ₹${p.price}`;
                opt.dataset.image = p.images[0];
                opt.dataset.category = p.category;
                opt.dataset.name = p.name;
                opt.dataset.price = p.price;
                productDropdown.appendChild(opt);
            });
        }
    } catch(e) {
        console.error('Failed to load products');
    }

    // Check URL params
    const urlParams = new URLSearchParams(window.location.search);
    const paramProductId = urlParams.get('productId');
    if (paramProductId) {
        productDropdown.value = paramProductId;
        selectProduct(paramProductId);
    }

    // 2. Handle File Upload
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-accent');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-accent');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-accent');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
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

    // 3. Handle Product Selection
    productDropdown.addEventListener('change', (e) => {
        if (e.target.value) {
            selectProduct(e.target.value);
        }
    });

    function selectProduct(id) {
        const option = Array.from(productDropdown.options).find(opt => opt.value === id);
        if (!option) return;

        selectedProductId = id;
        
        document.getElementById('selected-product-img').src = option.dataset.image;
        document.getElementById('selected-product-category').textContent = option.dataset.category;
        document.getElementById('selected-product-name').textContent = option.dataset.name;
        document.getElementById('selected-product-price').textContent = `₹${option.dataset.price}`;

        productSelector.classList.add('hidden');
        selectedProductContainer.classList.remove('hidden');
        checkReady();
    }

    changeProductBtn.addEventListener('click', () => {
        selectedProductId = null;
        selectedProductContainer.classList.add('hidden');
        productSelector.classList.remove('hidden');
        productDropdown.value = '';
        checkReady();
    });

    function checkReady() {
        if (userImageBase64 && selectedProductId) {
            generateBtn.disabled = false;
        } else {
            generateBtn.disabled = true;
        }
    }

    // 4. New AI Pipeline and UI States
    const loadingMessages = [
        "Detecting your body pose...",
        "Segmenting clothing region...",
        "Fitting the outfit to your body...",
        "Adjusting lighting and shadows...",
        "Generating your final look..."
    ];

    let loadingInterval;

    function showLoading() {
        document.getElementById('statePlaceholder').classList.add('hidden');
        document.getElementById('stateResult').classList.add('hidden');
        document.getElementById('stateLoading').classList.remove('hidden');
        let i = 0;
        const msgEl = document.getElementById('loadingMessage');
        msgEl.textContent = loadingMessages[0];
        loadingInterval = setInterval(() => {
            i++;
            msgEl.textContent = loadingMessages[i % loadingMessages.length];
        }, 2500);
    }

    function showResult(imageUrl) {
        clearInterval(loadingInterval);
        document.getElementById('stateLoading').classList.add('hidden');
        document.getElementById('statePlaceholder').classList.add('hidden');
        document.getElementById('stateResult').classList.remove('hidden');
        document.getElementById('generatedImage').src = imageUrl;
        
        // Hide AI insights until generated, if we are still using them
        const insights = document.getElementById('ai-insights-container');
        if (insights) insights.classList.remove('hidden');
    }

    function showPlaceholder() {
        clearInterval(loadingInterval);
        document.getElementById('stateLoading').classList.add('hidden');
        document.getElementById('stateResult').classList.add('hidden');
        document.getElementById('statePlaceholder').classList.remove('hidden');
    }

    generateBtn.addEventListener('click', async () => {
        if (!userImageBase64) {
            window.showToast('Please upload your photo first', 'error'); return;
        }
        if (!selectedProductId) {
            window.showToast('Please select a product', 'error'); return;
        }

        showLoading();

        try {
            // Strip the data:image/...;base64, prefix if present for the backend payload
            let base64Data = userImageBase64;
            if (base64Data.includes(',')) {
                base64Data = base64Data.split(',')[1];
            }

            const data = await api.post('/tryon', {
                userImageBase64: base64Data, 
                productId: selectedProductId
            });

            if (!data.success) throw new Error(data.message);

            showResult(data.resultImageUrl);
            window.showToast('Your look is ready! 🎉', 'success');

        } catch (err) {
            showPlaceholder();
            window.showToast(err.message || 'Generation failed. Please try again.', 'error');
        }
    });

    // Action buttons (expose to window for onclick handlers in HTML)
    window.cancelTryOn = () => {
        showPlaceholder();
        const insights = document.getElementById('ai-insights-container');
        if (insights) insights.classList.add('hidden');
    };

    window.saveImage = () => {
        const img = document.getElementById('generatedImage');
        if (!img.src || document.getElementById('stateResult').classList.contains('hidden')) {
            window.showToast('Generate a try-on first', 'error'); return;
        }
        const a = document.createElement('a');
        a.href = img.src;
        a.download = 'trynova-tryon.jpg';
        a.click();
    };

    window.buyNow = async () => {
        if (!selectedProductId) {
            window.showToast('Please select a product', 'error'); return;
        }
        try {
            await api.post('/cart/add', {
                productId: selectedProductId,
                size: 'M',
                color: 'Default',
                quantity: 1
            });
            window.showToast('Added to cart', 'success');
            if (typeof updateCartBadge === 'function') updateCartBadge();
        } catch(e) {
            window.showToast('Please login to add to cart', 'error');
        }
    };
});
