// Resolve the backend base URL.
// Priority: window.__API_BASE__ override -> localStorage -> sensible default per host.
const API_BASE = (() => {
    if (window.__API_BASE__) return window.__API_BASE__;
    const stored = localStorage.getItem('trynova:api_base');
    if (stored) return stored;
    const host = window.location.hostname || 'localhost';
    return `http://${host}:5000/api`;
})();

const api = {
    async request(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers
        };

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }
            return data;
        } catch (error) {
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
