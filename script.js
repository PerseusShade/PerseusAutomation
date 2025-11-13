const WORKER_ENDPOINT = 'https://worker-create-issue.benjamin-portal.workers.dev';

(() => {
    const optionEl = document.getElementById('option');
    const boxDate = document.getElementById('box-date');
    const boxContent = document.getElementById('box-content');
    const dateInput = document.getElementById('date');
    const contentEl = document.getElementById('content');

    const attachBtn = document.getElementById('attach-btn');
    const fileInput = document.getElementById('file-input');
    const thumbs = document.getElementById('thumbs');
    const errorBox = document.getElementById('error-box');
    const filesCount = document.getElementById('files-count');
    const clearFilesBtn = document.getElementById('clear-files');

    const sendBtn = document.getElementById('send-btn');
    const resultBox = document.getElementById('result-box');
    const submissionCodeInput = document.getElementById('submission-code');

    let files = [];
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
    ];

    const STORAGE_KEY = 'composer_show_details_v1';
    let showDetails = Boolean(localStorage.getItem(STORAGE_KEY) === '1');

    let lastDetailsHtml = '';
    let lastIssueName = '';

    function todayYMD() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }
    if (dateInput) dateInput.value = todayYMD();

    function updateVisibility() {
        const isActualite = optionEl.value === 'actualite';
        boxDate.classList.toggle('hidden', !isActualite);
        boxContent.classList.toggle('hidden', !isActualite);
        boxDate.setAttribute('aria-hidden', String(!isActualite));
        boxContent.setAttribute('aria-hidden', String(!isActualite));
    }
    optionEl.addEventListener('change', updateVisibility);
    updateVisibility();

    function showError(msg) {
        if (!errorBox) return;
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
    }
    function clearError() {
        if (!errorBox) return;
        errorBox.textContent = '';
        errorBox.style.display = 'none';
    }

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (ev) => {
        clearError();
        const sel = Array.from(ev.target.files || []);
        if (!sel.length) return;
        const invalid = [];
        const accepted = [];
        for (const f of sel) {
            if (allowedTypes.includes(f.type)) {
                accepted.push(f);
            } else {
                const ext = (f.name.split('.').pop() || '').toLowerCase();
                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
                    accepted.push(f);
                } else {
                    invalid.push(f.name);
                }
            }
        }
        if (invalid.length) {
            showError('Format invalide : ' + invalid.join(', '));
        }
        if (accepted.length) {
            files = files.concat(accepted);
            renderFiles();
        }
        ev.target.value = '';
    });

    clearFilesBtn.addEventListener('click', () => {
        if (!files.length) return;
        if (!confirm('Retirer toutes les pièces jointes ?')) return;
        files = [];
        renderFiles();
        clearError();
    });

    function renderFiles() {
        if (!thumbs) return;
        thumbs.innerHTML = '';
        if (files.length === 0) {
            filesCount.textContent = 'Aucune pièce';
            return;
        }
        filesCount.textContent = `${files.length} pièce(s)`;
        files.forEach((f, idx) => {
            const div = document.createElement('div');
            div.className = 'thumb';

            const rem = document.createElement('button');
            rem.className = 'rem-btn';
            rem.textContent = '✕';
            rem.title = 'Retirer';
            rem.addEventListener('click', (e) => {
                e.stopPropagation();
                files.splice(idx, 1);
                renderFiles();
            });

            if (f.type && f.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    div.appendChild(img);
                    div.appendChild(rem);
                };
                reader.readAsDataURL(f);
            } else {
                div.textContent = f.name;
                div.appendChild(rem);
            }
            thumbs.appendChild(div);
        });
    }

    function subjectForOption() {
        const opt = optionEl.value;
        if (opt === 'actualite') {
            const d = dateInput.value || todayYMD();
            const s = d.replaceAll('-', '_');
            return `actualite#${s}`;
        }
        return opt;
    }

    function escapeHtml(s) {
        const str = String(s || '').normalize('NFC');
        return str
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;');
    }

    function formatTextareaToHtml(rawText) {
        if (!rawText) return '';
        const lines = rawText.split(/\r?\n/);
        let out = '';
        let listOpen = false;
        for (let i = 0; i < lines.length; i++) {
            const original = lines[i];
            const line = original.trim();
            if (line === '') {
                if (listOpen) {
                    out += '</ul>\n';
                    listOpen = false;
                }
                continue;
            }
            if (line.startsWith('- ')) {
                const itemRaw = line.slice(2).trim();
                let escaped = escapeHtml(itemRaw);
                escaped = escaped.replace(/\*(.+?)\*/gu, (m, p1) => `<strong>${p1}</strong>`);
                if (!listOpen) {
                    out += '<ul>\n';
                    listOpen = true;
                }
                out += `    <li>${escaped}</li>\n`;
            } else {
                if (listOpen) {
                    out += '</ul>\n';
                    listOpen = false;
                }
                let escaped = escapeHtml(line);
                escaped = escaped.replace(/\*(.+?)\*/gu, (m, p1) => `<strong>${p1}</strong>`);
                out += `<p>${escaped}</p>\n`;
            }
        }
        if (listOpen) {
            out += '</ul>\n';
            listOpen = false;
        }
        return out;
    }

    function renderResultMain(errMsg) {
        resultBox.innerHTML = '';

        if (errMsg) {
            resultBox.innerHTML = `<div class="error">${escapeHtml(errMsg)}</div>`;
        } else {
            resultBox.innerHTML = `<div class="success">Terminé</div>`;
            if (lastIssueName) {
                const mailBtn = document.createElement('button');
                mailBtn.id = 'mail-btn';
                mailBtn.className = 'btn-ghost';
                mailBtn.textContent = 'Mail';
                mailBtn.style.marginTop = '';
                mailBtn.addEventListener('click', () => {
                    const to = 'automation.perseusshade@gmail.com';
                    const subject = String(lastIssueName);
                    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`;
                });
                const container = document.createElement('div');
                container.className = 'row mail-container';
                container.appendChild(mailBtn);
                resultBox.appendChild(container);
            }
        }

        resultBox.style.display = 'block';
        renderDetailsIfNeeded();
    }

    function renderDetailsIfNeeded() {
        const old = document.getElementById('result-details');
        if (old) old.remove();

        if (!showDetails) return;

        const details = document.createElement('div');
        details.id = 'result-details';
        details.className = 'box';
        details.style.marginTop = '8px';

        if (lastDetailsHtml) {
            details.innerHTML = lastDetailsHtml;
        } else {
            details.innerHTML = '<div class="note">Aucun détail disponible.</div>';
        }

        resultBox.appendChild(details);
    }

    function toggleShowDetails() {
        showDetails = !showDetails;
        localStorage.setItem(STORAGE_KEY, showDetails ? '1' : '0');
    }

    sendBtn.addEventListener('click', async () => {
        clearError();
        resultBox.style.display = 'none';
        resultBox.innerHTML = '';

        const submissionCode = (submissionCodeInput && submissionCodeInput.value) ? submissionCodeInput.value.trim() : '';
        if (submissionCode === 'ShowDetails') {
            toggleShowDetails();
            const msg = showDetails ? 'Détails affichés (mode debug activé).' : 'Détails masqués (mode debug désactivé).';
            resultBox.innerHTML = `<div class="note">${escapeHtml(msg)}</div>`;
            resultBox.style.display = 'block';
            renderDetailsIfNeeded();
            if (submissionCodeInput) submissionCodeInput.value = '';
            return;
        }

        if (!submissionCode) {
            showError('Le champ Code est requis.');
            return;
        }

        const subject = subjectForOption();
        const contentHtml = formatTextareaToHtml(contentEl.value || '');

        if (optionEl.value === 'actualite' && !(contentEl.value && contentEl.value.trim())) {
            if (!confirm('Le contenu est vide. Continuer ?')) return;
        }

        const fd = new FormData();
        fd.append('subject', subject);
        fd.append('content', contentHtml);
        fd.append('type', optionEl.value);
        if (optionEl.value === 'actualite') fd.append('date', dateInput.value || todayYMD());
        files.forEach((f) => fd.append('files[]', f, f.name));
        fd.append('code', submissionCode);

        sendBtn.disabled = true;
        sendBtn.textContent = 'Envoi en cours…';

        try {
            const resp = await fetch(WORKER_ENDPOINT, {
                method: 'POST',
                body: fd
            });

            const txt = await resp.text();
            let data;
            try {
                data = JSON.parse(txt);
            } catch (err) {
                throw new Error('Réponse invalide du worker : ' + txt);
            }

            if (!resp.ok) {
                const msg = data && (data.error || data.message) ? (data.error || data.message) : 'Erreur serveur';
                throw new Error(msg);
            }

            const parts = [];
            parts.push(`<div class="success">Branch créée : <strong>${escapeHtml(data.branch || '')}</strong></div>`);

            if (data.uploads && data.uploads.length) {
                let repoLink = null;
                const firstRaw = data.uploads[0].raw || data.uploads[0].rawUrl || '';
                const partsRaw = firstRaw.split('/');
                if (partsRaw.length > 5) {
                    const owner = partsRaw[3];
                    const repo = partsRaw[4];
                    repoLink = `https://github.com/${owner}/${repo}/tree/${encodeURIComponent(data.branch || '')}`;
                }
                if (repoLink) {
                    parts.push(`<div class="note">Ouvrir la branche : <a href="${escapeHtml(repoLink)}" target="_blank" rel="noreferrer">${escapeHtml(repoLink)}</a></div>`);
                }
                parts.push('<div class="note">Fichiers uploadés :</div>');
                parts.push('<ul>');
                data.uploads.forEach(u => {
                    const raw = u.raw || u.rawUrl || '';
                    parts.push(`<li><a href="${escapeHtml(raw)}" target="_blank" rel="noreferrer">${escapeHtml(u.path || raw)}</a></li>`);
                });
                parts.push('</ul>');
            }

            lastDetailsHtml = parts.join('\n');

            lastIssueName = (data.issue_name && String(data.issue_name).trim()) ||
                            (data.branch && String(data.branch).trim()) ||
                            (data.issue_number ? `#${String(data.issue_number)}` : '') ||
                            subject || '';

            renderResultMain(null);

            files = [];
            renderFiles();
        } catch (err) {
            console.error(err);
            renderResultMain(err.message || String(err));
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Envoyer';
        }
    });

    attachBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

    renderFiles();
})();
