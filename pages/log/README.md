# 日志应用 - 实时订阅功能

## 🚀 功能特性

- ✅ **实时同步** - 任何数据库更新立即反映在界面上
- ✅ **智能重试** - 网络问题时自动重连，无需手动刷新
- ✅ **移动端优化** - 针对手机端网络不稳定进行专门优化
- ✅ **状态指示** - 清晰显示连接状态和操作结果
- ✅ **离线友好** - 网络恢复时自动重连实时订阅

## 📡 实时订阅配置

### 1. Supabase 后台设置

确保在 Supabase 项目中：
- 开启实时订阅功能
- `logs` 表启用 Row Level Security (RLS)
- 匿名用户有适当的读取权限

### 2. SQL 权限设置

```sql
-- 启用实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE logs;

-- 设置行级安全策略
CREATE POLICY "允许匿名用户读取日志" ON logs
FOR SELECT USING (true);

CREATE POLICY "允许匿名用户插入日志" ON logs
FOR INSERT WITH CHECK (true);

CREATE POLICY "允许匿名用户更新日志" ON logs
FOR UPDATE USING (true);

CREATE POLICY "允许匿名用户删除日志" ON logs
FOR DELETE USING (true);
```

## 🔧 调试工具

在浏览器控制台中运行以下命令：

```javascript
// 查看实时订阅状态
debugRealtime()

// 手动重新连接
logManager.setupRealtime()

// 检查网络状态
console.log('网络状态:', connectionManager.isOnline)
```

## 📱 移动端优化

- **心跳间隔**: 30秒（桌面端为默认值）
- **重试策略**: 指数退避，最大30秒间隔
- **连接超时**: 15秒，防止长时间等待
- **网络恢复**: 延迟1秒重连，确保网络稳定

## 🚨 常见问题

### 实时同步不工作
1. 检查控制台是否有错误信息
2. 运行 `debugRealtime()` 查看连接状态
3. 确认 Supabase 项目实时订阅权限
4. 检查网络连接状态

### 手机端连接不稳定
- 应用已自动优化移动端参数
- 网络恢复时会自动重连
- 观察右上角状态指示器

### 权限问题
- 确保匿名用户有 logs 表的读写权限
- 检查 RLS 策略是否正确配置

## 📊 状态指示器

- 🟢 **绿色圆点** + "实时同步" = 连接正常
- ⚪ **灰色圆点** + "同步断开" = 连接断开

状态指示器会在页面右上角显示，连接成功后10秒自动隐藏。