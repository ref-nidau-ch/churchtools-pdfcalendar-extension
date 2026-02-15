# Changelog

## 0.9.7 (2026-02-15)

### Features
- Display ChurchTools site logo on the left side of the PDF calendar title row
- Logo is fetched from `/api/config` (`site_logo` field) and embedded as base64
- Gracefully skipped when no logo is configured

## 0.9.6 (2026-02-15)

### Dependencies
- Upgraded pdfmake from 0.2.23 to 0.3.4 (promise-based API, smaller bundle)
- Upgraded @types/pdfmake from 0.2.x to 0.3.x

## 0.9.5 (2026-02-15)

### Improvements
- Vertically center timestamp with calendar title in header row
- Legend cells use equal widths with last cell filling remaining space

## 0.9.4 (2026-02-15)

### Improvements
- Reduced page margins for more calendar space (10mm → 5mm)
- Added app version to PDF metadata
- Inject version from package.json via Vite build-time define

## 0.9.3 (2026-02-15)

### Improvements
- Entry backgrounds now extend edge-to-edge (no white border around entries)
- Day numbers rendered behind entries with zero flow height for tighter layout
- Full weekday names (Montag, Dienstag...) on A4 and larger page sizes
- Black calendar grid borders for sharper appearance
- Vertically centered weekday names in header row
- Separator line shown below last entry in each cell

### Dependencies
- Updated @churchtools/churchtools-client to 1.6.0
- Updated typescript to 5.9.3
- Updated vite to 7.3.1

## 0.9.2 (2026-02-15)

### Improvements
- Calendar entry backgrounds now fill the full width of the cell
- Added light gray separator borders between entries within the same day cell
- Reduced overall calendar and legend grid border width for a cleaner look

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
