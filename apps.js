export async function getAppDirectories() {
    return [
        {id:'mail',name:'邮件',path:'mail/index.html'},
        {id:'contacts',name:'联系人',path:'contacts/index.html'},
        {id:'photos',name:'照片',path:'photos/index.html'},
        {id:'calendar',name:'日历',path:'calendar/index.html'},
        {id:'todo',name:'待办事项',path:'todo/index.html'},
        {id:'todo',name:'测试',path:'test/index.html'},
        {id:'cloud',name:'云盘',path:'cloud/index.html'}
    ];
}
