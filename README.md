# MBOX Viewer

<div style="display: flex; justify-content: center;">
  <img src="./public/logo.png" alt="logo" width="128" height="128" />
</div>

A modern, fast, and privacy-focused MBOX file viewer that runs directly in your browser.

## Key Features

- **Client-Side Processing**: All MBOX file parsing and rendering is done in the browser. Your files are never uploaded to a server, ensuring your data remains private.
- **Modern UI**: A clean and modern interface built with Shadcn/ui and Tailwind CSS.
- **HTML Email Rendering**: Accurately renders HTML emails, including attachments and inline images.
- **Bulk Message Export**: Select messages across paginated results and export them as MBOX, TXT, or HTML (with optional attachment bundles).
- **Multiple File Import**: Import many MBOX files at once with drag-and-drop or file picker multi-select.
- **File Management**: Rename imported files directly from the Files sidebar.
- **PWA Support**: Install the viewer as a Progressive Web App with offline-ready app shell caching.
- **i18n Support**: Internationalization support with English and Italian locales.

### Viewer Productivity Highlights

- **Search worker progress**: Live search progress percentage and progress bar while scanning large files.
- **Export progress & cancellation**: Real-time export progress in the export dialog with cancellable long-running exports.
- **Bulk selection shortcuts**:
  - `Ctrl/Cmd + A` → toggle filtered selection
  - `Shift + Ctrl/Cmd + A` → clear selection
  - `Shift + Esc` → reset active search/label filters
  - `Esc` → clear current previewed message
  - `?` (`Shift + /`), `F1`, or `Help` → open shortcuts help
- **Keyboard navigation**:
  - `↑ / ↓` → move preview selection through visible messages
  - `← / →` → move focus across visible label-filter chips
  - `Home / End` → jump to first/last label chip or menu item (when a dropdown menu is open)

## Tech Stack

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Bun](https://bun.sh/)

## Getting Started

### Prerequisites

This project uses [Bun](https://bun.sh/docs/installation) as package manager.

### Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/dan5py/mbox-viewer.git
   cd mbox-viewer
   ```

2. Install the dependencies:

   ```sh
   bun install
   ```

3. Run the development server:

   ```sh
   bun dev
   ```

Navigate to <http://localhost:3000> to view the app.

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue for it.
Thank you!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feat/new-feature`)
3. Run `bun run format` to format the code
4. Run `bun run lint` to check for linting errors
5. Commit your Changes (`git commit -m 'feat: add new feature'`)
6. Push to the Branch (`git push origin feat/new-feature`)
7. Open a Pull Request

### Commit Messages

We use [Commitlint](https://commitlint.js.org/) to enforce commit message conventions.

## License

Distributed under the MIT License. See `LICENSE` for more information.
