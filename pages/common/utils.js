/**
 * 通用工具函数库
 */

/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的文件大小
 */
export function formatFileSize(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 格式化日期
 * @param {Date|string|number} date - 日期对象或时间戳
 * @param {string} format - 格式化字符串，默认为 'YYYY-MM-DD HH:mm:ss'
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  const d = new Date(date);
  
  const replacements = {
    'YYYY': d.getFullYear(),
    'MM': String(d.getMonth() + 1).padStart(2, '0'),
    'DD': String(d.getDate()).padStart(2, '0'),
    'HH': String(d.getHours()).padStart(2, '0'),
    'mm': String(d.getMinutes()).padStart(2, '0'),
    'ss': String(d.getSeconds()).padStart(2, '0'),
  };
  
  let result = format;
  for (const [pattern, value] of Object.entries(replacements)) {
    result = result.replace(pattern, value);
  }
  
  return result;
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 文件扩展名（小写）
 */
export function getFileExtension(filename) {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
}

/**
 * 根据文件类型返回对应的图标类名
 * @param {string} filename - 文件名
 * @returns {string} 对应的图标类名
 */
export function getFileIcon(filename) {
  const ext = getFileExtension(filename);
  
  const iconMap = {
    // 文档文件
    'pdf': 'fa-file-pdf',
    'doc': 'fa-file-word',
    'docx': 'fa-file-word',
    'xls': 'fa-file-excel',
    'xlsx': 'fa-file-excel',
    'ppt': 'fa-file-powerpoint',
    'pptx': 'fa-file-powerpoint',
    'txt': 'fa-file-alt',
    
    // 图像文件
    'jpg': 'fa-file-image',
    'jpeg': 'fa-file-image',
    'png': 'fa-file-image',
    'gif': 'fa-file-image',
    'svg': 'fa-file-image',
    'webp': 'fa-file-image',
    
    // 音频文件
    'mp3': 'fa-file-audio',
    'wav': 'fa-file-audio',
    'ogg': 'fa-file-audio',
    'flac': 'fa-file-audio',
    
    // 视频文件
    'mp4': 'fa-file-video',
    'avi': 'fa-file-video',
    'mov': 'fa-file-video',
    'wmv': 'fa-file-video',
    'mkv': 'fa-file-video',
    
    // 压缩文件
    'zip': 'fa-file-archive',
    'rar': 'fa-file-archive',
    '7z': 'fa-file-archive',
    'tar': 'fa-file-archive',
    'gz': 'fa-file-archive',
    
    // 代码文件
    'html': 'fa-file-code',
    'css': 'fa-file-code',
    'js': 'fa-file-code',
    'ts': 'fa-file-code',
    'json': 'fa-file-code',
    'xml': 'fa-file-code',
    'php': 'fa-file-code',
    'py': 'fa-file-code',
    'java': 'fa-file-code',
    'c': 'fa-file-code',
    'cpp': 'fa-file-code',
    'cs': 'fa-file-code',
  };
  
  return iconMap[ext] || 'fa-file';
}

/**
 * 防抖函数
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait = 300) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要执行的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 是否复制成功
 */
export function copyToClipboard(text) {
  return navigator.clipboard.writeText(text)
    .then(() => true)
    .catch(() => {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
      } catch (err) {
        document.body.removeChild(textarea);
        return false;
      }
    });
}

/**
 * 简单的本地存储封装
 */
export const storage = {
  /**
   * 获取存储的值
   * @param {string} key - 键名
   * @param {*} defaultValue - 默认值
   * @returns {*} 存储的值
   */
  get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.error('Error getting from localStorage:', error);
      return defaultValue;
    }
  },
  
  /**
   * 设置存储值
   * @param {string} key - 键名
   * @param {*} value - 要存储的值
   */
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  },
  
  /**
   * 删除存储的值
   * @param {string} key - 键名
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  },
  
  /**
   * 清空所有存储
   */
  clear() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }
};

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
export function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * 检查对象是否为空
 * @param {Object} obj - 要检查的对象
 * @returns {boolean} 是否为空
 */
export function isEmptyObject(obj) {
  return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
 * 切换暗黑模式
 * @param {boolean} isDark - 是否启用暗黑模式
 */
export function toggleDarkMode(isDark) {
  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    storage.set('darkMode', true);
  } else {
    document.documentElement.removeAttribute('data-theme');
    storage.set('darkMode', false);
  }
}

/**
 * 初始化主题（从本地存储读取）
 */
export function initTheme() {
  const isDarkMode = storage.get('darkMode', false);
  toggleDarkMode(isDarkMode);
  return isDarkMode;
}

/**
 * 显示通知提示
 * @param {string} message - 提示消息
 * @param {string} type - 提示类型 ('success', 'error', 'info', 'warning')
 * @param {number} duration - 持续时间（毫秒）
 */
export function showNotification(message, type = 'info', duration = 3000) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = `notification notification-${type} fade-in`;
  notification.textContent = message;
  
  // 添加到文档
  const container = document.querySelector('.notification-container') || createNotificationContainer();
  container.appendChild(notification);
  
  // 设置自动消失
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
      // 如果容器为空，也移除容器
      if (container.children.length === 0) {
        container.remove();
      }
    }, 300);
  }, duration);
}

/**
 * 创建通知容器
 * @returns {HTMLElement} 通知容器
 */
function createNotificationContainer() {
  const container = document.createElement('div');
  container.className = 'notification-container';
  document.body.appendChild(container);
  return container;
}

/**
 * 获取URL参数
 * @param {string} name - 参数名
 * @returns {string|null} 参数值
 */
export function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * 设置URL参数（不刷新页面）
 * @param {string} name - 参数名
 * @param {string} value - 参数值
 */
export function setUrlParam(name, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState({}, '', url.toString());
}

/**
 * 移除URL参数（不刷新页面）
 * @param {string} name - 参数名
 */
export function removeUrlParam(name) {
  const url = new URL(window.location.href);
  url.searchParams.delete(name);
  window.history.replaceState({}, '', url.toString());
}

/**
 * 简易的事件发布订阅系统
 */
export const eventBus = {
  events: {},
  
  /**
   * 订阅事件
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(eventName, callback) {
    this.events[eventName] = this.events[eventName] || [];
    this.events[eventName].push(callback);
  },
  
  /**
   * 取消订阅
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(eventName, callback) {
    if (this.events[eventName]) {
      this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    }
  },
  
  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {*} data - 传递的数据
   */
  emit(eventName, data) {
    if (this.events[eventName]) {
      this.events[eventName].forEach(callback => {
        callback(data);
      });
    }
  },
  
  /**
   * 只订阅一次
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  once(eventName, callback) {
    const onceCallback = (data) => {
      callback(data);
      this.off(eventName, onceCallback);
    };
    this.on(eventName, onceCallback);
  }
}; 