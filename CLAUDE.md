# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Development Server
```bash
npm run dev
```
Starts Vite dev server at http://localhost:5173 with hot-reload. Requires CORS configuration in ChurchTools admin settings under "System Settings" > "Integrations" > "API" > "Cross-Origin Resource Sharing".

### Build for Production
```bash
npm run build
```
Compiles TypeScript and builds production bundle to `dist/`.

### Preview Production Build
```bash
npm run preview
```
Tests the production build locally before deployment.

### Package for ChurchTools Deployment
```bash
npm run deploy
```
Builds the extension and creates a versioned ZIP file in `releases/` directory. The ZIP filename includes project name, version from package.json, and git commit hash.

## High-Level Architecture

### ChurchTools Extension System

This is a **ChurchTools extension** that runs in the ChurchTools web interface. The extension uses:
- `VITE_KEY` environment variable as the extension identifier
- Vite's base path configuration: `/ccm/${VITE_KEY}/` (see vite.config.ts)
- ChurchTools client library for API authentication and requests

### Authentication Flow

The extension handles authentication differently in dev vs production:
- **Development**: Automatically logs in using `VITE_USERNAME` and `VITE_PASSWORD` from .env (see main.ts:39-43)
- **Production**: Uses existing ChurchTools session (no credentials needed)
- Base URL is read from `window.settings.base_url` (production) or `VITE_BASE_URL` (development)

### Application Flow

1. **Initialization** (main.ts:initApp)
   - Parallel fetch: current user, calendars, and appointment tags
   - Renders UI with calendar/tag selection, time range, and export options

2. **Form Submission** (main.ts:handleFormSubmit)
   - Fetches appointments for selected calendars and date range
   - Applies filters: visibility (public/private/all) and tags
   - Generates PDF or Excel based on button clicked

3. **PDF Generation** (pdf/CalendarBuilder.ts)
   - Uses pdfmake library with custom grid layout
   - GridCalculator computes cell dimensions based on page size/orientation
   - CalendarEntry models appointments with multi-day support
   - Supports calendar colors with automatic contrast text
   - Optional legend showing calendar categories

4. **Excel Export** (xlsx/ExcelExporter.ts)
   - Uses ExcelJS to create spreadsheet with appointment details
   - Hyperlinks for URLs and images
   - Auto-filter and alternating row colors by month

### Key-Value Store System

The extension includes a sophisticated KV storage wrapper (utils/kv-store.ts) for persisting data in ChurchTools. See key-value-store.md for comprehensive documentation.

**Storage hierarchy:**
```
Extension Module (identified by VITE_KEY)
└── Data Categories (organize related data, e.g., "settings", "cache")
    └── Data Values (JSON key-value pairs)
```

**Important KV Store Notes:**
- All data values are stored as JSON strings
- Use `getOrCreateModule()` in development (auto-creates module if missing)
- Use `getModule()` in production (module created during extension installation)
- All KV functions accept optional `moduleId` parameter (defaults to current extension)
- Category functions use "shorty" (short name) for lookups
- `createCustomDataValue()` returns the created value object with its ID

### Type System

ChurchTools API types are defined in:
- `utils/ct-types.d.ts` - Core ChurchTools types (Person, CustomModule, etc.)
- `types/calendar.types.ts` - Calendar-specific types (CTCalendar, CTAppointment, etc.)

The ChurchTools client returns data in two formats:
```typescript
// Wrapped response
{ data: CTCalendar[] }

// Direct response
CTCalendar[]
```

API wrappers handle both: `response.data ?? response` (see services/churchtools-api.ts)

### Date Handling

Date utilities (utils/date-utils.ts) provide:
- `calculateDateRange()` - Converts TimeRange enum to start/end dates and month list
- `formatMonthYear()` - German month/year formatting
- Calendar grid calculations (first day of week, weeks in month, etc.)

German locale constants: `DAY_NAMES_DE`, `MONTH_NAMES_DE`

### PDF Grid System

CalendarBuilder uses a sophisticated grid layout:
1. **Page dimensions** calculated by GridCalculator based on page size/orientation
2. **Week grid** computed with margins (top for title, bottom for legend)
3. **Cell placement** handles multi-day appointments with continuation markers
4. **Color system** uses ColorUtils for hex/RGB conversion and contrast calculation

Multi-day appointments span cells horizontally and show continuation indicators when spanning weeks.

### Safari Cookie Issue

Safari has stricter cookie handling than Chrome for cross-origin requests. Solutions:
1. Use Vite proxy to route API calls through local dev server
2. Run dev server with HTTPS using mkcert

## Important Patterns

### Parallel Data Loading
Fetch independent data concurrently:
```typescript
const [user, calendars, tags] = await Promise.all([
  churchtoolsClient.get('/whoami'),
  fetchCalendars(),
  fetchAppointmentTags(),
]);
```

### ChurchTools API Date Format
API expects dates as `YYYY-MM-DD`:
```typescript
function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}
```

### Appointment Filtering
Appointments are filtered in sequence:
1. Visibility filter (public/private/all)
2. Tag filter (if tags selected)
3. Sort by start date

### Form Data Extraction
Multi-select checkboxes use `FormData.getAll()`:
```typescript
const selectedCalendarIds = formData.getAll('calendars').map(Number);
```

### Environment Variables
All environment variables must be prefixed with `VITE_` to be accessible in the application (Vite requirement).
