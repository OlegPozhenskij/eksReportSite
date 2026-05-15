// Конфигурация
const SERVER_URL = 'http://10.100.162.110:5000';
let currentPreviewDoc = null;

//сырая версия

// DOM элементы
const phoneInput = document.getElementById('phoneInput');
const contactNameInput = document.getElementById('contactNameInput');
const fileInput = document.getElementById('fileInput');
const fileDropArea = document.getElementById('fileDropArea');
const filePreview = document.getElementById('filePreview');
const uploadBtn = document.getElementById('uploadBtn');
const statusDiv = document.getElementById('statusMessage');
const refreshBtn = document.getElementById('refreshReportsBtn');
const reportsContainer = document.getElementById('reportsContainer');
const previewModal = document.getElementById('previewModal');
const previewIframe = document.getElementById('previewIframe');
const downloadFromModalBtn = document.getElementById('downloadFromModalBtn');

let selectedFile = null;

// ============================================================
// ОЧИСТКА НОМЕРА ТЕЛЕФОНА (оставляем только цифры)
// ============================================================
function cleanPhoneNumber(phone) {
    return phone.replace(/[^\d+]/g, '');
}

phoneInput.addEventListener('input', (e) => {
    let cleaned = cleanPhoneNumber(e.target.value);
    if (cleaned && !cleaned.startsWith('+')) {
        if (cleaned.length === 11 && cleaned.startsWith('7')) {
            cleaned = '+' + cleaned;
        }
    }
    e.target.value = cleaned;
});

// ============================================================
// РАБОТА С ФАЙЛАМИ (Drag & Drop + кнопка)
// ============================================================
fileDropArea.addEventListener('click', () => {
    fileInput.click();
});

fileDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropArea.style.borderColor = '#667eea';
    fileDropArea.style.background = '#f5f3ff';
});

fileDropArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    fileDropArea.style.borderColor = '#cbd5e0';
    fileDropArea.style.background = '#fafbfc';
});

fileDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropArea.style.borderColor = '#cbd5e0';
    fileDropArea.style.background = '#fafbfc';

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    selectedFile = file;
    const sizeKB = (file.size / 1024).toFixed(1);
    filePreview.innerHTML = `
        <i class="fas fa-check-circle" style="color:#4CAF50;"></i>
        ${file.name} (${sizeKB} KB)
    `;
}

// ============================================================
// ОТПРАВКА ФАЙЛА НА СЕРВЕР
// ============================================================
uploadBtn.addEventListener('click', async () => {
    const rawPhone = phoneInput.value.trim();
    const phone = cleanPhoneNumber(rawPhone);
    const contactName = contactNameInput.value.trim();

    if (!phone) {
        showStatus('❌ Введите номер телефона', 'error');
        return;
    }

    if (!selectedFile) {
        showStatus('❌ Выберите аудиофайл', 'error');
        return;
    }

    showStatus('⏳ Отправка...', 'loading');

    const formData = new FormData();
    formData.append('phone', phone);
    formData.append('file', selectedFile);
    if (contactName) {
        formData.append('contact_name', contactName);
    }

    try {
        const response = await fetch(`${SERVER_URL}/upload`, {
            method: 'POST',
            body: formData,
            mode: 'cors'
        });

        const result = await response.json();

        if (response.ok && result.status === 'ok') {
            showStatus(`✅ ${result.file} отправлен! Обработка начата.`, 'success');
            selectedFile = null;
            fileInput.value = '';
            filePreview.innerHTML = '';
            loadReports();
        } else {
            showStatus(`❌ Ошибка: ${result.error || 'Неизвестная ошибка'}`, 'error');
        }
    } catch (err) {
        showStatus(`❌ Ошибка соединения: ${err.message}`, 'error');
    }
});

function showStatus(text, type) {
    statusDiv.textContent = text;
    statusDiv.className = `status-message ${type}`;
    setTimeout(() => {
        if (statusDiv.className === `status-message ${type}`) {
            statusDiv.style.display = 'none';
            statusDiv.className = 'status-message';
        } else {
            statusDiv.className = 'status-message';
        }
    }, 4000);
    statusDiv.style.display = 'block';
}

// ============================================================
// ЗАГРУЗКА И ГРУППИРОВКА ОТЧЁТОВ
// ============================================================
async function loadReports() {
    reportsContainer.innerHTML = '<div class="loading">Загрузка отчётов...</div>';

    try {
        const response = await fetch(`${SERVER_URL}/api/reports`);
        const data = await response.json();
        const reports = data.reports || [];

        if (reports.length === 0) {
            reportsContainer.innerHTML = '<div class="empty-folder">📭 Нет отчётов. Загрузите аудиофайлы.</div>';
            return;
        }

        // Группируем по номеру телефона
        const grouped = {};
        reports.forEach(report => {
            let phone = report.phone;
            if (!phone || phone === 'unknown') {
                // Извлекаем номер из имени файла
                const match = report.filename.match(/(\d{10,11})/);
                phone = match ? match[0] : 'unknown';
            }

            if (!grouped[phone]) {
                grouped[phone] = [];
            }
            grouped[phone].push(report);
        });

        // Рендерим группы
        renderGroups(grouped);

    } catch (err) {
        reportsContainer.innerHTML = `<div class="empty-folder">❌ Ошибка: ${err.message}</div>`;
    }
}

function renderGroups(grouped) {
    const phoneNumbers = Object.keys(grouped).sort();

    if (phoneNumbers.length === 0) {
        reportsContainer.innerHTML = '<div class="empty-folder">📭 Нет отчётов</div>';
        return;
    }

    reportsContainer.innerHTML = '';

    phoneNumbers.forEach(phone => {
        const reports = grouped[phone];
        const totalSize = reports.reduce((sum, r) => sum + (r.size || 0), 0);
        const sizeMB = (totalSize / 1024 / 1024).toFixed(1);

        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder';
        folderDiv.innerHTML = `
            <div class="folder-header" data-phone="${phone}">
                <i class="fas fa-chevron-right folder-icon"></i>
                <div class="folder-info">
                    <div class="folder-name">📞 ${formatPhoneNumber(phone)}</div>
                    <div class="folder-stats">${reports.length} отчёт(ов) • ${sizeMB} MB</div>
                </div>
                <div class="folder-actions">
                    <button class="download-all-btn" title="Скачать все отчёты">
                        <i class="fas fa-download"></i> Все
                    </button>
                </div>
            </div>
            <div class="folder-content" id="content-${phone.replace(/[^0-9]/g, '')}">
                ${renderReportsList(reports)}
            </div>
        `;

        reportsContainer.appendChild(folderDiv);

        // Обработчик раскрытия папки
        const header = folderDiv.querySelector('.folder-header');
        const content = folderDiv.querySelector('.folder-content');
        const icon = header.querySelector('.folder-icon');

        header.addEventListener('click', (e) => {
            if (e.target.closest('.download-all-btn')) return;
            content.classList.toggle('show');
            header.classList.toggle('expanded');
        });

        // Обработчик скачивания всех отчётов из папки
        const downloadAllBtn = header.querySelector('.download-all-btn');
        downloadAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadAllReports(reports);
        });
    });
}

function renderReportsList(reports) {
    return reports.map(report => `
        <div class="report-item" data-filename="${report.filename}">
            <div class="report-info">
                <div class="report-name">📄 ${report.filename}</div>
                <div class="report-meta">📅 ${report.date} • ${formatSize(report.size)}</div>
            </div>
            <div class="report-actions">
                <button class="preview-btn" onclick="previewReport('${report.filename}')" title="Предпросмотр">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="download-btn" onclick="downloadReport('${report.filename}')" title="Скачать">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================================
// РАБОТА С ОТЧЁТАМИ
// ============================================================
function formatPhoneNumber(phone) {
    if (!phone) return 'Неизвестный номер';
    const clean = phone.replace(/[^\d]/g, '');
    if (clean.length === 11) {
        return `+${clean[0]} (${clean.slice(1,4)}) ${clean.slice(4,7)}-${clean.slice(7,9)}-${clean.slice(9,11)}`;
    }
    return phone;
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

async function downloadReport(filename) {
    const url = `${SERVER_URL}/download/${filename}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

async function downloadAllReports(reports) {
    for (const report of reports) {
        await new Promise(resolve => {
            const url = `${SERVER_URL}/download/${report.filename}`;
            const a = document.createElement('a');
            a.href = url;
            a.download = report.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(resolve, 500);
        });
    }
    showStatus(`📥 Скачивание всех отчётов началось`, 'success');
}

async function previewReport(filename) {
    showStatus('⏳ Загрузка предпросмотра...', 'loading');

    try {
        // Используем наш локальный preview эндпоинт
        const previewUrl = `${SERVER_URL}/preview/${filename}`;
        previewIframe.src = previewUrl;
        previewModal.classList.add('show');

        downloadFromModalBtn.onclick = () => {
            downloadReport(filename);
        };
        showStatus('', '');
    } catch (err) {
        downloadReport(filename);
        showStatus(`📥 Скачивание: ${filename}`, 'success');
    }
}

function closePreview() {
    previewModal.classList.remove('show');
    previewIframe.src = 'about:blank';
    currentPreviewDoc = null;
}

// Закрытие модального окна по Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewModal.classList.contains('show')) {
        closePreview();
    }
});

// Клик вне модального окна
previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
        closePreview();
    }
});

// Автообновление каждые 30 секунд
refreshBtn.addEventListener('click', loadReports);
setInterval(loadReports, 30000);

// Первоначальная загрузка
loadReports();