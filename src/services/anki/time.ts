/**
 * Anki time utilities
 * Handles Anki's specific date/time semantics
 */

import { AnkiCol } from './schema';

/**
 * Get current time in epoch seconds
 */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current time in epoch milliseconds
 */
export function nowMillis(): number {
  return Date.now();
}

/**
 * Calculate days since collection creation
 * Used for review card due dates
 * 
 * @param col Collection data
 * @param timestamp Epoch seconds (defaults to now)
 * @param rolloverHour Hour of day for rollover (0-23, default 4)
 */
export function daysSinceCrt(
  col: AnkiCol,
  timestamp?: number,
  rolloverHour: number = 4
): number {
  const ts = timestamp ?? nowSeconds();
  
  // Get day start for both timestamps
  const colDayStart = getDayStart(col.crt, rolloverHour);
  const tsDayStart = getDayStart(ts, rolloverHour);
  
  // Calculate difference in days
  const diffMs = (tsDayStart - colDayStart) * 1000;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  
  return days;
}

/**
 * Convert days since crt to epoch seconds
 * 
 * @param col Collection data
 * @param days Days since collection creation
 * @param rolloverHour Hour of day for rollover (0-23, default 4)
 */
export function daysToTimestamp(
  col: AnkiCol,
  days: number,
  rolloverHour: number = 4
): number {
  const colDayStart = getDayStart(col.crt, rolloverHour);
  return colDayStart + (days * 24 * 60 * 60);
}

/**
 * Get the start of the Anki day for a given timestamp
 * Anki day starts at rolloverHour (default 4:00 AM)
 * 
 * @param timestamp Epoch seconds
 * @param rolloverHour Hour of day (0-23, default 4)
 */
export function getDayStart(timestamp: number, rolloverHour: number = 4): number {
  const date = new Date(timestamp * 1000);
  
  // Set to start of day
  date.setHours(0, 0, 0, 0);
  
  // Add rollover hours
  date.setHours(rolloverHour);
  
  // If current time is before rollover, go back one day
  const currentHour = new Date(timestamp * 1000).getHours();
  if (currentHour < rolloverHour) {
    date.setDate(date.getDate() - 1);
  }
  
  return Math.floor(date.getTime() / 1000);
}

/**
 * Get the next Anki day boundary from a timestamp
 */
export function getNextDayStart(timestamp: number, rolloverHour: number = 4): number {
  const dayStart = getDayStart(timestamp, rolloverHour);
  return dayStart + (24 * 60 * 60);
}

/**
 * Check if a card is due now
 * 
 * @param card Card with due date
 * @param col Collection data
 * @param type CardType
 */
export function isDue(
  due: number,
  type: number,
  col: AnkiCol,
  now?: number
): boolean {
  const currentTime = now ?? nowSeconds();
  
  if (type === 0) {
    // New cards are always "due" (ordered by due field)
    return true;
  } else if (type === 1 || type === 3) {
    // Learning/relearning: due is epoch seconds
    return due <= currentTime;
  } else if (type === 2) {
    // Review: due is days since crt
    const currentDay = daysSinceCrt(col, currentTime);
    return due <= currentDay;
  }
  
  return false;
}

/**
 * Counter to ensure unique IDs even within the same millisecond
 */
let idCounter = 0;

/**
 * Generate a unique ID based on current timestamp (milliseconds)
 * Includes a counter to prevent collisions within the same millisecond
 */
export function generateId(): string {
  const timestamp = nowMillis();
  const id = `${timestamp}${idCounter}`;
  idCounter = (idCounter + 1) % 1000; // Reset after 999 to keep IDs reasonable length
  return id;
}

/**
 * Add days to a timestamp (respecting Anki day boundaries)
 */
export function addDays(
  timestamp: number,
  days: number,
  rolloverHour: number = 4
): number {
  return timestamp + (days * 24 * 60 * 60);
}

/**
 * Add minutes to a timestamp
 */
export function addMinutes(timestamp: number, minutes: number): number {
  return timestamp + (minutes * 60);
}
