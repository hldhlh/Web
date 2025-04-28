/**
 * 应用程序通用 JavaScript 功能
 */

// 主题支持
const AppTheme = {
    // 获取当前主题
    getTheme() {
        return localStorage.getItem('app-theme') || 'light';
    },
    
    // 设置主题
    setTheme(theme) {
        localStorage.setItem('app-theme', theme);
        document.body.setAttribute('data-theme', theme);
        
        // 触发主题变更事件
        const event = new CustomEvent('themeChanged', { detail: { theme } });
        document.dispatchEvent(event);
    },
    
    // 切换主题
    toggleTheme() {
        const currentTheme = this.getTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        return newTheme;
    },
    
    // 初始化主题
    initialize() {
        const theme = this.getTheme();
        document.body.setAttribute('data-theme', theme);
    }
};

// 通知系统
const Notifications = {
    // 显示通知
    show(message, type = 'info', duration = 3000) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `app-notification ${type} fade-in`;
        notification.textContent = message;
        
        // 添加到文档
        const container = document.querySelector('.notification-container') || this.createContainer();
        container.appendChild(notification);
        
        // 设置计时器自动移除
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => {
                container.removeChild(notification);
            }, 300);
        }, duration);
        
        return notification;
    },
    
    // 创建通知容器
    createContainer() {
        const container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
        return container;
    },
    
    // 快捷方法
    success(message, duration) {
        return this.show(message, 'success', duration);
    },
    
    error(message, duration) {
        return this.show(message, 'error', duration);
    },
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
};

// 公共工具函数
const AppUtils = {
    // 格式化日期
    formatDate(date, format = 'YYYY-MM-DD') {
        const d = new Date(date);
        
        const replacements = {
            'YYYY': d.getFullYear(),
            'MM': String(d.getMonth() + 1).padStart(2, '0'),
            'DD': String(d.getDate()).padStart(2, '0'),
            'HH': String(d.getHours()).padStart(2, '0'),
            'mm': String(d.getMinutes()).padStart(2, '0'),
            'ss': String(d.getSeconds()).padStart(2, '0')
        };
        
        let result = format;
        for (const [pattern, value] of Object.entries(replacements)) {
            result = result.replace(pattern, value);
        }
        
        return result;
    },
    
    // 从URL获取查询参数
    getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },
    
    // 防抖函数
    debounce(func, wait = 300) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
};

// 导航
const AppNavigation = {
    // 返回主页
    goHome() {
        window.location.href = '../../index.html';
    },
    
    // 导航到另一个应用
    goToApp(appId) {
        window.location.href = `../${appId}/index.html`;
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    AppTheme.initialize();
    
    // 为所有返回按钮添加事件监听
    document.querySelectorAll('.back-button').forEach(button => {
        button.addEventListener('click', () => {
            AppNavigation.goHome();
        });
    });
    
    // 添加通知样式
    const style = document.createElement('style');
    style.textContent = `
        .notification-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        }
        
        .app-notification {
            margin-bottom: 10px;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            min-width: 250px;
            max-width: 350px;
        }
        
        .app-notification.info {
            background-color: var(--app-primary-color);
            color: white;
        }
        
        .app-notification.success {
            background-color: var(--app-success-color);
            color: white;
        }
        
        .app-notification.error {
            background-color: var(--app-danger-color);
            color: white;
        }
        
        .app-notification.warning {
            background-color: var(--app-warning-color);
            color: white;
        }
        
        .fade-out {
            opacity: 0;
            transition: opacity 0.3s;
        }
    `;
    document.head.appendChild(style);
}); 