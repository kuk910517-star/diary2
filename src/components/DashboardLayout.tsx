import React from "react";
import ScheduleCard from "./ScheduleCard";
import TodoCard from "./TodoCard";
import CalendarCard from "./CalendarCard";
import AttendanceCard from "./AttendanceCard";
import NoticeBoardCard from "./NoticeBoardCard";
import TimerCard from "./TimerCard";

interface DashboardLayoutProps {
  onManageSchedule: () => void;
  onNavigateToBoard: () => void;
  onNavigateToTimer: () => void;
  onNavigateToCalendar: () => void;
}

export default function DashboardLayout({ onManageSchedule, onNavigateToBoard, onNavigateToTimer, onNavigateToCalendar }: DashboardLayoutProps) {
  return (
    <main className="max-w-[1600px] mx-auto p-6 lg:p-8">
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
