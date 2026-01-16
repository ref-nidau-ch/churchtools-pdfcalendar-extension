/**
 * ChurchTools API Service
 * Thin wrapper around @churchtools/churchtools-client for calendar operations
 */

import { churchtoolsClient } from '@churchtools/churchtools-client';
import type {
  CTCalendar,
  CTAppointment,
  CTResource,
  CTResourceType,
  CTTag,
  CTApiResponse,
  VisibilityFilter,
} from '../types/calendar.types';

// ============================================
// Calendar API
// ============================================

/**
 * Fetches all available calendars
 */
export async function fetchCalendars(): Promise<CTCalendar[]> {
  const response = await churchtoolsClient.get<CTApiResponse<CTCalendar[]>>('/calendars');
  return response.data ?? response;
}

/**
 * Fetches appointments for the specified calendars and time range
 */
export async function fetchAppointments(
  calendarIds: number[],
  from: Date,
  to: Date
): Promise<CTAppointment[]> {
  if (calendarIds.length === 0) {
    return [];
  }

  const params = {
    calendar_ids: calendarIds.join(','),
    from: formatDateForApi(from),
    to: formatDateForApi(to),
  };

  const queryString = new URLSearchParams(params).toString();
  const response = await churchtoolsClient.get<CTApiResponse<CTAppointment[]>>(
    `/calendars/appointments?${queryString}`
  );

  return response.data ?? response ?? [];
}

/**
 * Filters appointments by visibility (public/private)
 */
export function filterAppointmentsByVisibility(
  appointments: CTAppointment[],
  visibility: VisibilityFilter
): CTAppointment[] {
  if (visibility === 'all') {
    return appointments;
  }

  return appointments.filter((apt) => {
    if (visibility === 'public') {
      return apt.calendar.isPublic;
    }
    if (visibility === 'private') {
      return apt.calendar.isPrivate || !apt.calendar.isPublic;
    }
    return true;
  });
}

/**
 * Filters appointments by tags
 */
export function filterAppointmentsByTags(
  appointments: CTAppointment[],
  tagIds: number[]
): CTAppointment[] {
  // No tag filter = all appointments
  if (tagIds.length === 0) {
    return appointments;
  }

  return appointments.filter((apt) => {
    if (!apt.tags || apt.tags.length === 0) {
      return false;
    }
    // Appointment has at least one of the selected tags
    return apt.tags.some((tag) => tagIds.includes(tag.id));
  });
}

/**
 * Sorts appointments by start date
 */
export function sortAppointments(appointments: CTAppointment[]): CTAppointment[] {
  return [...appointments].sort((a, b) => {
    const dateA = new Date(a.startDate).getTime();
    const dateB = new Date(b.startDate).getTime();
    return dateA - dateB;
  });
}

// ============================================
// Tags API
// ============================================

/**
 * Fetches all appointment tags
 */
export async function fetchAppointmentTags(): Promise<CTTag[]> {
  try {
    // ChurchTools API endpoint for appointment tags
    const response = await churchtoolsClient.get<CTApiResponse<CTTag[]>>('/calendars/appointments/tags');
    return response.data ?? response ?? [];
  } catch (error) {
    // Fallback: Try generic tags endpoint
    try {
      const response = await churchtoolsClient.get<CTApiResponse<CTTag[]>>('/tags?type=appointment');
      return response.data ?? response ?? [];
    } catch {
      console.warn('Tags API not available:', error);
      return [];
    }
  }
}

// ============================================
// Resources API (optional, for future extension)
// ============================================

/**
 * Fetches all resources
 */
export async function fetchResources(): Promise<CTResource[]> {
  try {
    const response = await churchtoolsClient.get<CTApiResponse<CTResource[]>>(
      '/resource/masterdata/resources'
    );
    return response.data ?? response ?? [];
  } catch (error) {
    console.warn('Resources API not available:', error);
    return [];
  }
}

/**
 * Fetches all resource types
 */
export async function fetchResourceTypes(): Promise<CTResourceType[]> {
  try {
    const response = await churchtoolsClient.get<CTApiResponse<CTResourceType[]>>(
      '/resource/masterdata/resourcetypes'
    );
    return response.data ?? response ?? [];
  } catch (error) {
    console.warn('ResourceTypes API not available:', error);
    return [];
  }
}

/**
 * Groups resources by resource type
 */
export function groupResourcesByType(
  resources: CTResource[],
  resourceTypes: CTResourceType[]
): Map<CTResourceType, CTResource[]> {
  const grouped = new Map<CTResourceType, CTResource[]>();

  for (const resType of resourceTypes) {
    const resourcesOfType = resources.filter((r) => r.resourceTypeId === resType.id);
    if (resourcesOfType.length > 0) {
      grouped.set(resType, resourcesOfType);
    }
  }

  return grouped;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Formats date for API (YYYY-MM-DD)
 */
export function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses ISO date string to Date object
 */
export function parseApiDate(dateString: string): Date {
  return new Date(dateString);
}

/**
 * Formats address as string
 */
export function formatAddress(appointment: CTAppointment): string {
  if (!appointment.address) {
    return '';
  }

  const addr = appointment.address;
  const parts: string[] = [];

  if (addr.meetingAt) {
    parts.push(addr.meetingAt);
  }
  if (addr.street) {
    parts.push(addr.street);
  }
  if (addr.zip || addr.city) {
    parts.push([addr.zip, addr.city].filter(Boolean).join(' '));
  }

  return parts.join(', ');
}

/**
 * Gets the image URL of an appointment
 */
export function getAppointmentImageUrl(appointment: CTAppointment): string | null {
  if (!appointment.image) {
    return null;
  }
  return appointment.image.fileUrl ?? appointment.image.url ?? null;
}
