import React, { useEffect } from "react";
import { Calendar, ChevronDown, Award, Database, LogOut } from "lucide-react";
import { useSupabaseInitStatus, getCachedSetting, saveCachedSetting } from "../lib/supabase";

interface HeaderProps {
  onManageSchedule?: () => void;
  onGoHome?: () => void;
  onLogout?: () => void;
}

export default function Header({ onManageSchedule, onGoHome, onLogout }: HeaderProps) {
  const { initialized, isConnected } = useSupabaseInitStatus();

  // Editable teacher name and class info with local persistence and real-time syncing
  const [teacherName, setTeacherName] = React.useState(() => {
    return getCachedSetting("header_teacher_name", localStorage.getItem("header_teacher_name") || "김다온");
  });
  const [classInfo, setClassInfo] = React.useState(() => {
    return getCachedSetting("header_class_info", localStorage.getItem("header_class_info") || "5학년 2반");
  });

  // Listen to storage events to keep teacherName and classInfo updated instantly across components
  useEffect(() => {
    const handleStorage = () => {
      setTeacherName(getCachedSetting("header_teacher_name", localStorage.getItem("header_teacher_name") || "김다온"));
      setClassInfo(getCachedSetting("header_class_info", localStorage.getItem("header_class_info") || "5학년 2반"));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleTeacherNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTeacherName(val);
    saveCachedSetting("header_teacher_name", val);
    localStorage.setItem("header_teacher_name", val);
  };

  const handleClassInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setClassInfo(val);
    saveCachedSetting("header_class_info", val);
    localStorage.setItem("header_class_info", val);
  };

  // Use current date or a styled reference date
  const today = new Date();
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  };
  const formattedDate = today.toLocaleDateString("ko-KR", options);

  return (
    <header className="h-[90px] bg-white border-b border-gray-100 px-4 sm:px-8 flex items-center justify-between shadow-xs sticky top-0 z-50">
      {/* Left side: Logo & Title & Date */}
      <div className="flex items-center gap-3 sm:gap-6">
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-90 select-none"
          onClick={onGoHome}
          title="대시보드로 이동"
        >
          <div className="w-10 h-10 bg-[#2563EB] rounded-xl flex items-center justify-center text-white shadow-sm shadow-blue-200 shrink-0">
            <Award className="w-5.5 h-5.5" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-sans font-extrabold text-base sm:text-lg tracking-tight text-gray-900 whitespace-nowrap">
              담임노트
            </h1>
            <span className="text-[10px] text-gray-400 font-semibold hidden sm:inline select-none">
              Teacher's Desk
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-6 w-[1px] bg-gray-200 hidden sm:block"></div>

        {/* Today's Date */}
        <div className="flex items-center gap-2 text-gray-600 hidden sm:flex">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">{formattedDate}</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium shrink-0">
            1학기 18주차
          </span>
        </div>

        {/* Supabase Connection Status Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-100 text-[11px] font-semibold select-none shadow-2xs">
          <Database className="w-3.5 h-3.5 text-gray-400" />
          {isConnected ? (
            initialized ? (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-700 font-bold">Supabase 연동 완료</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-blue-600 font-bold animate-pulse">Supabase 동기화 중...</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span>
              <span className="text-amber-700">로컬 캐시 모드</span>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Profile & Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Full Schedule Button */}
        {onManageSchedule && (
          <button
            onClick={onManageSchedule}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border border-blue-100/50"
          >
            <Calendar className="w-3.5 h-3.5" />
            전체 시간표
          </button>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer border border-red-100/50"
            title="로그아웃"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">로그아웃</span>
          </button>
        )}

        {/* Divider */}
        <div className="h-6 w-[1px] bg-gray-200"></div>

        {/* Teacher Profile Info */}
        <div className="flex items-center gap-2 pl-1 select-none">
          <div className="w-8 h-8 sm:w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-[#2563EB] font-extrabold text-xs sm:text-sm shrink-0">
            {teacherName.charAt(0) || "김"}
          </div>
            <div className="flex flex-col text-left gap-0.5">
              <div className="flex items-center">
                <input
                  type="text"
                  value={teacherName}
                  onChange={handleTeacherNameChange}
                  className="w-18 sm:w-22 bg-transparent hover:bg-gray-100/55 focus:bg-white border border-transparent focus:border-gray-200 focus:ring-1 focus:ring-blue-100 rounded px-1 py-0.5 text-xs font-bold text-gray-800 focus:outline-hidden transition-all"
                  placeholder="교사명"
                  title="선생님 이름 수정"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="text"
                  value={classInfo}
                  onChange={handleClassInfoChange}
                  className="w-20 sm:w-26 bg-transparent hover:bg-gray-100/55 focus:bg-white border border-transparent focus:border-gray-200 focus:ring-1 focus:ring-blue-100 rounded px-1 py-0.5 text-[10px] font-semibold text-gray-500 focus:outline-hidden transition-all"
                  placeholder="학년 반"
                  title="학반 수정"
                />
              </div>
            </div>
        </div>
      </div>
    </header>
  );
}

