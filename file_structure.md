# Project File and Directory Organization

This document outlines the structure of the Web Application Navigation Center project.

## Key Files and Directories:

*   **`index.html`**: This is the main entry point of the application. It serves as the homepage that users first land on and from which they can navigate to other applications.

*   **`apps.js`**: This JavaScript file holds the configuration for the various applications that are part of the navigation center. It likely defines attributes for each app, such as its ID, display name, path to its entry point, and potentially its icon. The `README.md` indicates this file is used to "add application information."

*   **`pages/`**: This directory is the central hub for all the individual demo applications.
    *   Each application resides in its own subdirectory within `pages/` (e.g., `pages/mail/`, `pages/contacts/`, `pages/calendar/`).
    *   Typically, each application subdirectory contains:
        *   `index.html`: The main HTML file for that specific application.
        *   `icon.svg`: An SVG image file used as the icon for the application in the navigation center.
    *   Some application subdirectories may also contain their own specific CSS (`style.css`) and JavaScript (`script.js`) files, as seen with `pages/cloud/`.
    *   The `README.md` mentions a `common/` subdirectory for shared components, though it's not present in the current `ls` output. It also mentions `settings/` and `help/` directories which are also not present.

*   **`README.md`**: This Markdown file provides general information about the project, including its structure (as referenced for this document), features, instructions for adding new applications, and the technology stack used.

*   **`project_summary.md`**: This file (created in a previous step) contains a high-level summary of the project's goals and core functionality.

## General Structure Observations:

The project follows a modular structure where the main navigation shell (`index.html`, `apps.js`) is separate from the individual applications housed within the `pages/` directory. This organization makes it easier to manage and add new applications. The `README.md` confirms this modular approach, stating "each application independent封装" (each application is independently encapsulated).
