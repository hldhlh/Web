/**
 * supabase.js
 * Supabase 客户端配置和 Storage API 封装
 */

// 导入 Supabase JavaScript 客户端
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/+esm';

// Supabase 项目 URL 和 公共匿名密钥（仅限公共数据访问）
const SUPABASE_URL = 'https://fmxddvjgkykuqwmasigo.supabase.co';
const SUPABASE_ANON_KEY = 'd32788855b19d0d2d4d4d0734e0cd86aa9d19e92db78ef979cbb1a145dd566b0';

// 存储服务端点
const STORAGE_ENDPOINT = 'https://fmxddvjgkykuqwmasigo.supabase.co/storage/v1';
// 存储区域
const STORAGE_REGION = 'ap-northeast-1';

// S3 兼容接口配置
const S3_ENDPOINT = 'https://fmxddvjgkykuqwmasigo.supabase.co/storage/v1/s3';
const S3_REGION = 'ap-northeast-1';
const S3_ACCESS_KEY_ID = '16cd02bd91e0581145376dc64c7fadd1';
// 注意：需要从 Supabase 控制台获取完整的密钥，此处仅显示 ID
const S3_SECRET_ACCESS_KEY = '';  // 出于安全考虑，不在代码中存储 Secret

// 创建 Supabase 客户端（添加额外选项以解决跨域和连接问题）
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: fetch
  }
});

// 添加错误处理和重试逻辑
const fetchWithRetry = async (url, options = {}, retries = 3, retryDelay = 1000) => {
  try {
    const response = await fetch(url, {
      ...options,
      mode: 'cors',
      credentials: 'include',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`请求失败，${retryDelay/1000}秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return fetchWithRetry(url, options, retries - 1, retryDelay * 1.5);
    } else {
      throw error;
    }
  }
};

/**
 * 云盘存储服务
 */
export const CloudStorage = {
  /**
   * 初始化存储服务
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async init() {
    // 添加离线模式检查
    if (!navigator.onLine) {
      console.error('当前处于离线状态，无法连接到存储服务');
      return false;
    }
    
    try {
      console.log('正在连接到 Supabase 存储服务...');
      
      // 测试连接
      try {
        // 使用简单请求测试连接
        const testUrl = `${SUPABASE_URL}/storage/v1/bucket`;
        await fetchWithRetry(testUrl, {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY
          }
        }, 3, 2000);
      } catch (testError) {
        console.error('连接测试失败:', testError);
        throw new Error('无法连接到存储服务，请检查您的网络连接或稍后重试');
      }
      
      // 检查连接是否正常
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      
      console.log('Supabase 存储服务连接成功');
      
      // 检查是否存在默认存储桶，没有则创建
      const bucketName = 'cloud-storage';
      const bucketExists = data.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        console.log('创建默认存储桶...');
        
        try {
          const { error: createError } = await supabase.storage.createBucket(
            bucketName,
            { 
              public: true, // 改为公共存储桶，简化访问
              fileSizeLimit: 52428800, // 50MB
              allowedMimeTypes: ['*/*'] // 允许所有文件类型
            }
          );
          
          if (createError) throw createError;
          console.log('默认存储桶创建成功');
          
          // 设置公共访问权限
          const { error: policyError } = await supabase.storage.from(bucketName).getPublicUrl('test.txt');
          if (policyError) {
            console.warn('设置公共访问策略失败，但不影响基本功能');
          }
        } catch (bucketError) {
          console.error('创建存储桶失败:', bucketError);
          console.log('尝试使用现有存储桶...');
        }
      }
      
      // 记录存储服务信息
      console.log(`存储端点: ${STORAGE_ENDPOINT}`);
      console.log(`存储区域: ${STORAGE_REGION}`);
      console.log(`S3 兼容端点: ${S3_ENDPOINT}`);
      console.log(`S3 兼容区域: ${S3_REGION}`);
      
      return true;
    } catch (error) {
      console.error('Supabase 存储服务初始化失败:', error.message);
      // 更详细的错误信息
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        console.error('网络连接问题: 请检查您的网络连接或防火墙设置');
      } else if (error.message.includes('401')) {
        console.error('认证问题: API密钥可能无效');
      } else if (error.message.includes('403')) {
        console.error('权限问题: 没有足够的权限访问存储服务');
      } else if (error.message.includes('404')) {
        console.error('资源不存在: 所请求的资源不存在');
      } else if (error.message.includes('timeout')) {
        console.error('请求超时: 服务器响应时间过长');
      }
      
      return false;
    }
  },
  
  /**
   * 上传文件
   * @param {File} file - 要上传的文件对象
   * @param {string} path - 存储路径（文件夹）
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(file, path = '', progressCallback = null) {
    // 检查网络连接
    if (!navigator.onLine) {
      return {
        success: false,
        error: '当前处于离线状态，无法上传文件'
      };
    }
    
    try {
      const bucketName = 'cloud-storage';
      const filePath = path ? `${path}/${file.name}` : file.name;
      
      // 上传前通知
      console.log(`准备上传文件: ${filePath}`);
      
      // 上传文件
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true, // 如果文件已存在则覆盖
          onUploadProgress: progressEvent => {
            if (progressCallback) {
              const progress = (progressEvent.loaded / progressEvent.total) * 100;
              progressCallback(Math.round(progress));
            }
          }
        });
      
      if (error) throw error;
      
      console.log(`文件上传成功: ${filePath}`);
      
      // 获取文件公共URL
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      
      // 备用：如果公共URL无法获取，则使用签名URL
      let finalUrl = publicUrlData?.publicUrl;
      if (!finalUrl) {
        console.log('无法获取公共URL，尝试使用签名URL');
        const { data: urlData } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(filePath, 60 * 60 * 24); // 24小时有效期
        finalUrl = urlData?.signedUrl;
      }
      
      // 验证可访问性
      try {
        await fetchWithRetry(finalUrl, { method: 'HEAD' }, 1, 2000);
        console.log('文件URL可访问性验证成功');
      } catch (e) {
        console.warn('文件URL可能无法直接访问:', e.message);
      }
      
      return {
        success: true,
        path: filePath,
        url: finalUrl || null,
        metadata: data
      };
    } catch (error) {
      console.error('文件上传失败:', error.message);
      let message = error.message;
      
      // 友好的错误信息
      if (error.message.includes('network')) {
        message = '网络连接失败，请检查您的网络连接';
      } else if (error.message.includes('timeout')) {
        message = '请求超时，服务器响应时间过长';
      } else if (error.message.includes('storage/invalid_mime')) {
        message = '不支持的文件类型';
      } else if (error.message.includes('storage/file_size_exceeds_limit')) {
        message = '文件大小超过限制 (50MB)';
      }
      
      return {
        success: false,
        error: message
      };
    }
  },
  
  /**
   * 下载文件
   * @param {string} path - 文件路径
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFile(path) {
    // 检查网络连接
    if (!navigator.onLine) {
      return {
        success: false,
        error: '当前处于离线状态，无法下载文件'
      };
    }
    
    try {
      const bucketName = 'cloud-storage';
      console.log(`准备下载文件: ${path}`);
      
      // 尝试获取公共URL
      let fileData;
      try {
        // 尝试直接从公共URL下载
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(path);
          
        const publicUrl = publicUrlData?.publicUrl;
        if (publicUrl) {
          console.log('使用公共URL下载文件');
          const response = await fetchWithRetry(publicUrl, {}, 3, 2000);
          fileData = await response.blob();
        } else {
          throw new Error('无法获取公共URL');
        }
      } catch (publicError) {
        console.log('公共URL下载失败，尝试使用存储API下载:', publicError.message);
        
        // 回退到存储API
        const { data, error } = await supabase.storage
          .from(bucketName)
          .download(path);
          
        if (error) throw error;
        fileData = data;
      }
      
      if (!fileData) {
        throw new Error('无法获取文件数据');
      }
      
      console.log(`文件下载成功: ${path}`);
      
      return {
        success: true,
        data: fileData,
        url: URL.createObjectURL(fileData)
      };
    } catch (error) {
      console.error('文件下载失败:', error.message);
      let message = error.message;
      
      // 友好的错误信息
      if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
        message = '网络连接失败，请检查您的网络连接';
      } else if (error.message.includes('timeout')) {
        message = '请求超时，服务器响应时间过长';
      } else if (error.message.includes('storage/object_not_found')) {
        message = '文件不存在或已被删除';
      }
      
      return {
        success: false,
        error: message
      };
    }
  },
  
  /**
   * 删除文件
   * @param {string} path - 文件路径
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(path) {
    try {
      const bucketName = 'cloud-storage';
      
      const { error } = await supabase.storage
        .from(bucketName)
        .remove([path]);
      
      if (error) throw error;
      
      return {
        success: true
      };
    } catch (error) {
      console.error('文件删除失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * 列出目录中的文件
   * @param {string} path - 目录路径
   * @returns {Promise<Object>} 文件列表
   */
  async listFiles(path = '') {
    // 检查网络连接
    if (!navigator.onLine) {
      return {
        success: false,
        error: '当前处于离线状态，无法获取文件列表',
        folders: [],
        files: [],
        all: []
      };
    }
    
    try {
      const bucketName = 'cloud-storage';
      console.log(`列出目录内容: ${path || '根目录'}`);
      
      // 添加重试逻辑
      let result;
      let retries = 3;
      let delay = 1000;
      
      while (retries > 0) {
        try {
          result = await supabase.storage
            .from(bucketName)
            .list(path, {
              sortBy: { column: 'name', order: 'asc' }
            });
          
          if (result.error) throw result.error;
          break; // 成功获取数据，跳出循环
        } catch (retryError) {
          console.warn(`获取文件列表失败，重试中... (剩余尝试次数: ${retries})`);
          retries--;
          if (retries === 0) throw retryError;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // 增加延迟
        }
      }
      
      const { data, error } = result;
      if (error) throw error;
      
      // 处理返回的数据
      const folders = data.filter(item => 
        (item.id === null && !item.metadata) || 
        (item.name.endsWith('/') || item.name === '.folder' || item.name.includes('.folder@'))
      );
      
      const files = data.filter(item => 
        !folders.includes(item) && item.name !== '.folder' && !item.name.includes('.folder@')
      );
      
      console.log(`获取到 ${folders.length} 个文件夹和 ${files.length} 个文件`);
      
      return {
        success: true,
        folders,
        files,
        all: data
      };
    } catch (error) {
      console.error('列出文件失败:', error.message);
      let message = error.message;
      
      // 友好的错误信息
      if (error.message.includes('network') || error.message.includes('Failed to fetch')) {
        message = '网络连接失败，请检查您的网络连接';
      } else if (error.message.includes('timeout')) {
        message = '请求超时，服务器响应时间过长';
      } else if (error.message.includes('401')) {
        message = '授权失败，请重新登录';
      }
      
      return {
        success: false,
        error: message,
        folders: [],
        files: [],
        all: []
      };
    }
  },
  
  /**
   * 创建文件夹
   * @param {string} path - 文件夹路径
   * @returns {Promise<Object>} 创建结果
   */
  async createFolder(path) {
    try {
      const bucketName = 'cloud-storage';
      
      // Supabase Storage 没有直接创建文件夹的API
      // 创建一个空的 .folder 文件来模拟文件夹
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(`${path}/.folder`, new Blob(['']), {
          contentType: 'application/x-directory',
          upsert: true
        });
      
      if (error) throw error;
      
      return {
        success: true,
        path,
        metadata: data
      };
    } catch (error) {
      console.error('创建文件夹失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * 获取文件的签名URL
   * @param {string} path - 文件路径
   * @param {number} expiresIn - 链接有效期（秒）
   * @returns {Promise<string|null>} 签名URL
   */
  async getSignedUrl(path, expiresIn = 60 * 60 * 24) {
    try {
      const bucketName = 'cloud-storage';
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(path, expiresIn);
      
      if (error) throw error;
      
      return data?.signedUrl || null;
    } catch (error) {
      console.error('获取签名URL失败:', error.message);
      return null;
    }
  },
  
  /**
   * 获取存储使用统计
   * @returns {Promise<Object>} 使用统计
   */
  async getStorageStats() {
    try {
      const bucketName = 'cloud-storage';
      
      // 获取存储桶信息
      const { data, error } = await supabase.storage.getBucket(bucketName);
      
      if (error) throw error;
      
      // 列出所有文件
      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list('', { recursive: true });
      
      if (listError) throw listError;
      
      // 计算总大小
      const totalSize = files.reduce((sum, file) => {
        return sum + (file.metadata?.size || 0);
      }, 0);
      
      return {
        success: true,
        bucketSize: totalSize,
        fileCount: files.length,
        bucketInfo: data
      };
    } catch (error) {
      console.error('获取存储统计失败:', error.message);
      return {
        success: false,
        error: error.message,
        bucketSize: 0,
        fileCount: 0
      };
    }
  },
  
  /**
   * 检查 S3 连接配置是否有效
   * @returns {boolean} 配置是否有效
   */
  isS3ConfigValid() {
    return S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY && S3_ENDPOINT;
  },
  
  /**
   * 获取 S3 连接信息
   * @returns {Object} S3 连接信息
   */
  getS3ConnectionInfo() {
    return {
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      accessKeyId: S3_ACCESS_KEY_ID,
      // 不返回密钥的实际值，只返回是否已配置
      secretAccessKeyConfigured: !!S3_SECRET_ACCESS_KEY
    };
  },
  
  /**
   * 配置 S3 密钥 (安全地存储在内存中，不持久化)
   * @param {string} secretKey - S3 密钥
   * @returns {boolean} 配置是否成功
   */
  setS3SecretKey(secretKey) {
    if (!secretKey) {
      console.error('S3 密钥不能为空');
      return false;
    }
    
    try {
      // 在生产环境中应该使用更安全的方式存储密钥
      // 这里仅用于演示
      window._s3SecretKey = secretKey;
      console.log('S3 密钥已配置');
      return true;
    } catch (error) {
      console.error('S3 密钥配置失败:', error);
      return false;
    }
  },
  
  /**
   * 通过 S3 协议上传文件
   * @param {File} file - 要上传的文件
   * @param {string} path - 存储路径
   * @param {Function} progressCallback - 进度回调函数
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFileViaS3(file, path = '', progressCallback = null) {
    // 检查网络连接
    if (!navigator.onLine) {
      return {
        success: false,
        error: '当前处于离线状态，无法上传文件'
      };
    }
    
    // 检查 S3 配置
    if (!this.isS3ConfigValid() && !window._s3SecretKey) {
      return {
        success: false,
        error: '未配置 S3 密钥，无法使用 S3 协议上传'
      };
    }
    
    // 如果浏览器支持 AWS SDK，可以使用 AWS SDK 上传
    // 此处为示例代码，实际使用时需要引入 AWS SDK
    try {
      const bucketName = 'cloud-storage';
      const filePath = path ? `${path}/${file.name}` : file.name;
      
      console.log(`准备通过 S3 协议上传文件: ${filePath}`);
      
      // 示例：使用 fetch 手动构建 S3 请求
      // 实际应用中应使用 AWS SDK for JavaScript
      
      console.log('S3 上传功能需要引入 AWS SDK 以实现完整功能');
      console.log('以下是使用 S3 的连接信息:');
      console.log(`- 端点: ${S3_ENDPOINT}`);
      console.log(`- 区域: ${S3_REGION}`);
      console.log(`- 访问密钥 ID: ${S3_ACCESS_KEY_ID}`);
      console.log(`- 存储桶: ${bucketName}`);
      console.log(`- 文件路径: ${filePath}`);
      
      // 使用普通上传方法作为备选
      console.log('正在使用标准 Supabase Storage API 上传文件...');
      return await this.uploadFile(file, path, progressCallback);
      
    } catch (error) {
      console.error('通过 S3 协议上传文件失败:', error.message);
      let message = error.message;
      
      // 友好的错误信息
      if (error.message.includes('network')) {
        message = '网络连接失败，请检查您的网络连接';
      } else if (error.message.includes('timeout')) {
        message = '请求超时，服务器响应时间过长';
      } else if (error.message.includes('credentials')) {
        message = 'S3 认证失败，请检查访问密钥';
      }
      
      return {
        success: false,
        error: message
      };
    }
  },
  
  /**
   * 通过 S3 协议下载文件
   * @param {string} path - 文件路径
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFileViaS3(path) {
    // 检查网络连接
    if (!navigator.onLine) {
      return {
        success: false,
        error: '当前处于离线状态，无法下载文件'
      };
    }
    
    // 检查 S3 配置
    if (!this.isS3ConfigValid() && !window._s3SecretKey) {
      console.log('S3 配置不完整，使用标准下载方法');
      return await this.downloadFile(path);
    }
    
    try {
      console.log(`准备通过 S3 协议下载文件: ${path}`);
      console.log('S3 下载功能需要引入 AWS SDK 以实现完整功能');
      
      // 使用普通下载方法作为备选
      console.log('正在使用标准 Supabase Storage API 下载文件...');
      return await this.downloadFile(path);
      
    } catch (error) {
      console.error('通过 S3 协议下载文件失败:', error.message);
      let message = error.message;
      
      // 友好的错误信息
      if (error.message.includes('network')) {
        message = '网络连接失败，请检查您的网络连接';
      } else if (error.message.includes('timeout')) {
        message = '请求超时，服务器响应时间过长';
      } else if (error.message.includes('credentials')) {
        message = 'S3 认证失败，请检查访问密钥';
      }
      
      return {
        success: false,
        error: message
      };
    }
  },

  /**
   * 获取存储服务类型和状态
   * @returns {Object} 存储服务信息
   */
  getStorageInfo() {
    const supportsS3 = this.isS3ConfigValid() || !!window._s3SecretKey;
    
    return {
      primaryService: 'Supabase Storage',
      s3Compatible: true,
      s3Configured: supportsS3,
      endpoint: STORAGE_ENDPOINT,
      s3Endpoint: S3_ENDPOINT,
      region: STORAGE_REGION,
      online: navigator.onLine
    };
  }
};

// 导出 Supabase 客户端以便需要时使用
export default supabase; 