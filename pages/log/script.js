// Supabase配置
const SUPABASE_URL = 'https://fmxddvjgkykuqwmasigo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteGRkdmpna3lrdXF3bWFzaWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNDMzMjcsImV4cCI6MjA1OTYxOTMyN30.XCU4-03oajGh6M2-PNiBotCZSIDn_nJXkIC0Thjjfqo';

// 初始化Supabase客户端
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 日志管理类
class LogManager {
    constructor() {
        this.logs = [];
        this.editingId = null;
        this.realtimeChannel = null;
        this.init();
    }

    // 初始化
    async init() {
        this.bindEvents();
        await this.loadLogs();
        this.renderTimeline();
        this.setupRealtime();
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
        
        // 点击模态框背景关闭
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

        try {
            if (this.editingId) {
                await this.updateLog(this.editingId, content);
            } else {
                await this.addLog(content);
            }

            this.resetForm();
            // 不需要手动刷新，实时监听会自动更新
        } catch (error) {
            console.error('操作失败:', error);
            alert('操作失败，请重试');
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

        // 不需要手动刷新，实时监听会自动更新
    }

    // 加载日志
    async loadLogs() {
        const { data, error } = await supabase
            .from('logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('加载日志失败:', error);
            return;
        }

        this.logs = data || [];
    }

    // 设置实时监听
    setupRealtime() {
        // 如果已有频道，先取消订阅
        if (this.realtimeChannel) {
            supabase.removeChannel(this.realtimeChannel);
        }

        // 创建新的实时频道
        this.realtimeChannel = supabase
            .channel('logs_changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'logs'
                },
                (payload) => this.handleRealtimeChange(payload)
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('实时监听已启用');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('实时监听连接失败');
                }
            });
    }

    // 处理实时数据变化
    async handleRealtimeChange(payload) {
        console.log('收到实时更新:', payload);

        switch (payload.eventType) {
            case 'INSERT':
                // 新增记录
                await this.loadLogs();
                this.renderTimeline();
                break;
            case 'UPDATE':
                // 更新记录
                await this.loadLogs();
                this.renderTimeline();
                break;
            case 'DELETE':
                // 删除记录
                await this.loadLogs();
                this.renderTimeline();
                break;
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
            try {
                await this.deleteLog(this.deleteId);
                this.hideDeleteModal();
            } catch (error) {
                console.error('删除失败:', error);
                alert('删除失败，请重试');
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
        if (this.realtimeChannel) {
            supabase.removeChannel(this.realtimeChannel);
            this.realtimeChannel = null;
        }
    }
}

// 初始化应用
const logManager = new LogManager();

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    logManager.cleanup();
});
