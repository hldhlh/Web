# 云盘应用 Supabase 存储集成指南

本文档指导您如何在云盘应用中配置和使用 Supabase 存储服务。

## 准备工作

1. 创建 Supabase 账户和项目
2. 配置存储权限
3. 设置存储桶和规则
4. 更新配置文件

## 创建 Supabase 账户和项目

1. 访问 [Supabase 官网](https://supabase.com/) 并注册账户
2. 登录后，点击"New Project"创建一个新项目
3. 为项目填写名称、密码和区域信息
4. 等待项目创建完成（可能需要几分钟）

## 获取项目配置信息

创建项目后，您需要获取以下信息来配置云盘应用：

1. 在项目设置中找到 API 部分
2. 复制 **Project URL** 和 **anon/public** API 密钥

## 配置存储权限

为了确保存储功能正常工作，您需要配置适当的存储权限：

1. 在 Supabase 仪表盘中，点击左侧菜单的"Storage"
2. 点击"Policies"标签页
3. 为您的存储桶创建以下策略：

### 文件读取权限（适用于公共访问）

```sql
-- 允许所有用户读取文件
(bucket_id = 'cloud-storage'::text)
```

### 文件写入权限（可限制为认证用户）

```sql
-- 允许所有用户上传文件（简化示例）
(bucket_id = 'cloud-storage'::text)
```

## 更新配置文件

打开 `pages/common/supabase.js` 文件，并用您的 Supabase 项目信息更新以下内容：

```javascript
// Supabase 项目 URL 和 公共匿名密钥（仅限公共数据访问）
const SUPABASE_URL = 'YOUR_SUPABASE_URL';  // 替换为您的项目 URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';  // 替换为您的 anon/public 密钥
```

## 使用注意事项

### 存储桶

应用将自动创建名为 `cloud-storage` 的存储桶。如果您想使用不同的存储桶名称，您需要修改 `supabase.js` 文件中的 `bucketName` 变量。

### 文件大小限制

默认情况下，Supabase 限制每个文件的大小为 50MB。如果您需要上传更大的文件，请检查您的计划限制并在 Supabase 管理面板中调整设置。

### 存储容量

Supabase 免费计划提供 1GB 的存储空间。如果您需要更多存储空间，您可能需要升级到付费计划。

## 故障排除

### 连接问题

如果出现"存储服务初始化失败"错误，请检查：

1. `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 是否正确
2. 您的网络连接是否正常
3. Supabase 服务是否可用（可在 [状态页面](https://status.supabase.com/) 查看）

### 上传/下载问题

如果文件上传或下载失败，请检查：

1. 存储桶是否存在
2. 存储策略是否正确配置
3. 文件大小是否超过限制

## 进一步改进

如果您希望增强云盘应用的功能，可以考虑：

1. 添加用户认证系统
2. 实现文件版本控制
3. 添加文件共享功能
4. 实现全文搜索
5. 添加文件预览功能 