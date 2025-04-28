# Web 应用导航中心

这是一个模拟的 Web 应用导航中心，包含多个常用应用的演示。

## 项目结构

```
project-root/
├── index.html           ← 主页，应用导航页面
├── README.md            ← 项目说明文档
└── pages/               ← 存放各个"应用"的目录
    ├── apps.json        ← 应用列表清单
    ├── common/          ← 共享资源目录
    │   ├── style.css    ← 共享样式
    │   └── app.js       ← 共享JavaScript功能
    ├── mail/            ← 应用 1：邮件
    │   ├── index.html   ← 邮件应用页面
    │   └── icon.png     ← 邮件应用图标
    ├── contacts/        ← 应用 2：通讯录
    │   ├── index.html   ← 通讯录应用页面
    │   └── icon.png     ← 通讯录应用图标
    ├── calendar/        ← 应用 3：日历
    │   ├── index.html   ← 日历应用页面
    │   └── icon.png     ← 日历应用图标
    ├── photos/          ← 应用 4：照片
    │   ├── index.html   ← 照片应用页面
    │   └── icon.png     ← 照片应用图标
    └── todo/            ← 应用 5：待办事项
        ├── index.html   ← 待办事项应用页面
        └── icon.png     ← 待办事项应用图标
```

## 功能特点

- 响应式设计：适配各种屏幕尺寸
- 主题支持：提供浅色和深色主题
- 模块化结构：每个应用独立封装
- 共享组件：通用样式和功能封装，便于扩展
- 无外部依赖：除部分 Bootstrap Icons 外，不依赖外部库

## 开发指南

### 添加新应用

1. 在 `pages` 目录下创建新的应用目录
2. 添加 `index.html` 和 `icon.png` 文件
3. 在 `pages/apps.json` 中添加应用信息
4. 引入共享组件：

```html
<link rel="stylesheet" href="../common/style.css">
<script src="../common/app.js"></script>
```

### 应用配置结构

在 `apps.json` 中添加新应用的配置：

```json
{
    "id": "app-id",
    "name": "应用名称",
    "description": "应用描述",
    "icon": "icon.png",
    "path": "app-id/index.html"
}
```

## 使用说明

1. 直接打开 `index.html` 访问应用中心
2. 点击应用卡片进入相应应用
3. 点击应用内的返回按钮回到主页
4. 点击右上角的主题按钮切换深色/浅色主题

## 技术栈

- HTML5
- CSS3（变量、Flexbox、Grid）
- 原生 JavaScript (ES6+)
- 响应式设计
- 浅色/深色主题支持 