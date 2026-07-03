import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateBookingId() {
  const year = new Date().getFullYear();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `KTM-${year}-${randomStr}`;
}

export function isBookingExpired(bookingDateStr: string, bookingTimeRange: string): boolean {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const localDateStr = `${year}-${month}-${date}`;

    if (bookingDateStr < localDateStr) return true;
    if (bookingDateStr > localDateStr) return false;

    const parts = bookingTimeRange.replace(/\s+/g, '').split('-');
    const end = parts[1] || parts[0];
    if (!end) return false;
    const endDateTime = new Date(`${bookingDateStr}T${end}`);
    return now > endDateTime;
  } catch (err) {
    console.error('Error parsing booking expiration:', err);
    return false;
  }
}

export function isBookingNotStartedYet(bookingDateStr: string, bookingTimeRange: string): boolean {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const localDateStr = `${year}-${month}-${date}`;

    if (bookingDateStr > localDateStr) return true;
    if (bookingDateStr < localDateStr) return false;

    const parts = bookingTimeRange.replace(/\s+/g, '').split('-');
    const start = parts[0];
    if (!start) return false;
    const startDateTime = new Date(`${bookingDateStr}T${start}`);
    return now < startDateTime;
  } catch (err) {
    console.error('Error parsing booking start:', err);
    return false;
  }
}
