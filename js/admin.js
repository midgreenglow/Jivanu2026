document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('admin-upload-form');
    const messageEl = document.getElementById('admin-upload-message');

    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const adminSecret = formData.get('adminSecret');
        formData.delete('adminSecret');

        try {
            const response = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: {
                    'x-admin-secret': adminSecret
                },
                body: formData
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }
            if (messageEl) {
                messageEl.textContent = 'Upload successful.';
            }
            form.reset();
        } catch (err) {
            if (messageEl) {
                messageEl.textContent = err.message;
            }
        }
    });
});
