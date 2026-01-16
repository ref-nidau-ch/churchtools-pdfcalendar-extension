/**
 * GridCalculator
 * Calculates the calendar grid layout for PDF generation
 */

import { getDaysInMonth, getFirstDayWeekday, getWeeksInMonth } from '../utils/date-utils';

// ============================================
// Types
// ============================================

export interface GridConfig {
  month: number;           // 1-12
  year: number;
  weekStarts: 0 | 1;       // 0=Sunday, 1=Monday
  pageWidth: number;       // in mm
  pageHeight: number;      // in mm
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  titleHeight: number;     // Height for month title
  headerHeight: number;    // Height for weekday header
  legendHeight: number;    // Height for legend (0 if none)
}

export interface DayCell {
  day: number;             // 1-31
  x: number;               // X position in mm
  y: number;               // Y position in mm
  width: number;           // Cell width in mm
  height: number;          // Cell height in mm
  row: number;             // Row (0-based)
  col: number;             // Column (0-6)
}

export interface GridLayout {
  cells: DayCell[];
  numRows: number;
  numCols: number;
  cellWidth: number;
  cellHeight: number;
  rowHeights: number[];
  gridWidth: number;
  gridHeight: number;
  gridTop: number;         // Y position where grid starts
  gridLeft: number;        // X position where grid starts
}

// ============================================
// Page sizes (in mm)
// ============================================

export const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
};

// ============================================
// Grid Calculation
// ============================================

/**
 * Calculates the complete grid layout for a month
 */
export function calculateGrid(config: GridConfig): GridLayout {
  const {
    month,
    year,
    weekStarts,
    pageWidth,
    pageHeight,
    margins,
    titleHeight,
    headerHeight,
    legendHeight,
  } = config;

  // Number of days and weeks
  const daysInMonth = getDaysInMonth(year, month);
  const weekdayOfFirst = getFirstDayWeekday(year, month, weekStarts);
  const numRows = getWeeksInMonth(year, month, weekStarts);
  const numCols = 7;

  // Calculate available area
  const gridWidth = pageWidth - margins.left - margins.right;
  const gridHeight = pageHeight - margins.top - margins.bottom - titleHeight - headerHeight - legendHeight;
  const gridTop = margins.top + titleHeight + headerHeight;
  const gridLeft = margins.left;

  // Cell size
  const cellWidth = gridWidth / numCols;
  const cellHeight = gridHeight / numRows;

  // Initial row heights (evenly distributed)
  const rowHeights = Array(numRows).fill(cellHeight);

  // Calculate cells
  const cells: DayCell[] = [];
  let currentDay = 1;

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      // First row: start from weekdayOfFirst
      if (row === 0 && col < weekdayOfFirst) {
        continue;
      }

      // Stop after last day
      if (currentDay > daysInMonth) {
        break;
      }

      const x = gridLeft + col * cellWidth;
      const y = gridTop + row * cellHeight;

      cells.push({
        day: currentDay,
        x,
        y,
        width: cellWidth,
        height: cellHeight,
        row,
        col,
      });

      currentDay++;
    }
  }

  return {
    cells,
    numRows,
    numCols,
    cellWidth,
    cellHeight,
    rowHeights,
    gridWidth,
    gridHeight,
    gridTop,
    gridLeft,
  };
}

/**
 * Finds the cell for a specific day
 */
export function getCellForDay(grid: GridLayout, day: number): DayCell | undefined {
  return grid.cells.find((cell) => cell.day === day);
}

/**
 * Calculates page dimensions based on format and orientation
 */
export function getPageDimensions(
  pageSize: string,
  orientation: 'landscape' | 'portrait'
): { width: number; height: number } {
  const size = PAGE_SIZES[pageSize] || PAGE_SIZES.A4;

  if (orientation === 'landscape') {
    return { width: size.height, height: size.width };
  }

  return { width: size.width, height: size.height };
}

/**
 * Converts mm to pdfmake Points (1mm = 2.83465 pt)
 */
export function mmToPt(mm: number): number {
  return mm * 2.83465;
}

/**
 * Converts Points to mm
 */
export function ptToMm(pt: number): number {
  return pt / 2.83465;
}
