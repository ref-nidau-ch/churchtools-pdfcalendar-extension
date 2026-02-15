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

  const params = new URLSearchParams();
  for (const id of calendarIds) {
    params.append('calendar_ids[]', id.toString());
  }
  params.append('from', formatDateForApi(from));
  params.append('to', formatDateForApi(to));
  params.append('include[]', 'tags');

  const queryString = params.toString();

  // The API returns { appointment: { base: AppointmentBase, calculated: { startDate, endDate } } }
  interface RawAppointment {
    appointment: {
      base: {
        id: number;
        caption?: string;
        title?: string;
        note?: string | null;
        subtitle?: string | null;
        startDate: string;
        endDate: string;
        allDay: boolean;
        version: number;
        link: string | null;
        isInternal: boolean;
        repeatId: number;
        repeatFrequency?: number | null;
        repeatUntil?: string | null;
        repeatOption?: number | null;
        address?: CTAppointment['address'];
        information?: string | null;
        description?: string | null;
        image?: CTAppointment['image'];
        calendar: CTAppointment['calendar'];
      };
      calculated: {
        startDate: string;
        endDate: string;
      };
    };
    tags?: CTTag[];
  }

  const response = await churchtoolsClient.get<CTApiResponse<RawAppointment[]>>(
    `/calendars/appointments?${queryString}`
  );

  const rawList = response.data ?? response ?? [];

  return (rawList as RawAppointment[]).map((item) => {
    // Handle both nested { appointment: { base, calculated } } and flat { base, calculated } formats
    const apt = item.appointment ?? item;
    const base = (apt as RawAppointment['appointment']).base;
    const calculated = (apt as RawAppointment['appointment']).calculated;

    return {
      id: base.id,
      caption: base.caption ?? base.title ?? '',
      note: base.note ?? base.subtitle ?? '',
      startDate: calculated.startDate ?? base.startDate,
      endDate: calculated.endDate ?? base.endDate,
      allDay: base.allDay,
      version: base.version,
      link: base.link ?? '',
      isInternal: base.isInternal,
      repeatId: base.repeatId,
      repeatFrequency: base.repeatFrequency != null ? String(base.repeatFrequency) : undefined,
      repeatUntil: base.repeatUntil ?? undefined,
      repeatOption: base.repeatOption ?? undefined,
      address: base.address ?? null,
      information: base.information ?? base.description ?? undefined,
      image: base.image ?? null,
      calendar: base.calendar,
      tags: item.tags ?? [],
    };
  });
}

/**
 * Filters appointments by their visibility flag (isInternal).
 * "public" = only appointments visible to everyone (isInternal === false)
 * "private" = only appointments for logged-in users (isInternal === true)
 * "all" = no filter
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
      return !apt.isInternal;
    }
    if (visibility === 'private') {
      return apt.isInternal;
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
 * Fetches all appointment tags via /tags/appointment
 */
export async function fetchAppointmentTags(): Promise<CTTag[]> {
  try {
    const response = await churchtoolsClient.get<CTApiResponse<CTTag[]>>('/tags/appointment');
    return response.data ?? response ?? [];
  } catch (error) {
    console.warn('Tags API not available:', error);
    return [];
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
// Logo API
// ============================================

/**
 * Fetches the site logo as a base64 data URL for embedding in PDFs.
 *
 * Strategy (in order):
 * 1. Extract from ChurchTools DOM — the CT app renders the logo in
 *    the navigation; this works for any authenticated user.
 * 2. Fallback: try GET /api/config for the site_logo path (admin only).
 *
 * Returns null if no logo is found or on any failure.
 */
export async function fetchSiteLogo(): Promise<string | null> {
  // Strategy 1: Find logo in the ChurchTools DOM
  const domUrl = findLogoInDom();
  if (domUrl) {
    const dataUrl = await fetchImageAsDataUrl(domUrl);
    if (dataUrl) return dataUrl;
  }

  // Strategy 2: Try /api/config (works for admins)
  try {
    const config = await churchtoolsClient.get<{ site_logo?: string }>('/config');
    const logoPath = config.site_logo;
    if (logoPath) {
      const baseUrl = (window as { settings?: { base_url?: string } }).settings?.base_url
        ?? import.meta.env.VITE_BASE_URL;
      if (baseUrl) {
        const logoUrl = `${baseUrl.replace(/\/$/, '')}/${logoPath}`;
        const dataUrl = await fetchImageAsDataUrl(logoUrl);
        if (dataUrl) return dataUrl;
      }
    }
  } catch { /* not admin or endpoint unavailable */ }

  return null;
}

/**
 * Searches the ChurchTools DOM for the site logo image.
 * CT renders the logo in the navigation bar; we look for common selectors.
 */
function findLogoInDom(): string | null {
  // CT uses an img inside the navigation header for the site logo
  const selectors = [
    'img.ct-logo',
    'img[data-test="site-logo"]',
    '.ct-header img[src*="images/"]',
    '.ct-navigation img[src*="images/"]',
    'header img[src*="images/"]',
    'nav img[src*="images/"]',
    'img[src*="images/"][alt*="logo" i]',
    'img[src*="images/"][class*="logo" i]',
  ];
  for (const selector of selectors) {
    try {
      const img = document.querySelector<HTMLImageElement>(selector);
      if (img?.src) return img.src;
    } catch { /* invalid selector, skip */ }
  }
  return null;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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
