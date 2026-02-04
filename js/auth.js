const TOKEN_KEY = 'jivanu_token';
let lastOtpIdentifier = null;

function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest(url, options = {}) {
    const headers = options.headers || {};
    if (options.json !== false) {
        headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const otpRequestForm = document.getElementById('otp-request-form');
    const otpVerifyForm = document.getElementById('otp-verify-form');
    const otpCodeEl = document.getElementById('otp-code');
    const otpRequestSection = document.getElementById('otp-request-section');
    const otpVerifySection = document.getElementById('otp-verify-section');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(loginForm);
            try {
                const data = await apiRequest('/api/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: formData.get('email'),
                        password: formData.get('password')
                    })
                });
                saveToken(data.token);
                window.location.href = 'account.html';
            } catch (err) {
                alert(err.message);
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(signupForm);
            try {
                const data = await apiRequest('/api/signup', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: formData.get('email'),
                        phone: formData.get('phone'),
                        password: formData.get('password')
                    })
                });
                saveToken(data.token);
                window.location.href = 'account.html';
            } catch (err) {
                alert(err.message);
            }
        });
    }

    if (otpRequestForm) {
        otpRequestForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(otpRequestForm);
            const identifier = formData.get('identifier');
            try {
                const data = await apiRequest('/api/request-otp', {
                    method: 'POST',
                    body: JSON.stringify({ identifier })
                });
                lastOtpIdentifier = identifier;
                if (otpCodeEl) {
                    otpCodeEl.textContent = `Mock OTP code: ${data.code}`;
                    otpCodeEl.style.display = 'block';
                }
                if (otpRequestSection && otpVerifySection) {
                    otpRequestSection.style.display = 'none';
                    otpVerifySection.style.display = 'block';
                }
            } catch (err) {
                alert(err.message);
            }
        });
    }

    if (otpVerifyForm) {
        otpVerifyForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(otpVerifyForm);
            try {
                const data = await apiRequest('/api/verify-otp', {
                    method: 'POST',
                    body: JSON.stringify({
                        identifier: lastOtpIdentifier || '',
                        code: formData.get('code')
                    })
                });
                saveToken(data.token);
                window.location.href = 'account.html';
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const signoutButtons = document.querySelectorAll('#signout-btn');
    signoutButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            clearToken();
            window.location.href = 'signin.html';
        });
    });
});
