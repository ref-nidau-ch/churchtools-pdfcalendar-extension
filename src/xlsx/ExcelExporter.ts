/**
 * Excel Exporter
 * Exports calendar appointments as XLSX file
 */

import ExcelJS from 'exceljs';
import type { CTAppointment, CTCalendar, MonthYear } from '../types/calendar.types';
import { formatAddress, getAppointmentImageUrl } from '../services/churchtools-api';
import { formatMonthYear } from '../utils/date-utils';

// ============================================
// Types
// ============================================

export interface ExcelExportConfig {
  appointments: CTAppointment[];
  calendars: CTCalendar[];
  months: MonthYear[];
  showEndTime: boolean;
  useColors: boolean;
  showLegend: boolean;  // Show calendar column
  title?: string;
}

// ============================================
// Constants
// ============================================

const HEADER_BG_COLOR = 'DDDDDD';
const HEADER_FONT_SIZE = 12;
const TITLE_FONT_SIZE = 20;
const EVEN_MONTH_BG_COLOR = 'EEEEEE';
const DATE_COL_WIDTH = 18;

// ============================================
// Main Export Function
// ============================================

/**
 * Exports appointments as Excel file
 */
export async function exportToExcel(config: ExcelExportConfig): Promise<Blob> {
  const {
    appointments,
    calendars,
    months,
    showEndTime,
    useColors,
    showLegend,
    title,
  } = config;

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ChurchTools PDF Calendar Extension';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Termine');

  // Define columns
  const columns = buildColumns(showLegend, showEndTime);
  worksheet.columns = columns;

  let rowIndex = 1;

  // Title
  const titleText = title || buildTitle(months);
  const titleRow = worksheet.getRow(rowIndex);
  titleRow.getCell(1).value = titleText;
  titleRow.getCell(1).font = { bold: true, size: TITLE_FONT_SIZE };
  worksheet.mergeCells(rowIndex, 1, rowIndex, columns.length);
  rowIndex++;

  // Empty row
  rowIndex++;

  // Header row
  const headerRow = worksheet.getRow(rowIndex);
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header as string;
    cell.font = { bold: true, size: HEADER_FONT_SIZE };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${HEADER_BG_COLOR}` },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  rowIndex++;

  // Calendar map for quick lookup
  const calendarMap = new Map(calendars.map((c) => [c.id, c]));

  // Group appointments by month for alternating colors
  let currentMonthKey = '';
  let isEvenMonth = false;

  // Insert appointments
  for (const apt of appointments) {
    const calendar = calendarMap.get(apt.calendar.id);
    const row = worksheet.getRow(rowIndex);

    // Check month change for alternating colors
    const startDate = new Date(apt.startDate);
    const monthKey = `${startDate.getFullYear()}-${startDate.getMonth()}`;
    if (monthKey !== currentMonthKey) {
      currentMonthKey = monthKey;
      isEvenMonth = !isEvenMonth;
    }

    let colIdx = 1;

    // Calendar name (if legend enabled)
    if (showLegend) {
      const cell = row.getCell(colIdx++);
      cell.value = apt.calendar.name;

      // Calendar color as background
      if (useColors && calendar) {
        const bgColor = calendar.color.replace('#', '');
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: `FF${bgColor}` },
        };
        cell.font = {
          color: { argb: `FF${getContrastColorHex(calendar.color)}` },
        };
      }
    }

    // Start date
    const startCell = row.getCell(colIdx++);
    startCell.value = new Date(apt.startDate);
    startCell.numFmt = 'DD.MM.YYYY HH:mm';

    // End date (if enabled)
    if (showEndTime) {
      const endCell = row.getCell(colIdx++);
      endCell.value = new Date(apt.endDate);
      endCell.numFmt = 'DD.MM.YYYY HH:mm';
    }

    // Title
    row.getCell(colIdx++).value = apt.caption;

    // Note
    row.getCell(colIdx++).value = apt.note || '';

    // Additional info
    row.getCell(colIdx++).value = apt.information || '';

    // Link
    const linkCell = row.getCell(colIdx++);
    if (apt.link) {
      linkCell.value = {
        text: apt.link,
        hyperlink: apt.link,
        tooltip: 'Link öffnen',
      };
      linkCell.font = { color: { argb: 'FF0066CC' }, underline: true };
    }

    // Address
    row.getCell(colIdx++).value = formatAddress(apt);

    // Image URL
    const imageUrl = getAppointmentImageUrl(apt);
    const imageCell = row.getCell(colIdx++);
    if (imageUrl) {
      imageCell.value = {
        text: imageUrl,
        hyperlink: imageUrl,
        tooltip: 'Bild öffnen',
      };
      imageCell.font = { color: { argb: 'FF0066CC' }, underline: true };
    }

    // Alternating background color for months (in year view)
    if (months.length > 1 && isEvenMonth) {
      for (let i = 1; i <= columns.length; i++) {
        const cell = row.getCell(i);
        if (!cell.fill || (cell.fill as ExcelJS.FillPattern).pattern !== 'solid') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: `FF${EVEN_MONTH_BG_COLOR}` },
          };
        }
      }
    }

    rowIndex++;
  }

  // Adjust column widths
  worksheet.columns.forEach((column) => {
    if (column.width === undefined) {
      column.width = 20;
    }
  });

  // Enable auto-filter
  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: rowIndex - 1, column: columns.length },
  };

  // Export as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Builds the column definition
 */
function buildColumns(
  showLegend: boolean,
  showEndTime: boolean
): Partial<ExcelJS.Column>[] {
  const columns: Partial<ExcelJS.Column>[] = [];

  if (showLegend) {
    columns.push({ header: 'Kalender', key: 'calendar', width: 20 });
  }

  columns.push({ header: 'Start', key: 'start', width: DATE_COL_WIDTH });

  if (showEndTime) {
    columns.push({ header: 'Ende', key: 'end', width: DATE_COL_WIDTH });
  }

  columns.push(
    { header: 'Titel', key: 'title', width: 30 },
    { header: 'Bemerkung', key: 'note', width: 30 },
    { header: 'Weitere Infos', key: 'info', width: 30 },
    { header: 'Link', key: 'link', width: 25 },
    { header: 'Adresse', key: 'address', width: 30 },
    { header: 'Bild', key: 'image', width: 25 }
  );

  return columns;
}

/**
 * Builds the title from months
 */
function buildTitle(months: MonthYear[]): string {
  if (months.length === 0) {
    return 'Kalender';
  }

  if (months.length === 1) {
    return formatMonthYear(months[0].month, months[0].year);
  }

  // For multiple months: "Januar 2024 - Dezember 2024"
  const first = months[0];
  const last = months[months.length - 1];
  return `${formatMonthYear(first.month, first.year)} - ${formatMonthYear(last.month, last.year)}`;
}

/**
 * Calculates contrast color (without #)
 */
function getContrastColorHex(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? '000000' : 'FFFFFF';
}

/**
 * Triggers download of a Blob file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates a filename for export
 */
export function generateFilename(months: MonthYear[], extension = 'xlsx'): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  if (months.length === 1) {
    const m = months[0];
    return `kalender_${m.year}_${String(m.month).padStart(2, '0')}_${timestamp}.${extension}`;
  }

  const first = months[0];
  const last = months[months.length - 1];
  return `kalender_${first.year}${String(first.month).padStart(2, '0')}-${last.year}${String(last.month).padStart(2, '0')}_${timestamp}.${extension}`;
}
