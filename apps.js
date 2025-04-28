/**
 * apps.js
 * 
 * 该文件提供了获取应用目录列表的功能
 * 首先尝试从API获取应用列表，如果API不可用，则从本地JSON文件获取
 */

/**
 * 获取应用目录列表
 * @returns {Promise<Array>} 应用目录列表的Promise对象
 */
async function getAppDirectories() {
  // 首先尝试从API获取数据
  try {
    console.log('尝试从API获取应用目录列表...');
    const response = await fetch('api/get-app-directories.php');
    
    // 检查响应状态
    if (!response.ok) {
      throw new Error(`API请求失败，状态码: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 检查返回的数据是否有效
    if (data && Array.isArray(data.apps)) {
      console.log('成功从API获取应用目录列表');
      return data.apps;
    } else {
      throw new Error('API返回的数据格式不正确');
    }
  } catch (error) {
    // API请求失败，尝试从本地JSON文件获取数据
    console.warn(`从API获取应用目录失败: ${error.message}`);
    console.log('尝试从本地JSON文件获取应用目录列表...');
    
    try {
      const response = await fetch('./pages/apps.json');
      
      if (!response.ok) {
        throw new Error(`无法加载本地JSON文件，状态码: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data.apps)) {
        console.log('成功从本地JSON文件获取应用目录列表');
        return data.apps;
      } else {
        throw new Error('本地JSON文件的数据格式不正确');
      }
    } catch (localError) {
      // 如果本地JSON也失败，返回空数组
      console.error(`从本地JSON获取应用目录失败: ${localError.message}`);
      console.error('无法获取应用目录列表，返回空数组');
      return [];
    }
  }
}

// 导出函数以便其他模块使用
export { getAppDirectories }; 