import React, { useState } from "react";
import ScheduleCard from "./ScheduleCard";
import TodoCard from "./TodoCard";
import CalendarCard from "./CalendarCard";
import AttendanceCard from "./AttendanceCard";
import NoticeBoardCard from "./NoticeBoardCard";
import TimerCard from "./TimerCard";
import { AlertTriangle, RefreshCw, Check, Sparkles } from "lucide-react";
import { resetAllSemesterData } from "../lib/supabase";

interface DashboardLayoutProps {
  onManageSchedule: () => void;
  onNavigateToBoard: () => void;
  onNavigateToTimer: () => void;
  onNavigateToCalendar: () => void;
}

export default function DashboardLayout({ onManageSchedule, onNavigateToBoard, onNavigateToTimer, onNavigateToCalendar }: DashboardLayoutProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  
  const today = new Date();
  const isFebruary = today.getMonth() === 1; // 1 is February in JS Date
  
  const handleReset = async () => {
    const success = await resetAllSemesterData();
    if (success) {
      setResetSuccess(true);
      setShowConfirmModal(false);
      setTimeout(() => {
        setResetSuccess(false);
      }, 3000);
    }
  };

  return (
    <main className="max-w-[1600px] mx-auto p-6 lg:p-8 space-y-6">
      {/* Semester Reset Banner (Only shown in February for starting the new semester) */}
      {isFebruary && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-100 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in relative overflow-hidden">
          {/* Soft amber/rose background aura */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50/50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-50/30 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none"></div>

          <div className="flex items-start gap-3.5 z-10">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-gray-800 flex items-center gap-1.5">
                  새 학기 전체 기록 초기화
                </h3>
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full animate-pulse">
                  <Sparkles className="w-2.5 h-2.5" />
                  2월 1일 새학기 준비 기간!
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-[800px]">
                새 학기 시작(매년 2월 1일 기준)을 맞이하여 담임노트의 모든 데이터(시간표, 오늘 할 일 목록, 출결 현황, 달력 일정)를 깨끗하게 리셋하고 초기화할 수 있습니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 z-10 self-end md:self-center">
            {resetSuccess ? (
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-emerald-100 animate-scale-up">
                <Check className="w-3.5 h-3.5" />
                초기화 완료!
              </span>
            ) : (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shadow-amber-200 hover:scale-102 active:scale-98 select-none whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                전체 기록 리셋하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isFebruary && showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-100 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-scale-up text-left space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h4 className="text-base font-extrabold text-gray-900">
                정말로 전체 기록을 초기화할까요?
              </h4>
            </div>

            <p className="text-xs text-gray-500 font-medium leading-relaxed">
              이 작업은 되돌릴 수 없습니다. <strong className="text-gray-800">등록된 시간표, 오늘 할 일 목록, 출결 현황, 달력의 모든 학급 일정 및 할 일</strong>이 영구히 삭제되며 초기 상태로 깨끗하게 리셋됩니다.
            </p>

            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-[11px] font-semibold text-rose-800 leading-relaxed">
              ⚠️ 주의: 연동된 Supabase 데이터베이스와 기기 내 모든 로컬 캐시 백업이 함께 삭제됩니다.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-all cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-rose-200"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                예, 모두 초기화합니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3 Column Grid Layout: Left (30%), Center (45%), Right (25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-[30%_45%_25%] gap-6 items-start">
        
        {/* Left Column (30%) - Schedule, To-do */}
        <section className="space-y-6 flex flex-col lg:h-[calc(100vh-146px)]">
          <div className="h-[360px] lg:flex-1 min-h-[300px]">
            <ScheduleCard onManageSchedule={onManageSchedule} />
          </div>
          <div className="h-[320px] shrink-0">
            <TodoCard />
          </div>
        </section>

        {/* Center Column (45%) - Academic Calendar */}
        <section className="lg:h-[calc(100vh-146px)] flex flex-col">
          <div className="flex-1 min-h-[500px] lg:h-full">
            <CalendarCard onNavigateToCalendar={onNavigateToCalendar} />
          </div>
        </section>

        {/* Right Column (25%) - Attendance, NoticeBoard, Timer */}
        <section className="space-y-6 flex flex-col lg:h-[calc(100vh-146px)] overflow-y-auto pr-0.5 scrollbar-thin">
          <div className="h-[220px] shrink-0">
            <AttendanceCard />
          </div>
          <div className="hidden sm:block h-[250px] shrink-0">
            <NoticeBoardCard onNavigateToBoard={onNavigateToBoard} />
          </div>
          <div className="hidden sm:block h-[210px] shrink-0">
            <TimerCard onNavigateToTimer={onNavigateToTimer} />
          </div>
        </section>

      </div>
    </main>
  );
}
