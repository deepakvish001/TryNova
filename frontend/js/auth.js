// auth.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            try {
                const res = await api.post('/auth/login', { email, password });
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data));
                window.showToast('Login successful', 'success');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } catch (error) {
                window.showToast(error.message, 'error');
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirm = document.getElementById('signup-confirm').value;
            
            if (password !== confirm) {
                return window.showToast('Passwords do not match', 'error');
            }
            
            try {
                const res = await api.post('/auth/signup', { name, email, password });
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data));
                window.showToast('Account created successfully', 'success');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } catch (error) {
                window.showToast(error.message, 'error');
            }
        });
    }
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'signin.html';
}
