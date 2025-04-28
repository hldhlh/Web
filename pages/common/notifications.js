/**
 * notifications.js
 * 提供简单的通知功能
 */

/**
 * 通知系统
 */
const Notifications = {
  /**
   * 创建通知容器
   * @returns {HTMLElement} 通知容器
   */
  getContainer() {
    let container = document.querySelector('.app-notifications');
    
    if (!container) {
      container = document.createElement('div');
      container.className = 'app-notifications';
      document.body.appendChild(container);
      
      // 添加样式
      const style = document.createElement('style');
      style.textContent = `
        .app-notifications {
          position: fixed;
          top: 60px;
          right: 20px;
          z-index: 1000;
          width: 300px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .notification {
          padding: 12px 15px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #fff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          animation: notification-enter 0.3s ease-out, notification-exit 0.3s ease-in 2.7s forwards;
          max-width: 100%;
        }
        
        @keyframes notification-enter {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes notification-exit {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        
        .notification-success {
          background-color: #4caf50;
        }
        
        .notification-error {
          background-color: #f44336;
        }
        
        .notification-info {
          background-color: #2196f3;
        }
        
        .notification-warning {
          background-color: #ff9800;
        }
        
        .notification i {
          font-size: 18px;
        }
        
        .notification-content {
          flex: 1;
        }
        
        .notification-close {
          cursor: pointer;
          background: none;
          border: none;
          color: #fff;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        
        .notification-close:hover {
          opacity: 1;
        }
        
        @media (max-width: 480px) {
          .app-notifications {
            width: calc(100% - 40px);
            top: 20px;
            right: 20px;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    return container;
  },
  
  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型 (success, error, info, warning)
   * @param {number} duration - 显示时长 (毫秒)
   */
  show(message, type = 'info', duration = 3000) {
    const container = this.getContainer();
    
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // 图标映射
    const icons = {
      success: '<i class="bi bi-check-circle"></i>',
      error: '<i class="bi bi-exclamation-circle"></i>',
      info: '<i class="bi bi-info-circle"></i>',
      warning: '<i class="bi bi-exclamation-triangle"></i>'
    };
    
    notification.innerHTML = `
      ${icons[type] || icons.info}
      <div class="notification-content">${message}</div>
      <button class="notification-close"><i class="bi bi-x"></i></button>
    `;
    
    // 添加到容器
    container.appendChild(notification);
    
    // 关闭按钮事件
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      notification.remove();
    });
    
    // 自动移除
    setTimeout(() => {
      notification.addEventListener('animationend', (event) => {
        if (event.animationName === 'notification-exit') {
          notification.remove();
        }
      });
    }, duration);
  },
  
  /**
   * 显示成功通知
   * @param {string} message - 通知消息
   */
  success(message) {
    this.show(message, 'success');
  },
  
  /**
   * 显示错误通知
   * @param {string} message - 通知消息
   */
  error(message) {
    this.show(message, 'error');
  },
  
  /**
   * 显示信息通知
   * @param {string} message - 通知消息
   */
  info(message) {
    this.show(message, 'info');
  },
  
  /**
   * 显示警告通知
   * @param {string} message - 通知消息
   */
  warning(message) {
    this.show(message, 'warning');
  }
};

// 导出通知系统
export default Notifications; 