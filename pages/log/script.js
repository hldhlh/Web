// Supabase配置
const SUPABASE_URL = 'https://fmxddvjgkykuqwmasigo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteGRkdmpna3lrdXF3bWFzaWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNDMzMjcsImV4cCI6MjA1OTYxOTMyN30.XCU4-03oajGh6M2-PNiBotCZSIDn_nJXkIC0Thjjfqo';

// 简化的连接检测和重试机制
class ConnectionManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.setupNetworkListeners();
    }

    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('网络连接已恢复');
            this.showToast('网络连接已恢复，正在重连实时同步...', 'success');
            
            // 网络恢复时重新建立实时连接
            setTimeout(() => {
                if (window.logManager && window.logManager.setupRealtime) {
                    console.log('网络恢复，重新建立实时连接');
                    window.logManager.setupRealtime();
                }
            }, 1000); // 延迟1秒确保网络稳定
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('网络连接已断开');
            this.showToast('网络连接已断开，实时同步暂停', 'error');
        });
    }

    // 智能重试机制
    async executeWithRetry(operation, context = '操作') {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                if (!this.isOnline) {
                    throw new Error('网络连接不可用');
                }

                const result = await operation();
                this.retryCount = 0; // 重置重试计数
                return result;
            } catch (error) {
                console.warn(`${context}失败 (尝试 ${attempt}/${this.maxRetries}):`, error);
                
                if (attempt === this.maxRetries) {
                    this.showToast(`${context}失败，请检查网络连接`, 'error');
                    throw error;
                }

                // 移动端使用更长的重试间隔
                const delay = this.isMobile ? 
                    2000 * Math.pow(1.5, attempt - 1) : 
                    1000 * Math.pow(2, attempt - 1);
                
                this.showToast(`连接失败，${Math.ceil(delay/1000)}秒后重试... (${attempt}/${this.maxRetries})`, 'warning');
                await this.sleep(delay);
            }
        }
    }

    // 显示提示信息
    showToast(message, type = 'info') {
        const existingToast = document.querySelector('.connection-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `connection-toast fixed top-4 right-4 px-3 py-2 rounded text-xs font-medium z-50 max-w-xs`;
        
        switch (type) {
            case 'success':
                toast.classList.add('bg-green-100', 'text-green-800', 'border', 'border-green-200');
                break;
            case 'error':
                toast.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-200');
                break;
            case 'warning':
                toast.classList.add('bg-yellow-100', 'text-yellow-800', 'border', 'border-yellow-200');
                break;
            default:
                toast.classList.add('bg-blue-100', 'text-blue-800', 'border', 'border-blue-200');
        }

        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast && toast.parentNode) {
                toast.remove();
            }
        }, type === 'error' ? 5000 : 3000);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 初始化连接管理器
const connectionManager = new ConnectionManager();

// 初始化Supabase客户端，添加超时和错误处理
function initializeSupabase() {
    try {
        if (!window.supabase) {
            throw new Error('Supabase CDN未能加载');
        }

        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            realtime: connectionManager.isMobile ? {
                // 移动端优化：增加心跳间隔，减少连接频率
                params: {
                    heartbeat_interval_ms: 30000,
                    timeout_ms: 10000
                }
            } : undefined
        });

        return supabase;
    } catch (error) {
        console.error('Supabase初始化失败:', error);
        connectionManager.showToast('数据库连接失败', 'error');
        return null;
    }
}

const supabase = initializeSupabase();

// 日志管理类
class LogManager {
    constructor() {
        this.logs = [];
        this.editingId = null;
        this.realtimeChannel = null;
        this.isInitialized = false;
        this.init();
    }

    // 初始化
    async init() {
        this.bindEvents();
        await this.loadLogs();
        this.renderTimeline();
        
        // 只有在supabase可用时才设置实时监听
        if (supabase) {
            console.log('🚀 正在启动实时同步...');
            this.setupRealtime();
        } else {
            console.error('❌ Supabase不可用，实时同步无法启动');
            connectionManager.showToast('实时同步不可用，请刷新页面重试', 'warning');
            this.showRealtimeStatus(false);
        }
        
        this.isInitialized = true;
        console.log('📝 日志应用初始化完成');
    }

    // 绑定事件
    bindEvents() {
        const form = document.getElementById('logForm');
        const cancelBtn = document.getElementById('cancelBtn');
        const deleteModal = document.getElementById('deleteModal');
        const cancelDelete = document.getElementById('cancelDelete');
        const confirmDelete = document.getElementById('confirmDelete');

        form.addEventListener('submit', (e) => this.handleSubmit(e));
        cancelBtn.addEventListener('click', () => this.cancelEdit());
        cancelDelete.addEventListener('click', () => this.hideDeleteModal());
        confirmDelete.addEventListener('click', () => this.confirmDelete());
        
        deleteModal.addEventListener('click', (e) => {
            if (e.target === deleteModal) this.hideDeleteModal();
        });
    }

    // 处理表单提交
    async handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const content = formData.get('content').trim();

        if (!content) return;

        if (!supabase) {
            connectionManager.showToast('数据库连接不可用，请刷新页面', 'error');
            return;
        }

        try {
            if (this.editingId) {
                await connectionManager.executeWithRetry(
                    () => this.updateLog(this.editingId, content),
                    '更新日志'
                );
            } else {
                await connectionManager.executeWithRetry(
                    () => this.addLog(content),
                    '添加日志'
                );
            }

            this.resetForm();
        } catch (error) {
            console.error('操作失败:', error);
        }
    }

    // 添加日志
    async addLog(content) {
        const { data, error } = await supabase
            .from('logs')
            .insert([{ content }])
            .select();

        if (error) {
            throw error;
        }
        return data;
    }

    // 更新日志
    async updateLog(id, content) {
        const { data, error } = await supabase
            .from('logs')
            .update({ content })
            .eq('id', id)
            .select();

        if (error) {
            throw error;
        }
        return data;
    }

    // 删除日志
    async deleteLog(id) {
        const { error } = await supabase
            .from('logs')
            .delete()
            .eq('id', id);

        if (error) {
            throw error;
        }
    }

    // 加载日志
    async loadLogs() {
        if (!supabase) {
            console.warn('数据库连接不可用');
            return;
        }

        try {
            const { data, error } = await connectionManager.executeWithRetry(
                () => supabase
                    .from('logs')
                    .select('*')
                    .order('created_at', { ascending: false }),
                '加载日志'
            );

            if (error) {
                throw error;
            }

            this.logs = data || [];
        } catch (error) {
            console.error('加载日志失败:', error);
            // 保留当前日志数据，避免清空
        }
    }

    // 设置实时监听
    setupRealtime() {
        if (!supabase) {
            console.error('Supabase客户端不可用，无法设置实时监听');
            return;
        }

        // 如果已有频道，先取消订阅
        if (this.realtimeChannel) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }

        console.log('开始设置实时监听...');

        // 创建新的实时频道，使用更具体的频道名
        const channelName = `logs_realtime_${Date.now()}`;
        this.realtimeChannel = supabase
            .channel(channelName, {
                config: {
                    broadcast: { self: true }
                }
            })
            .on('postgres_changes',
                {
                    event: '*', // 监听所有事件 (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'logs'
                },
                (payload) => {
                    console.log('收到实时数据变化:', payload);
                    this.handleRealtimeChange(payload);
                }
            )
            .subscribe((status, err) => {
                console.log('实时监听状态变化:', { status, error: err });
                
                switch (status) {
                    case 'SUBSCRIBED':
                        console.log('✅ 实时监听已成功启用');
                        connectionManager.showToast('实时同步已启用', 'success');
                        this.realtimeRetryCount = 0; // 重置重试计数
                        this.showRealtimeStatus(true);
                        break;
                        
                    case 'CHANNEL_ERROR':
                        console.error('❌ 实时监听连接失败:', err);
                        connectionManager.showToast('实时同步连接失败', 'error');
                        this.showRealtimeStatus(false);
                        this.retryRealtimeConnection();
                        break;
                        
                    case 'TIMED_OUT':
                        console.warn('⏰ 实时监听连接超时');
                        connectionManager.showToast('实时同步连接超时，正在重试...', 'warning');
                        this.showRealtimeStatus(false);
                        this.retryRealtimeConnection();
                        break;
                        
                    case 'CLOSED':
                        console.log('🔒 实时监听连接已关闭');
                        this.showRealtimeStatus(false);
                        if (connectionManager.isOnline) {
                            connectionManager.showToast('实时同步连接已断开，正在重连...', 'warning');
                            this.retryRealtimeConnection();
                        }
                        break;
                        
                    default:
                        console.log('实时监听状态:', status);
                }
            });

        // 设置连接超时保护
        this.realtimeTimeout = setTimeout(() => {
            if (this.realtimeChannel && this.realtimeChannel.state !== 'joined') {
                console.warn('实时监听连接超时，强制重试');
                this.retryRealtimeConnection();
            }
        }, 15000); // 15秒超时
    }

    // 重试实时连接
    retryRealtimeConnection() {
        if (!this.realtimeRetryCount) {
            this.realtimeRetryCount = 0;
        }
        
        this.realtimeRetryCount++;
        const maxRetries = 5;
        
        if (this.realtimeRetryCount > maxRetries) {
            console.error('实时监听重试次数已达上限，停止重试');
            connectionManager.showToast('实时同步暂时不可用，数据可能需要手动刷新', 'error');
            return;
        }
        
        // 指数退避策略
        const delay = Math.min(1000 * Math.pow(2, this.realtimeRetryCount - 1), 30000);
        console.log(`将在 ${delay/1000} 秒后重试实时连接 (第${this.realtimeRetryCount}次)`);
        
        clearTimeout(this.realtimeTimeout);
        
        setTimeout(() => {
            if (connectionManager.isOnline && supabase) {
                console.log('重试建立实时连接...');
                this.setupRealtime();
            }
        }, delay);
    }

    // 检查实时连接状态
    checkRealtimeStatus() {
        if (!this.realtimeChannel) {
            console.log('实时监听未启用');
            return 'not_started';
        }
        
        const state = this.realtimeChannel.state;
        console.log('实时监听当前状态:', state);
        return state;
    }

    // 显示实时状态指示器
    showRealtimeStatus(isConnected) {
        // 移除旧的状态指示器
        const existingIndicator = document.querySelector('.realtime-status');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        // 创建状态指示器
        const indicator = document.createElement('div');
        indicator.className = 'realtime-status fixed top-20 right-4 px-2 py-1 rounded text-xs font-medium z-40 flex items-center';
        
        if (isConnected) {
            indicator.classList.add('bg-green-50', 'text-green-700', 'border', 'border-green-200');
            indicator.innerHTML = `
                <div class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                实时同步
            `;
        } else {
            indicator.classList.add('bg-gray-50', 'text-gray-500', 'border', 'border-gray-200');
            indicator.innerHTML = `
                <div class="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                同步断开
            `;
        }

        document.body.appendChild(indicator);

        // 10秒后自动隐藏（除非是断开状态）
        if (isConnected) {
            setTimeout(() => {
                if (indicator && indicator.parentNode) {
                    indicator.remove();
                }
            }, 10000);
        }
    }

    // 处理实时数据变化
    async handleRealtimeChange(payload) {
        console.log('📡 收到实时更新:', payload);

        try {
            switch (payload.eventType) {
                case 'INSERT':
                    console.log('➕ 新增日志记录');
                    // 直接将新记录添加到列表开头，避免重新加载全部数据
                    if (payload.new) {
                        const existingIndex = this.logs.findIndex(log => log.id === payload.new.id);
                        if (existingIndex === -1) {
                            this.logs.unshift(payload.new);
                            this.renderTimeline();
                            connectionManager.showToast('新日志已添加', 'success');
                        }
                    } else {
                        // 如果没有完整数据，则重新加载
                        await this.loadLogs();
                        this.renderTimeline();
                    }
                    break;

                case 'UPDATE':
                    console.log('✏️ 更新日志记录');
                    // 直接更新对应的记录，避免重新加载全部数据
                    if (payload.new) {
                        const updateIndex = this.logs.findIndex(log => log.id === payload.new.id);
                        if (updateIndex !== -1) {
                            this.logs[updateIndex] = payload.new;
                            this.renderTimeline();
                            connectionManager.showToast('日志已更新', 'success');
                        } else {
                            // 如果找不到记录，重新加载
                            await this.loadLogs();
                            this.renderTimeline();
                        }
                    } else {
                        await this.loadLogs();
                        this.renderTimeline();
                    }
                    break;

                case 'DELETE':
                    console.log('🗑️ 删除日志记录');
                    // 直接从列表中移除，避免重新加载全部数据
                    if (payload.old) {
                        const deleteIndex = this.logs.findIndex(log => log.id === payload.old.id);
                        if (deleteIndex !== -1) {
                            this.logs.splice(deleteIndex, 1);
                            this.renderTimeline();
                            connectionManager.showToast('日志已删除', 'success');
                        }
                    } else {
                        await this.loadLogs();
                        this.renderTimeline();
                    }
                    break;

                default:
                    console.log('🔄 未知事件类型，重新加载数据');
                    await this.loadLogs();
                    this.renderTimeline();
            }
        } catch (error) {
            console.error('处理实时更新失败:', error);
            // 出错时重新加载数据确保一致性
            await this.loadLogs();
            this.renderTimeline();
        }
    }

    // 编辑日志
    editLog(id) {
        const log = this.logs.find(log => log.id === id);
        if (!log) return;

        document.getElementById('logContent').value = log.content;
        document.getElementById('submitBtn').textContent = '更新';
        document.getElementById('cancelBtn').classList.remove('hidden');

        this.editingId = id;
        document.getElementById('logContent').focus();
    }

    // 取消编辑
    cancelEdit() {
        this.resetForm();
    }

    // 重置表单
    resetForm() {
        document.getElementById('logForm').reset();
        document.getElementById('submitBtn').textContent = '保存';
        document.getElementById('cancelBtn').classList.add('hidden');
        this.editingId = null;
    }

    // 显示删除确认模态框
    showDeleteModal(id) {
        this.deleteId = id;
        document.getElementById('deleteModal').classList.remove('hidden');
        document.getElementById('deleteModal').classList.add('flex');
    }

    // 隐藏删除确认模态框
    hideDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
        document.getElementById('deleteModal').classList.remove('flex');
        this.deleteId = null;
    }

    // 确认删除
    async confirmDelete() {
        if (this.deleteId) {
            if (!supabase) {
                connectionManager.showToast('数据库连接不可用，请刷新页面', 'error');
                return;
            }

            try {
                await connectionManager.executeWithRetry(
                    () => this.deleteLog(this.deleteId),
                    '删除日志'
                );
                this.hideDeleteModal();
            } catch (error) {
                console.error('删除失败:', error);
            }
        }
    }

    // 渲染时间线
    renderTimeline() {
        const timeline = document.getElementById('timeline');
        const emptyState = document.getElementById('emptyState');

        if (this.logs.length === 0) {
            timeline.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        timeline.innerHTML = this.logs.map(log => this.createLogItem(log)).join('');
    }

    // 创建日志条目HTML
    createLogItem(log) {
        const timeAgo = this.getTimeAgo(log.created_at);
        const isUpdated = log.updated_at && log.updated_at !== log.created_at;

        return `
            <div class="timeline-item relative pb-6" data-id="${log.id}">
                <div class="timeline-line"></div>
                <div class="timeline-dot"></div>
                <div class="ml-4">
                    <div class="flex justify-between items-start mb-2">
                        <p class="text-gray-700 text-sm whitespace-pre-wrap flex-1">${this.escapeHtml(log.content)}</p>
                        <div class="flex space-x-2 ml-4">
                            <button onclick="logManager.editLog('${log.id}')"
                                    class="text-gray-500 hover:text-gray-700 text-xs">
                                编辑
                            </button>
                            <button onclick="logManager.showDeleteModal('${log.id}')"
                                    class="text-gray-500 hover:text-gray-700 text-xs">
                                删除
                            </button>
                        </div>
                    </div>
                    <div class="text-xs text-gray-400">
                        ${timeAgo}${isUpdated ? ' (已编辑)' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // 计算时间差
    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (days > 0) return `${days}天前`;
        if (hours > 0) return `${hours}小时前`;
        if (minutes > 0) return `${minutes}分钟前`;
        return '刚刚';
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 清理资源
    cleanup() {
        if (this.realtimeChannel && supabase) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
    }
}

// 初始化应用
const logManager = new LogManager();

// 将logManager暴露到全局，供网络监听器使用
window.logManager = logManager;

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    logManager.cleanup();
});

// 添加调试工具
window.debugRealtime = () => {
    if (logManager) {
        console.log('=== 实时订阅调试信息 ===');
        console.log('连接状态:', logManager.checkRealtimeStatus());
        console.log('网络状态:', connectionManager.isOnline ? '在线' : '离线');
        console.log('是否移动端:', connectionManager.isMobile);
        console.log('重试次数:', logManager.realtimeRetryCount || 0);
        
        if (logManager.realtimeChannel) {
            console.log('频道详情:', {
                topic: logManager.realtimeChannel.topic,
                state: logManager.realtimeChannel.state,
                joinedAt: logManager.realtimeChannel.joinedAt
            });
        }
        
        // 手动重新连接
        console.log('手动重新连接实时订阅...');
        logManager.setupRealtime();
    }
};

/* 
===============================================
📡 实时订阅功能说明
===============================================

✅ 已实现的功能：
- 监听 logs 表的所有变化 (INSERT/UPDATE/DELETE)
- 智能重试机制，网络问题时自动重连
- 移动端优化，减少连接频率
- 状态指示器显示连接状态
- 网络恢复时自动重连

🔧 调试方法：
- 打开浏览器控制台
- 运行 debugRealtime() 查看连接状态
- 观察控制台日志了解实时更新

📱 手机端优化：
- 增加心跳间隔到30秒
- 使用指数退避重试策略
- 网络恢复时延迟重连确保稳定

⚠️ 注意事项：
- 需要在Supabase后台开启实时订阅权限
- logs表需要启用 Row Level Security
- 确保匿名用户有读取权限
===============================================
*/