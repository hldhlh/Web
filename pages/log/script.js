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
        const existingToast = document.querySelector('.status-indicator');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `status-indicator ${type}`;
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

// 全局变量
let supabase = null;
let isAppInitialized = false;

// 初始化Supabase客户端，添加超时和错误处理
function initializeSupabase() {
    try {
        if (!window.supabase) {
            throw new Error('Supabase CDN未能加载');
        }

        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            realtime: connectionManager.isMobile ? {
                // 移动端优化：增加心跳间隔，减少连接频率
                params: {
                    heartbeat_interval_ms: 30000,
                    timeout_ms: 10000
                }
            } : undefined
        });

        console.log('✅ Supabase客户端初始化成功');
        return client;
    } catch (error) {
        console.error('❌ Supabase初始化失败:', error);
        connectionManager.showToast('数据库连接失败', 'error');
        return null;
    }
}

// CDN就绪时初始化应用
function initializeApp() {
    if (isAppInitialized) return;
    
    console.log('🚀 开始初始化日志应用...');
    
    // 初始化Supabase
    supabase = initializeSupabase();
    
    // 初始化日志管理器
    if (typeof LogManager !== 'undefined') {
        window.logManager = new LogManager();
        isAppInitialized = true;
        console.log('✅ 日志应用初始化完成');
    } else {
        console.error('❌ LogManager类未找到');
    }
}

// 监听CDN加载完成事件
window.addEventListener('cdnReady', (event) => {
    console.log('📦 CDN加载完成:', event.detail);
    connectionManager.showToast('资源加载完成', 'success');
    
    // 延迟初始化，确保所有依赖都已就绪
    setTimeout(initializeApp, 100);
});

// 监听CDN加载失败事件
window.addEventListener('cdnError', (event) => {
    console.error('❌ CDN加载失败:', event.detail);
    connectionManager.showToast('资源加载失败，功能可能受限', 'error');
    
    // 即使CDN失败也尝试初始化基本功能
    setTimeout(() => {
        if (window.supabase) {
            initializeApp();
        } else {
            console.warn('⚠️ 无Supabase支持，应用以降级模式运行');
        }
    }, 1000);
});

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
        }
        
        this.isInitialized = true;
        console.log('📝 日志应用初始化完成');
        
        // 开始实时监听连接状态
        this.startConnectionMonitoring();
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
                        // 状态会由监听器自动更新，不需要手动调用
                        break;
                        
                    case 'CHANNEL_ERROR':
                        console.error('❌ 实时监听连接失败:', err);
                        connectionManager.showToast('实时同步连接失败', 'error');
                        this.retryRealtimeConnection();
                        break;
                        
                    case 'TIMED_OUT':
                        console.warn('⏰ 实时监听连接超时');
                        connectionManager.showToast('实时同步连接超时，正在重试...', 'warning');
                        this.retryRealtimeConnection();
                        break;
                        
                    case 'CLOSED':
                        console.log('🔒 实时监听连接已关闭');
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
        // 查找或创建状态指示器
        let indicator = document.querySelector('.realtime-status');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'realtime-status';
            document.body.appendChild(indicator);
        }

        // 更新状态
        indicator.className = isConnected ? 'realtime-status connected' : 'realtime-status disconnected';
        
        if (isConnected) {
            indicator.innerHTML = `
                <div class="status-dot green pulse"></div>
                实时同步
            `;
        } else {
            indicator.innerHTML = `
                <div class="status-dot gray"></div>
                同步断开
            `;
        }

        // 状态指示器现在持续显示，不会自动隐藏
        this.updateConnectionStatus();
    }

    // 更新连接状态信息
    updateConnectionStatus() {
        const indicator = document.querySelector('.realtime-status');
        if (!indicator) return;

        // 添加点击查看详细信息的功能
        indicator.onclick = () => {
            const isConnected = this.realtimeChannel && this.realtimeChannel.state === 'joined';
            const networkStatus = connectionManager.isOnline ? '在线' : '离线';
            const supabaseStatus = supabase ? '已加载' : '未加载';
            const connectionQuality = connectionManager.connectionQuality || '未知';
            
            const details = `
=== 连接状态详情 ===
网络状态: ${networkStatus}
Supabase: ${supabaseStatus}
实时连接: ${isConnected ? '已连接' : '断开'}
连接质量: ${connectionQuality}
重试次数: ${this.realtimeRetryCount || 0}
设备类型: ${connectionManager.isMobile ? '移动端' : '桌面端'}
            `.trim();
            
            console.log(details);
            connectionManager.showToast('连接详情已输出到控制台', 'info');
        };

        // 添加tooltip提示
        indicator.title = '点击查看详细连接信息';
    }

    // 开始实时监听连接状态
    startConnectionMonitoring() {
        // 初始显示状态
        this.showRealtimeStatus(false);
        
        // 每5秒检查一次连接状态
        this.connectionMonitorInterval = setInterval(() => {
            this.checkAndUpdateConnectionStatus();
        }, 5000);
        
        console.log('🔄 开始实时监听数据库连接状态');
    }

    // 检查并更新连接状态
    async checkAndUpdateConnectionStatus() {
        try {
            // 检查网络状态
            const networkOnline = navigator.onLine;
            
            // 检查Supabase客户端状态
            const supabaseAvailable = !!supabase;
            
            // 检查实时连接状态
            const realtimeConnected = this.realtimeChannel && this.realtimeChannel.state === 'joined';
            
            // 定期测试数据库连接
            let databaseReachable = false;
            if (supabaseAvailable && networkOnline) {
                try {
                    // 使用轻量级查询测试连接
                    await connectionManager.executeWithRetry(async () => {
                        const { error } = await supabase.from('logs').select('id').limit(1);
                        if (error) throw error;
                        databaseReachable = true;
                    }, '连接测试');
                } catch (error) {
                    console.warn('数据库连接测试失败:', error.message);
                    databaseReachable = false;
                }
            }
            
            // 综合判断连接状态
            const overallConnected = networkOnline && supabaseAvailable && realtimeConnected && databaseReachable;
            
            // 更新状态显示
            this.showRealtimeStatus(overallConnected);
            
            // 如果连接状态发生变化，记录日志
            if (this.lastConnectionStatus !== overallConnected) {
                console.log(`📡 连接状态变化: ${overallConnected ? '已连接' : '已断开'}`);
                console.log({
                    网络: networkOnline ? '在线' : '离线',
                    Supabase: supabaseAvailable ? '可用' : '不可用',
                    实时连接: realtimeConnected ? '已连接' : '断开',
                    数据库: databaseReachable ? '可达' : '不可达',
                    综合状态: overallConnected ? '正常' : '异常'
                });
                this.lastConnectionStatus = overallConnected;
            }
            
        } catch (error) {
            console.error('连接状态检查失败:', error);
            this.showRealtimeStatus(false);
        }
    }

    // 停止连接监听
    stopConnectionMonitoring() {
        if (this.connectionMonitorInterval) {
            clearInterval(this.connectionMonitorInterval);
            this.connectionMonitorInterval = null;
            console.log('🛑 停止实时连接状态监听');
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
        const timeInfo = this.getDetailedTime(log.created_at);
        const isUpdated = log.updated_at && log.updated_at !== log.created_at;
        const updatedTimeInfo = isUpdated ? this.getDetailedTime(log.updated_at) : null;

        return `
            <div class="timeline-item" data-id="${log.id}">
                <div class="timeline-line"></div>
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <p class="timeline-text">${this.escapeHtml(log.content)}</p>
                        <div class="timeline-actions">
                            <button onclick="logManager.editLog('${log.id}')" class="timeline-action">
                                编辑
                            </button>
                            <button onclick="logManager.showDeleteModal('${log.id}')" class="timeline-action">
                                删除
                            </button>
                        </div>
                    </div>
                    <div class="timeline-meta">
                        <span class="time-tooltip" title="${timeInfo.full}">
                            ${timeInfo.simple}
                        </span>${isUpdated ? ` <span class="time-tooltip" title="编辑于: ${updatedTimeInfo.full}">(已编辑)</span>` : ''}
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

    // 获取详细时间信息
    getDetailedTime(timestamp) {
        const time = new Date(timestamp);
        const now = new Date();
        
        // 格式化日期
        const year = time.getFullYear();
        const month = time.getMonth() + 1;
        const date = time.getDate();
        const hours = time.getHours();
        const minutes = time.getMinutes();
        const seconds = time.getSeconds();
        
        // 获取星期几
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdays[time.getDay()];
        
        // 判断上午/下午/凌晨等
        let timeOfDay;
        if (hours >= 0 && hours < 6) {
            timeOfDay = '凌晨';
        } else if (hours >= 6 && hours < 12) {
            timeOfDay = '上午';
        } else if (hours >= 12 && hours < 18) {
            timeOfDay = '下午';
        } else {
            timeOfDay = '晚上';
        }
        
        // 12小时制显示
        const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
        
        // 判断是否是今天、昨天等
        const isToday = now.toDateString() === time.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = yesterday.toDateString() === time.toDateString();
        
        let dateStr;
        if (isToday) {
            dateStr = '今天';
        } else if (isYesterday) {
            dateStr = '昨天';
        } else if (year === now.getFullYear()) {
            dateStr = `${month}月${date}日`;
        } else {
            dateStr = `${year}年${month}月${date}日`;
        }
        
        // 格式化时间
        const timeStr = `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        return {
            full: `${dateStr} ${weekday} ${timeOfDay} ${timeStr}`,
            simple: this.getTimeAgo(timestamp)
        };
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 清理资源
    cleanup() {
        // 停止连接状态监听
        this.stopConnectionMonitoring();
        
        // 清理实时连接
        if (this.realtimeChannel && supabase) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
        
        // 移除状态指示器
        const indicator = document.querySelector('.realtime-status');
        if (indicator) {
            indicator.remove();
        }
    }
}

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.logManager && typeof window.logManager.cleanup === 'function') {
        window.logManager.cleanup();
    }
});

// 兼容性检查 - 如果CDN已经加载完成（比如直接访问），立即初始化
document.addEventListener('DOMContentLoaded', () => {
    // 等待一小段时间，让CDN加载器有机会运行
    setTimeout(() => {
        if (!isAppInitialized && window.supabase) {
            console.log('🔄 检测到Supabase已可用，直接初始化...');
            initializeApp();
        }
    }, 500);
});

// 添加调试工具
window.debugRealtime = () => {
    if (window.logManager) {
        console.log('=== 实时订阅调试信息 ===');
        console.log('应用初始化状态:', isAppInitialized);
        console.log('连接状态:', window.logManager.checkRealtimeStatus());
        console.log('网络状态:', connectionManager.isOnline ? '在线' : '离线');
        console.log('是否移动端:', connectionManager.isMobile);
        console.log('重试次数:', window.logManager.realtimeRetryCount || 0);
        console.log('Supabase可用:', !!supabase);
        
        if (window.logManager.realtimeChannel) {
            console.log('频道详情:', {
                topic: window.logManager.realtimeChannel.topic,
                state: window.logManager.realtimeChannel.state,
                joinedAt: window.logManager.realtimeChannel.joinedAt
            });
        }
        
        // 手动重新连接
        console.log('手动重新连接实时订阅...');
        window.logManager.setupRealtime();
    } else {
        console.warn('⚠️ 日志管理器未初始化');
        console.log('CDN状态检查:');
        console.log('- Supabase可用:', !!window.supabase);
        console.log('- 应用初始化:', isAppInitialized);
        
        if (window.supabase && !isAppInitialized) {
            console.log('🔄 尝试手动初始化应用...');
            initializeApp();
        }
    }
};

// 添加CDN状态检查工具
window.debugCDN = () => {
    console.log('=== CDN状态调试信息 ===');
    console.log('自定义CSS可用:', !!document.querySelector('link[href*="styles.css"]'));
    console.log('Supabase可用:', !!window.supabase);
    console.log('应用初始化状态:', isAppInitialized);
    console.log('网络状态:', navigator.onLine ? '在线' : '离线');
    console.log('用户代理:', navigator.userAgent);
    console.log('时区:', Intl.DateTimeFormat().resolvedOptions().timeZone);
    
    // 检查已加载的资源
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    
    console.log('已加载的脚本:', scripts.map(s => s.src));
    console.log('已加载的样式:', links.map(l => l.href));
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