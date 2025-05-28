# Guide: Adding a New Application

This guide explains how to add a new application to the Web Application Navigation Center. The process involves creating the application's files and then registering it with the main navigation system.

Follow these steps:

## 1. Create the Application Directory

First, you need to create a new directory for your application within the `pages/` directory. The name of this directory should ideally be a short, descriptive identifier for your application (this will often match the `app-id`).

For example, if you are creating a "Notes" application, you might create:

```
project-root/
└── pages/
    └── notes/       <-- Your new application directory
```

Inside this directory (`pages/notes/`), you will place all the files for your new application, such as its main HTML file, CSS stylesheets, and JavaScript files. At a minimum, you will need an `index.html` file for the application.

```
project-root/
└── pages/
    └── notes/
        └── index.html  <-- Main file for your new "Notes" app
        └── style.css   <-- (Optional) Styles for your "Notes" app
        └── script.js   <-- (Optional) JavaScript for your "Notes" app
```

## 2. Add Application Information to `apps.js`

Next, you need to inform the navigation center about your new application. This is done by adding an entry to the `apps.js` file.

Open `apps.js` and add a new object to the array returned by the `getAppDirectories` function. This object must have the following structure:

```javascript
{
  id: 'your-app-id',       // A unique identifier (e.g., 'notes')
  name: 'Your App Name',   // The display name (e.g., '笔记应用' or 'Notes App')
  path: 'your-app-id/index.html' // Path to the app's entry HTML file, relative to 'pages/'
}
```

**Breakdown of the fields:**

*   `id`: This is a unique string that identifies your application. It's good practice to make this the same as your application's directory name. This ID is used internally, for example, to locate the `icon.svg`.
*   `name`: This is the human-readable name that will be displayed below the application's icon in the navigation center.
*   `path`: This specifies the path to the main HTML file of your application, relative to the `pages/` directory. Typically, this will be `your-app-id/index.html`.

**Example:**

If you created a "Notes" app in the `pages/notes/` directory, you would add the following to the array in `apps.js`:

```javascript
// In apps.js
export async function getAppDirectories() {
    return [
        // ... other existing applications ...
        {id:'mail',name:'邮件',path:'mail/index.html'},
        {id:'contacts',name:'联系人',path:'contacts/index.html'},
        // Add your new application here:
        {id:'notes', name:'笔记应用', path:'notes/index.html'}
    ];
}
```

## 3. Create an Application Icon (Recommended)

For your application to display nicely in the navigation center, it's highly recommended to provide an SVG icon.

*   Create an `icon.svg` file.
*   Place this file inside your application's directory (e.g., `pages/notes/icon.svg`).

The navigation center will automatically try to load `./pages/your-app-id/icon.svg`. If this icon is not found, a fallback UI (a colored tile with the first letter of the application's name) will be displayed.

## 4. Introduce Shared Components (Optional)

The `README.md` mentions a "共享组件系统" (Shared component system) and a potential `common/` directory within `pages/` for such components. While this system might not be fully implemented yet (the `common/` directory was not observed in the initial file listing), if you are developing components that could be reused across multiple applications, consider this structure for future maintainability.

This step is more about architectural consideration as your application or the suite of applications grows.

---

Once these steps are completed, your new application should appear in the Web Application Navigation Center when you next load or refresh `index.html`.
