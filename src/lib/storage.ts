import { DaySchedule, ScheduleLesson, DailyAttendance } from "../types";
import { 
  getCachedSchedules, 
  saveCachedSchedules, 
  getCachedAttendance 
} from "./supabase";

// Default daily lessons template
export const DEFAULT_LESSONS: ScheduleLesson[] = [
  { id: "def-1", subject: "", content: "" },
  { id: "def-2", subject: "", content: "" },
  { id: "def-3", subject: "", content: "" },
  { id: "def-4", subject: "", content: "" },
  { id: "def-5", subject: "", content: "" },
];

/**
 * Generates YYYY-MM-DD date string
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Generates an array of weekday date strings from startDate (inclusive) to endDate (inclusive)
 */
export function generateWeekdayDates(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(formatDate(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Get all saved schedules
 */
export function getSchedules(): DaySchedule[] {
  return getCachedSchedules();
}

/**
 * Save schedules list
 */
export function saveSchedules(schedules: DaySchedule[]): void {
  saveCachedSchedules(schedules);
}

/**
 * Get schedule for a specific date, e.g. "2026-07-14"
 */
export function getScheduleForDate(dateStr: string): DaySchedule | undefined {
  const all = getSchedules();
  return all.find((s) => s.date === dateStr);
}

export function getAttendanceForDate(dateStr: string): DailyAttendance {
  const allList = getCachedAttendance();
  const forDate = allList.filter((item) => item.date === dateStr);

  const mapped: DailyAttendance = {
    date: dateStr,
    absent: [],
    experiential: [],
    tardy: [],
    earlyLeave: [],
  };

  forDate.forEach((item) => {
    if (item.category === "absent") {
      mapped.absent.push(item.studentName);
    } else if (item.category === "experiential") {
      mapped.experiential.push(item.studentName);
    } else if (item.category === "tardy") {
      mapped.tardy.push(item.studentName);
    } else if (item.category === "earlyLeave") {
      mapped.earlyLeave.push(item.studentName);
    }
  });

  return mapped;
}


