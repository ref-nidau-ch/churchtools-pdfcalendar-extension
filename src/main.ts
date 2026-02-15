/**
 * PDF Calendar Generator - ChurchTools Extension
 * Main Entry Point
 */

import type { Person } from './utils/ct-types';
import { churchtoolsClient, activateLogging, LOG_LEVEL_DEBUG } from '@churchtools/churchtools-client';
import {
  fetchCalendars,
  fetchAppointments,
  fetchAppointmentTags,
  filterAppointmentsByVisibility,
  filterAppointmentsByTags,
  sortAppointments,
} from './services/churchtools-api';
import { calculateDateRange, formatMonthYear } from './utils/date-utils';
import { exportToExcel, downloadBlob, generateFilename } from './xlsx/ExcelExporter';
import { CalendarBuilder, generatePdfFilename, downloadBlob as downloadPdfBlob } from './pdf/CalendarBuilder';
import type { CTCalendar, CTTag, CTAppointment, VisibilityFilter, TimeRange, MonthYear, UserSettings } from './types/calendar.types';
import './styles/calendar.css';

// Load reset CSS and activate request logging only in development mode
if (import.meta.env.MODE === 'development') {
  import('./utils/reset.css');
  activateLogging(LOG_LEVEL_DEBUG);
}

declare const window: Window &
  typeof globalThis & {
    settings: {
      base_url?: string;
    };
  };

// Configure ChurchTools Client
const baseUrl = window.settings?.base_url ?? import.meta.env.VITE_BASE_URL;
churchtoolsClient.setBaseUrl(baseUrl);

// Login in development mode
const username = import.meta.env.VITE_USERNAME;
const password = import.meta.env.VITE_PASSWORD;
if (import.meta.env.MODE === 'development' && username && password) {
  await churchtoolsClient.post('/login', { username, password });
}

// Export extension key
const KEY = import.meta.env.VITE_KEY;
export { KEY };

// App version injected by Vite at build time
declare const __APP_VERSION__: string;

// localStorage key for persisted settings
const SETTINGS_KEY = 'ct-pdfcalendar-settings';

// Global state variables
let calendars: CTCalendar[] = [];
let tags: CTTag[] = [];
let currentUserName = '';

// ============================================
// Settings Persistence
// ============================================

function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Silently ignore storage errors (quota exceeded, etc.)
  }
}

function loadSettings(): UserSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSettings;
  } catch {
    return null;
  }
}

function restoreSettings(): void {
  const settings = loadSettings();
  if (!settings) return;

  // Restore select elements
  const selects: Array<[string, string]> = [
    ['timeRange', settings.timeRange],
    ['pageSize', settings.pageSize],
    ['orientation', settings.orientation],
    ['visibility', settings.visibility],
  ];
  for (const [id, value] of selects) {
    const el = document.getElementById(id) as HTMLSelectElement | null;
    if (el) el.value = value;
  }

  // Restore static checkboxes
  const checkboxes: Array<[string, boolean]> = [
    ['showEndTime', settings.showEndTime],
    ['useColors', settings.useColors],
    ['showLegend', settings.showLegend],
  ];
  for (const [id, checked] of checkboxes) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.checked = checked;
  }

  // Restore calendar checkboxes
  if (settings.calendarIds?.length) {
    const savedIds = new Set(settings.calendarIds.map(String));
    document.querySelectorAll<HTMLInputElement>('input[name="calendars"]').forEach((cb) => {
      cb.checked = savedIds.has(cb.value);
    });
  }

  // Restore tag checkboxes
  if (settings.tagIds?.length) {
    const savedIds = new Set(settings.tagIds.map(String));
    document.querySelectorAll<HTMLInputElement>('input[name="tags"]').forEach((cb) => {
      cb.checked = savedIds.has(cb.value);
    });
  }

  // Update select-all checkbox states
  updateSelectAllState('select-all-public', 'cal-public');
  updateSelectAllState('select-all-private', 'cal-private');
}

function updateSelectAllState(selectAllId: string, groupClass: string): void {
  const selectAll = document.getElementById(selectAllId) as HTMLInputElement | null;
  if (!selectAll) return;
  const all = document.querySelectorAll<HTMLInputElement>(`input.${groupClass}`);
  selectAll.checked = all.length > 0 && Array.from(all).every((cb) => cb.checked);
  selectAll.indeterminate = !selectAll.checked && Array.from(all).some((cb) => cb.checked);
}

// ============================================
// App Initialization
// ============================================

async function initApp() {
  const app = document.querySelector<HTMLDivElement>('#app')!;

  // Show loading state
  app.innerHTML = `
    <div class="pdf-calendar-container">
      <h1>PDF Kalender Generator</h1>
      <div class="loading">
        <div class="spinner"></div>
        <span>Lade Daten...</span>
      </div>
    </div>
  `;

  try {
    // Load data in parallel
    const [user, loadedCalendars, loadedTags] = await Promise.all([
      churchtoolsClient.get<Person>('/whoami'),
      fetchCalendars(),
      fetchAppointmentTags(),
    ]);

    calendars = loadedCalendars;
    tags = loadedTags;
    currentUserName = `${user.firstName} ${user.lastName}`.trim();

    // Render UI
    renderApp(app, user);
  } catch (error) {
    console.error('Fehler beim Laden:', error);
    app.innerHTML = `
      <div class="pdf-calendar-container">
        <h1>PDF Kalender Generator</h1>
        <div class="error-message">
          Fehler beim Laden der Daten. Bitte versuchen Sie es erneut.
          <br><small>${error instanceof Error ? error.message : 'Unbekannter Fehler'}</small>
        </div>
      </div>
    `;
  }
}

// ============================================
// UI Rendering
// ============================================

function renderApp(app: HTMLDivElement, user: Person) {
  // Group calendars by public/private
  const publicCalendars = calendars.filter((c) => c.isPublic);
  const privateCalendars = calendars.filter((c) => !c.isPublic);

  app.innerHTML = `
    <div class="pdf-calendar-container">
      <h1>PDF Kalender Generator</h1>
      <p style="margin-bottom: 20px; color: #666;">
        Willkommen, ${user.firstName} ${user.lastName}!
      </p>

      <form id="calendar-form" class="calendar-form">
        <div class="form-columns">
          <!-- Column 1: Calendars -->
          <div class="form-column">
            <div class="form-group">
              <label>Kalender:</label>
              <div class="checkbox-list" id="calendar-list">
                ${publicCalendars.length > 0 ? `
                <label class="checkbox-item select-all-item">
                  <input type="checkbox" id="select-all-public">
                  <span class="select-all-label">Gemeindekalender</span>
                </label>` : ''}
                ${publicCalendars.map((cal) => renderCalendarCheckbox(cal, 'cal-public')).join('')}
                ${privateCalendars.length > 0 ? `
                <label class="checkbox-item select-all-item">
                  <input type="checkbox" id="select-all-private">
                  <span class="select-all-label">Gruppenkalender</span>
                </label>` : ''}
                ${privateCalendars.map((cal) => renderCalendarCheckbox(cal, 'cal-private')).join('')}
              </div>
            </div>
          </div>

          <!-- Column 2: Tags -->
          <div class="form-column">
            <div class="form-group">
              <label>Tags: <span class="hint">(keine Auswahl = alle Termine)</span></label>
              <div class="checkbox-list checkbox-list--scrollable" id="tag-list">
                ${tags.length > 0 ? tags.map((tag) => renderTagCheckbox(tag)).join('') : '<div class="empty-hint">Keine Tags verfügbar</div>'}
              </div>
            </div>
          </div>

          <!-- Column 3: Options & Export -->
          <div class="form-column">
            <div class="form-group">
              <label for="timeRange">Zeitraum:</label>
              <select name="timeRange" id="timeRange">
                <option value="previous">Vorheriger Monat</option>
                <option value="current">Aktueller Monat</option>
                <option value="next" selected>Nächster Monat</option>
                <option value="year">Ganzes Jahr (12 Seiten)</option>
              </select>
            </div>

            <div class="form-group">
              <label for="pageSize">Papierformat:</label>
              <select name="pageSize" id="pageSize">
                <option value="A5">A5</option>
                <option value="A4" selected>A4</option>
                <option value="A3">A3</option>
                <option value="A2">A2</option>
              </select>
            </div>

            <div class="form-group">
              <label for="orientation">Ausrichtung:</label>
              <select name="orientation" id="orientation">
                <option value="landscape">Querformat</option>
                <option value="portrait" selected>Hochformat</option>
              </select>
            </div>

            <div class="form-group">
              <label for="visibility">Sichtbarkeit:</label>
              <select name="visibility" id="visibility">
                <option value="all">Alle Termine</option>
                <option value="public" selected>Nur öffentlich sichtbare</option>
                <option value="private">Nur intern sichtbare</option>
              </select>
            </div>

            <div class="checkbox-option">
              <input type="checkbox" name="showEndTime" id="showEndTime">
              <label for="showEndTime">Endzeit anzeigen</label>
            </div>

            <div class="checkbox-option">
              <input type="checkbox" name="useColors" id="useColors" checked>
              <label for="useColors">Kalenderfarben verwenden</label>
            </div>

            <div class="checkbox-option">
              <input type="checkbox" name="showLegend" id="showLegend" checked>
              <label for="showLegend">Legende anzeigen</label>
            </div>

            <div class="button-group">
              <button type="submit" name="format" value="pdf" class="btn btn-primary" id="btn-pdf">
                PDF generieren
              </button>
              <button type="submit" name="format" value="xlsx" class="btn btn-secondary" id="btn-xlsx">
                Excel exportieren
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  `;

  // Register event handlers
  const form = document.getElementById('calendar-form') as HTMLFormElement;
  form.addEventListener('submit', handleFormSubmit);

  // Select-all for public calendars
  setupSelectAll('select-all-public', 'cal-public');
  setupSelectAll('select-all-private', 'cal-private');

  // Restore persisted settings
  restoreSettings();
}

function renderCalendarCheckbox(cal: CTCalendar, groupClass: string): string {
  return `
    <label class="checkbox-item">
      <input type="checkbox" name="calendars" value="${cal.id}" class="${groupClass}">
      <span class="calendar-color-badge" style="background-color: ${cal.color}; color: ${getContrastColor(cal.color)}">
        ${escapeHtml(cal.name)}
      </span>
    </label>
  `;
}

function renderTagCheckbox(tag: CTTag): string {
  return `
    <label class="checkbox-item">
      <input type="checkbox" name="tags" value="${tag.id}">
      <span>${escapeHtml(tag.name)}</span>
    </label>
  `;
}

// ============================================
// Form Handler
// ============================================

async function handleFormSubmit(event: SubmitEvent) {
  event.preventDefault();

  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);
  const format = (event.submitter as HTMLButtonElement)?.value || 'pdf';

  // Disable buttons during processing
  const btnPdf = document.getElementById('btn-pdf') as HTMLButtonElement;
  const btnXlsx = document.getElementById('btn-xlsx') as HTMLButtonElement;
  btnPdf.disabled = true;
  btnXlsx.disabled = true;
  btnPdf.textContent = format === 'pdf' ? 'Generiere...' : 'PDF generieren';
  btnXlsx.textContent = format === 'xlsx' ? 'Generiere...' : 'Excel exportieren';

  try {
    // Selected calendars & tags
    const selectedCalendarIds = formData.getAll('calendars').map(Number);
    const selectedTagIds = formData.getAll('tags').map(Number);

    if (selectedCalendarIds.length === 0) {
      alert('Bitte mindestens einen Kalender auswählen.');
      return;
    }

    // Calculate time range
    const timeRange = formData.get('timeRange') as TimeRange;
    const { startDate, endDate, months } = calculateDateRange(timeRange);

    // Load appointments
    console.log(`Lade Termine von ${startDate.toISOString()} bis ${endDate.toISOString()}...`);
    let appointments = await fetchAppointments(selectedCalendarIds, startDate, endDate);

    // Apply filters
    const visibility = formData.get('visibility') as VisibilityFilter;
    appointments = filterAppointmentsByVisibility(appointments, visibility);
    appointments = filterAppointmentsByTags(appointments, selectedTagIds);
    appointments = sortAppointments(appointments);

    console.log(`${appointments.length} Termine geladen.`);

    // Collect configuration
    const config = {
      calendarIds: selectedCalendarIds,
      tagIds: selectedTagIds,
      timeRange,
      months,
      pageSize: formData.get('pageSize') as string,
      orientation: formData.get('orientation') as string,
      visibility,
      showEndTime: formData.has('showEndTime'),
      useColors: formData.has('useColors'),
      showLegend: formData.has('showLegend'),
    };

    // Persist current form settings
    saveSettings({
      timeRange,
      pageSize: config.pageSize as string,
      orientation: config.orientation as string,
      visibility,
      showEndTime: config.showEndTime as boolean,
      useColors: config.useColors as boolean,
      showLegend: config.showLegend as boolean,
      calendarIds: selectedCalendarIds,
      tagIds: selectedTagIds,
    });

    // Selected calendars for colors/legend
    const selectedCalendars = calendars.filter((c) => selectedCalendarIds.includes(c.id));

    if (format === 'xlsx') {
      await generateExcel(appointments, selectedCalendars, config);
    } else {
      await generatePdf(appointments, selectedCalendars, config);
    }
  } catch (error) {
    console.error('Fehler bei der Generierung:', error);
    alert(`Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  } finally {
    // Re-enable buttons
    btnPdf.disabled = false;
    btnXlsx.disabled = false;
    btnPdf.textContent = 'PDF generieren';
    btnXlsx.textContent = 'Excel exportieren';
  }
}

// ============================================
// PDF/Excel Generation
// ============================================

async function generatePdf(
  appointments: CTAppointment[],
  selectedCalendars: CTCalendar[],
  config: Record<string, unknown>
): Promise<void> {
  const months = config.months as MonthYear[];
  const useColors = config.useColors as boolean;
  const showLegend = config.showLegend as boolean && selectedCalendars.length > 1;

  console.log('PDF-Generierung:', {
    appointments: appointments.length,
    calendars: selectedCalendars.length,
    months,
  });

  try {
    // Create CalendarBuilder
    const builder = new CalendarBuilder({
      orientation: config.orientation as 'landscape' | 'portrait',
      pageSize: config.pageSize as 'A2' | 'A3' | 'A4' | 'A5',
      weekStarts: 1, // Montag
      showEndTime: config.showEndTime as boolean,
      useColors,
      showLegend,
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      author: currentUserName,
      version: __APP_VERSION__,
    });

    // Add categories (calendars) for colors and legend
    if (useColors || showLegend) {
      for (const cal of selectedCalendars) {
        // Calculate contrast color for text
        const textColor = getContrastColorForCalendar(cal.color);
        builder.addCategory(cal.id.toString(), cal.name, textColor, cal.color);
      }
    }

    // Calendar map for quick lookup
    const calendarMap = new Map(selectedCalendars.map((c) => [c.id, c]));

    // Create a page for each month
    for (const monthYear of months) {
      const { month, year } = monthYear;
      const title = formatMonthYear(month, year);

      // Add month
      builder.addMonth(month, year, title);

      // Filter appointments for this month
      const monthAppointments = appointments.filter((apt) => {
        const startDate = new Date(apt.startDate);
        const endDate = new Date(apt.endDate);

        // Appointment is in this month (start or end)
        const startsInMonth = startDate.getMonth() === month - 1 && startDate.getFullYear() === year;
        const endsInMonth = endDate.getMonth() === month - 1 && endDate.getFullYear() === year;

        // Appointment spans this month
        const firstOfMonth = new Date(year, month - 1, 1);
        const lastOfMonth = new Date(year, month, 0, 23, 59, 59);
        const spansMonth = startDate <= lastOfMonth && endDate >= firstOfMonth;

        return startsInMonth || endsInMonth || spansMonth;
      });

      // Add appointments
      for (const apt of monthAppointments) {
        const calendar = calendarMap.get(apt.calendar.id);
        const startDate = new Date(apt.startDate);
        const endDate = new Date(apt.endDate);

        // Combine title with note (as in PHP)
        let title = apt.caption;
        if (apt.note && apt.note.trim()) {
          title = `${apt.caption} (${apt.note.trim()})`;
        }

        if (useColors && calendar) {
          builder.addEntryWithCategory(startDate, endDate, title, calendar.id.toString());
        } else {
          builder.addEntry(startDate, endDate, title);
        }
      }
    }

    // Generate PDF
    const blob = await builder.generate();

    // Trigger download
    const filename = generatePdfFilename(months);
    downloadPdfBlob(blob, filename);

    console.log(`PDF-Datei "${filename}" wurde generiert.`);
  } catch (error) {
    console.error('Fehler bei PDF-Generierung:', error);
    throw new Error(`PDF-Generierung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  }
}

/**
 * Calculates contrast color for calendar
 */
function getContrastColorForCalendar(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#FFFFFF';
}

async function generateExcel(
  appointments: CTAppointment[],
  selectedCalendars: CTCalendar[],
  config: Record<string, unknown>
): Promise<void> {
  const months = config.months as Array<{ month: number; year: number }>;

  console.log('Excel-Export:', {
    appointments: appointments.length,
    calendars: selectedCalendars.length,
    months,
  });

  try {
    // Generate Excel file
    const blob = await exportToExcel({
      appointments,
      calendars: selectedCalendars,
      months,
      showEndTime: config.showEndTime as boolean,
      useColors: config.useColors as boolean,
      showLegend: config.showLegend as boolean,
    });

    // Trigger download
    const filename = generateFilename(months, 'xlsx');
    downloadBlob(blob, filename);

    console.log(`Excel-Datei "${filename}" wurde generiert.`);
  } catch (error) {
    console.error('Fehler beim Excel-Export:', error);
    throw new Error(`Excel-Export fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Wires up a select-all checkbox to toggle all checkboxes with the given class
 */
function setupSelectAll(selectAllId: string, groupClass: string): void {
  const selectAll = document.getElementById(selectAllId) as HTMLInputElement | null;
  if (!selectAll) return;

  const checkboxes = () => document.querySelectorAll<HTMLInputElement>(`input.${groupClass}`);

  selectAll.addEventListener('change', () => {
    checkboxes().forEach((cb) => { cb.checked = selectAll.checked; });
  });

  // Update select-all state when individual checkboxes change
  document.getElementById('calendar-list')?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.classList.contains(groupClass)) {
      const all = checkboxes();
      selectAll.checked = Array.from(all).every((cb) => cb.checked);
      selectAll.indeterminate = !selectAll.checked && Array.from(all).some((cb) => cb.checked);
    }
  });
}

/**
 * Calculates contrast color (black/white) for background
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '#000000' : '#ffffff';
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Start App
// ============================================

initApp();
