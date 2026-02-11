/**
 * ChurchTools Calendar Types
 * Based on the ChurchTools REST API
 */

// ============================================
// API Response Types
// ============================================

// Generic API response wrapper
export interface CTApiResponse<T> {
  data: T;
  meta?: {
    count?: number;
    pagination?: {
      current: number;
      limit: number;
      total: number;
    };
  };
}

// ============================================
// Calendar Types
// ============================================

// Calendar from ChurchTools
export interface CTCalendar {
  id: number;
  name: string;
  nameTranslated: string;
  color: string;
  isPublic: boolean;
  isPrivate: boolean;
  randomUrl?: string;
  sortKey?: number;
  iCalSourceUrl?: string | null;
}

// Appointment from ChurchTools (API response format)
export interface CTAppointment {
  id: number;
  caption: string;
  startDate: string;        // ISO 8601 format: "2024-01-15T10:00:00Z"
  endDate: string;          // ISO 8601 format
  allDay: boolean;
  note: string;
  version: number;
  link: string;
  isInternal: boolean;
  repeatId: number;
  repeatFrequency?: string;
  repeatUntil?: string;
  repeatOption?: number;
  address?: CTAddress | null;
  information?: string;
  image?: CTImage | null;
  calendar: CTAppointmentCalendar;
  tags?: CTTag[];
}

// Calendar info within an appointment
export interface CTAppointmentCalendar {
  id: number;
  name: string;
  nameTranslated: string;
  color: string;
  isPublic: boolean;
  isPrivate: boolean;
}

// Address
export interface CTAddress {
  meetingAt?: string;
  street?: string;
  addition?: string;
  district?: string;
  zip?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

// Image
export interface CTImage {
  url: string;
  fileUrl?: string;
}

// ============================================
// Resource Types
// ============================================

// Resource from ChurchTools
export interface CTResource {
  id: number;
  name: string;
  resourceTypeId: number;
  resourceType?: CTResourceType;
  sortKey?: number;
  location?: string;
  iCalLocation?: string;
}

// Resource type
export interface CTResourceType {
  id: number;
  name: string;
  nameTranslated?: string;
  sortKey?: number;
}

// ============================================
// Tag Types
// ============================================

// Tag for appointments
export interface CTTag {
  id: number;
  name: string;
  count?: number;
}

// ============================================
// PDF Configuration Types
// ============================================

// PDF configuration
export interface CalendarConfig {
  month: number;
  year: number;
  title: string;
  orientation: 'landscape' | 'portrait';
  pageSize: 'A2' | 'A3' | 'A4' | 'A5';
  weekStarts: 0 | 1;  // 0=Sunday, 1=Monday
  showEndTime: boolean;
  useColors: boolean;
  showLegend: boolean;
}

// Calendar entry for PDF generation
export interface CalendarEntryData {
  day: number;
  startDate: Date;
  endDate: Date | null;
  message: string;
  textColor: RGB;
  bgColor: RGB;
  hideStartTime: boolean;
  hideEndTime: boolean;
  isContinuation: boolean;
  originalStartDate?: Date;
}

// RGB color value
export type RGB = [number, number, number];

// Time range options
export type TimeRange = 'current' | 'previous' | 'next' | 'year';

// Visibility filter
export type VisibilityFilter = 'all' | 'public' | 'private';

// Export format
export type ExportFormat = 'pdf' | 'xlsx';

// Month/Year pair
export interface MonthYear {
  month: number;
  year: number;
}

// Persisted user settings for localStorage
export interface UserSettings {
  timeRange: TimeRange;
  pageSize: string;
  orientation: string;
  visibility: VisibilityFilter;
  showEndTime: boolean;
  useColors: boolean;
  showLegend: boolean;
  calendarIds: number[];
  tagIds: number[];
}

// Form data for calendar generation
export interface CalendarFormData {
  calendarIds: number[];
  timeRange: TimeRange;
  pageSize: 'A2' | 'A3' | 'A4' | 'A5';
  orientation: 'landscape' | 'portrait';
  showEndTime: boolean;
  useColors: boolean;
  showLegend: boolean;
  visibility: VisibilityFilter;
  tagIds?: number[];
}
