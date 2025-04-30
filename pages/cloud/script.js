const SUPABASE_URL = 'https://fmxddvjgkykuqwmasigo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteGRkdmpna3lrdXF3bWFzaWdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDA0MzMyNywiZXhwIjoyMDU5NjE5MzI3fQ.03Je2x-ixNl0SUzjSHmGy_fmybYbkxyg6prdv7TumI8';
const BUCKET_NAME = 'cloud-storage';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
function showToast(message, duration = 3000) {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, duration);
}
let currentCategory = 'all';
let currentView = 'grid';
let currentFiles = [];
let selectedFile = null;
let searchQuery = '';
const imageCache = {
    storage: {},
    localStorageKey: 'cloud_image_cache',
    cacheLifetime: 24 * 60 * 60 * 1000,
    init() {
        try {
            const storedCache = localStorage.getItem(this.localStorageKey);
            if (storedCache) {
                const parsedCache = JSON.parse(storedCache);
                this.cleanExpiredCache(parsedCache);
                this.storage = parsedCache;
            }
        } catch (error) {
            console.warn('初始化图片缓存失败:', error);
            this.storage = {};
        }
    },
    async getImageUrl(fileName) {
        try {
            // 检查内存缓存
            const cachedItem = this.storage[fileName];
            if (cachedItem && cachedItem.expires > Date.now()) {
                // 如果缓存的是公共 URL，直接返回
                if (!cachedItem.url.includes('/sign/')) { // 简单判断是否为签名 URL
                    return cachedItem.url;
                }
                // 如果缓存的是签名 URL，则忽略缓存，继续往下获取新的 URL
            }

            // 缓存无效或为签名 URL，尝试获取新的签名 URL
            try {
                const { data, error } = await supabase.storage
                    .from(BUCKET_NAME)
                    .createSignedUrl(fileName, 5 * 60); // 缩短有效期至5分钟，减少过期风险

                if (!error && data.signedUrl) {
                    // 获取成功，更新缓存（但下次仍会重新获取新的签名URL）
                    this.storage[fileName] = {
                        url: data.signedUrl,
                        expires: Date.now() + this.cacheLifetime // 仍然使用长缓存时间标记，但逻辑上会忽略
                    };
                    this.saveToLocalStorage();
                    return data.signedUrl;
                }
                // 如果获取签名 URL 出错，继续尝试公共 URL
                if(error) console.warn(`获取签名URL失败 (${fileName}):`, error.message);

            } catch (signError) {
                 console.warn(`获取签名URL异常 (${fileName}):`, signError);
            }

            // 获取签名 URL 失败或出错，尝试使用公共 URL
            const publicUrl = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(fileName).data.publicUrl;

            // 更新缓存为公共 URL
            this.storage[fileName] = {
                url: publicUrl,
                expires: Date.now() + this.cacheLifetime
            };
            this.saveToLocalStorage();
            return publicUrl;

        } catch (error) {
            console.error(`获取图片URL失败 (${fileName}):`, error);
             // 尝试再次获取公共URL作为最终备选
            try {q
                const publicUrl = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(fileName).data.publicUrl;
                return publicUrl;
            } catch (e) {
                console.error(`获取公共URL也失败 (${fileName}):`, e);
                return null;
            }
        }
    },
    saveToLocalStorage() {
        try {
            localStorage.setItem(this.localStorageKey, JSON.stringify(this.storage));
        } catch (error) {
            console.warn('保存缓存到localStorage失败:', error);
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                this.cleanOldestHalf();
                try {
                    localStorage.setItem(this.localStorageKey, JSON.stringify(this.storage));
                } catch (innerError) {
                    console.error('清理后仍无法保存缓存:', innerError);
                }
            }
        }
    },
    cleanExpiredCache(cacheObj) {
        const now = Date.now();
        for (const key in cacheObj) {
            if (cacheObj[key].expires < now) {
                delete cacheObj[key];
            }
        }
    },
    cleanOldestHalf() {
        const entries = Object.entries(this.storage);
        if (entries.length === 0) return;
        entries.sort((a, b) => a[1].expires - b[1].expires);
        const halfLength = Math.floor(entries.length / 2);
        for (let i = 0; i < halfLength; i++) {
            delete this.storage[entries[i][0]];
        }
    },
    clear() {
        this.storage = {};
        localStorage.removeItem(this.localStorageKey);
    }
};
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_FILE_TYPES = {
    images: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico'],
    documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf'],
    videos: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'],
    audios: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'],
    archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
    code: ['html', 'css', 'js', 'json', 'xml', 'php', 'py', 'java', 'cpp', 'c', 'cs', 'rb', 'pl', 'sh', 'ts', 'jsx', 'tsx']
};
const uploadInput = document.getElementById('file-upload');
const fileList = document.getElementById('file-list');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const viewButtons = document.querySelectorAll('.view-btn');
const categoryButtons = document.querySelectorAll('.category');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalContent = modal.querySelector('.modal-content');
const closeModal = document.querySelector('.close-modal');
const uploadProgressContainer = document.getElementById('upload-progress-container');
const closeProgressBtn = document.getElementById('close-progress');
const uploadProgressItems = document.getElementById('upload-progress-items');
const storageProgress = document.getElementById('storage-progress');
const usedStorage = document.getElementById('used-storage');
const totalStorage = document.getElementById('total-storage');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const dropArea = document.getElementById('drop-area');
const dropOverlay = document.getElementById('drop-overlay');
let simpleContextMenu = null;
document.addEventListener('DOMContentLoaded', initialize);
function on(selectorOrEl, evt, handler) {
    const els = typeof selectorOrEl === 'string'
        ? document.querySelectorAll(selectorOrEl)
        : [selectorOrEl];
    els.forEach(el => el.addEventListener(evt, handler));
}
function setupEventHandlers() {
    on(uploadInput, 'change', e => handleFiles(e.target.files));
    on(closeProgressBtn, 'click', () => uploadProgressContainer.classList.add('hidden'));
    on('#search-btn', 'click', () => { searchQuery = searchInput.value.trim().toLowerCase(); filterFiles(); });
    on('#search-input', 'keyup', e => { if (e.key === 'Enter') { searchQuery = searchInput.value.trim().toLowerCase(); filterFiles(); }});
    on('.view-btn', 'click', e => changeView(e.currentTarget.dataset.view));
    on('.category', 'click', e => changeCategory(e.currentTarget.dataset.category));
    on(window, 'click', e => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (modalContent) {
                modalContent.style.width = '';
                modalContent.style.height = '';
            }
        }
    });
    on(document, 'click', hideContextMenu);
    on(window, 'keydown', e => { if (e.key === 'Escape') hideContextMenu(); });
    initDragAndDrop();
}
async function initialize() {
    imageCache.init();
    await createBucketIfNotExists();
    fileList.className = `file-list ${currentView}-view`;
    await loadFiles();
    await updateStorageUsage();
    setupEventHandlers();
}
async function createBucketIfNotExists() {
    try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);
        if (!bucketExists) {
            await supabase.storage.createBucket(BUCKET_NAME, {
                public: true
            });
            console.log(`创建存储桶 ${BUCKET_NAME} 成功`);
        }
    } catch (error) {
        console.error('创建存储桶失败:', error);
        showToast('创建存储桶失败，请检查网络连接');
    }
}
function initDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    function highlight() {
        dropOverlay.classList.add('active');
    }
    function unhighlight() {
        dropOverlay.classList.remove('active');
    }
    dropArea.addEventListener('drop', handleDrop, false);
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    dropOverlay.querySelector('.drop-message').addEventListener('click', () => {
        uploadInput.click();
    });
    const dropMessage = dropOverlay.querySelector('.drop-message');
    if (dropMessage) {
        dropMessage.innerHTML = `
            <div class="drop-icon">
                <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <p>将文件拖放到此处或点击上传</p>
            <div class="supported-formats">
                <p>支持的格式:</p>
                <div class="format-tags">
                    <span class="format-tag">图片</span>
                    <span class="format-tag">文档</span>
                    <span class="format-tag">视频</span>
                    <span class="format-tag">音频</span>
                    <span class="format-tag">压缩包</span>
                    <span class="format-tag">代码</span>
                </div>
            </div>
        `;
    }
}
async function loadFiles() {
    showLoading(true);
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list('', {
                sortBy: { column: 'name', order: 'asc' }
            });
        if (error) throw error;
        currentFiles = data || [];
        filterFiles();
    } catch (error) {
        console.error('加载文件失败:', error);
        showToast('加载文件失败，请检查网络连接');
        fileList.innerHTML = '<div class="error-message">加载文件失败，请重试</div>';
    } finally {
        showLoading(false);
    }
}
function filterFiles() {
    let filteredFiles = [...currentFiles];
    if (currentCategory !== 'all') {
        filteredFiles = filteredFiles.filter(file => {
            const fileType = getFileType(file.name).toLowerCase();
            switch (currentCategory) {
                case 'images':
                    return ALLOWED_FILE_TYPES.images.includes(fileType);
                case 'documents':
                    return ALLOWED_FILE_TYPES.documents.includes(fileType);
                case 'others':
                    return !Object.values(ALLOWED_FILE_TYPES).flat().includes(fileType);
                default:
                    return true;
            }
        });
    }
    if (searchQuery) {
        filteredFiles = filteredFiles.filter(file =>
            file.name.toLowerCase().includes(searchQuery)
        );
    }
    renderFiles(filteredFiles);
}
function handleFiles(files) {
    if (!files || files.length === 0) return;
    uploadProgressContainer.classList.remove('hidden');
    uploadProgressItems.innerHTML = '';
    Array.from(files).forEach((file, index) => {
        const fileId = `file-${Date.now()}-${index}`;
        addFileToUploadQueue(file, fileId);
        processFileUpload(file, fileId);
    });
}
function addFileToUploadQueue(file, fileId) {
    const progressItem = document.createElement('div');
    progressItem.className = 'upload-progress-item';
    progressItem.innerHTML = `
        <span class="upload-file-name">${file.name}</span>
        <div class="upload-progress-bar">
            <div id="${fileId}" class="upload-progress" style="width: 0%;"></div>
        </div>
        <div class="upload-status">
            <span id="${fileId}-status">准备上传...</span>
            <span id="${fileId}-percent">0%</span>
        </div>
    `;
    uploadProgressItems.appendChild(progressItem);
    uploadProgressContainer.classList.remove('hidden');
}
function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
async function processFileUpload(file, fileId) {
    if (file.size > MAX_FILE_SIZE) {
        document.getElementById(fileId).classList.add('error');
        document.getElementById(`${fileId}-status`).textContent = '文件过大';
        document.getElementById(`${fileId}-percent`).textContent = '错误';
        showToast(`文件 ${file.name} 超过最大上传限制（100MB）`);
        return;
    }
    const fileType = getFileType(file.name).toLowerCase();
    const isAllowedType = Object.values(ALLOWED_FILE_TYPES).some(types => types.includes(fileType));
    if (!isAllowedType) {
        showToast(`警告：文件类型 ${fileType} 可能不受支持`);
    }
    const safeName = sanitizeFileName(file.name);
    const fileExists = currentFiles.some(existingFile =>
        existingFile.name.toLowerCase() === safeName.toLowerCase());
    if (fileExists) {
        document.getElementById(`${fileId}-status`).textContent = '文件已存在';
        document.getElementById(`${fileId}-percent`).textContent = '等待确认';
        if (!confirm(`文件 "${file.name}" 已存在，是否覆盖？`)) {
            document.getElementById(fileId).classList.add('error');
            document.getElementById(`${fileId}-status`).textContent = '已取消';
            return;
        }
    }
    try {
        const progressEl = document.getElementById(fileId);
        const percentEl = document.getElementById(`${fileId}-percent`);
        const statusEl = document.getElementById(`${fileId}-status`);
        if (statusEl) {
            statusEl.textContent = '上传中...';
        }
        if (progressEl) {
            progressEl.classList.add('uploading');
        }
        let simulatedPercent = 0;
        let isUploading = true;
        let lastRealPercent = 0;
        const progressSimulator = setInterval(() => {
            if (!isUploading) {
                clearInterval(progressSimulator);
                return;
            }
            const increment = Math.max(0.5, (95 - simulatedPercent) / 20);
            simulatedPercent = Math.min(95, simulatedPercent + increment);
            const displayPercent = Math.max(lastRealPercent, Math.floor(simulatedPercent));
            if (progressEl) {
                progressEl.style.width = `${displayPercent}%`;
            }
            if (percentEl) {
                percentEl.textContent = `${displayPercent}%`;
            }
        }, 200);
        const updateProgress = (progress) => {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            lastRealPercent = percent;
            if (percent >= 100) {
                isUploading = false;
                if (progressEl) {
                    progressEl.classList.remove('uploading');
                    progressEl.style.width = '100%';
                }
                if (percentEl) {
                    percentEl.textContent = '100%';
                }
            }
        };
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(safeName, file, {
                cacheControl: '3600',
                upsert: true,
                contentType: file.type || 'application/octet-stream',
                onUploadProgress: updateProgress
            });
        isUploading = false;
        clearInterval(progressSimulator);
        if (error) throw error;
        if (progressEl) {
            progressEl.classList.remove('uploading');
            progressEl.classList.add('complete');
            progressEl.style.width = '100%';
            progressEl.classList.add('complete-animation');
        }
        if (statusEl) {
            statusEl.textContent = '上传完成';
        }
        if (percentEl) {
            percentEl.textContent = '100%';
        }
        await loadFiles();
        await updateStorageUsage();
    } catch (error) {
        console.error(`上传文件 ${file.name} 失败:`, error);
        const progressEl = document.getElementById(fileId);
        const statusEl = document.getElementById(`${fileId}-status`);
        const percentEl = document.getElementById(`${fileId}-percent`);
        if (progressEl) {
            progressEl.classList.remove('uploading');
            progressEl.classList.add('error');
            progressEl.classList.add('error-animation');
        }
        if (statusEl) {
            statusEl.textContent = '上传失败';
        }
        if (percentEl) {
            percentEl.textContent = '错误';
        }
        showToast(`上传文件 ${file.name} 失败: ${error.message}`);
    }
}
function changeView(view) {
    viewButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.view-btn[data-view="${view}"]`).classList.add('active');
    currentView = view;
    fileList.className = `file-list ${view}-view`;
    filterFiles();
}
function changeCategory(category) {
    categoryButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.category[data-category="${category}"]`).classList.add('active');
    currentCategory = category;
    filterFiles();
}
async function downloadSelectedFile() {
    if (!selectedFile) return;
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(selectedFile.name);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedFile.name;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showToast('文件下载开始');
    } catch (error) {
        console.error('下载文件失败:', error);
        showToast('下载文件失败: ' + error.message);
    }
}
async function shareSelectedFile() {
    if (!selectedFile) return;
    try {
        const { data } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(selectedFile.name);
        modalTitle.textContent = '分享文件';
        modalBody.innerHTML = `
            <div class="form-group">
                <label>分享链接</label>
                <div style="display: flex; margin-bottom: 10px;">
                    <input type="text" id="share-link" class="form-control" value="${data.publicUrl}" readonly>
                    <button id="copy-link" class="btn" style="margin-left: 10px; border-radius: 4px;">复制</button>
                </div>
            </div>
            <button id="close-share" class="form-btn">关闭</button>
        `;
        document.getElementById('copy-link').addEventListener('click', () => {
            const shareLink = document.getElementById('share-link');
            shareLink.select();
            document.execCommand('copy');
            showToast('链接已复制到剪贴板');
        });
        document.getElementById('close-share').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        modal.style.display = 'block';
    } catch (error) {
        console.error('创建分享链接失败:', error);
        showToast('创建分享链接失败: ' + error.message);
    }
}
function showRenameForm() {
    if (!selectedFile) return;
    modalTitle.textContent = '重命名文件';
    modalBody.innerHTML = `
        <div class="form-group">
            <label for="new-name">新文件名</label>
            <input type="text" id="new-name" class="form-control" value="${selectedFile.name}">
        </div>
        <button id="rename-submit" class="form-btn">确认</button>
    `;
    document.getElementById('rename-submit').addEventListener('click', handleRename);
    modal.style.display = 'block';
}
async function handleRename() {
    const newName = document.getElementById('new-name').value.trim();
    if (!newName) {
        showToast('请输入有效的文件名');
        return;
    }
    if (newName === selectedFile.name) {
        modal.style.display = 'none';
        return;
    }
    try {
        modalBody.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner" style="margin: 20px auto;"></div>
                <p>正在重命名文件，请稍候...</p>
            </div>
        `;
        const { data: fileData, error: downloadError } = await supabase.storage
            .from(BUCKET_NAME)
            .download(selectedFile.name);
        if (downloadError) throw downloadError;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(newName, fileData, {
                upsert: false
            });
        if (uploadError) throw uploadError;
        const { error: deleteError } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([selectedFile.name]);
        if (deleteError) throw deleteError;
        modal.style.display = 'none';
        showToast('文件重命名成功');
        await loadFiles();
    } catch (error) {
        console.error('重命名文件失败:', error);
        showToast('重命名文件失败: ' + error.message);
        modalBody.innerHTML = `
            <div style="text-align: center;" class="error-message">
                <p>重命名失败: ${error.message}</p>
                <button id="retry-rename" class="form-btn" style="margin-top: 15px;">重试</button>
            </div>
        `;
        document.getElementById('retry-rename').addEventListener('click', handleRename);
    }
}
function confirmDeleteFile() {
    if (!selectedFile) return;
    modalTitle.textContent = '删除文件';
    modalBody.innerHTML = `
        <p>确定要删除文件 "${selectedFile.name}" 吗？此操作不可撤销。</p>
        <div style="display: flex; justify-content: space-between; margin-top: 20px;">
            <button id="delete-cancel" class="btn" style="background-color: var(--text-light);">取消</button>
            <button id="delete-confirm" class="btn" style="background-color: var(--danger-color);">删除</button>
        </div>
    `;
    document.getElementById('delete-cancel').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    document.getElementById('delete-confirm').addEventListener('click', handleDelete);
    modal.style.display = 'block';
}
async function handleDelete() {
    try {
        modalBody.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner" style="margin: 20px auto;"></div>
                <p>正在删除文件，请稍候...</p>
            </div>
        `;
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([selectedFile.name]);
        if (error) throw error;
        modal.style.display = 'none';
        showToast('文件删除成功');
        currentFiles = currentFiles.filter(file => file.name !== selectedFile.name);
        filterFiles();
        await updateStorageUsage();
    } catch (error) {
        console.error('删除文件失败:', error);
        modalBody.innerHTML = `
            <div style="text-align: center;" class="error-message">
                <p>删除失败: ${error.message}</p>
                <div style="display: flex; justify-content: center; gap: 10px; margin-top: 15px;">
                    <button id="retry-delete" class="btn" style="background-color: var(--danger-color);">重试</button>
                    <button id="cancel-delete" class="btn" style="background-color: var(--text-light);">取消</button>
                </div>
            </div>
        `;
        document.getElementById('retry-delete').addEventListener('click', handleDelete);
        document.getElementById('cancel-delete').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        showToast('删除文件失败: ' + error.message);
    }
}
function getFileType(fileName) {
    if (!fileName) return '';
    const parts = fileName.split('.');
    if (parts.length <= 1) return '';
    return parts[parts.length - 1].toLowerCase();
}
function getFileTypeDisplay(fileName) {
    if (!fileName) return '';
    return fileName.split('.').pop().toUpperCase();
}
function isFileOfType(fileName, typeCategory) {
    if (!fileName || !typeCategory) return false;
    const type = getFileType(fileName);
    if (typeCategory === 'images') {
        if (fileName.toLowerCase().includes('_ios')) {
            return true;
        }
        if (fileName.includes('_')) {
            const commonImageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            return commonImageExtensions.some(ext => fileName.toLowerCase().endsWith(`.${ext}`));
        }
    }
    return ALLOWED_FILE_TYPES[typeCategory] && ALLOWED_FILE_TYPES[typeCategory].includes(type);
}
function showLoading(isLoading) {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
        loadingEl.style.display = isLoading ? 'flex' : 'none';
    }
    if (isLoading) {
        fileList.innerHTML = '<div class="loading-message">正在加载文件...</div>';
    }
}
function renderFiles(files) {
    if (files.length === 0) {
        fileList.innerHTML = '<div class="empty-message">没有找到文件</div>';
        return;
    }
    fileList.className = `file-list ${currentView}-view`;
    fileList.innerHTML = '';
    if (currentView === 'list') {
        const header = document.createElement('div');
        header.className = 'file-list-header';
        header.innerHTML = `
            <div></div>
            <div>文件名</div>
            <div>类型</div>
            <div>大小</div>
            <div>日期</div>
            <div>操作</div>
        `;
        fileList.appendChild(header);
    }
    files.forEach(file => {
        if (file.name === '.emptyFolderPlaceholder') return;
        const fileType = getFileType(file.name);
        const fileTypeDisplay = getFileTypeDisplay(file.name);
        const fileTypeClass = getFileTypeClass(fileType);
        const fileIcon = getFileIcon(fileType);
        const fileSize = formatBytes(file.metadata?.size || 0);
        const fileDate = formatDate(new Date(file.metadata?.lastModified || Date.now()));
        const isImage = isFileOfType(file.name, 'images');
        const fileEl = document.createElement('div');
        fileEl.className = 'file-item';
        fileEl.setAttribute('data-name', file.name);
        fileEl.setAttribute('data-type', fileTypeDisplay);
        if (currentView === 'grid') {
            fileEl.innerHTML = `
                <div class="file-icon ${fileTypeClass}">
                    ${isImage ? '' : fileIcon}
                    <span class="file-type-badge">${fileTypeDisplay}</span>
                </div>
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-meta">
                    <span>${fileSize}</span>
                    <span>${fileDate.split(' ')[0]}</span>
                </div>
            `;
            if (isImage) {
                generateThumbnail(file.name, fileEl);
            }
        } else {
            fileEl.innerHTML = `
                <div class="file-icon ${fileTypeClass}">${fileIcon}</div>
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-type">${fileTypeDisplay}</div>
                <div class="file-size">${fileSize}</div>
                <div class="file-date">${fileDate}</div>
                <div class="file-actions">
                    <button class="action-btn download-btn" title="下载">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-btn share-btn" title="分享">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="action-btn delete-btn" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }
        fileEl.addEventListener('click', (e) => {
            if (!e.target.closest('.action-btn')) {
                handleFileClick(file);
            }
        });
        fileEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            selectedFile = file;
            showSimpleContextMenu(e, file);
        });
        fileList.appendChild(fileEl);
        if (currentView === 'list') {
            fileEl.querySelector('.download-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                selectedFile = file;
                downloadSelectedFile();
            });
            fileEl.querySelector('.share-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                selectedFile = file;
                shareSelectedFile();
            });
            fileEl.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                selectedFile = file;
                confirmDeleteFile();
            });
        }
    });
}
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) return '未知';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}
async function generateThumbnail(fileName, fileEl) {
    try {
        const iconDiv = fileEl.querySelector('.file-icon');
        if (!iconDiv) return;
        iconDiv.innerHTML = '<div class="thumbnail-loading"><div class="spinner"></div></div>';

        // 使用 imageCache.getImageUrl 直接获取 URL
        const imageUrl = await imageCache.getImageUrl(fileName);

        if (!imageUrl) {
            // 如果 getImageUrl 返回 null，说明获取失败，直接显示默认图标
            console.error(`无法获取文件URL: ${fileName}`);
            iconDiv.style.backgroundImage = '';
            iconDiv.innerHTML = getFileIcon(getFileType(fileName));
            const typeTag = document.createElement('span');
            typeTag.className = 'file-type-badge';
            typeTag.textContent = getFileTypeDisplay(fileName);
            iconDiv.appendChild(typeTag);
            return;
        }

        const img = new Image();

        img.onload = () => {
            iconDiv.style.backgroundImage = `url('${imageUrl}')`;
            iconDiv.innerHTML = '';
            if (!isPreviewableImage(fileName)) {
                const typeTag = document.createElement('span');
                typeTag.className = 'file-type-badge';
                typeTag.textContent = getFileTypeDisplay(fileName);
                iconDiv.appendChild(typeTag);
            }
        };

        img.onerror = (errorEvent) => {
            // 增强错误日志
            console.error(`缩略图加载失败: ${fileName}`, `URL: ${imageUrl}`, errorEvent);

            // 加载失败，显示默认图标
            iconDiv.style.backgroundImage = '';
            iconDiv.innerHTML = getFileIcon(getFileType(fileName));
            const typeTag = document.createElement('span');
            typeTag.className = 'file-type-badge';
            typeTag.textContent = getFileTypeDisplay(fileName);
            iconDiv.appendChild(typeTag);
        };

        img.src = imageUrl;
    } catch (error) {
        console.error(`生成缩略图时发生异常: ${fileName}`, error);
        const iconDiv = fileEl.querySelector('.file-icon');
        if (iconDiv) {
            iconDiv.innerHTML = getFileIcon(getFileType(fileName));
            const typeTag = document.createElement('span');
            typeTag.className = 'file-type-badge';
            typeTag.textContent = getFileTypeDisplay(fileName);
            iconDiv.appendChild(typeTag);
        }
    }
}
function isPreviewableImage(fileName) {
    const type = getFileType(fileName);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type);
}
function getFileTypeClass(fileType) {
    const type = (fileType || '').toLowerCase();
    if (ALLOWED_FILE_TYPES.images.includes(type)) return 'file-image';
    if (ALLOWED_FILE_TYPES.documents.includes(type)) return 'file-document';
    if (ALLOWED_FILE_TYPES.videos.includes(type)) return 'file-video';
    if (ALLOWED_FILE_TYPES.audios.includes(type)) return 'file-audio';
    if (ALLOWED_FILE_TYPES.archives.includes(type)) return 'file-archive';
    if (ALLOWED_FILE_TYPES.code.includes(type)) return 'file-code';
    return 'file-other';
}
function getFileIcon(fileType) {
    const type = (fileType || '').toLowerCase();
    if (ALLOWED_FILE_TYPES.images.includes(type))
        return '<i class="fas fa-file-image"></i>';
    if (ALLOWED_FILE_TYPES.documents.includes(type))
        return '<i class="fas fa-file-alt"></i>';
    if (ALLOWED_FILE_TYPES.videos.includes(type))
        return '<i class="fas fa-file-video"></i>';
    if (ALLOWED_FILE_TYPES.audios.includes(type))
        return '<i class="fas fa-file-audio"></i>';
    if (ALLOWED_FILE_TYPES.archives.includes(type))
        return '<i class="fas fa-file-archive"></i>';
    if (ALLOWED_FILE_TYPES.code.includes(type))
        return '<i class="fas fa-file-code"></i>';
    return '<i class="fas fa-file"></i>';
}
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
async function updateStorageUsage() {
    try {
        const { data: files, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list('');
        if (error) throw error;
        let totalSize = 0;
        files.forEach(file => {
            totalSize += file.metadata?.size || 0;
        });
        const usedSizeFormatted = formatBytes(totalSize);
        const totalSizeFormatted = formatBytes(500 * 1024 * 1024);
        usedStorage.textContent = usedSizeFormatted;
        totalStorage.textContent = totalSizeFormatted;
        const percentUsed = Math.min(100, (totalSize / (500 * 1024 * 1024)) * 100);
        storageProgress.style.width = `${percentUsed}%`;
        if (percentUsed > 90) {
            storageProgress.className = 'progress-bar danger';
        } else if (percentUsed > 70) {
            storageProgress.className = 'progress-bar warning';
        } else {
            storageProgress.className = 'progress-bar success';
        }
    } catch (error) {
        console.error('更新存储使用情况失败:', error);
    }
}
async function previewFile(file) {
    const type = getFileType(file.name);
    // 使用 imageCache.getImageUrl 直接获取 URL
    const url = await imageCache.getImageUrl(file.name);
    if (!url) return;

    let previewContentHtml;
    const isDirectPreview = ALLOWED_FILE_TYPES.images.includes(type) || ALLOWED_FILE_TYPES.videos.includes(type) || ALLOWED_FILE_TYPES.audios.includes(type);

    if (ALLOWED_FILE_TYPES.images.includes(type)) {
        previewContentHtml = `<img id="preview-media-element" src="${url}" alt="${file.name}" class="preview-media preview-image">`;
    } else if (ALLOWED_FILE_TYPES.videos.includes(type)) {
        previewContentHtml = `<video id="preview-media-element" controls class="preview-media preview-video" src="${url}">浏览器不支持视频预览</video>`;
    } else if (ALLOWED_FILE_TYPES.audios.includes(type)) {
        // 音频预览放在容器中间
        previewContentHtml = `<div class="audio-container"><audio id="preview-media-element" controls class="preview-media preview-audio" src="${url}">浏览器不支持音频预览</audio></div>`;
    } else {
        const size = formatBytes(file.metadata?.size || 0);
        const date = file.metadata?.lastModified ? formatDate(new Date(file.metadata.lastModified)) : '未知';
        // 优化文件信息展示
        previewContentHtml = `
            <div class="preview-details-minimal">
                <div class="file-icon large ${getFileTypeClass(type)}">${getFileIcon(type)}</div>
                <div class="details-text-minimal">
                    <p><strong class="detail-label">类型:</strong> <span class="detail-value">${type || '未知'} 文件</span></p>
                    <p><strong class="detail-label">大小:</strong> <span class="detail-value">${size}</span></p>
                    <p><strong class="detail-label">修改日期:</strong> <span class="detail-value">${date}</span></p>
                </div>
            </div>`;
    }

    modalTitle.textContent = file.name;
    // 使用新的HTML结构和CSS类
    modalBody.innerHTML = `
        <div class="preview-modal-wrapper">
            <div class="preview-area ${isDirectPreview ? 'direct-preview' : 'info-preview'}" id="preview-content-container">
                ${previewContentHtml}
            </div>
            <!-- <div class="preview-actions-bar"> -->
                 <!-- <button id="modal-fullscreen" class="btn action-btn minimal-btn" title="全屏"><i class="fas fa-expand"></i> <span class="btn-text">全屏</span></button> -->
                 <!-- <button id="modal-download" class="btn action-btn minimal-btn" title="下载"><i class="fas fa-download"></i> <span class="btn-text">下载</span></button> -->
                 <!-- <button id="modal-share" class="btn action-btn minimal-btn" title="分享"><i class="fas fa-share-alt"></i> <span class="btn-text">分享</span></button> -->
                 <!-- <button id="modal-rename" class="btn action-btn minimal-btn" title="重命名"><i class="fas fa-edit"></i> <span class="btn-text">重命名</span></button> -->
                 <!-- <button id="modal-delete" class="btn action-btn minimal-btn danger-btn" title="删除"><i class="fas fa-trash"></i> <span class="btn-text">删除</span></button> -->
            <!-- </div> -->
        </div>`;

    // modal.style.display = 'block'; // 这行被移到 adjustModalSize 内部了

    // 确保所有事件监听器都正确绑定 (移除与 action bar 相关的)
    // on('#modal-download','click', downloadSelectedFile);
    // on('#modal-share','click', shareSelectedFile);
    // on('#modal-rename','click', showRenameForm);
    // on('#modal-delete','click', confirmDeleteFile);
    // on('#modal-fullscreen', 'click', handleFullscreen);

    // --- 新增：动态调整模态框尺寸 --- 
    const previewMediaElement = document.getElementById('preview-media-element');
    const adjustModalSize = (naturalWidth, naturalHeight) => {
        if (!modalContent) return;

        const maxWidth = window.innerWidth * 0.85;  // 与 CSS max-width: 85vw 对应
        const maxHeight = window.innerHeight * 0.85; // 与 CSS max-height: 85vh 对应

        const contentRatio = naturalWidth / naturalHeight;
        const containerMaxRatio = maxWidth / maxHeight;

        let targetWidth = maxWidth;
        let targetHeight = maxHeight;

        if (contentRatio > containerMaxRatio) {
            // 内容比容器更宽，以宽度为基准缩放高度
            targetWidth = maxWidth;
            targetHeight = maxWidth / contentRatio;
        } else {
            // 内容比容器更高（或比例相同），以高度为基准缩放宽度
            targetHeight = maxHeight;
            targetWidth = maxHeight * contentRatio;
        }
        
        // 确保不超过最大值（理论上前面的计算已经保证，但加一层保险）
        targetWidth = Math.min(targetWidth, maxWidth);
        targetHeight = Math.min(targetHeight, maxHeight);

        // 应用尺寸 - 直接设置 style 会覆盖 CSS，确保 CSS 中移除固定 width/height
        // 我们已经在 CSS 中使用 max-width/max-height 和 width/height: auto，
        // 这里改为设置 modal-body 或 preview-area 的尺寸可能更好，
        // 但最简单的是直接修改 modalContent 的 width/height 来强制尺寸。
        modalContent.style.width = `${targetWidth}px`;
        modalContent.style.height = `${targetHeight}px`;

        // 重新居中（因为尺寸变了）
        // transform: translate(-50%, -50%) 应该能自动处理居中
        
        // 显示模态框
        modal.style.display = 'block';

        // --- 新增：控制控件显隐的事件监听 --- 
        const modalHeader = modal.querySelector('.modal-header');
        const previewArea = modal.querySelector('.preview-area');

        const showControls = () => {
            if (modalHeader) {
                modalHeader.style.opacity = '1';
                modalHeader.style.visibility = 'visible';
            }
            /* if (previewActionsBar) {
                previewActionsBar.style.opacity = '1';
                previewActionsBar.style.visibility = 'visible';
            } */
        };

        const hideControls = () => {
             if (modalHeader) {
                modalHeader.style.opacity = '0';
                modalHeader.style.visibility = 'hidden';
            }
            /* if (previewActionsBar) {
                previewActionsBar.style.opacity = '0';
                previewActionsBar.style.visibility = 'hidden';
            } */
        };

        if (previewArea) {
            // 移除旧监听器 (如果存在)
            previewArea.removeEventListener('mouseenter', showControls);
            previewArea.removeEventListener('mouseleave', hideControls);

            // 添加新监听器
            previewArea.addEventListener('mouseenter', showControls);
            previewArea.addEventListener('mouseleave', hideControls);
        }
        // --- 结束：控制控件显隐的事件监听 --- 
    };

    if (previewMediaElement && (previewMediaElement.tagName === 'IMG' || previewMediaElement.tagName === 'VIDEO')) {
        if (previewMediaElement.tagName === 'IMG') {
            if (previewMediaElement.complete) {
                // 图片已加载完成 (可能来自缓存)
                adjustModalSize(previewMediaElement.naturalWidth, previewMediaElement.naturalHeight);
            } else {
                previewMediaElement.onload = () => {
                    adjustModalSize(previewMediaElement.naturalWidth, previewMediaElement.naturalHeight);
                };
                 previewMediaElement.onerror = () => {
                     // 加载失败，使用默认最大尺寸显示信息
                     modalContent.style.width = ''; // 清除内联样式，恢复 CSS 控制
                     modalContent.style.height = '';
                     modal.style.display = 'block'; 
                 }
            }
        } else if (previewMediaElement.tagName === 'VIDEO') {
            if (previewMediaElement.readyState >= 1) { // HAVE_METADATA
                 // 视频元数据已加载
                 adjustModalSize(previewMediaElement.videoWidth, previewMediaElement.videoHeight);
            } else {
                previewMediaElement.onloadedmetadata = () => {
                     adjustModalSize(previewMediaElement.videoWidth, previewMediaElement.videoHeight);
                };
                 previewMediaElement.onerror = () => {
                     // 加载失败，使用默认最大尺寸显示信息
                     modalContent.style.width = '';
                     modalContent.style.height = '';
                     modal.style.display = 'block'; 
                 }
            }
        }
    } else {
         // 非图片/视频，或元素未找到，使用默认最大尺寸
         modalContent.style.width = ''; // 清除内联样式，恢复 CSS 控制
         modalContent.style.height = '';
         modal.style.display = 'block';
         // 对于非媒体文件，可能需要一直显示控件，或者根据需要处理
         // 暂时保持默认隐藏，如果需要修改可以取消下面的注释
         // const modalHeader = modal.querySelector('.modal-header');
         // const previewActionsBar = modal.querySelector('.preview-actions-bar');
         // if(modalHeader) modalHeader.style.opacity = '1'; // 总是显示？
         // if(previewActionsBar) previewActionsBar.style.opacity = '1'; // 总是显示？
    }
    // --- 结束：动态调整模态框尺寸 --- 
}
function handleFileClick(file) {
    selectedFile = file;
    previewFile(file);
}
function createSimpleContextMenu() {
    if (simpleContextMenu) {
        document.body.removeChild(simpleContextMenu);
        simpleContextMenu = null;
    }
}
function showSimpleContextMenu(e, file) {
    e.preventDefault();
    if (simpleContextMenu) {
        document.body.removeChild(simpleContextMenu);
        simpleContextMenu = null;
    }
    simpleContextMenu = document.createElement('div');
    simpleContextMenu.className = 'simple-context-menu';
    simpleContextMenu.innerHTML = `
        <div class="menu-item download-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            下载
        </div>
        <div class="menu-item share-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            分享链接
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item rename-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            重命名
        </div>
        <div class="menu-item delete-item delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            删除
        </div>
    `;
    document.body.appendChild(simpleContextMenu);
    simpleContextMenu.style.left = `${e.pageX}px`;
    simpleContextMenu.style.top = `${e.pageY}px`;
    const menuRect = simpleContextMenu.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    if (menuRect.right > windowWidth) {
        simpleContextMenu.style.left = `${windowWidth - menuRect.width}px`;
    }
    if (menuRect.bottom > windowHeight) {
        simpleContextMenu.style.top = `${windowHeight - menuRect.height}px`;
    }
    simpleContextMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    const downloadItem = simpleContextMenu.querySelector('.download-item');
    const shareItem = simpleContextMenu.querySelector('.share-item');
    const renameItem = simpleContextMenu.querySelector('.rename-item');
    const deleteItem = simpleContextMenu.querySelector('.delete-item');
    downloadItem.addEventListener('click', () => {
        selectedFile = file;
        downloadSelectedFile();
        hideContextMenu();
    });
    shareItem.addEventListener('click', () => {
        selectedFile = file;
        shareSelectedFile();
        hideContextMenu();
    });
    renameItem.addEventListener('click', () => {
        selectedFile = file;
        showRenameForm();
        hideContextMenu();
    });
    deleteItem.addEventListener('click', () => {
        selectedFile = file;
        confirmDeleteFile();
        hideContextMenu();
    });
}
function hideContextMenu() {
    if (simpleContextMenu) {
        document.body.removeChild(simpleContextMenu);
        simpleContextMenu = null;
    }
}
function handleFullscreen() {
    const mediaElement = document.getElementById('preview-media-element');
    const containerElement = document.getElementById('preview-content-container');
    const elementToFullscreen = mediaElement || containerElement; // 优先全屏媒体，否则全屏容器

    if (!elementToFullscreen) return;

    if (document.fullscreenElement) {
        // 如果已是全屏，则退出全屏
        document.exitFullscreen().catch(err => console.error("退出全屏失败:", err));
    } else {
        // 请求全屏
        if (elementToFullscreen.requestFullscreen) {
            elementToFullscreen.requestFullscreen().catch(err => console.error("请求全屏失败:", err));
        } else if (elementToFullscreen.webkitRequestFullscreen) { /* Safari */
            elementToFullscreen.webkitRequestFullscreen().catch(err => console.error("请求全屏失败 (webkit):", err));
        } else if (elementToFullscreen.msRequestFullscreen) { /* IE11 */
            elementToFullscreen.msRequestFullscreen().catch(err => console.error("请求全屏失败 (ms):", err));
        }
    }
}