# ChurchTools PDF Calendar Extension

A ChurchTools extension that generates printable PDF calendars and Excel exports from your ChurchTools calendar appointments.

## Features

- **PDF Calendar Generation**
  - Monthly calendar grid layout with appointments
  - Support for multiple months (year view with 12 pages)
  - Page sizes: A2, A3, A4, A5
  - Landscape and portrait orientation
  - Calendar colors with automatic contrast text
  - Legend showing calendar categories
  - Multi-day event support with continuation markers

- **Excel Export**
  - Full appointment details in spreadsheet format
  - Hyperlinks for URLs and images
  - Auto-filter enabled
  - Alternating row colors for different months

- **Filtering Options**
  - Select specific calendars
  - Filter by tags
  - Visibility filter (public/private/all)
  - Time range selection (current/previous/next month, full year)

## Technology Stack

- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **pdfmake** - PDF generation
- **ExcelJS** - Excel file generation
- **@churchtools/churchtools-client** - Official ChurchTools API client

## Project Structure

```
src/
├── main.ts                    # Application entry point and UI
├── types/
│   └── calendar.types.ts      # TypeScript type definitions
├── services/
│   └── churchtools-api.ts     # ChurchTools API wrapper
├── utils/
│   ├── date-utils.ts          # Date calculation utilities
│   ├── ct-types.ts            # ChurchTools type definitions
│   └── reset.css              # Development CSS reset
├── pdf/
│   ├── CalendarBuilder.ts     # PDF calendar generator
│   ├── CalendarEntry.ts       # Calendar entry data model
│   ├── ColorUtils.ts          # Color conversion utilities
│   └── GridCalculator.ts      # Grid layout calculations
├── xlsx/
│   └── ExcelExporter.ts       # Excel export functionality
└── styles/
    └── calendar.css           # Application styles
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A ChurchTools instance with API access

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd churchtools-pdfcalendar-extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment configuration:
   ```bash
   cp .env-example .env
   ```

4. Configure `.env` with your ChurchTools credentials:
   ```env
   VITE_BASE_URL=https://your-instance.church.tools
   VITE_USERNAME=your-username
   VITE_PASSWORD=your-password
   VITE_KEY=your-extension-key
   ```

### Development

Start the development server with hot-reload:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

> **Note:** Configure CORS in your ChurchTools instance to allow requests from
> `http://localhost:5173`. This can be done in ChurchTools admin settings under:
> "System Settings" > "Integrations" > "API" > "Cross-Origin Resource Sharing"

### Building for Production

Create a production build:

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

Test the production build locally:

```bash
npm run preview
```

### Package for Deployment

Build and package the extension for ChurchTools deployment:

```bash
npm run deploy
```

The deployment package will be created in the `releases/` directory.

## Deployment to ChurchTools

1. Run `npm run deploy` to create the deployment package
2. Upload the package from `releases/` to your ChurchTools instance
3. Configure the extension in ChurchTools admin settings

## Configuration Options

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_BASE_URL` | Your ChurchTools instance URL |
| `VITE_USERNAME` | Username for development login |
| `VITE_PASSWORD` | Password for development login |
| `VITE_KEY` | Extension key for ChurchTools |

### Calendar Options (UI)

| Option | Description |
|--------|-------------|
| Calendars | Select which calendars to include |
| Tags | Filter appointments by tags (optional) |
| Time Range | Current/Previous/Next month or Full year |
| Page Size | A2, A3, A4, A5 |
| Orientation | Landscape or Portrait |
| Visibility | Public only, Private only, or All |
| Show End Time | Display appointment end times |
| Use Colors | Apply calendar colors to entries |
| Show Legend | Display calendar color legend |

## Development Notes

### Safari Cookie Issues

If login works in Chrome but not Safari, Safari has stricter cookie handling. Solutions:

1. Use a Vite proxy so API calls go through your local server
2. Run dev server with HTTPS using [mkcert](https://github.com/FiloSottile/mkcert)

### Bundle Size

The production bundle is ~3.2MB due to pdfmake and ExcelJS. Consider code-splitting
with dynamic imports if this becomes an issue.

## API Dependencies

This extension uses the following ChurchTools API endpoints:

- `GET /whoami` - Get current user
- `GET /calendars` - List available calendars
- `GET /calendars/appointments` - Fetch appointments
- `GET /calendars/appointments/tags` - Get appointment tags

## License

[Add your license here]

## Support

For questions about the ChurchTools API, visit the [ChurchTools Forum](https://forum.church.tools).
