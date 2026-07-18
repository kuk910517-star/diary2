export interface Lesson {
  period: number;
  time: string;
  subject: string;
  topic: string;
  room?: string;
  isCurrent?: boolean;
  isCompleted?: boolean;
}

export interface TodoItem {
  id: string | number;
  title: string;
  isCompleted: boolean;
  completedAt?: string; // YYYY-MM-DD
  date?: string;        // YYYY-MM-DD for date-linked todos
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: "academic" | "meeting" | "evaluation" | "personal";
  color: string; // hex or tailwind class name
}

export interface DailyAttendance {
  date: string; // YYYY-MM-DD
  absent: string[]; // 결석
  experiential: string[]; // 교외체험학습
  tardy: string[]; // 지각
  earlyLeave: string[]; // 조퇴
}

export interface SupabaseAttendanceItem {
  id: string | number;
  date: string;
  category: "absent" | "experiential" | "tardy" | "earlyLeave";
  studentName: string;
}


export interface ScheduleLesson {
  id: string;
  subject: string;
  content: string;
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  lessons: ScheduleLesson[];
}
