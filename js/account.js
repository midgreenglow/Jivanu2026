const TOKEN_KEY = 'jivanu_token';

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest(url) {
    const token = getToken();
    if (!token) {
        throw new Error('Missing token');
    }
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

document.addEventListener('DOMContentLoaded', async () => {
    const token = getToken();
    if (!token) {
        window.location.href = 'signin.html';
        return;
    }

    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', () => {
            clearToken();
            window.location.href = 'signin.html';
        });
    }

    try {
        const { user } = await apiRequest('/api/me');
        const emailEl = document.getElementById('account-email');
        const phoneEl = document.getElementById('account-phone');
        const createdEl = document.getElementById('account-created');

        if (emailEl) emailEl.textContent = user.email || '—';
        if (phoneEl) phoneEl.textContent = user.phone || '—';
        if (createdEl) createdEl.textContent = user.created_at ? new Date(user.created_at).toLocaleDateString() : '—';

        const reportsData = await apiRequest('/api/reports');
        const list = document.getElementById('reports-list');
        if (list) {
            if (!reportsData.reports.length) {
                list.innerHTML = '<p class="empty-state">No reports yet. We will upload them here once ready.</p>';
                return;
            }
            list.innerHTML = reportsData.reports.map((report) => `
                <div class="report-card">
                    <div>
                        <h3>${report.title}</h3>
                        <p>Uploaded ${new Date(report.uploaded_at).toLocaleDateString()}</p>
                    </div>
                    <a class="btn btn-primary" href="${report.url}" target="_blank" rel="noopener">Download</a>
                </div>
            `).join('');
        }
    } catch (err) {
        clearToken();
        alert('Session expired. Please sign in again.');
        window.location.href = 'signin.html';
    }
});
