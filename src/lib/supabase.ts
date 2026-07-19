import { createClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { DaySchedule, TodoItem, DailyAttendance, ScheduleLesson, SupabaseAttendanceItem } from "../types";
import { getOwnerId } from "@/lib/owner";

const meta = import.meta as any;
const supabaseUrl = meta.env?.VITE_SUPABASE_URL || "https://ibhjqnqvkjrwnhunlbbm.supabase.co";
const supabaseAnonKey = meta.env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_Z_ooZya3Z8D-ruGcKer8SQ_j5QIPCgd";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Memory caches
let timetablesCache: DaySchedule[] = [];
let todosCache: TodoItem[] = [];
let attendanceCache: SupabaseAttendanceItem[] = [];
let calendarEventsCache: Record<string, string[]> = {};
let calendarCache: any[] = [];
let noticesCache: string = "";
let settingsCache: Record<string, string> = {};

let isInitialized = false;

const DEFAULT_LESSONS = [
  { id: "def-1", subject: "", content: "" },
  { id: "def-2", subject: "", content: "" },
  { id: "def-3", subject: "", content: "" },
  { id: "def-4", subject: "", content: "" },
  { id: "def-5", subject: "", content: "" },
];

function generateWeekdayDates(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function getActualTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function cleanSchedules(schedules: DaySchedule[]): DaySchedule[] {
  const actualTodayStr = getActualTodayStr();
  
  let processed = schedules.map(s => {
    if (s.date === "2026-07-14") {
      return { ...s, date: actualTodayStr };
    }
    return s;
  });

  processed = processed.filter(s => s.date >= actualTodayStr);

  // Filter out dates between 2026-07-25 and 2026-08-20 inclusive unless they contain customized lesson info
  processed = processed.filter(s => {
    if (s.date >= "2026-07-25" && s.date <= "2026-08-20") {
      return s.lessons.some(l => l.subject || l.content);
    }
    return true;
  });

  // Ensure "2026-08-21" is always present if the current date is before it
  if (!processed.some(s => s.date === "2026-08-21") && "2026-08-21" >= actualTodayStr) {
    processed.push({
      date: "2026-08-21",
      lessons: DEFAULT_LESSONS.map((l, index) => ({
        id: `2026-08-21-lesson-${index}-${Math.random().toString(36).substr(2, 4)}`,
        subject: l.subject,
        content: l.content,
      }))
    });
  }

  const unique: Record<string, DaySchedule> = {};
  processed.forEach(s => {
    if (!unique[s.date]) {
      unique[s.date] = s;
    } else {
      const currentFilled = unique[s.date].lessons.filter(l => l.subject).length;
      const newFilled = s.lessons.filter(l => l.subject).length;
      if (newFilled > currentFilled) {
        unique[s.date] = s;
      }
    }
  });

  return Object.values(unique).sort((a, b) => a.date.localeCompare(b.date));
}

export function getInitialMockSchedules(): DaySchedule[] {
  const todayStr = getActualTodayStr();
  const weekdayDates = generateWeekdayDates(todayStr, "2026-07-24");
  
  if (!weekdayDates.includes("2026-08-21") && "2026-08-21" >= todayStr) {
    weekdayDates.push("2026-08-21");
  }

  return weekdayDates.map((dateStr) => ({
    date: dateStr,
    lessons: DEFAULT_LESSONS.map((l, index) => ({
      id: `${dateStr}-lesson-${index}-${Math.random().toString(36).substr(2, 4)}`,
      subject: l.subject,
      content: l.content,
    })),
  }));
}

// Helper to get authenticated user_id using auth.uid() equivalents
export async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch (err) {
    console.warn("supabase.auth.getUser() failed", err);
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) return session.user.id;
  } catch (err) {
    console.warn("supabase.auth.getSession() failed", err);
  }
  return null;
}

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

// DB fetch functions
export async function fetchTimetablesFromDB(userId?: string | null, date?: string) {
  if (!supabase) return;
  try {
    const ownerId = getOwnerId();
    if (!ownerId) {
      throw new Error("owner_id missing");
    }
    let query = supabase.from("timetable").select("*").eq("owner_id", ownerId);
    if (date) {
      query = query.eq("date", date);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      // Group rows by date
      const grouped: Record<string, any[]> = {};
      data.forEach((row: any) => {
        if (!row.date) return;
        if (!grouped[row.date]) {
          grouped[row.date] = [];
        }
        grouped[row.date].push(row);
      });

      // Construct DaySchedule[]
      const baseSchedules = date ? [...timetablesCache] : [...getInitialMockSchedules()];

      Object.keys(grouped).forEach((d) => {
        const rows = grouped[d];
        const maxPeriod = Math.max(...rows.map(r => r.period || 0), 5);
        const lessons: ScheduleLesson[] = [];
        for (let p = 1; p <= maxPeriod; p++) {
          const row = rows.find(r => r.period === p);
          let subject = "";
          let content = "";
          if (row && row.subject) {
            const val = row.subject.trim();
            if (val.startsWith("{") && val.endsWith("}")) {
              try {
                const parsed = JSON.parse(val);
                subject = parsed.subject || "";
                content = parsed.content || "";
              } catch {
                subject = row.subject || "";
              }
            } else {
              subject = row.subject || "";
            }
          }
          lessons.push({
            id: `${d}-lesson-${p - 1}`,
            subject: subject,
            content: content
          });
        }

        const idx = baseSchedules.findIndex(s => s.date === d);
        if (idx !== -1) {
          baseSchedules[idx] = { date: d, lessons };
        } else {
          baseSchedules.push({ date: d, lessons });
        }
      });

      timetablesCache = cleanSchedules(baseSchedules);
    }
  } catch (err: any) {
    console.warn("fetchTimetablesFromDB error: " + (err?.message || err?.details || JSON.stringify(err)));
  }
}

export async function fetchTodosFromDB(userId?: string | null) {
  if (!supabase) return;
  try {
    const ownerId = getOwnerId();
    if (!ownerId) {
      throw new Error("owner_id missing");
    }
    const { data, error } = await supabase.from("todos").select("*").eq("user_id", ownerId);
    if (error) throw error;
    if (data) {
      if (data.length === 0) {
        // If DB is completely empty for this user, populate the 5 default todos directly in Supabase
        const defaultTodos = [
          { title: "출결 확인", is_completed: false },
          { title: "알림장 작성", is_completed: false },
          { title: "상담 기록", is_completed: false },
          { title: "가정통신문 확인", is_completed: false },
          { title: "생활기록부 작성", is_completed: false },
        ].map(t => {
          const payload: any = {
            title: t.title,
            is_completed: t.is_completed,
            completed_at: null,
            date: null,
            user_id: ownerId,
            owner_id: ownerId
          };
          return payload;
        });

        const { error: insertError } = await supabase.from("todos").insert(defaultTodos);
        if (insertError) throw insertError;

        // Refetch to get the database-assigned real ids (bigint/uuid)
        const { data: refetchedData, error: refetchError } = await supabase.from("todos").select("*").eq("user_id", ownerId);
        if (refetchError) throw refetchError;
        if (refetchedData) {
          todosCache = refetchedData.map((t: any) => ({
            id: t.id,
            title: t.title,
            isCompleted: t.is_completed,
            completedAt: t.completed_at || undefined,
            date: t.date || undefined
          }));
        }
      } else {
        todosCache = data.map((t: any) => ({
          id: t.id,
          title: t.title,
          isCompleted: t.is_completed,
          completedAt: t.completed_at || undefined,
          date: t.date || undefined
        }));
      }
    }
  } catch (err: any) {
    console.warn("fetchTodosFromDB error: " + (err?.message || err?.details || JSON.stringify(err)));
    throw err;
  }
}

export async function fetchAttendanceFromDB() {
  if (!supabase) return;
  const ownerId = getOwnerId();
  if (!ownerId) {
    console.log("No owner_id found, skipping attendance fetch");
    return;
  }
  try {
    const { data, error } = await supabase.from("attendance").select("*").eq("owner_id", ownerId);
    if (error) throw error;
    if (data && data.length > 0) {
      attendanceCache = data.map((item: any) => ({
        id: item.id,
        date: item.date,
        category: item.category === "early_leave" ? "earlyLeave" : (item.category as any),
        studentName: item.student_name,
      }));
      localStorage.setItem(`attendance_local_backup_${ownerId}`, JSON.stringify(attendanceCache));
    } else {
      // If DB is empty, check local backup first
      const backupStr = localStorage.getItem(`attendance_local_backup_${ownerId}`);
      if (backupStr) {
        attendanceCache = JSON.parse(backupStr);
      } else {
        // If no backup, populate default attendance and try to insert to DB
        const getRelativeDateStr = (offsetDays: number): string => {
          const d = new Date();
          d.setDate(d.getDate() + offsetDays);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}-${month}-${day}`;
        };
        const todayStr = getRelativeDateStr(0);

        const defaultAttendance: any[] = [];

        attendanceCache = defaultAttendance.map((a, idx) => ({
          id: `att-local-init-${idx}-${Date.now()}`,
          date: a.date,
          category: a.category as any,
          studentName: a.student_name
        }));

        localStorage.setItem(`attendance_local_backup_${ownerId}`, JSON.stringify(attendanceCache));

        const dbPayloads = defaultAttendance.map(a => ({
          date: a.date,
          category: a.category,
          student_name: a.student_name,
          user_id: SYSTEM_USER_ID,
          owner_id: ownerId
        }));

        try {
          const { error: insertError } = await supabase.from("attendance").insert(dbPayloads);
          if (insertError) {
            console.warn("Failed to insert default attendance to Supabase (likely RLS):", insertError.message);
          } else {
            const { data: refetchedData, error: refetchError } = await supabase.from("attendance").select("*").eq("owner_id", ownerId);
            if (!refetchError && refetchedData && refetchedData.length > 0) {
              attendanceCache = refetchedData.map((item: any) => ({
                id: item.id,
                date: item.date,
                category: item.category === "early_leave" ? "earlyLeave" : (item.category as any),
                studentName: item.student_name,
              }));
              localStorage.setItem(`attendance_local_backup_${ownerId}`, JSON.stringify(attendanceCache));
            }
          }
        } catch (dbErr) {
          console.warn("DB default attendance population failed:", dbErr);
        }
      }
    }
  } catch (err: any) {
    console.warn("fetchAttendanceFromDB error, falling back to local storage:", err?.message || err);
    const backupStr = localStorage.getItem(`attendance_local_backup_${ownerId}`);
    if (backupStr) {
      attendanceCache = JSON.parse(backupStr);
    }
  }
}

export async function fetchCalendarEvents() {
  if (!supabase) return;
  try {
    const ownerId = getOwnerId();
    if (!ownerId) {
      console.log("No owner_id found, skipping fetchCalendarEvents");
      return;
    }
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("owner_id", ownerId);
    if (error) throw error;
    if (data) {
      calendarCache = data;

      // Sync to calendarEventsCache for compatibility
      const parsedEvents: Record<string, string[]> = {};
      data.forEach((row: any) => {
        if (!row.date) return;
        if (!parsedEvents[row.date]) {
          parsedEvents[row.date] = [];
        }
        if (row.title) {
          parsedEvents[row.date].push(row.title);
        }
      });
      calendarEventsCache = parsedEvents;
      
      window.dispatchEvent(new Event("storage"));
    }
  } catch (err: any) {
    console.warn("fetchCalendarEvents error: " + (err?.message || err?.details || JSON.stringify(err)));
  }
}

export async function fetchNoticesFromDB(userId: string | null) {
  if (!supabase) return;
  try {
    if (!userId) {
      console.log("Unauthenticated user: skipping notices fetch");
      return;
    }
    const activeUserId = userId;
    const { data, error } = await supabase.from("notices").select("*").eq("id", "main").eq("user_id", activeUserId).maybeSingle();
    if (error) throw error;
    if (data) {
      noticesCache = data.notice_html;
    }
  } catch (err: any) {
    console.warn("fetchNoticesFromDB error: " + (err?.message || err?.details || JSON.stringify(err)));
  }
}

export async function fetchSettingsFromDB(userId: string | null) {
  if (!supabase) return;
  try {
    if (!userId) {
      console.log("Unauthenticated user: skipping settings fetch");
      return;
    }
    const activeUserId = userId;
    const { data, error } = await supabase.from("settings").select("*").eq("user_id", activeUserId);
    if (error) throw error;
    if (data) {
      const parsedSettings: Record<string, string> = {};
      data.forEach((row: any) => {
        parsedSettings[row.key] = row.value;
      });
      settingsCache = { ...settingsCache, ...parsedSettings };
    }
  } catch (err: any) {
    console.warn("fetchSettingsFromDB error: " + (err?.message || err?.details || JSON.stringify(err)));
  }
}

export async function initSupabaseData() {
  const getRelativeDateStr = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = getRelativeDateStr(0);

  // Set default initial caches
  timetablesCache = getInitialMockSchedules();
  todosCache = [
    { id: "todo-1", title: "출결 확인", isCompleted: false },
    { id: "todo-2", title: "알림장 작성", isCompleted: false },
    { id: "todo-3", title: "상담 기록", isCompleted: false },
    { id: "todo-4", title: "가정통신문 확인", isCompleted: false },
    { id: "todo-5", title: "생활기록부 작성", isCompleted: false },
  ];
  attendanceCache = [];
  calendarEventsCache = {};
  const savedLocalNotice = localStorage.getItem("teacher_notes_notice_html");
  noticesCache = savedLocalNotice !== null ? savedLocalNotice : "<div>1.&nbsp;내일 수학 준비물 지참</div><div>2.&nbsp;교실 사물함 정돈하기</div>";
  settingsCache = {
    "teacher_notes_board_active_tab": "notice",
    "teacher_notes_timer_initial_seconds": "2400"
  };

  if (!supabase) {
    console.warn("Supabase is not configured yet. Using in-memory state.");
    isInitialized = true;
    window.dispatchEvent(new Event("storage"));
    return;
  }

  try {
    console.log("Initializing data from Supabase...");
    const userId = await getUserId();
    console.log("Current authenticated user_id:", userId);

    // Fetch all in parallel
    await Promise.all([
      fetchTimetablesFromDB(userId),
      fetchTodosFromDB(userId),
      fetchAttendanceFromDB(),
      fetchCalendarEvents(),
      fetchNoticesFromDB(userId),
      fetchSettingsFromDB(userId)
    ]);

    // Subscribe to realtime database changes for instant cross-device synchronization
    subscribeToRealtimeChanges();

    isInitialized = true;
    console.log("Supabase data successfully loaded!");
    window.dispatchEvent(new Event("storage"));
  } catch (error) {
    console.warn("Error during Supabase initialization:", error);
    isInitialized = true;
    window.dispatchEvent(new Event("storage"));
  }
}

let realtimeChannel: any = null;

export function subscribeToRealtimeChanges() {
  if (!supabase || realtimeChannel) return;

  try {
    realtimeChannel = supabase
      .channel("supabase-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timetable" },
        async () => {
          console.log("Realtime event: timetable updated");
          await fetchTimetablesFromDB();
          window.dispatchEvent(new Event("storage"));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "todos" },
        async () => {
          console.log("Realtime event: todos updated");
          const userId = await getUserId();
          await fetchTodosFromDB(userId);
          window.dispatchEvent(new Event("storage"));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        async () => {
          console.log("Realtime event: attendance updated");
          await fetchAttendanceFromDB();
          window.dispatchEvent(new Event("storage"));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        async () => {
          console.log("Realtime event: calendar_events updated");
          await fetchCalendarEvents();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notices" },
        async () => {
          console.log("Realtime event: notices updated");
          const userId = await getUserId();
          await fetchNoticesFromDB(userId);
          window.dispatchEvent(new Event("storage"));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        async () => {
          console.log("Realtime event: settings updated");
          const userId = await getUserId();
          await fetchSettingsFromDB(userId);
          window.dispatchEvent(new Event("storage"));
        }
      )
      .subscribe();
  } catch (err) {
    console.error("Failed to subscribe to realtime changes:", err);
  }
}

// TIMETABLES APIS
export function getCachedSchedules(): DaySchedule[] {
  return cleanSchedules(timetablesCache);
}

export function saveCachedSchedules(schedules: DaySchedule[]) {
  const cleaned = cleanSchedules(schedules);
  // Update local memory cache first for immediate responsiveness
  timetablesCache = cleaned;
  window.dispatchEvent(new Event("storage"));

  if (supabase) {
    (async () => {
      try {
        const ownerId = getOwnerId();
        if (!ownerId) {
          throw new Error("owner_id missing");
        }
        
        const payloads: any[] = [];
        const datesToUpdate: string[] = [];

        cleaned.forEach(s => {
          datesToUpdate.push(s.date);
          s.lessons.forEach((lesson, index) => {
            const subjectVal = JSON.stringify({
              subject: lesson.subject || "",
              content: lesson.content || ""
            });

            const p: any = {
              date: s.date,
              period: index + 1,
              subject: subjectVal,
              user_id: SYSTEM_USER_ID,
              owner_id: ownerId
            };
            payloads.push(p);
          });
        });

        // 1. Delete existing records for these dates to prevent leftover period rows
        if (datesToUpdate.length > 0) {
          const { error: deleteError } = await supabase
            .from("timetable")
            .delete()
            .in("date", datesToUpdate)
            .eq("owner_id", ownerId);
          if (deleteError) {
            console.error("Delete from timetable error:", deleteError);
            throw deleteError;
          }
        }

        // 2. Insert new period records
        if (payloads.length > 0) {
          console.log("payloads", payloads);
          const { error: insertError } = await supabase
            .from("timetable")
            .insert(payloads);
          console.log("insertError", insertError);
          if (insertError) {
            console.error("Insert into timetable error:", insertError);
            throw insertError;
          }
          console.log("insert success");
        }

        // 3. Re-query from Supabase to refresh state and sync screen as requested
        await fetchTimetablesFromDB();
        console.log("fetch complete");
        window.dispatchEvent(new Event("storage"));
      } catch (err) {
        console.error("Failed to save timetable to Supabase", err);
        throw err;
      }
    })();
  }
}

// ATTENDANCE APIS
export function getCachedAttendance(): SupabaseAttendanceItem[] {
  return attendanceCache;
}

export async function addAttendanceToDB(date: string, category: string, studentName: string): Promise<SupabaseAttendanceItem | null> {
  if (!supabase) {
    throw new Error("Supabase client is not initialized.");
  }
  const ownerId = getOwnerId();
  if (!ownerId) {
    throw new Error("owner_id missing");
  }

  const mappedCategory = category === "earlyLeave" ? "early_leave" : category;

  const localId = `att-local-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const newItem: SupabaseAttendanceItem = {
    id: localId,
    date,
    category: category as any,
    studentName,
  };

  try {
    const payload: any = {
      date,
      category: mappedCategory,
      student_name: studentName,
      user_id: SYSTEM_USER_ID,
      owner_id: ownerId
    };
    const { data, error } = await supabase.from("attendance").insert(payload).select().single();
    if (error) {
      console.error("===== ATTENDANCE INSERT ERROR =====");
      console.error(error);
      throw error;
    }
    if (data) {
      const dbItem: SupabaseAttendanceItem = {
        id: data.id,
        date: data.date,
        category: data.category === "early_leave" ? "earlyLeave" : (data.category as any),
        studentName: data.student_name,
      };
      attendanceCache.push(dbItem);
      localStorage.setItem(`attendance_local_backup_${ownerId}`, JSON.stringify(attendanceCache));
      window.dispatchEvent(new Event("storage"));
      return dbItem;
    }
  } catch (err: any) {
    console.error("addAttendanceToDB exception:", err?.message || err);
    throw err;
  }
  return null;
}

export async function updateAttendanceInDB(id: string | number, updates: Partial<SupabaseAttendanceItem>): Promise<void> {
  if (!supabase) return;
  const ownerId = getOwnerId();
  if (!ownerId) {
    attendanceCache = attendanceCache.map(item => {
      if (item.id === id) {
        const updated = { ...item };
        if (updates.date !== undefined) updated.date = updates.date;
        if (updates.category !== undefined) updated.category = updates.category;
        if (updates.studentName !== undefined) updated.studentName = updates.studentName;
        return updated;
      }
      return item;
    });
    window.dispatchEvent(new Event("storage"));
    return;
  }

  attendanceCache = attendanceCache.map(item => {
    if (item.id === id) {
      const updated = { ...item };
      if (updates.date !== undefined) updated.date = updates.date;
      if (updates.category !== undefined) updated.category = updates.category;
      if (updates.studentName !== undefined) updated.studentName = updates.studentName;
      return updated;
    }
    return item;
  });
  localStorage.setItem(`attendance_local_backup_${ownerId}`, JSON.stringify(attendanceCache));
  window.dispatchEvent(new Event("storage"));

  const isMock = typeof id === "string" && id.startsWith("att-");
  if (!isMock) {
    try {
      const payload: any = {};
      if (updates.date !== undefined) payload.date = updates.date;
      if (updates.category !== undefined) {
        payload.category = updates.category === "earlyLeave" ? "early_leave" : updates.category;
      }
      if (updates.studentName !== undefined) payload.student_name = updates.studentName;

      const { error } = await supabase.from("attendance").update(payload).eq("id", id).eq("owner_id", ownerId);
      if (error) {
        console.warn("Supabase update failed (likely RLS), changes saved locally:", error.message);
      }
    } catch (err: any) {
      console.warn("updateAttendanceInDB exception:", err?.message || err);
    }
  }
}

export async function deleteAttendanceFromDB(id: string | number): Promise<void> {
  if (!supabase) return;
  const ownerId = getOwnerId();
  if (!ownerId) {
    attendanceCache = attendanceCache.filter(item => item.id !== id);
    window.dispatchEvent(new Event("storage"));
    return;
  }

  attendanceCache = attendanceCache.filter(item => item.id !== id);
  localStorage.setItem(`attendance_local_backup_${ownerId}`, JSON.stringify(attendanceCache));
  window.dispatchEvent(new Event("storage"));

  const isMock = typeof id === "string" && id.startsWith("att-");
  if (!isMock) {
    try {
      const { error } = await supabase.from("attendance").delete().eq("id", id).eq("owner_id", ownerId);
      if (error) {
        console.warn("Supabase delete failed (likely RLS), changes saved locally:", error.message);
      }
    } catch (err: any) {
      console.warn("deleteAttendanceFromDB exception:", err?.message || err);
    }
  }
}

// TODOS APIS
export function getCachedTodos(): TodoItem[] {
  return todosCache;
}

export async function addTodoToDB(title: string, dateStr?: string): Promise<TodoItem | null> {
  if (!supabase) {
    throw new Error("Supabase client is not initialized.");
  }
  try {
    const ownerId = getOwnerId();
    if (!ownerId) {
      throw new Error("owner_id missing");
    }
    const payload: any = {
      title,
      is_completed: false,
      completed_at: null,
      date: dateStr || null,
      user_id: ownerId,
      owner_id: ownerId
    };
    const { data, error } = await supabase.from("todos").insert(payload).select().single();
    if (error) throw error;
    if (data) {
      const newTodo: TodoItem = {
        id: data.id,
        title: data.title,
        isCompleted: data.is_completed,
        completedAt: data.completed_at || undefined,
        date: data.date || undefined
      };
      // Re-query from Supabase immediately to sync state across other devices
      await fetchTodosFromDB();
      window.dispatchEvent(new Event("storage"));
      return newTodo;
    }
  } catch (err) {
    console.error("addTodoToDB error:", err);
    throw err;
  }
  return null;
}

export async function updateTodoInDB(id: string | number, updates: Partial<TodoItem>): Promise<void> {
  if (!supabase) return;
  try {
    const ownerId = getOwnerId();
    if (!ownerId) {
      throw new Error("owner_id missing");
    }
    const payload: any = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.isCompleted !== undefined) payload.is_completed = updates.isCompleted;
    if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt || null;
    if (updates.date !== undefined) payload.date = updates.date || null;
    payload.owner_id = ownerId;

    const { error } = await supabase.from("todos").update(payload).eq("id", id).eq("user_id", ownerId);
    if (error) throw error;

    // Re-query from Supabase immediately to sync state across other devices
    await fetchTodosFromDB();
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function deleteTodoFromDB(id: string | number): Promise<void> {
  if (!supabase) return;
  try {
    const ownerId = getOwnerId();
    if (!ownerId) {
      throw new Error("owner_id missing");
    }
    const { error } = await supabase.from("todos").delete().eq("id", id).eq("user_id", ownerId);
    if (error) throw error;

    // Re-query from Supabase immediately to sync state across other devices
    await fetchTodosFromDB();
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export function saveCachedTodos(todos: TodoItem[]) {
  todosCache = todos;
  window.dispatchEvent(new Event("storage"));

  if (supabase) {
    (async () => {
      try {
        const ownerId = getOwnerId();
        if (!ownerId) {
          throw new Error("owner_id missing");
        }
        
        // Fetch current DB IDs to determine deletions (scoped by user_id if logged in)
        const { data, error: selectError } = await supabase.from("todos").select("id").eq("user_id", ownerId);
        if (selectError) throw selectError;

        const currentIds = data ? data.map((row: any) => row.id) : [];
        const newIds = todos.map(t => t.id);
        const toDelete = currentIds.filter(id => !newIds.includes(id));

        if (toDelete.length > 0) {
          const { error: deleteError } = await supabase.from("todos").delete().in("id", toDelete).eq("user_id", ownerId);
          if (deleteError) throw deleteError;
        }

        if (todos.length > 0) {
          const payload = todos.map(t => {
            const p: any = {
              title: t.title,
              is_completed: t.isCompleted,
              completed_at: t.completedAt || null,
              date: t.date || null,
              user_id: ownerId,
              owner_id: ownerId
            };
            if (typeof t.id === 'number' || (typeof t.id === 'string' && /^\d+$/.test(t.id))) {
              p.id = t.id;
            }
            return p;
          });
          const { error: upsertError } = await supabase.from("todos").upsert(payload, { onConflict: 'id' });
          if (upsertError) throw upsertError;
        }

        // 저장 후 즉시 다시 조회하여 화면을 갱신하도록 수정
        await fetchTodosFromDB();
        window.dispatchEvent(new Event("storage"));
      } catch (err) {
        console.error(err);
      }
    })();
  }
}

// CALENDAR APIS
export function getCachedCalendarEvents(): Record<string, string[]> {
  return calendarEventsCache;
}

export function saveCachedCalendarEvents(events: Record<string, string[]>) {
  calendarEventsCache = events;
  window.dispatchEvent(new Event("storage"));

  if (supabase) {
    (async () => {
      try {
        const ownerId = getOwnerId();
        if (!ownerId) {
          console.log("Unauthenticated user: skipping calendar events sync to Supabase");
          return;
        }
        
        // Delete all existing events for this user to perform a clean overwrite
        const { error: deleteError } = await supabase
          .from("calendar_events")
          .delete()
          .eq("owner_id", ownerId);
        if (deleteError) throw deleteError;

        // Build payloads for each individual event
        const payloads: any[] = [];
        Object.keys(events).forEach(d => {
          const titles = events[d] || [];
          titles.forEach(t => {
            if (t && t.trim()) {
              payloads.push({
                date: d,
                title: t.trim(),
                owner_id: ownerId
              });
            }
          });
        });

        if (payloads.length > 0) {
          const { error: insertError } = await supabase
            .from("calendar_events")
            .insert(payloads);
          if (insertError) throw insertError;
        }

        // 저장 후 즉시 다시 조회하여 화면을 갱신하도록 수정
        await fetchCalendarEvents();
        window.dispatchEvent(new Event("storage"));
      } catch (err) {
        console.error("Failed to sync calendar events to Supabase", err);
      }
    })();
  }
}

export async function addCalendarEvent(date: string, title: string, color?: string) {
  if (!supabase) return null;
  try {
    const ownerId = getOwnerId();
    if (!ownerId) {
      throw new Error("owner_id missing");
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
          owner_id: ownerId,
          date,
          title,
          color: color || null
      })
      .select()
      .single();

    if (error) throw error;

    await fetchCalendarEvents();
    window.dispatchEvent(new Event("storage"));
    return data;
  } catch (err) {
    console.error("addCalendarEvent error:", err);
    throw err;
  }
}

export async function updateCalendarEvent(id: string | number, title: string, color?: string) {
  if (!supabase) return;
  try {
    const ownerId = getOwnerId();
    if (!ownerId) {
      throw new Error("owner_id missing");
    }

    const { error } = await supabase
      .from("calendar_events")
      .update({
          title,
          color: color || null
      })
      .eq("id", id)
      .eq("owner_id", ownerId);

    if (error) throw error;

    await fetchCalendarEvents();
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.error("updateCalendarEvent error:", err);
    throw err;
  }
}

export async function deleteCalendarEvent(id: string | number) {
  if (!supabase) return;
  try {
    const ownerId = getOwnerId();
    if (!ownerId) {
      throw new Error("owner_id missing");
    }

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id)
      .eq("owner_id", ownerId);

    if (error) throw error;

    await fetchCalendarEvents();
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.error("deleteCalendarEvent error:", err);
    throw err;
  }
}

// NOTICES APIS
export function getCachedNoticeHtml(): string {
  const savedLocalNotice = localStorage.getItem("teacher_notes_notice_html");
  if (savedLocalNotice !== null) {
    noticesCache = savedLocalNotice;
  }
  return noticesCache;
}

export function saveCachedNoticeHtml(html: string) {
  noticesCache = html;
  localStorage.setItem("teacher_notes_notice_html", html);
  window.dispatchEvent(new Event("storage"));

  if (supabase) {
    (async () => {
      try {
        const userId = await getUserId();
        if (!userId) {
          console.log("Unauthenticated user: skipping notice html sync to Supabase");
          return;
        }
        const payload: any = {
          id: "main",
          notice_html: html,
          user_id: userId
        };
        const { error } = await supabase.from("notices").upsert(payload, { onConflict: 'user_id,id' });
        if (error) throw error;

        // 저장 후 즉시 다시 조회하여 화면을 갱신하도록 수정
        await fetchNoticesFromDB(userId);
        window.dispatchEvent(new Event("storage"));
      } catch (err) {
        console.error("Failed to save notice html to Supabase", err);
      }
    })();
  }
}

// SETTINGS APIS
export function getCachedSetting(key: string, defaultValue: string): string {
  return settingsCache[key] ?? defaultValue;
}

export function saveCachedSetting(key: string, value: string) {
  settingsCache[key] = value;
  window.dispatchEvent(new Event("storage"));

  if (supabase) {
    (async () => {
      try {
        const userId = await getUserId();
        if (!userId) {
          console.log("Unauthenticated user: skipping setting sync to Supabase");
          return;
        }
        const payload: any = {
          key,
          value,
          user_id: userId
        };
        const { error } = await supabase.from("settings").upsert(payload, { onConflict: 'user_id,key' });
        if (error) throw error;

        // 저장 후 즉시 다시 조회하여 화면을 갱신하도록 수정
        await fetchSettingsFromDB(userId);
        window.dispatchEvent(new Event("storage"));
      } catch (err) {
        console.error("Failed to save setting to Supabase", err);
      }
    })();
  }
}

export function isSupabaseInitialized() {
  return isInitialized;
}

export async function resetAllSemesterData(): Promise<boolean> {
  const ownerId = getOwnerId();
  if (!ownerId) return false;

  try {
    if (supabase) {
      // Delete from timetable
      const { error: tErr } = await supabase.from("timetable").delete().eq("owner_id", ownerId);
      if (tErr) console.warn("Reset timetable error:", tErr);

      // Delete from todos
      const { error: dErr } = await supabase.from("todos").delete().eq("user_id", ownerId);
      if (dErr) console.warn("Reset todos error:", dErr);

      // Delete from attendance
      const { error: aErr } = await supabase.from("attendance").delete().eq("owner_id", ownerId);
      if (aErr) console.warn("Reset attendance error:", aErr);

      // Delete from calendar_events
      const { error: cErr } = await supabase.from("calendar_events").delete().eq("owner_id", ownerId);
      if (cErr) console.warn("Reset calendar_events error:", cErr);
    }

    // Clear local backup
    localStorage.removeItem(`attendance_local_backup_${ownerId}`);
    localStorage.removeItem("teacher_notes_notice_html");

    // Reset in-memory caches
    timetablesCache = getInitialMockSchedules();
    todosCache = [
      { id: "todo-1", title: "출결 확인", isCompleted: false },
      { id: "todo-2", title: "알림장 작성", isCompleted: false },
      { id: "todo-3", title: "상담 기록", isCompleted: false },
      { id: "todo-4", title: "가정통신문 확인", isCompleted: false },
      { id: "todo-5", title: "생활기록부 작성", isCompleted: false },
    ];
    attendanceCache = [];
    calendarEventsCache = {};
    calendarCache = [];
    noticesCache = "<div>1.&nbsp;내일 수학 준비물 지참</div><div>2.&nbsp;교실 사물함 정돈하기</div>";

    // Trigger storage event so that all other views refresh
    window.dispatchEvent(new Event("storage"));
    return true;
  } catch (err) {
    console.error("Failed to reset all data:", err);
    return false;
  }
}

export function useSupabaseInitStatus() {
  const [initialized, setInitialized] = useState(isInitialized);

  useEffect(() => {
    const handleStorage = () => {
      setInitialized(isInitialized);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return {
    initialized,
    isConnected: !!supabase,
    supabaseUrl: supabaseUrl || null
  };
}
