/**
 * storage-settings.js
 * 存储服务设置页面
 */

import { CloudStorage } from '../common/supabase.js';

/**
 * 存储设置管理器
 */
export const StorageSettings = {
  /**
   * 初始化存储设置页面
   */
  async init() {
    console.log('初始化存储设置页面...');
    
    // 获取存储服务信息
    await this.refreshStorageInfo();
    
    // 绑定设置表单事件
    this.bindEvents();
  },
  
  /**
   * 刷新存储服务信息
   */
  async refreshStorageInfo() {
    try {
      // 获取存储服务状态
      const storageInfo = CloudStorage.getStorageInfo();
      const s3ConnectionInfo = CloudStorage.getS3ConnectionInfo();
      
      // 展示主存储服务信息
      document.getElementById('storage-service-type').textContent = storageInfo.primaryService;
      document.getElementById('storage-endpoint').textContent = storageInfo.endpoint;
      document.getElementById('storage-region').textContent = storageInfo.region;
      document.getElementById('storage-status').textContent = storageInfo.online ? '在线' : '离线';
      
      // 展示 S3 兼容信息
      document.getElementById('s3-compatible').textContent = storageInfo.s3Compatible ? '支持' : '不支持';
      document.getElementById('s3-configured').textContent = storageInfo.s3Configured ? '已配置' : '未配置';
      document.getElementById('s3-endpoint').textContent = s3ConnectionInfo.endpoint;
      document.getElementById('s3-region').textContent = s3ConnectionInfo.region;
      document.getElementById('s3-access-key-id').textContent = s3ConnectionInfo.accessKeyId || '未设置';
      document.getElementById('s3-secret-configured').textContent = 
        s3ConnectionInfo.secretAccessKeyConfigured ? '已配置' : '未配置';
      
      // 更新 S3 配置表单中的值
      document.getElementById('s3-access-key-input').value = s3ConnectionInfo.accessKeyId || '';
      
      // 更新连接测试按钮状态
      const testS3Button = document.getElementById('test-s3-connection');
      testS3Button.disabled = !storageInfo.s3Configured;
      
    } catch (error) {
      console.error('获取存储信息失败:', error);
      this.showNotification('获取存储信息失败: ' + error.message, 'error');
    }
  },
  
  /**
   * 绑定设置表单事件
   */
  bindEvents() {
    // 保存 S3 密钥按钮
    const saveS3KeyButton = document.getElementById('save-s3-secret');
    if (saveS3KeyButton) {
      saveS3KeyButton.addEventListener('click', async () => {
        const secretKeyInput = document.getElementById('s3-secret-key-input');
        const secretKey = secretKeyInput.value.trim();
        
        if (!secretKey) {
          this.showNotification('请输入有效的 S3 密钥', 'warning');
          return;
        }
        
        try {
          const success = CloudStorage.setS3SecretKey(secretKey);
          
          if (success) {
            this.showNotification('S3 密钥已保存（仅保存在当前会话中）', 'success');
            secretKeyInput.value = '';
            await this.refreshStorageInfo();
          } else {
            this.showNotification('保存 S3 密钥失败', 'error');
          }
        } catch (error) {
          console.error('保存 S3 密钥出错:', error);
          this.showNotification('保存 S3 密钥时发生错误', 'error');
        }
      });
    }
    
    // 测试 S3 连接按钮
    const testS3Button = document.getElementById('test-s3-connection');
    if (testS3Button) {
      testS3Button.addEventListener('click', async () => {
        try {
          this.showNotification('正在测试 S3 连接...', 'info');
          
          // 创建一个测试文件并上传
          const testBlob = new Blob(['S3 连接测试'], { type: 'text/plain' });
          const testFile = new File([testBlob], 's3-test.txt', { type: 'text/plain' });
          
          const result = await CloudStorage.uploadFileViaS3(testFile, 'tests');
          
          if (result.success) {
            this.showNotification('S3 连接测试成功！', 'success');
            
            // 清理测试文件
            setTimeout(async () => {
              await CloudStorage.deleteFile('tests/s3-test.txt');
            }, 5000);
          } else {
            this.showNotification(`S3 连接测试失败: ${result.error}`, 'error');
          }
        } catch (error) {
          console.error('S3 连接测试出错:', error);
          this.showNotification('S3 连接测试时发生错误', 'error');
        }
      });
    }
  },
  
  /**
   * 显示通知消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型（success/info/warning/error）
   */
  showNotification(message, type = 'info') {
    const notificationContainer = document.getElementById('notification-container');
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    
    // 自动关闭
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        notification.remove();
      }, 500);
    }, 5000);
  }
};

// 页面加载时初始化
window.addEventListener('DOMContentLoaded', () => {
  StorageSettings.init();
}); 