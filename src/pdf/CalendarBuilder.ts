/**
 * CalendarBuilder
 * Generates PDF calendars with pdfmake
 * Port from PDFCalendarBuilder (PHP)
 */

import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { CalendarEntry } from './CalendarEntry';
import { mmToPt, PAGE_SIZES } from './GridCalculator';
import { rgbToHex, html2rgb } from './ColorUtils';
import {
  getDaysInMonth,
  getFirstDayWeekday,
  getWeeksInMonth,
  DAY_NAMES_SHORT_DE,
  MONTH_NAMES_DE,
} from '../utils/date-utils';
import type { RGB, MonthYear } from '../types/calendar.types';

// Initialize pdfmake fonts
// @ts-expect-error pdfmake types are not fully compatible
pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.default?.pdfMake?.vfs || pdfFonts;

// ============================================
// Types
// ============================================

export interface CalendarBuilderConfig {
  orientation: 'landscape' | 'portrait';
  pageSize: 'A2' | 'A3' | 'A4' | 'A5';
  weekStarts: 0 | 1;       // 0=Sunday, 1=Monday
  margins?: { top: number; right: number; bottom: number; left: number };
  showEndTime?: boolean;
  useColors?: boolean;
  showLegend?: boolean;
  dayNames?: string[];
  monthNames?: string[];
  author?: string;
}

export interface Category {
  id: string;
  name: string;
  textColor: RGB;
  bgColor: RGB;
}

interface PageData {
  month: number;
  year: number;
  title: string;
  entries: CalendarEntry[];
}

// ============================================
// Constants
// ============================================

const DEFAULT_MARGINS = { top: 10, right: 10, bottom: 10, left: 10 };
const TITLE_FONT_SIZE = 16;
const HEADER_FONT_SIZE = 10;
const DAY_NUMBER_FONT_SIZE = 14;
const ENTRY_FONT_SIZE = 8;
const LEGEND_FONT_SIZE = 8;

const HEADER_BG_COLOR = '#808080';
const HEADER_TEXT_COLOR = '#FFFFFF';
const DAY_NUMBER_COLOR = '#C8C8C8';
const GRID_BORDER_COLOR = '#808080';

// ============================================
// CalendarBuilder Class
// ============================================

export class CalendarBuilder {
  private config: CalendarBuilderConfig;
  private pages: PageData[] = [];
  private categories: Map<string, Category> = new Map();
  private dayNames: string[];
  private monthNames: string[];

  constructor(config: CalendarBuilderConfig) {
    this.config = {
      margins: DEFAULT_MARGINS,
      showEndTime: false,
      useColors: true,
      showLegend: true,
      ...config,
    };

    // Arrange day names based on week start
    const defaultDayNames = [...DAY_NAMES_SHORT_DE];
    this.dayNames = config.dayNames || this.rotateDayNames(defaultDayNames, config.weekStarts);
    this.monthNames = config.monthNames || MONTH_NAMES_DE;
  }

  /**
   * Rotates day names based on week start
   */
  private rotateDayNames(names: string[], weekStarts: number): string[] {
    const rotated = [...names];
    for (let i = 0; i < weekStarts; i++) {
      rotated.push(rotated.shift()!);
    }
    return rotated;
  }

  /**
   * Adds a month
   */
  addMonth(month: number, year: number, title?: string): void {
    const monthTitle = title || `${this.monthNames[month - 1]} ${year}`;
    this.pages.push({
      month,
      year,
      title: monthTitle,
      entries: [],
    });
  }

  /**
   * Adds a category (for legend and colors)
   */
  addCategory(id: string, name: string, textColor: string, bgColor: string): void {
    this.categories.set(id, {
      id,
      name,
      textColor: html2rgb(textColor),
      bgColor: html2rgb(bgColor),
    });
  }

  /**
   * Adds an appointment
   */
  addEntry(
    startDate: Date,
    endDate: Date | null,
    message: string,
    textColor: string | RGB = '#000000',
    bgColor: string | RGB = '#FFFFFF'
  ): void {
    if (this.pages.length === 0) {
      throw new Error('No month added. Please call addMonth() first.');
    }

    const entry = new CalendarEntry(startDate, endDate, message, textColor, bgColor);
    this.getCurrentPage().entries.push(entry);
  }

  /**
   * Adds an appointment with category
   */
  addEntryWithCategory(
    startDate: Date,
    endDate: Date | null,
    message: string,
    categoryId: string
  ): void {
    const category = this.categories.get(categoryId);
    if (category) {
      this.addEntry(startDate, endDate, message, category.textColor, category.bgColor);
    } else {
      this.addEntry(startDate, endDate, message);
    }
  }

  /**
   * Returns the current page
   */
  private getCurrentPage(): PageData {
    return this.pages[this.pages.length - 1];
  }

  /**
   * Expands multi-day appointments into individual day entries
   */
  private expandMultiDayEntries(entries: CalendarEntry[], month: number, year: number): CalendarEntry[] {
    const expanded: CalendarEntry[] = [];

    for (const entry of entries) {
      if (!entry.isSpanningDays() || !entry.endDate) {
        // Check if appointment is in this month
        if (entry.startDate.getMonth() === month - 1 && entry.startDate.getFullYear() === year) {
          expanded.push(entry);
        }
        continue;
      }

      // Multi-Day: expand
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      const current = new Date(start);
      let isFirst = true;

      while (current <= end) {
        // Only days in this month
        if (current.getMonth() === month - 1 && current.getFullYear() === year) {
          const newEntry = entry.cloneForDay(
            current.getDate(),
            month,
            year
          );

          if (!isFirst) {
            newEntry.hideStartTime = true;
            newEntry.isContinuation = true;
            newEntry.message = '...' + entry.message;
          }

          const isLastDay = current.toDateString() === end.toDateString();
          if (!isLastDay) {
            newEntry.hideEndTime = true;
            if (!newEntry.isContinuation) {
              newEntry.message = entry.message + '...';
            } else {
              newEntry.message = '...' + entry.message + '...';
            }
          }

          expanded.push(newEntry);
        }

        current.setDate(current.getDate() + 1);
        isFirst = false;
      }
    }

    return expanded;
  }

  /**
   * Sorts entries by day and start time
   */
  private sortEntries(entries: CalendarEntry[]): CalendarEntry[] {
    return [...entries].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.startDate.getTime() - b.startDate.getTime();
    });
  }

  /**
   * Groups entries by day
   */
  private groupEntriesByDay(entries: CalendarEntry[]): Map<number, CalendarEntry[]> {
    const grouped = new Map<number, CalendarEntry[]>();

    for (const entry of entries) {
      const day = entry.day;
      if (!grouped.has(day)) {
        grouped.set(day, []);
      }
      grouped.get(day)!.push(entry);
    }

    return grouped;
  }

  /**
   * Builds the content for a page
   */
  private buildPageContent(page: PageData): Content[] {
    const { month, year, title, entries } = page;

    // Prepare entries
    let processedEntries = this.expandMultiDayEntries(entries, month, year);
    processedEntries = this.sortEntries(processedEntries);
    const entriesByDay = this.groupEntriesByDay(processedEntries);

    // Calculate grid data
    const daysInMonth = getDaysInMonth(year, month);
    const weekdayOfFirst = getFirstDayWeekday(year, month, this.config.weekStarts);
    const numRows = getWeeksInMonth(year, month, this.config.weekStarts);

    // Calculate page dimensions
    const pageSizeMm = PAGE_SIZES[this.config.pageSize] || PAGE_SIZES.A4;
    const pageWidthMm = this.config.orientation === 'landscape' ? pageSizeMm.height : pageSizeMm.width;
    const pageHeightMm = this.config.orientation === 'landscape' ? pageSizeMm.width : pageSizeMm.height;
    const margins = this.config.margins!;
    const availableWidthPt = mmToPt(pageWidthMm - margins.left - margins.right);
    const colWidthPt = availableWidthPt / 7;

    // Calculate available height for the calendar grid
    const availableHeightPt = mmToPt(pageHeightMm - margins.top - margins.bottom);
    const titleHeightPt = TITLE_FONT_SIZE * 1.4 + 8;
    const headerRowHeightPt = HEADER_FONT_SIZE * 1.4 + 8;
    const showLegend = this.config.showLegend && this.categories.size > 0;
    const numLegendRows = showLegend ? Math.ceil(this.categories.size / 7) : 0;
    const legendHeightPt = numLegendRows > 0 ? numLegendRows * (LEGEND_FONT_SIZE * 1.4 + 12) : 0;
    const footerHeightPt = 7 * 1.4 + 4;
    const gridBordersPt = (numRows + 2) * 0.5;
    const safetyMarginPt = 5;
    const gridHeightPt = availableHeightPt - titleHeightPt - headerRowHeightPt - legendHeightPt - footerHeightPt - gridBordersPt - safetyMarginPt;

    // Find optimal font size and row heights
    const { entryFontSize, rowHeights } = this.calculateOptimalLayout(
      entriesByDay, numRows, weekdayOfFirst, daysInMonth, colWidthPt, gridHeightPt
    );

    const content: Content[] = [];

    // Title
    content.push({
      text: title,
      style: 'title',
      alignment: 'center',
      margin: [0, 0, 0, 8],
    });

    // Build calendar table
    const tableBody: TableCell[][] = [];

    // Header row (weekdays)
    const headerRow: TableCell[] = this.dayNames.map((name) => ({
      text: name,
      style: 'dayHeader',
      alignment: 'center' as const,
      fillColor: HEADER_BG_COLOR,
      margin: [2, 2, 2, 2],
    }));
    tableBody.push(headerRow);

    // Calendar rows
    let currentDay = 1;

    for (let row = 0; row < numRows; row++) {
      const tableRow: TableCell[] = [];

      for (let col = 0; col < 7; col++) {
        if (row === 0 && col < weekdayOfFirst) {
          tableRow.push({ text: '', fillColor: '#F5F5F5', margin: [2, 2, 2, 2] });
          continue;
        }

        if (currentDay > daysInMonth) {
          tableRow.push({ text: '', fillColor: '#F5F5F5', margin: [2, 2, 2, 2] });
          continue;
        }

        const dayEntries = entriesByDay.get(currentDay) || [];
        const cellContent = this.buildDayCellContent(currentDay, dayEntries, entryFontSize, rowHeights[row]);
        tableRow.push(cellContent);

        currentDay++;
      }

      tableBody.push(tableRow);
    }

    // Add table with calculated row heights
    const finalRowHeights = rowHeights;
    content.push({
      table: {
        headerRows: 1,
        widths: Array(7).fill(colWidthPt),
        heights: (row: number) => row === 0 ? headerRowHeightPt : finalRowHeights[row - 1],
        body: tableBody,
      },
      layout: {
        hLineWidth: () => 0.25,
        vLineWidth: () => 0.25,
        hLineColor: () => GRID_BORDER_COLOR,
        vLineColor: () => GRID_BORDER_COLOR,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
    });

    // Legend
    if (showLegend) {
      content.push(this.buildLegend(colWidthPt));
    }

    // Timestamp
    content.push({
      text: `Erstellt: ${new Date().toLocaleString('de-DE')}`,
      style: 'footer',
      alignment: 'right',
      margin: [0, 4, 0, 0],
    });

    // Wrap everything in an unbreakable stack so pdfmake never splits
    // the calendar grid across pages.
    return [{ stack: content, unbreakable: true }];
  }

  /**
   * Calculates optimal entry font size and per-row heights to fill available space.
   * Reduces font size if content overflows, then distributes remaining space.
   * Content-heavy rows get their needed height; remaining space is shared equally.
   */
  private calculateOptimalLayout(
    entriesByDay: Map<number, CalendarEntry[]>,
    numRows: number,
    weekdayOfFirst: number,
    daysInMonth: number,
    colWidthPt: number,
    gridHeightPt: number
  ): { entryFontSize: number; rowHeights: number[] } {
    const MIN_FONT_SIZE = 5;
    let entryFontSize = ENTRY_FONT_SIZE;

    while (entryFontSize >= MIN_FONT_SIZE) {
      const contentHeights = this.estimateRowContentHeights(
        entriesByDay, numRows, weekdayOfFirst, daysInMonth, colWidthPt, entryFontSize
      );
      const totalContent = contentHeights.reduce((sum, h) => sum + h, 0);

      if (totalContent <= gridHeightPt) {
        const rowHeights = this.distributeRowHeights(contentHeights, gridHeightPt);
        return { entryFontSize, rowHeights };
      }

      // Content overflows — try smaller font
      entryFontSize -= 0.5;
    }

    // Even at minimum font size, distribute as well as possible
    const contentHeights = this.estimateRowContentHeights(
      entriesByDay, numRows, weekdayOfFirst, daysInMonth, colWidthPt, MIN_FONT_SIZE
    );
    return { entryFontSize: MIN_FONT_SIZE, rowHeights: this.distributeRowHeights(contentHeights, gridHeightPt) };
  }

  /**
   * Distributes available height across rows.
   * Rows whose content exceeds an equal share get their full content height.
   * Remaining space is distributed equally among the other rows.
   */
  private distributeRowHeights(contentHeights: number[], totalAvailable: number): number[] {
    const numRows = contentHeights.length;
    const rowHeights = new Array<number>(numRows).fill(0);
    const isFixed = new Array<boolean>(numRows).fill(false);

    let remaining = totalAvailable;
    let flexCount = numRows;

    // Iteratively assign heights to rows that exceed the equal share
    for (let iteration = 0; iteration < numRows; iteration++) {
      const equalShare = remaining / flexCount;
      let changed = false;

      for (let i = 0; i < numRows; i++) {
        if (isFixed[i]) continue;
        if (contentHeights[i] > equalShare) {
          rowHeights[i] = contentHeights[i];
          isFixed[i] = true;
          remaining -= contentHeights[i];
          flexCount--;
          changed = true;
        }
      }

      if (!changed) break;
    }

    // Distribute remaining space equally among flexible rows
    const equalShare = flexCount > 0 ? remaining / flexCount : 0;
    for (let i = 0; i < numRows; i++) {
      if (!isFixed[i]) {
        rowHeights[i] = equalShare;
      }
    }

    return rowHeights;
  }

  /**
   * Estimates the minimum content height for each calendar row.
   * The height of a row is determined by its tallest cell.
   */
  private estimateRowContentHeights(
    entriesByDay: Map<number, CalendarEntry[]>,
    numRows: number,
    weekdayOfFirst: number,
    daysInMonth: number,
    colWidthPt: number,
    entryFontSize: number
  ): number[] {
    const lineHeight = entryFontSize * 1.4;
    const entryMarginV = 2; // top + bottom margin per entry
    const cellMarginV = 4; // top + bottom cell margin
    // Conservative char width estimate — overestimate line count to avoid overflow
    const avgCharWidth = entryFontSize * 0.55;
    const textWidth = colWidthPt - 4; // minus horizontal cell margins
    // Day number is placed first in the cell stack and takes flow height,
    // so include it in the estimation.
    const dayNumberHeight = DAY_NUMBER_FONT_SIZE * 1.2;
    const minRowHeight = dayNumberHeight + cellMarginV;

    const rowHeights: number[] = [];
    let currentDay = 1;

    for (let row = 0; row < numRows; row++) {
      let maxCellHeight = minRowHeight;

      for (let col = 0; col < 7; col++) {
        if (row === 0 && col < weekdayOfFirst) { continue; }
        if (currentDay > daysInMonth) { continue; }

        const dayEntries = entriesByDay.get(currentDay) || [];
        // Start with dayNumberHeight (first in the stack) + cell margins
        let cellHeight = cellMarginV + dayNumberHeight;

        for (const entry of dayEntries) {
          let timeStr = '';
          if (!entry.hideStartTime && !entry.isAllDay()) {
            timeStr = entry.getFormattedStartTime();
          }
          const text = timeStr + entry.message;
          const charsPerLine = Math.max(1, Math.floor(textWidth / avgCharWidth));
          const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
          cellHeight += lines * lineHeight + entryMarginV;
        }

        maxCellHeight = Math.max(maxCellHeight, cellHeight);
        currentDay++;
      }

      rowHeights.push(maxCellHeight);
    }

    return rowHeights;
  }

  /**
   * Builds the content of a day cell.
   * The day number is placed FIRST with relativePosition to the bottom-right.
   * Its yShift is based on the known rowHeight (no entry estimation needed).
   * Entries follow and flow from the top, overlapping the day number area
   * when the cell is full.
   */
  private buildDayCellContent(
    day: number,
    entries: CalendarEntry[],
    entryFontSize: number,
    rowHeight: number,
  ): TableCell {
    const cellPad = 2;
    const dayNumHeight = DAY_NUMBER_FONT_SIZE * 1.2;
    const contentAreaHeight = rowHeight - 2 * cellPad;

    const stack: Content[] = [];

    // Day number FIRST: its natural position is at y=0 (top of content area).
    // relativePosition shifts it visually to the bottom-right.
    // yShift = contentAreaHeight - dayNumHeight (always correct, no estimation).
    const yShift = Math.max(0, contentAreaHeight - dayNumHeight);
    stack.push({
      text: day.toString(),
      style: 'dayNumber',
      alignment: 'right',
      relativePosition: { x: 0, y: yShift },
    });

    // Entries flow from the top (after day number's flow height)
    for (let i = 0; i < entries.length; i++) {
      const isLast = i === entries.length - 1;
      stack.push(this.buildEntryContent(entries[i], entryFontSize, isLast));
    }

    return {
      stack,
      fillColor: '#FFFFFF',
      margin: [cellPad, cellPad, cellPad, cellPad],
    };
  }

  /**
   * Builds the content of an entry.
   * Uses a single-cell table so the background color fills the full width of the
   * containing cell and exactly the height of the text.
   */
  private buildEntryContent(entry: CalendarEntry, entryFontSize: number, isLast: boolean): Content {
    // Format time
    let timeStr = '';
    if (!entry.hideStartTime && !entry.isAllDay()) {
      timeStr = entry.getFormattedStartTime();

      if (this.config.showEndTime && entry.endDate && !entry.hideEndTime) {
        const endTime = entry.getFormattedEndTime();
        if (endTime) {
          timeStr = timeStr.replace('h ', '') + '-' + endTime + ' ';
        }
      }
    }

    const text = timeStr + entry.message;
    const bgColor = rgbToHex(entry.bgColor);
    const textColor = rgbToHex(entry.textColor);

    return {
      margin: [0, 0, 0, 0],
      table: {
        widths: ['*'],
        body: [[{
          text,
          fontSize: entryFontSize,
          color: textColor,
          fillColor: bgColor,
          margin: [1, 1, 1, 1],
        }]],
      },
      layout: {
        hLineWidth: (i: number) => (i > 0 && !isLast) ? 0.5 : 0,
        vLineWidth: () => 0,
        hLineColor: () => '#D0D0D0',
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
    };
  }

  /**
   * Builds the legend as rows of up to 7 cells, expanding to fill the full width.
   * Text is horizontally and vertically centered within each cell.
   */
  private buildLegend(colWidthPt: number): Content {
    const categories = Array.from(this.categories.values());
    const availableWidthPt = colWidthPt * 7;
    const tables: Content[] = [];
    const lineHeight = LEGEND_FONT_SIZE * 1.4;
    const avgCharWidth = LEGEND_FONT_SIZE * 0.5;
    const cellPadH = 4; // horizontal content margin (2 left + 2 right)
    const cellPadV = 2; // base vertical padding

    for (let i = 0; i < categories.length; i += 7) {
      const chunk = categories.slice(i, i + 7);
      const cellWidth = availableWidthPt / chunk.length;
      const textWidth = cellWidth - cellPadH;

      // Estimate line count per cell
      const lineCounts = chunk.map((cat) => {
        const charsPerLine = Math.max(1, Math.floor(textWidth / avgCharWidth));
        return Math.ceil(cat.name.length / charsPerLine);
      });
      const maxLines = Math.max(...lineCounts);
      const maxContentHeight = maxLines * lineHeight;

      const row: TableCell[] = chunk.map((cat, idx) => {
        const cellContentHeight = lineCounts[idx] * lineHeight;
        const extraTop = (maxContentHeight - cellContentHeight) / 2;
        const extraBottom = maxContentHeight - cellContentHeight - extraTop;

        return {
          stack: [{
            text: cat.name,
            fontSize: LEGEND_FONT_SIZE,
            color: rgbToHex(cat.textColor),
            alignment: 'center' as const,
            margin: [2, cellPadV + extraTop, 2, cellPadV + extraBottom],
          }],
          fillColor: rgbToHex(cat.bgColor),
        };
      });

      tables.push({
        table: {
          widths: Array(chunk.length).fill(cellWidth),
          body: [row],
        },
        layout: {
          hLineWidth: () => 0.25,
          vLineWidth: () => 0.25,
          hLineColor: () => GRID_BORDER_COLOR,
          vLineColor: () => GRID_BORDER_COLOR,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
        margin: [0, i === 0 ? 4 : 0, 0, 0],
      });
    }

    return { stack: tables };
  }

  /**
   * Generates the PDF
   */
  async generate(): Promise<Blob> {
    if (this.pages.length === 0) {
      throw new Error('No pages added. Please call addMonth() first.');
    }

    const margins = this.config.margins!;

    // Build PDF title from page titles
    const pdfTitle = this.pages.length === 1
      ? this.pages[0].title
      : `${this.pages[0].title} – ${this.pages[this.pages.length - 1].title}`;

    // Build keywords from category names and page titles
    const categoryNames = Array.from(this.categories.values()).map((c) => c.name);
    const keywords = ['ChurchTools', 'Kalender', ...categoryNames].join(', ');

    // Use pdfmake's built-in page size strings — it handles dimensions and orientation natively
    const docDefinition: TDocumentDefinitions = {
      info: {
        title: pdfTitle,
        author: this.config.author || 'ChurchTools PDF Calendar Extension',
        creator: 'ChurchTools PDF Calendar Extension',
        subject: `Kalender: ${pdfTitle}`,
        keywords,
      },
      pageSize: this.config.pageSize,
      pageOrientation: this.config.orientation,
      pageMargins: [mmToPt(margins.left), mmToPt(margins.top), mmToPt(margins.right), mmToPt(margins.bottom)],
      content: [],
      styles: {
        title: {
          fontSize: TITLE_FONT_SIZE,
          bold: true,
        },
        dayHeader: {
          fontSize: HEADER_FONT_SIZE,
          bold: true,
          color: HEADER_TEXT_COLOR,
        },
        dayNumber: {
          fontSize: DAY_NUMBER_FONT_SIZE,
          color: DAY_NUMBER_COLOR,
          bold: true,
        },
        entry: {
          fontSize: ENTRY_FONT_SIZE,
        },
        footer: {
          fontSize: 7,
          color: '#888888',
        },
      },
      defaultStyle: {
        font: 'Roboto',
      },
    };

    // Add pages
    const content: Content[] = [];

    for (let i = 0; i < this.pages.length; i++) {
      if (i > 0) {
        // Page break before each page except the first
        content.push({ text: '', pageBreak: 'before' });
      }
      content.push(...this.buildPageContent(this.pages[i]));
    }

    docDefinition.content = content;

    // Generate PDF
    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = pdfMake.createPdf(docDefinition);
        pdfDoc.getBlob((blob: Blob) => {
          resolve(blob);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

// ============================================
// Helper Functions
// ============================================

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
 * Generates a filename for PDF export
 */
export function generatePdfFilename(months: MonthYear[]): string {
  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  if (months.length === 1) {
    const m = months[0];
    return `kalender_${m.year}_${String(m.month).padStart(2, '0')}_${timestamp}.pdf`;
  }

  const first = months[0];
  const last = months[months.length - 1];
  return `kalender_${first.year}${String(first.month).padStart(2, '0')}-${last.year}${String(last.month).padStart(2, '0')}_${timestamp}.pdf`;
}
