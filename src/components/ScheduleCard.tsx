import React, { useEffect, useState } from "react";
import { Clock, CalendarDays, ExternalLink, Loader2 } from "lucide-react";
import { getScheduleForDate, formatDate } from "../lib/storage";
import { useSupabaseInitStatus } from "../lib/supabase";

interface ScheduleCardProps {
  onManageSchedule: () => void;
}

import { ScheduleLesson } from "../types";

function loadTimetable(): ScheduleLesson[] {
  const todayStr = formatDate(new Date());
  let stored: ScheduleLesson[] = [];
  try {
    const todaySchedule = getScheduleForDate(todayStr);
    if (todaySchedule && todaySchedule.lessons) {
      stored = todaySchedule.lessons;
    }
  } catch (e) {
    console.error("Failed to load timetable", e);
  }
  return stored;
}

export default function ScheduleCard({ onManageSchedule }: ScheduleCardProps) {
  const { initialized, isConnected } = useSupabaseInitStatus();
  const [lessons, setLessons] = useState<ScheduleLesson[]>([]);

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const dateVal = String(today.getDate()).padStart(2, "0");
  const dayName = ["일", "월", "화", "수", "목", "금", "토"][today.getDay()];
  const formattedToday = `${year}.${month}.${dateVal} (${dayName})`;

  useEffect(() => {
    const handleStorageChange = () => {
      const loaded = loadTimetable();
      setLessons(loaded);
    };
    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [initialized]);

  // Helper to dynamically color subject badges beautifully based on subject name
  const getSubjectBadgeClasses = (subject: string) => {
    const sub = subject.trim();
    if (!sub) return "bg-gray-50 text-gray-500 border-gray-200";

    if (sub.includes("국어")) return "bg-red-50 text-red-700 border-red-200";
    if (sub.includes("수학")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (sub.includes("체육")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (sub.includes("사회")) return "bg-amber-50 text-amber-700 border-amber-200";
    if (sub.includes("과학")) return "bg-orange-50 text-orange-700 border-orange-200";
    if (sub.includes("영어")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
    if (sub.includes("미술")) return "bg-purple-50 text-purple-700 border-purple-200";
    if (sub.includes("음악")) return "bg-pink-50 text-pink-700 border-pink-200";
    if (sub.includes("창체") || sub.includes("재량")) return "bg-indigo-50 text-indigo-700 border-indigo-200";

    // Hash name to get stable light colors for custom subjects
    const hash = sub.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      "bg-teal-50 text-teal-700 border-teal-200",
      "bg-sky-50 text-sky-700 border-sky-200",
      "bg-violet-50 text-violet-700 border-violet-200",
      "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
      "bg-lime-50 text-lime-700 border-lime-200",
    ];
    return colors[hash % colors.length];
  };

  return (
    <div id="schedule-card" className="bg-white rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-300 border border-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-[#2563EB] rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
          <h2 className="font-sans font-bold text-sm text-gray-800">오늘 시간표</h2>
        </div>
        <button
          onClick={onManageSchedule}
          className="text-[10px] font-bold text-[#2563EB] bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 border border-blue-100/30"
        >
          <CalendarDays className="w-3 h-3" />
          <span>전체 시간표</span>
        </button>
      </div>

      {/* Schedule Items List */}
      <div className="space-y-1.5 flex-1 overflow-y-auto scrollbar-thin pr-1 relative">
        {isConnected && !initialized ? (
          <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center text-center p-4">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin mb-2" />
            <span className="text-[11px] font-bold text-gray-600">시간표 불러오는 중...</span>
            <span className="text-[9px] text-gray-400 mt-1">Supabase 연동 완료 대기 중</span>
          </div>
        ) : null}

        {lessons.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-8">
            <Clock className="w-6 h-6 text-gray-200 mb-1" />
            <p className="text-[11px] font-semibold">오늘 지정된 시간표가 없습니다.</p>
            <p className="text-[9px] text-gray-400 mt-0.5">상단 버튼으로 전체 시간표를 추가하세요.</p>
          </div>
        ) : (
          lessons.map((item, idx) => (
            <div key={item.id} className="flex items-center gap-1.5">
              {/* Period indicator */}
              <span className="text-[10px] font-bold text-gray-400 w-10 shrink-0">
                {idx + 1}교시
              </span>

              {/* Subject Badge */}
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border text-center min-w-[44px] truncate ${getSubjectBadgeClasses(
                  item.subject
                )}`}
                title={item.subject || "공란"}
              >
                {item.subject || "미입력"}
              </span>

              {/* Content text */}
              <div className="flex-1 min-w-0">
                <div className="w-full bg-gray-50/50 border border-gray-100 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors truncate text-left" title={item.content}>
                  {item.content || <span className="text-gray-300 italic font-normal">수업 내용 없음</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer shortcut link */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-semibold">
        <span className="text-gray-400">{formattedToday}</span>
        <button
          onClick={onManageSchedule}
          className="text-[#2563EB] hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          <span>시간표 수정/추가</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}
