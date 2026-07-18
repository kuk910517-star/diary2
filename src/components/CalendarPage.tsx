import React from "react";
import { ChevronLeft, Calendar as CalendarIcon } from "lucide-react";
import CalendarCard from "./CalendarCard";

interface CalendarPageProps {
  onBack: () => void;
}

export default function CalendarPage({ onBack }: CalendarPageProps) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const dateVal = String(today.getDate()).padStart(2, "0");
  const formattedTodayDot = `${year}.${month}.${dateVal}`;

  return (
    <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in flex flex-col min-h-[calc(100vh-90px)]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white border border-transparent hover:border-gray-200 rounded-xl transition-all cursor-pointer text-gray-500 hover:text-gray-950 flex items-center justify-center"
            title="메인 화면으로 돌아가기"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md">
                학급관리
              </span>
              <span className="text-[10px] text-gray-400 font-medium">기준일: {formattedTodayDot}</span>
            </div>
            <h1 className="font-sans font-extrabold text-xl text-gray-950 tracking-tight mt-0.5">
              학급 월간 일정 및 달력
            </h1>
          </div>
        </div>
      </div>

      {/* Main Calendar Card - occupying full space */}
      <div className="flex-1 min-h-[500px]">
        <CalendarCard />
      </div>
    </div>
  );
}
