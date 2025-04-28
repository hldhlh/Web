<?php
/**
 * API端点：获取应用目录列表
 * 返回应用目录的JSON数据
 */

// 设置响应头为JSON
header('Content-Type: application/json');

// 应用列表数据
$appData = [
    'apps' => [
        [
            'id' => 'mail',
            'name' => '邮件',
            'description' => '处理您的电子邮件',
            'path' => 'mail/index.html'
        ],
        [
            'id' => 'contacts',
            'name' => '通讯录',
            'description' => '管理您的联系人',
            'path' => 'contacts/index.html'
        ],
        [
            'id' => 'calendar',
            'name' => '日历',
            'description' => '安排您的日程',
            'path' => 'calendar/index.html'
        ],
        [
            'id' => 'photos',
            'name' => '照片',
            'description' => '浏览您的照片',
            'path' => 'photos/index.html'
        ],
        [
            'id' => 'todo',
            'name' => '待办事项',
            'description' => '管理您的任务',
            'path' => 'todo/index.html'
        ],
        [
            'id' => 'cloud',
            'name' => '云盘',
            'description' => '管理您的文件',
            'path' => 'cloud/index.html'
        ]
    ]
];

// 输出JSON
echo json_encode($appData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?> 