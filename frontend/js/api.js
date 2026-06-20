// Resolve the backend base URL.
// Priority: window.__API_BASE__ override -> localStorage -> sensible default per host.
const API_BASE = (() => {
    if (window.__API_BASE__) return window.__API_BASE__;
    const stored = localStorage.getItem('trynova:api_base');
    if (stored) return stored;
    const host = window.location.hostname || 'localhost';
    return `http://${host}:5000/api`;
})();

// True when we've decided the live backend isn't reachable and we should
// route every subsequent request straight to the demo handler.
let _demoOnly = false;

function _shouldUseDemo() {
    return _demoOnly || (window.TryNovaDemo && window.TryNovaDemo.isEnabled());
}

async function _demoCall(method, endpoint, body) {
    if (!window.TryNovaDemo) throw new Error('Demo mode not loaded');
    window.TryNovaDemo.enable();
    return window.TryNovaDemo.handle(method, endpoint, body);
}

const api = {
    async request(endpoint, options = {}) {
        const method = options.method || 'GET';
        const body = options.body ? JSON.parse(options.body) : undefined;

        if (_shouldUseDemo()) {
            return _demoCall(method, endpoint, body);
        }

        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };

        const config = { ...options, headers };
        const controller = new AbortController();
        config.signal = controller.signal;
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);
            clearTimeout(timeoutId);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            // Network errors / aborts -> flip to demo mode permanently for this session.
            const isNetwork = error.name === 'AbortError'
                || error.name === 'TypeError'
                || /Failed to fetch|NetworkError/i.test(error.message || '');
            if (isNetwork && window.TryNovaDemo) {
                _demoOnly = true;
                return _demoCall(method, endpoint, body);
            }
            console.error('API Error:', error);
            throw error;
        }
    },

    get(endpoint) { return this.request(endpoint); },
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};

// Global Toast System
window.showToast = (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        if(container.contains(toast)) container.removeChild(toast);
    }, 3000);
};

// Update Navbar Auth State
document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const authLinks = document.getElementById('auth-links');
    
    if (user && authLinks) {
        authLinks.innerHTML = `
            <a href="profile.html" class="hover:text-accent smooth-transition">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </a>
        `;
    } else if (authLinks) {
        authLinks.innerHTML = `
            <a href="signin.html" class="text-sm font-medium hover:text-accent smooth-transition">Sign In</a>
        `;
    }
    
    updateCartBadge();
});

async function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    
    try {
        if (localStorage.getItem('token')) {
            const res = await api.get('/cart');
            const count = res.data.items.reduce((acc, item) => acc + item.quantity, 0);
            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (e) {
        console.error("Cart fetch error", e);
    }
}
