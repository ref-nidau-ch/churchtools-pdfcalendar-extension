/**
 * CalendarBuilder
 * Generates PDF calendars with pdfmake
 * Port from PDFCalendarBuilder (PHP)
 */

import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces';
import { CalendarEntry } from './CalendarEntry';
import { getPageDimensions } from './GridCalculator';
import { rgbToHex, html2rgb } from './ColorUtils';
import {
  getDaysInMonth,
  getFirstDayWeekday,
  getWeeksInMonth,
  DAY_NAMES_DE,
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
    const defaultDayNames = [...DAY_NAMES_DE];
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
    }));
    tableBody.push(headerRow);

    // Calendar rows
    let currentDay = 1;

    for (let row = 0; row < numRows; row++) {
      const tableRow: TableCell[] = [];

      for (let col = 0; col < 7; col++) {
        // Empty cells before the 1st day
        if (row === 0 && col < weekdayOfFirst) {
          tableRow.push({ text: '', fillColor: '#F5F5F5' });
          continue;
        }

        // Empty cells after the last day
        if (currentDay > daysInMonth) {
          tableRow.push({ text: '', fillColor: '#F5F5F5' });
          continue;
        }

        // Cell for this day
        const dayEntries = entriesByDay.get(currentDay) || [];
        const cellContent = this.buildDayCellContent(currentDay, dayEntries);
        tableRow.push(cellContent);

        currentDay++;
      }

      tableBody.push(tableRow);
    }

    // Add table
    content.push({
      table: {
        headerRows: 1,
        widths: Array(7).fill('*'),
        body: tableBody,
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => GRID_BORDER_COLOR,
        vLineColor: () => GRID_BORDER_COLOR,
        paddingLeft: () => 2,
        paddingRight: () => 2,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
    });

    // Legend
    if (this.config.showLegend && this.categories.size > 0) {
      content.push(this.buildLegend());
    }

    // Timestamp
    content.push({
      text: `Erstellt: ${new Date().toLocaleString('de-DE')}`,
      style: 'footer',
      alignment: 'right',
      margin: [0, 4, 0, 0],
    });

    return content;
  }

  /**
   * Builds the content of a day cell
   */
  private buildDayCellContent(day: number, entries: CalendarEntry[]): TableCell {
    const stack: Content[] = [];

    // Entries
    for (const entry of entries) {
      const entryContent = this.buildEntryContent(entry);
      stack.push(entryContent);
    }

    // Day number (bottom right)
    stack.push({
      text: day.toString(),
      style: 'dayNumber',
      alignment: 'right',
      margin: [0, 2, 0, 0],
    });

    return {
      stack,
      fillColor: '#FFFFFF',
    };
  }

  /**
   * Builds the content of an entry
   */
  private buildEntryContent(entry: CalendarEntry): Content {
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
      text,
      fontSize: ENTRY_FONT_SIZE,
      color: textColor,
      fillColor: bgColor,
      margin: [0, 1, 0, 1],
      // Simulate padding through background
      background: bgColor,
    };
  }

  /**
   * Builds the legend
   */
  private buildLegend(): Content {
    const legendItems: Content[] = [];

    this.categories.forEach((category) => {
      const bgColor = rgbToHex(category.bgColor);
      const textColor = rgbToHex(category.textColor);

      legendItems.push({
        text: ` ${category.name} `,
        fontSize: LEGEND_FONT_SIZE,
        color: textColor,
        background: bgColor,
        margin: [2, 0, 4, 0],
      });
    });

    return {
      columns: legendItems,
      margin: [0, 8, 0, 0],
    };
  }

  /**
   * Generates the PDF
   */
  async generate(): Promise<Blob> {
    if (this.pages.length === 0) {
      throw new Error('No pages added. Please call addMonth() first.');
    }

    const { width, height } = getPageDimensions(this.config.pageSize, this.config.orientation);
    const margins = this.config.margins!;

    // Document definition
    const docDefinition: TDocumentDefinitions = {
      pageSize: {
        width: width,
        height: height,
      },
      pageOrientation: this.config.orientation,
      pageMargins: [margins.left, margins.top, margins.right, margins.bottom],
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
