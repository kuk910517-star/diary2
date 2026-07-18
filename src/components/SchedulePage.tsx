import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Plus, Trash2, GripVertical, Calendar, Save, CheckCircle2, RefreshCw } from "lucide-react";
import { getSchedules, saveSchedules, formatDate } from "../lib/storage";
import { DaySchedule, ScheduleLesson } from "../types";
import { getCachedSetting } from "../lib/supabase";

interface SubjectInputProps {
  id: string;
  initialValue: string;
  onSave: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function SubjectInput({ id, initialValue, onSave, onKeyDown }: SubjectInputProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleBlur = () => {
    if (value !== initialValue) {
      onSave(value);
    }
  };

  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder="과목명"
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key.startsWith("Arrow")) {
          if (value !== initialValue) {
            onSave(value);
          }
        }
        onKeyDown(e);
      }}
      className="w-full bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-gray-800 focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all text-center placeholder-gray-300"
    />
  );
}

// Optimized sub-component to prevent stutter/re-render while typing lesson content
interface ContentTextAreaProps {
  id: string;
  initialValue: string;
  onSave: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  textareaRefCallback: (el: HTMLTextAreaElement | null) => void;
}

function ContentTextArea({ id, initialValue, onSave, onKeyDown, textareaRefCallback }: ContentTextAreaProps) {
  const [value, setValue] = useState(initialValue);
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Local height adjustment during active typing (highly responsive)
  useEffect(() => {
    const el = localRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);

  const handleBlur = () => {
    if (value !== initialValue) {
      onSave(value);
    }
  };

  return (
    <textarea
      id={id}
      ref={(el) => {
        localRef.current = el;
        textareaRefCallback(el);
      }}
      value={value}
      placeholder="수업 내용을 자유롭게 입력하세요 (Enter를 누르면 다음 교시로 이동)"
      rows={1}
      onChange={(e) => {
        setValue(e.target.value);
      }}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key.startsWith("Arrow")) {
          if (value !== initialValue) {
            onSave(value);
          }
        }
        onKeyDown(e);
      }}
      className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-700 focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-none placeholder-gray-300 leading-relaxed min-h-[38px]"
    />
  );
}

interface SchedulePageProps {
  onBack: () => void;
}

export default function SchedulePage({ onBack }: SchedulePageProps) {
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [savedToast, setSavedToast] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const textareasRef = useRef<{ [key: string]: HTMLTextAreaElement | null }>({});
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);



  // Load schedules on mount with real-time reactivity
  useEffect(() => {
    const handleStorageChange = () => {
      const data = getSchedules();
      setSchedules(data);
    };
    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Sync auto-resize on initial render and schedule updates
  useEffect(() => {
    Object.keys(textareasRef.current).forEach((key) => {
      const el = textareasRef.current[key];
      if (el) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    });
  }, [schedules]);

  // Helper to save data and trigger visual feedback
  const handleSave = (updated: DaySchedule[]) => {
    setSchedules(updated);
    saveSchedules(updated);
    
    // Show quick feedback toast with proper timer cleanup
    setSavedToast(true);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setSavedToast(false);
    }, 1500);
  };

  // 1. Subject and Content Editing
  const handleFieldChange = (date: string, lessonId: string, field: "subject" | "content", value: string) => {
    const updated = schedules.map((day) => {
      if (day.date === date) {
        return {
          ...day,
          lessons: day.lessons.map((lesson) => {
            if (lesson.id === lessonId) {
              return { ...lesson, [field]: value };
            }
            return lesson;
          }),
        };
      }
      return day;
    });
    handleSave(updated);
  };

  // 2. Add Lesson
  const handleAddLesson = (date: string) => {
    const updated = schedules.map((day) => {
      if (day.date === date) {
        const newLesson: ScheduleLesson = {
          id: `${date}-lesson-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          subject: "",
          content: "",
        };
        return {
          ...day,
          lessons: [...day.lessons, newLesson],
        };
      }
      return day;
    });
    handleSave(updated);
  };

  // 3. Delete Lesson
  const handleDeleteLesson = (date: string, lessonId: string) => {
    const updated = schedules.map((day) => {
      if (day.date === date) {
        return {
          ...day,
          lessons: day.lessons.filter((l) => l.id !== lessonId),
        };
      }
      return day;
    });
    handleSave(updated);
  };

  // 3.5. Clear All Schedules (subjects and content)
  const handleClearAllSchedules = () => {
    const updated = schedules.map((day) => ({
      ...day,
      lessons: day.lessons.map((lesson) => ({
        ...lesson,
        subject: "",
        content: "",
      })),
    }));
    handleSave(updated);
  };

  // 4. Keyboard Navigation (Excel-style)
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    dateIndex: number,
    lessonIndex: number,
    field: "subject" | "content"
  ) => {
    const currentDay = schedules[dateIndex];
    if (!currentDay) return;

    const dateStr = currentDay.date;

    const focusField = (dIdx: number, lIdx: number, f: "subject" | "content") => {
      const targetDay = schedules[dIdx];
      if (!targetDay) return;
      const targetDateStr = targetDay.date;
      const id = `${f === "subject" ? "sub" : "con"}-${targetDateStr}-${lIdx}`;
      const el = document.getElementById(id);
      if (el) {
        el.focus();
        e.preventDefault();
      }
    };

    switch (e.key) {
      case "ArrowUp": {
        // Move to previous lesson same field
        if (lessonIndex > 0) {
          focusField(dateIndex, lessonIndex - 1, field);
        } else if (dateIndex > 0) {
          // Go to last lesson of previous day
          const prevDay = schedules[dateIndex - 1];
          if (prevDay && prevDay.lessons.length > 0) {
            focusField(dateIndex - 1, prevDay.lessons.length - 1, field);
          }
        }
        break;
      }
      case "ArrowDown": {
        // Move to next lesson same field
        if (lessonIndex < currentDay.lessons.length - 1) {
          focusField(dateIndex, lessonIndex + 1, field);
        } else if (dateIndex < schedules.length - 1) {
          // Go to first lesson of next day
          focusField(dateIndex + 1, 0, field);
        }
        break;
      }
      case "ArrowLeft": {
        // Move to previous field in same lesson
        if (field === "content") {
          focusField(dateIndex, lessonIndex, "subject");
        } else if (lessonIndex > 0) {
          // Wrap around to previous lesson's content
          focusField(dateIndex, lessonIndex - 1, "content");
        }
        break;
      }
      case "ArrowRight": {
        // Move to next field in same lesson
        if (field === "subject") {
          focusField(dateIndex, lessonIndex, "content");
        } else if (lessonIndex < currentDay.lessons.length - 1) {
          // Wrap around to next lesson's subject
          focusField(dateIndex, lessonIndex + 1, "subject");
        }
        break;
      }
      case "Enter": {
        if (!e.shiftKey) {
          e.preventDefault();
          // Excel behavior: Enter moves down the same column
          if (lessonIndex < currentDay.lessons.length - 1) {
            focusField(dateIndex, lessonIndex + 1, field);
          } else if (dateIndex < schedules.length - 1) {
            // Last lesson of day -> Next day's first lesson, same field
            focusField(dateIndex + 1, 0, field);
          }
        }
        break;
      }
      default:
        break;
    }
  };

  // 5. Native HTML5 Drag and Drop across multiple days and within a single day card
  const [dragInfo, setDragInfo] = useState<{ date: string; index: number } | null>(null);

  const handleDragStart = (e: React.DragEvent, date: string, index: number) => {
    setDragInfo({ date, index });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, date: string, hoverIndex: number) => {
    if (!dragInfo) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, date: string, targetIndex: number) => {
    if (!dragInfo) return;

    const sourceDate = dragInfo.date;
    const sourceIndex = dragInfo.index;

    if (sourceDate === date && sourceIndex === targetIndex) return;

    let updated = [...schedules];

    if (sourceDate === date) {
      // Same date reordering
      updated = updated.map((day) => {
        if (day.date === date) {
          const reorderedLessons = [...day.lessons];
          const [movedItem] = reorderedLessons.splice(sourceIndex, 1);
          reorderedLessons.splice(targetIndex, 0, movedItem);
          return { ...day, lessons: reorderedLessons };
        }
        return day;
      });
    } else {
      // Dragging between different dates
      const sourceDay = schedules.find((d) => d.date === sourceDate);
      if (!sourceDay) return;
      const movedItem = sourceDay.lessons[sourceIndex];
      if (!movedItem) return;

      updated = updated.map((day) => {
        if (day.date === sourceDate) {
          // Remove from source
          const lessons = day.lessons.filter((_, idx) => idx !== sourceIndex);
          return { ...day, lessons };
        }
        if (day.date === date) {
          // Insert into target
          const lessons = [...day.lessons];
          const newId = `${date}-lesson-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
          lessons.splice(targetIndex, 0, {
            ...movedItem,
            id: newId,
          });
          return { ...day, lessons };
        }
        return day;
      });
    }

    handleSave(updated);
    setDragInfo(null);
  };

  const getDayKorean = (dateStr: string) => {
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const d = new Date(dateStr);
    return dayNames[d.getDay()];
  };

  const formatCardDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
    return dateStr;
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] pb-16">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40 px-3 sm:px-6 lg:px-8 py-3 sm:py-5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-gray-100 shrink-0"
            title="대시보드로 돌아가기"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 h-5" />
          </button>
          <div>
            <h1 className="font-sans font-extrabold text-base sm:text-xl text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <Calendar className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-[#2563EB] shrink-0" />
              <span className="hidden sm:inline">학기 전체 </span>시간표<span className="hidden sm:inline"> 관리</span>
            </h1>
            <p className="hidden sm:block text-xs text-gray-400 mt-0.5 font-medium">
              학기 종료일까지의 시간표를 엑셀처럼 빠르고 직관적으로 관리하세요.
            </p>
          </div>
        </div>

        {/* Saved status indicators */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {showClearConfirm ? (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-rose-50 border border-rose-100 rounded-xl p-1 px-2 sm:p-1.5 sm:px-3 shadow-xs animate-fade-in shrink-0">
              <span className="text-[10px] sm:text-xs font-extrabold text-rose-700">전부 비우시겠습니까?</span>
              <button
                onClick={() => {
                  handleClearAllSchedules();
                  setShowClearConfirm(false);
                }}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] sm:text-xs font-extrabold cursor-pointer transition-colors"
              >
                예
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-[10px] sm:text-xs font-extrabold cursor-pointer transition-colors"
              >
                아니오
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-2 sm:px-3.5 py-1.5 sm:py-2 bg-white text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
              title="모든 날짜의 교시 과목과 내용을 일괄 비웁니다"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">시간표 전체 비우기</span>
            </button>
          )}
          {savedToast ? (
            <span className="text-[10px] sm:text-xs text-emerald-600 bg-emerald-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-full font-bold flex items-center gap-1 animate-fade-in shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">자동 저장 완료</span>
              <span className="sm:hidden">저장됨</span>
            </span>
          ) : (
            <span className="text-[10px] sm:text-xs text-gray-400 bg-gray-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-full font-semibold flex items-center gap-1 sm:gap-1.5 shrink-0">
              <RefreshCw className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-gray-300 animate-spin-slow shrink-0" />
              <span className="text-left leading-tight">
                실시간
                <br />
                동기화 중
              </span>
            </span>
          )}
          <button
            onClick={onBack}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-[#2563EB] text-white hover:bg-[#1d4ed8] rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all hover:scale-102 cursor-pointer whitespace-nowrap"
          >
            반영
          </button>
        </div>
      </div>

      {/* Grid of Day Schedule Cards */}
      <div className="max-w-[1400px] mx-auto p-6 lg:p-8 space-y-8">
        {schedules.map((day, dateIdx) => {
          const isTodayStr = formatDate(new Date()) === day.date;

          return (
            <div
              key={day.date}
              className={`bg-white rounded-3xl p-6 shadow-xs hover:shadow-md border transition-all duration-300 ${
                isTodayStr ? "ring-2 ring-blue-500/40 border-blue-200 bg-blue-50/5" : "border-gray-100"
              }`}
            >
              {/* Card Header: Date */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl font-bold flex items-center gap-1.5 ${
                    isTodayStr ? "bg-blue-100/75 text-[#2563EB]" : "bg-gray-50 text-gray-700"
                  }`}>
                    <Calendar className="w-4.5 h-4.5" />
                    <span className="text-sm font-extrabold tracking-tight">
                      {formatCardDate(day.date)} ({getDayKorean(day.date)})
                    </span>
                  </div>
                  {isTodayStr && (
                    <span className="text-[11px] font-bold bg-[#2563EB] text-white px-2.5 py-0.5 rounded-full animate-pulse">
                      오늘
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-400">
                  총 {day.lessons.length}개 교시 편성됨
                </span>
              </div>

              {/* Day Lessons Grid List */}
              <div className="space-y-3">
                {day.lessons.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl">
                    <p className="text-sm text-gray-400 font-semibold">등록된 수업 일정이 없습니다.</p>
                  </div>
                ) : (
                  day.lessons.map((lesson, lessonIdx) => (
                    <div
                      key={lesson.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, day.date, lessonIdx)}
                      onDragOver={(e) => handleDragOver(e, day.date, lessonIdx)}
                      onDrop={(e) => handleDrop(e, day.date, lessonIdx)}
                      className={`flex flex-col gap-2.5 p-3 sm:p-4 bg-gray-50/35 border border-gray-100 rounded-2xl hover:bg-gray-50/80 transition-colors group ${
                        dragInfo?.date === day.date && dragInfo?.index === lessonIdx ? "opacity-40 border-dashed border-blue-300 bg-blue-50/10" : ""
                      }`}
                    >
                      {/* Top Row: Info & Controls */}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2.5">
                          {/* Drag Handle Icon */}
                          <div className="text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-4 h-4" />
                          </div>

                          {/* Period Indicator Badge */}
                          <span className="text-xs font-extrabold text-[#2563EB] bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg shrink-0">
                            {lessonIdx + 1}교시
                          </span>

                          {/* Subject Input Field */}
                          <div className="w-32">
                            <SubjectInput
                              id={`sub-${day.date}-${lessonIdx}`}
                              initialValue={lesson.subject}
                              onSave={(val) => handleFieldChange(day.date, lesson.id, "subject", val)}
                              onKeyDown={(e) => handleKeyDown(e, dateIdx, lessonIdx, "subject")}
                            />
                          </div>
                        </div>

                        {/* Trash Delete button */}
                        <button
                          onClick={() => handleDeleteLesson(day.date, lesson.id)}
                          className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0 animate-fade-in"
                          title="교시 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Bottom Row: Content textarea underneath */}
                      <div className="w-full">
                        <ContentTextArea
                          id={`con-${day.date}-${lessonIdx}`}
                          initialValue={lesson.content}
                          onSave={(val) => handleFieldChange(day.date, lesson.id, "content", val)}
                          onKeyDown={(e) => handleKeyDown(e, dateIdx, lessonIdx, "content")}
                          textareaRefCallback={(el) => {
                            textareasRef.current[`${day.date}-${lesson.id}`] = el;
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add lesson button at bottom of card */}
              <div className="mt-4 flex justify-start">
                <button
                  onClick={() => handleAddLesson(day.date)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] bg-blue-50/50 hover:bg-blue-50 border border-blue-100/50 px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  교시 추가
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
