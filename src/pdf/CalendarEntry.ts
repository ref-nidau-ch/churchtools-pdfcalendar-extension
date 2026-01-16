/**
 * CalendarEntry - Data model for a calendar entry
 * Port from CalendarEntry.php
 */

import type { RGB, CalendarEntryData } from '../types/calendar.types';
import { html2rgb } from './ColorUtils';

export class CalendarEntry implements CalendarEntryData {
  public day: number;
  public startDate: Date;
  public endDate: Date | null;
  public message: string;
  public textColor: RGB;
  public bgColor: RGB;
  public hideStartTime = false;
  public hideEndTime = false;
  public isContinuation = false;
  public originalStartDate?: Date;

  constructor(
    startDate: Date,
    endDate: Date | null,
    message: string,
    textColor: string | RGB = '#000000',
    bgColor: string | RGB = '#ffffff'
  ) {
    this.startDate = new Date(startDate);
    this.endDate = endDate ? new Date(endDate) : null;
    this.message = message;
    this.day = this.startDate.getDate();

    this.textColor = typeof textColor === 'string' ? html2rgb(textColor) : textColor;
    this.bgColor = typeof bgColor === 'string' ? html2rgb(bgColor) : bgColor;
  }

  /**
   * Checks if the appointment spans multiple days
   */
  isSpanningDays(): boolean {
    if (!this.endDate) return false;

    const startDay = new Date(
      this.startDate.getFullYear(),
      this.startDate.getMonth(),
      this.startDate.getDate()
    );
    const endDay = new Date(
      this.endDate.getFullYear(),
      this.endDate.getMonth(),
      this.endDate.getDate()
    );

    return startDay.getTime() !== endDay.getTime();
  }

  /**
   * Checks if this is an all-day appointment
   */
  isAllDay(): boolean {
    return (
      this.startDate.getHours() === 0 &&
      this.startDate.getMinutes() === 0 &&
      (!this.endDate ||
        (this.endDate.getHours() === 0 && this.endDate.getMinutes() === 0) ||
        (this.endDate.getHours() === 23 && this.endDate.getMinutes() === 59))
    );
  }

  /**
   * Formats the start time
   */
  getFormattedStartTime(): string {
    if (this.hideStartTime || this.isAllDay()) {
      return '';
    }

    const hours = this.startDate.getHours();
    const minutes = this.startDate.getMinutes();

    if (minutes === 0) {
      return `${hours}h `;
    }
    return `${hours}:${minutes.toString().padStart(2, '0')}h `;
  }

  /**
   * Formats the end time
   */
  getFormattedEndTime(): string {
    if (this.hideEndTime || !this.endDate || this.isAllDay()) {
      return '';
    }

    const hours = this.endDate.getHours();
    const minutes = this.endDate.getMinutes();

    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}:${minutes.toString().padStart(2, '0')}h`;
  }

  /**
   * Creates a copy of the entry for a specific day
   */
  cloneForDay(day: number, month: number, year: number): CalendarEntry {
    const newStart = new Date(year, month - 1, day, this.startDate.getHours(), this.startDate.getMinutes());
    const clone = new CalendarEntry(newStart, null, this.message, this.textColor, this.bgColor);
    clone.originalStartDate = this.startDate;
    return clone;
  }
}
