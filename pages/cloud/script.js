// Supabase 配置
const SUPABASE_URL = 'https://fmxddvjgkykuqwmasigo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteGRkdmpna3lrdXF3bWFzaWdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDA0MzMyNywiZXhwIjoyMDU5NjE5MzI3fQ.03Je2x-ixNl0SUzjSHmGy_fmybYbkxyg6prdv7TumI8';
const BUCKET_NAME = 'cloud-storage';

// 初始化 Supabase 客户端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 全局变量
let currentCategory = 'all';
let currentView = 'grid';
let currentFiles = [];
let selectedFile = null;
let searchQuery = '';

// 文件上传配置
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_FILE_TYPES = {
    // 图片
    images: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico'],
    // 文档
    documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf'],
    // 视频
    videos: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'],
    // 音频
    audios: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'],
    // 压缩文件
    archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
    // 代码文件
    code: ['html', 'css', 'js', 'json', 'xml', 'php', 'py', 'java', 'cpp', 'c', 'cs', 'rb', 'pl', 'sh', 'ts', 'jsx', 'tsx']
};

// DOM 元素
const uploadInput = document.getElementById('file-upload');
const fileList = document.getElementById('file-list');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const viewButtons = document.querySelectorAll('.view-btn');
const categoryButtons = document.querySelectorAll('.category');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close-modal');
const contextMenu = document.getElementById('file-context-menu');
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

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
    // 创建存储桶（如果不存在）
    await createBucketIfNotExists();

    // 加载文件列表
    await loadFiles();

    // 更新存储使用情况
    await updateStorageUsage();

    // 添加事件监听器
    addEventListeners();
}

// Supabase 存储桶创建
async function createBucketIfNotExists() {
    try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);
        
        if (!bucketExists) {
            await supabase.storage.createBucket(BUCKET_NAME, {
                public: true // 设置为公共访问
            });
            console.log(`创建存储桶 ${BUCKET_NAME} 成功`);
        }
    } catch (error) {
        console.error('创建存储桶失败:', error);
        showToast('创建存储桶失败，请检查网络连接');
    }
}

// 事件监听器设置
function addEventListeners() {
    // 文件上传相关
    uploadInput.addEventListener('change', (e) => handleFiles(e.target.files));
    closeProgressBtn.addEventListener('click', () => {
        uploadProgressContainer.classList.add('hidden');
    });

    // 拖放文件上传
    initDragAndDrop();

    // 文件查看和搜索相关
    searchBtn.addEventListener('click', () => {
        searchQuery = searchInput.value.trim().toLowerCase();
        filterFiles();
    });
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            searchQuery = searchInput.value.trim().toLowerCase();
            filterFiles();
        }
    });

    // 视图切换
    viewButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            changeView(view);
        });
    });

    // 分类过滤
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-category');
            changeCategory(category);
        });
    });

    // 模态框关闭
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // 右键菜单相关
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    // 右键菜单项
    document.getElementById('context-download').addEventListener('click', downloadSelectedFile);
    document.getElementById('context-share').addEventListener('click', shareSelectedFile);
    document.getElementById('context-rename').addEventListener('click', showRenameForm);
    document.getElementById('context-delete').addEventListener('click', confirmDeleteFile);
}

// 拖放上传功能初始化
function initDragAndDrop() {
    // 阻止浏览器默认行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 高亮显示拖放区域
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

    // 处理拖放的文件
    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    // 添加点击上传功能
    dropOverlay.querySelector('.drop-message').addEventListener('click', () => {
        uploadInput.click();
    });

    // 显示拖放指引动画
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

// 文件加载和过滤
async function loadFiles() {
    showLoading(true);

    try {
        // 直接从根目录加载文件
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
    // 应用分类过滤
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

    // 应用搜索过滤
    if (searchQuery) {
        filteredFiles = filteredFiles.filter(file => 
            file.name.toLowerCase().includes(searchQuery)
        );
    }

    // 渲染文件列表
    renderFiles(filteredFiles);
}

// 文件处理
function handleFiles(files) {
    if (!files || files.length === 0) return;

    // 显示上传进度容器
    uploadProgressContainer.classList.remove('hidden');
    uploadProgressItems.innerHTML = '';
    
    // 处理每个文件
    Array.from(files).forEach((file, index) => {
        // 生成唯一文件ID
        const fileId = `file-${Date.now()}-${index}`;
        
        // 添加文件到上传队列
        addFileToUploadQueue(file, fileId);
        
        // 开始上传处理
        processFileUpload(file, fileId);
    });
}

// 添加文件到上传队列UI
function addFileToUploadQueue(file, fileId) {
    // 创建上传进度条UI
    const progressItem = document.createElement('div');
    progressItem.className = 'upload-progress-item';
    progressItem.innerHTML = `
        <span class="upload-file-name">${file.name}</span>
        <div class="upload-progress-bar">
            <div id="${fileId}" class="upload-progress"></div>
        </div>
        <div class="upload-status">
            <span id="${fileId}-status">准备上传...</span>
            <span id="${fileId}-percent">0%</span>
        </div>
    `;
    uploadProgressItems.appendChild(progressItem);
}

// 处理文件上传
async function processFileUpload(file, fileId) {
    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
        document.getElementById(fileId).classList.add('error');
        document.getElementById(`${fileId}-status`).textContent = '文件过大';
        document.getElementById(`${fileId}-percent`).textContent = '错误';
        showToast(`文件 ${file.name} 超过最大上传限制（100MB）`);
        return;
    }
    
    // 获取文件类型
    const fileType = getFileType(file.name).toLowerCase();
    
    // 检查文件类型是否在允许列表中
    const isAllowedType = Object.values(ALLOWED_FILE_TYPES).some(types => types.includes(fileType));
    
    // 如果是不支持的文件类型，添加警告
    if (!isAllowedType) {
        showToast(`警告：文件类型 ${fileType} 可能不受支持`);
    }
    
    // 检查文件名是否已存在
    const fileExists = currentFiles.some(existingFile => 
        existingFile.name.toLowerCase() === file.name.toLowerCase());
    
    // 如果文件已存在，询问是否覆盖
    if (fileExists) {
        document.getElementById(`${fileId}-status`).textContent = '文件已存在';
        document.getElementById(`${fileId}-percent`).textContent = '等待确认';
        
        // 显示确认对话框
        if (!confirm(`文件 "${file.name}" 已存在，是否覆盖？`)) {
            document.getElementById(fileId).classList.add('error');
            document.getElementById(`${fileId}-status`).textContent = '已取消';
            return;
        }
    }
    
    try {
        // 更新状态为上传中
        document.getElementById(`${fileId}-status`).textContent = '上传中...';
        
        // 上传文件到Supabase
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(file.name, file, {
                cacheControl: '3600',
                upsert: true, // 允许覆盖已有文件
                onUploadProgress: (progress) => {
                    const percent = Math.round((progress.loaded / progress.total) * 100);
                    document.getElementById(fileId).style.width = `${percent}%`;
                    document.getElementById(`${fileId}-percent`).textContent = `${percent}%`;
                }
            });

        if (error) throw error;
        
        // 更新状态为完成
        document.getElementById(fileId).classList.add('complete');
        document.getElementById(`${fileId}-status`).textContent = '上传完成';
        document.getElementById(`${fileId}-percent`).textContent = '100%';
        
        // 更新文件列表
        await loadFiles();
        
        // 更新存储使用情况
        await updateStorageUsage();
        
    } catch (error) {
        console.error(`上传文件 ${file.name} 失败:`, error);
        document.getElementById(fileId).classList.add('error');
        document.getElementById(`${fileId}-status`).textContent = '上传失败';
        document.getElementById(`${fileId}-percent`).textContent = '错误';
        showToast(`上传文件 ${file.name} 失败: ${error.message}`);
    }
}

// 文件查看和搜索相关函数
function changeView(view) {
    // 移除所有视图按钮的active类
    viewButtons.forEach(btn => btn.classList.remove('active'));
    
    // 给当前选中的视图按钮添加active类
    document.querySelector(`.view-btn[data-view="${view}"]`).classList.add('active');
    
    currentView = view;
    filterFiles();
}

function changeCategory(category) {
    // 移除所有分类按钮的active类
    categoryButtons.forEach(btn => btn.classList.remove('active'));
    
    // 给当前选中的分类按钮添加active类
    document.querySelector(`.category[data-category="${category}"]`).classList.add('active');
    
    currentCategory = category;
    filterFiles();
}

// 文件操作相关函数
async function downloadSelectedFile() {
    if (!selectedFile) return;

    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .download(selectedFile.name);

        if (error) throw error;

        // 创建下载链接
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
        // 创建公共URL而不是签名URL，这样就不需要登录
        const { data } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(selectedFile.name);

        // 显示分享链接
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
        // 显示进度提示
        modalBody.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner" style="margin: 20px auto;"></div>
                <p>正在重命名文件，请稍候...</p>
            </div>
        `;
        
        // 先下载原文件
        const { data: fileData, error: downloadError } = await supabase.storage
            .from(BUCKET_NAME)
            .download(selectedFile.name);

        if (downloadError) throw downloadError;

        // 上传到新的路径
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(newName, fileData, {
                upsert: false
            });

        if (uploadError) throw uploadError;

        // 删除原文件
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
        // 显示进度提示
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
        
        // 从当前文件列表中移除该文件
        currentFiles = currentFiles.filter(file => file.name !== selectedFile.name);
        filterFiles();
        
        // 更新存储使用情况
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

// 辅助函数
function getFileType(fileName) {
    return fileName.split('.').pop().toUpperCase();
}

// 显示加载状态
function showLoading(isLoading) {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
        loadingEl.style.display = isLoading ? 'flex' : 'none';
    }
    
    // 当正在加载时，显示加载中文本
    if (isLoading) {
        fileList.innerHTML = '<div class="loading-message">正在加载文件...</div>';
    }
}

// 文件渲染
function renderFiles(files) {
    if (files.length === 0) {
        fileList.innerHTML = '<div class="empty-message">没有找到文件</div>';
        return;
    }

    fileList.innerHTML = '';

    files.forEach(file => {
        if (file.name === '.emptyFolderPlaceholder') return; // 忽略占位文件
        
        // 获取文件扩展名和类型
        const fileType = getFileType(file.name);
        const fileTypeClass = getFileTypeClass(fileType);
        const fileIcon = getFileIcon(fileType);
        const fileSize = formatBytes(file.metadata?.size || 0);
        const fileUrl = getFileUrl(file.name);
        const fileDate = file.metadata?.lastModified ? new Date(file.metadata.lastModified).toLocaleString() : '未知';

        // 创建文件元素
        const fileEl = document.createElement('div');
        fileEl.className = `file-item ${currentView === 'list' ? 'list-view' : ''}`;
        fileEl.setAttribute('data-name', file.name);
        fileEl.setAttribute('data-type', fileType);
        fileEl.setAttribute('data-size', file.metadata?.size || 0);
        fileEl.setAttribute('data-url', fileUrl);
        
        if (currentView === 'grid') {
            fileEl.innerHTML = `
                <div class="file-icon ${fileTypeClass}">
                    ${fileIcon}
                    <span class="file-type-tag">${fileType}</span>
                </div>
                <div class="file-info">
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-meta">${fileSize}</div>
                </div>
            `;
        } else {
            fileEl.innerHTML = `
                <div class="file-icon ${fileTypeClass}">${fileIcon}</div>
                <div class="file-name" title="${file.name}">${file.name}</div>
                <div class="file-type">${fileType}</div>
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

        // 图片文件显示缩略图
        if (ALLOWED_FILE_TYPES.images.includes(fileType.toLowerCase())) {
            generateThumbnail(file.name, fileEl);
        }

        // 添加事件监听器
        fileEl.addEventListener('click', () => handleFileClick(file));
        
        // 右键菜单
        fileEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, file);
        });

        // 添加到页面
        fileList.appendChild(fileEl);
        
        // 为列表视图添加动作按钮事件
        if (currentView === 'list') {
            const downloadBtn = fileEl.querySelector('.download-btn');
            const shareBtn = fileEl.querySelector('.share-btn');
            const deleteBtn = fileEl.querySelector('.delete-btn');
            
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedFile = file;
                downloadSelectedFile();
            });
            
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedFile = file;
                shareSelectedFile();
            });
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedFile = file;
                confirmDeleteFile();
            });
        }
    });
}

// 生成图片缩略图
async function generateThumbnail(fileName, fileEl) {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fileName, 60);
        
        if (error) throw error;
        
        const iconDiv = fileEl.querySelector('.file-icon');
        if (iconDiv) {
            iconDiv.style.backgroundImage = `url('${data.signedUrl}')`;
            iconDiv.style.backgroundSize = 'cover';
            iconDiv.style.backgroundPosition = 'center';
            iconDiv.innerHTML = ''; // 清除图标
            
            // 保留文件类型标签
            const fileType = getFileType(fileName);
            const typeTag = document.createElement('span');
            typeTag.className = 'file-type-tag';
            typeTag.textContent = fileType;
            iconDiv.appendChild(typeTag);
        }
    } catch (error) {
        console.log(`无法为 ${fileName} 生成缩略图`, error);
    }
}

// 根据文件类型获取CSS类
function getFileTypeClass(fileType) {
    const type = fileType.toLowerCase();
    
    if (ALLOWED_FILE_TYPES.images.includes(type)) return 'file-image';
    if (ALLOWED_FILE_TYPES.documents.includes(type)) return 'file-document';
    if (ALLOWED_FILE_TYPES.videos.includes(type)) return 'file-video';
    if (ALLOWED_FILE_TYPES.audios.includes(type)) return 'file-audio';
    if (ALLOWED_FILE_TYPES.archives.includes(type)) return 'file-archive';
    if (ALLOWED_FILE_TYPES.code.includes(type)) return 'file-code';
    
    return 'file-other';
}

// 根据文件类型获取图标
function getFileIcon(fileType) {
    const type = fileType.toLowerCase();
    
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

// 文件大小格式化
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 更新存储使用情况
async function updateStorageUsage() {
    try {
        // 获取所有文件
        const { data: files, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list('');
        
        if (error) throw error;
        
        // 计算总使用量
        let totalSize = 0;
        files.forEach(file => {
            totalSize += file.metadata?.size || 0;
        });
        
        // 显示在UI上
        const usedSizeFormatted = formatBytes(totalSize);
        const totalSizeFormatted = formatBytes(500 * 1024 * 1024); // 假设有500MB限制
        
        usedStorage.textContent = usedSizeFormatted;
        totalStorage.textContent = totalSizeFormatted;
        
        // 更新进度条
        const percentUsed = Math.min(100, (totalSize / (500 * 1024 * 1024)) * 100);
        storageProgress.style.width = `${percentUsed}%`;
        
        // 根据使用量设置颜色
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

// 文件交互
function handleFileClick(file) {
    selectedFile = file;
    
    const fileType = getFileType(file.name).toLowerCase();
    
    // 处理不同类型的文件
    if (ALLOWED_FILE_TYPES.images.includes(fileType)) {
        previewImage(file);
    } else if (ALLOWED_FILE_TYPES.videos.includes(fileType)) {
        previewVideo(file);
    } else if (ALLOWED_FILE_TYPES.audios.includes(fileType)) {
        previewAudio(file);
    } else {
        // 对于其他文件，显示文件信息
        showFileInfo(file);
    }
}

// 预览图片
async function previewImage(file) {
    modalTitle.textContent = file.name;
    modalBody.innerHTML = '<div class="loading-spinner"></div>';
    modal.style.display = 'block';
    
    try {
        const fileUrl = await getFileUrl(file.name);
        
        modalBody.innerHTML = `
            <div class="image-preview">
                <img src="${fileUrl}" alt="${file.name}">
            </div>
            <div class="file-actions mt-3">
                <button id="modal-download" class="btn btn-primary">
                    <i class="fas fa-download"></i> 下载
                </button>
                <button id="modal-share" class="btn btn-success">
                    <i class="fas fa-share-alt"></i> 分享
                </button>
                <button id="modal-rename" class="btn btn-info">
                    <i class="fas fa-edit"></i> 重命名
                </button>
                <button id="modal-delete" class="btn btn-danger">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        `;
        
        // 添加事件监听
        document.getElementById('modal-download').addEventListener('click', downloadSelectedFile);
        document.getElementById('modal-share').addEventListener('click', shareSelectedFile);
        document.getElementById('modal-rename').addEventListener('click', showRenameForm);
        document.getElementById('modal-delete').addEventListener('click', confirmDeleteFile);
    } catch (error) {
        modalBody.innerHTML = '<div class="error-message">无法预览图片</div>';
        console.error('预览图片失败:', error);
    }
}

// 预览视频
async function previewVideo(file) {
    modalTitle.textContent = file.name;
    modalBody.innerHTML = '<div class="loading-spinner"></div>';
    modal.style.display = 'block';
    
    try {
        const fileUrl = await getFileUrl(file.name);
        
        modalBody.innerHTML = `
            <div class="video-preview">
                <video controls>
                    <source src="${fileUrl}" type="video/${getFileType(file.name).toLowerCase()}">
                    您的浏览器不支持视频预览
                </video>
            </div>
            <div class="file-actions mt-3">
                <button id="modal-download" class="btn btn-primary">
                    <i class="fas fa-download"></i> 下载
                </button>
                <button id="modal-share" class="btn btn-success">
                    <i class="fas fa-share-alt"></i> 分享
                </button>
                <button id="modal-rename" class="btn btn-info">
                    <i class="fas fa-edit"></i> 重命名
                </button>
                <button id="modal-delete" class="btn btn-danger">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        `;
        
        // 添加事件监听
        document.getElementById('modal-download').addEventListener('click', downloadSelectedFile);
        document.getElementById('modal-share').addEventListener('click', shareSelectedFile);
        document.getElementById('modal-rename').addEventListener('click', showRenameForm);
        document.getElementById('modal-delete').addEventListener('click', confirmDeleteFile);
    } catch (error) {
        modalBody.innerHTML = '<div class="error-message">无法预览视频</div>';
        console.error('预览视频失败:', error);
    }
}

// 预览音频
async function previewAudio(file) {
    modalTitle.textContent = file.name;
    modalBody.innerHTML = '<div class="loading-spinner"></div>';
    modal.style.display = 'block';
    
    try {
        const fileUrl = await getFileUrl(file.name);
        
        modalBody.innerHTML = `
            <div class="audio-preview">
                <audio controls>
                    <source src="${fileUrl}" type="audio/${getFileType(file.name).toLowerCase()}">
                    您的浏览器不支持音频预览
                </audio>
            </div>
            <div class="file-actions mt-3">
                <button id="modal-download" class="btn btn-primary">
                    <i class="fas fa-download"></i> 下载
                </button>
                <button id="modal-share" class="btn btn-success">
                    <i class="fas fa-share-alt"></i> 分享
                </button>
                <button id="modal-rename" class="btn btn-info">
                    <i class="fas fa-edit"></i> 重命名
                </button>
                <button id="modal-delete" class="btn btn-danger">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        `;
        
        // 添加事件监听
        document.getElementById('modal-download').addEventListener('click', downloadSelectedFile);
        document.getElementById('modal-share').addEventListener('click', shareSelectedFile);
        document.getElementById('modal-rename').addEventListener('click', showRenameForm);
        document.getElementById('modal-delete').addEventListener('click', confirmDeleteFile);
    } catch (error) {
        modalBody.innerHTML = '<div class="error-message">无法预览音频</div>';
        console.error('预览音频失败:', error);
    }
}

// 显示文件信息
function showFileInfo(file) {
    modalTitle.textContent = file.name;
    const fileSize = formatBytes(file.metadata?.size || 0);
    const fileDate = file.metadata?.lastModified ? new Date(file.metadata.lastModified).toLocaleString() : '未知';
    const fileType = getFileType(file.name);
    
    modalBody.innerHTML = `
        <div class="file-details">
            <div class="file-icon large ${getFileTypeClass(fileType)}">
                ${getFileIcon(fileType)}
            </div>
            <table class="file-info-table">
                <tr>
                    <td>名称:</td>
                    <td>${file.name}</td>
                </tr>
                <tr>
                    <td>类型:</td>
                    <td>${fileType} 文件</td>
                </tr>
                <tr>
                    <td>大小:</td>
                    <td>${fileSize}</td>
                </tr>
                <tr>
                    <td>修改日期:</td>
                    <td>${fileDate}</td>
                </tr>
            </table>
        </div>
        <div class="file-actions mt-3">
            <button id="modal-download" class="btn btn-primary">
                <i class="fas fa-download"></i> 下载
            </button>
            <button id="modal-share" class="btn btn-success">
                <i class="fas fa-share-alt"></i> 分享
            </button>
            <button id="modal-rename" class="btn btn-info">
                <i class="fas fa-edit"></i> 重命名
            </button>
            <button id="modal-delete" class="btn btn-danger">
                <i class="fas fa-trash"></i> 删除
            </button>
        </div>
    `;
    
    // 添加事件监听
    document.getElementById('modal-download').addEventListener('click', downloadSelectedFile);
    document.getElementById('modal-share').addEventListener('click', shareSelectedFile);
    document.getElementById('modal-rename').addEventListener('click', showRenameForm);
    document.getElementById('modal-delete').addEventListener('click', confirmDeleteFile);
    
    modal.style.display = 'block';
}

function getFileUrl(filename) {
    return supabase.storage.from(BUCKET_NAME).getPublicUrl(filename).data.publicUrl;
}

function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// 显示右键菜单
function showContextMenu(e, file) {
    e.preventDefault();
    selectedFile = file;
    
    // 设置菜单位置
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    
    // 调整菜单位置，确保在视口内
    const rightEdge = window.innerWidth - contextMenu.clientWidth - 10;
    const bottomEdge = window.innerHeight - contextMenu.clientHeight - 10;
    
    if (parseInt(contextMenu.style.left) > rightEdge) {
        contextMenu.style.left = `${rightEdge}px`;
    }
    
    if (parseInt(contextMenu.style.top) > bottomEdge) {
        contextMenu.style.top = `${bottomEdge}px`;
    }

    // 更新菜单选项文本
    const fileType = getFileType(file.name).toLowerCase();
    const previewItem = document.getElementById('context-preview');
    
    // 根据文件类型调整"预览"选项文本
    if (ALLOWED_FILE_TYPES.images.includes(fileType)) {
        previewItem.textContent = '预览图片';
        previewItem.style.display = 'block';
    } else if (ALLOWED_FILE_TYPES.videos.includes(fileType)) {
        previewItem.textContent = '播放视频';
        previewItem.style.display = 'block';
    } else if (ALLOWED_FILE_TYPES.audios.includes(fileType)) {
        previewItem.textContent = '播放音频';
        previewItem.style.display = 'block';
    } else {
        previewItem.style.display = 'none';
    }
    
    // 添加预览事件
    previewItem.onclick = () => handleFileClick(file);
} 