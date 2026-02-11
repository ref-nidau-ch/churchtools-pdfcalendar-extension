# Changelog

## 0.9.0 (2026-02-11)

### Features
- PDF calendar generation with monthly grid layout and multi-day event support
- Excel export with appointment details, hyperlinks, and auto-filter
- Calendar and tag selection with "select all" checkboxes
- Time range selection: current/previous/next month or full year (12 pages)
- Page sizes: A2, A3, A4, A5 in landscape or portrait orientation
- Calendar colors with automatic contrast text and optional legend
- Visibility filter (public/private/all) based on appointment `isInternal` flag
- Form settings persistence via localStorage (restored on next visit)
- PDF metadata (title, author, keywords)
- Adaptive PDF font sizing to fit content within page grid

### Infrastructure
- Cross-platform deploy script using `archiver` (works on Windows and Linux)
- Vite-based build with TypeScript
- ChurchTools extension packaging with versioned ZIP output
