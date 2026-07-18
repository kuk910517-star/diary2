import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, BookOpen, Users, CheckSquare, Square, Sparkles, Edit2, Check, X } from "lucide-react";
import { getScheduleForDate, getAttendanceForDate, formatDate } from "../lib/storage";
import { 
  getCachedCalendarEvents, 
  saveCachedCalendarEvents, 
  getCachedTodos, 
  saveCachedTodos,
  addTodoToDB,
  updateTodoInDB,
  deleteTodoFromDB,
  getCachedSchedules, 
  saveCachedSchedules 
} from "../lib/supabase";

interface CalendarEvent {
  [dateStr: string]: string[];
}

interface TodoItem {
  id: string | number;
  title: string;
  isCompleted: boolean;
  completedAt?: string;
  date?: string;
}

interface CalendarCardProps {
  onNavigateToCalendar?: () => void;
}

export default function CalendarCard({ onNavigateToCalendar }: CalendarCardProps) {
  const today = new Date();
  const todayStr = formatDate(today);

  // Calendar Year and Month states
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);

  // Local storage states
  const [events, setEvents] = useState<CalendarEvent>({});
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newEventText, setNewEventText] = useState("");

  // Add todo interactive states
  const [showTodoInput, setShowTodoInput] = useState(false);
  const [newTodoText, setNewTodoText] = useState("");

  // Todo editing states
  const [editingTodoId, setEditingTodoId] = useState<string | number | null>(null);
  const [editingTodoText, setEditingTodoText] = useState("");

  // Load initial data and clean up past non-attendance data
  useEffect(() => {
    // Load events and clean up past events (older than 2026-07-14)
    try {
      const savedEvents = getCachedCalendarEvents();
      let loadedEvents: CalendarEvent = {};
      if (savedEvents && Object.keys(savedEvents).length > 0) {
        loadedEvents = savedEvents;
      } else {
        loadedEvents = {};
      }

      // Clean up past events
      const cleanedEvents: CalendarEvent = {};
      let eventsChanged = false;
      Object.keys(loadedEvents).forEach((dateKey) => {
        if (dateKey >= todayStr) {
          cleanedEvents[dateKey] = loadedEvents[dateKey];
        } else {
          eventsChanged = true;
        }
      });

      setEvents(cleanedEvents);
      if (eventsChanged || !savedEvents) {
        saveCachedCalendarEvents(cleanedEvents);
      }
    } catch (e) {
      console.error("Failed to load/clean events", e);
    }

    // Load todos and clean up past completed todos
    try {
      const savedTodos = getCachedTodos();
      if (savedTodos && savedTodos.length > 0) {
        const cleanedTodos = savedTodos.filter((todo) => {
          // If a todo is completed and its completion date is in the past, delete it.
          if (todo.isCompleted && todo.completedAt && todo.completedAt < todayStr) {
            return false;
          }
          return true;
        });
        setTodos(cleanedTodos);
        if (savedTodos.length !== cleanedTodos.length) {
          saveCachedTodos(cleanedTodos);
        }
      } else {
        setTodos([]);
      }
    } catch (e) {
      console.error("Failed to load/clean todos", e);
    }

    // Clean up past schedules
    try {
      const savedSchedules = getCachedSchedules();
      if (savedSchedules && savedSchedules.length > 0) {
        const cleanedSchedules = savedSchedules.filter((sched) => sched.date >= todayStr);
        if (savedSchedules.length !== cleanedSchedules.length) {
          saveCachedSchedules(cleanedSchedules);
        }
      }
    } catch (e) {
      console.error("Failed to clean schedules", e);
    }

    // Trigger storage event to notify other cards of any cleanups
    window.dispatchEvent(new Event("storage"));

    // Listen to storage events to keep synced
    const handleStorageChange = () => {
      try {
        const savedTodos = getCachedTodos();
        if (savedTodos) {
          setTodos(savedTodos);
        }
        const savedEvents = getCachedCalendarEvents();
        if (savedEvents) {
          setEvents(savedEvents);
        }
      } catch (e) {
        console.error("Failed to load todos on storage change", e);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const loadTodoList = () => {
    try {
      const savedTodos = getCachedTodos();
      if (savedTodos) {
        setTodos(savedTodos);
      }
    } catch (e) {
      console.error("Failed to load todos", e);
    }
  };

  // Helper to save events
  const saveEvents = (updated: CalendarEvent) => {
    setEvents(updated);
    saveCachedCalendarEvents(updated);
  };


  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleGoToday = () => {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setSelectedDateStr(formatDate(d));
  };

  // Generate days grid
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    
    // Day of week of the 1st of the month (0 = Sunday, 6 = Saturday)
    const startDay = date.getDay();
    
    // Previous month filler days
    const prevMonthDate = new Date(year, month, 0);
    const prevDaysCount = prevMonthDate.getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      const d = prevDaysCount - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({
        dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: false,
      });
    }
    
    // Current month days
    const currentMonthDate = new Date(year, month + 1, 0);
    const currentDaysCount = currentMonthDate.getDate();
    for (let d = 1; d <= currentDaysCount; d++) {
      days.push({
        dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: true,
      });
    }
    
    // Next month filler days to complete standard 6 rows grid (42 cells)
    const totalCells = 42;
    const nextDaysNeeded = totalCells - days.length;
    for (let d = 1; d <= nextDaysNeeded; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({
        dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        isCurrentMonth: false,
      });
    }
    
    return days;
  };

  const calendarDays = getDaysInMonth(currentYear, currentMonth);
  const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"];

  // Fetch info for the selected date
  const selectedSchedule = getScheduleForDate(selectedDateStr);
  const selectedAttendance = getAttendanceForDate(selectedDateStr);
  const selectedEvents = events[selectedDateStr] || [];

  // Check if a date has "평가" (evaluation) in schedule lessons
  const checkEvaluation = (dateStr: string) => {
    const sched = getScheduleForDate(dateStr);
    if (!sched) return false;
    return sched.lessons.some(
      (l) => l.subject.includes("평가") || l.content.includes("평가")
    );
  };

  // Add a custom calendar event
  const handleAddEvent = () => {
    const trimmed = newEventText.trim();
    if (!trimmed) return;

    const currentDayEvents = events[selectedDateStr] || [];
    const updatedEvents = {
      ...events,
      [selectedDateStr]: [...currentDayEvents, trimmed],
    };
    saveEvents(updatedEvents);
    setNewEventText("");
  };

  // Delete a custom calendar event
  const handleDeleteEvent = (indexToDelete: number) => {
    const currentDayEvents = events[selectedDateStr] || [];
    const updatedDayEvents = currentDayEvents.filter((_, idx) => idx !== indexToDelete);
    
    const updatedEvents = { ...events };
    if (updatedDayEvents.length === 0) {
      delete updatedEvents[selectedDateStr];
    } else {
      updatedEvents[selectedDateStr] = updatedDayEvents;
    }
    saveEvents(updatedEvents);
  };

  // Toggle todo item completion
  const handleToggleTodo = async (id: string | number) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const nextCompleted = !todo.isCompleted;
    const completedAt = nextCompleted ? todayStr : undefined;

    // Optimistic state update
    setTodos(prev => prev.map(t => t.id === id ? { ...t, isCompleted: nextCompleted, completedAt } : t));

    try {
      await updateTodoInDB(id, { isCompleted: nextCompleted, completedAt });
    } catch (err) {
      console.error("Failed to toggle todo status", err);
    }
  };

  const checkHasAttendance = (dateStr: string) => {
    const att = getAttendanceForDate(dateStr);
    return (
      att.absent.length > 0 ||
      att.experiential.length > 0 ||
      att.tardy.length > 0 ||
      att.earlyLeave.length > 0
    );
  };

  const handleCreateTodoFromCalendar = async () => {
    const trimmed = newTodoText.trim();
    if (!trimmed) return;

    setNewTodoText("");
    setShowTodoInput(false);

    try {
      const saved = await addTodoToDB(trimmed, selectedDateStr);
      if (saved) {
        setTodos(prev => {
          if (prev.some(t => t.id === saved.id)) return prev;
          return [...prev, saved];
        });
      }
    } catch (err) {
      console.error("Failed to add todo from calendar", err);
    }
  };

  // Todo edit start
  const handleStartEditTodo = (id: string | number, currentText: string) => {
    setEditingTodoId(id);
    setEditingTodoText(currentText);
  };

  // Todo edit save
  const handleSaveEditTodo = async (id: string | number) => {
    const trimmed = editingTodoText.trim();
    if (!trimmed) return;

    setEditingTodoId(null);
    setTodos(prev => prev.map(t => t.id === id ? { ...t, title: trimmed } : t));

    try {
      await updateTodoInDB(id, { title: trimmed });
    } catch (err) {
      console.error("Failed to update todo title", err);
    }
  };

  // Todo delete
  const handleDeleteTodo = async (id: string | number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    if (editingTodoId === id) {
      setEditingTodoId(null);
    }

    try {
      await deleteTodoFromDB(id);
    } catch (err) {
      console.error("Failed to delete todo", err);
    }
  };

  // Format date display for Korean context
  const getKoreanFormattedDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const days = ["일", "월", "화", "수", "목", "금", "토"];
      return `${parts[0]}년 ${parts[1]}월 ${parts[2]}일 (${days[d.getDay()]})`;
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div id="calendar-card" className="bg-white rounded-2xl p-6 shadow-xs hover:shadow-md transition-all duration-300 border border-gray-100 flex flex-col h-full relative">
      {/* Full-width Calendar Grid */}
      <div className="flex flex-col h-full justify-between gap-4">
        <div>
          {/* Calendar Header with Navigation */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
            <div 
              className={`flex items-center gap-2 ${onNavigateToCalendar ? "cursor-pointer hover:opacity-80" : ""}`}
              onClick={onNavigateToCalendar}
              title={onNavigateToCalendar ? "전체화면 달력 페이지로 이동" : undefined}
            >
              <div className="p-1.5 bg-blue-50 text-[#2563EB] rounded-lg">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left">
                <h2 className="font-sans font-bold text-base text-gray-800 flex items-center gap-1.5">
                  달력
                  {onNavigateToCalendar && (
                    <span className="text-[9px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md hover:bg-blue-200 transition-colors" title="전체보기">
                      <span className="hidden sm:inline">전체보기 </span>↗
                    </span>
                  )}
                </h2>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1 text-gray-500 hover:text-gray-950 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                title="이전 달"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs sm:text-sm font-extrabold text-gray-800 min-w-[75px] sm:min-w-[100px] text-center whitespace-nowrap">
                ◀ {String(currentYear).slice(-2)}년 {currentMonth + 1}월 ▶
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1 text-gray-500 hover:text-gray-950 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                title="다음 달"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleGoToday}
                className="ml-0.5 sm:ml-1 px-2 py-1 text-[10px] font-bold text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer shrink-0"
              >
                오늘
              </button>
            </div>
          </div>

          {/* Days of Week Row */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {daysOfWeek.map((day, idx) => (
              <div
                key={day}
                className={`text-xs font-bold py-1 ${
                  idx === 0
                    ? "text-red-500"
                    : idx === 6
                    ? "text-[#2563EB]"
                    : "text-gray-400"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((dayObj, idx) => {
                const isSunday = idx % 7 === 0;
                const isSaturday = idx % 7 === 6;
                const isSelected = dayObj.dateStr === selectedDateStr;
                const isToday = dayObj.dateStr === todayStr;
                const dayEvents = events[dayObj.dateStr] || [];
                const dayTodos = todos.filter((todo) => todo.date === dayObj.dateStr);
                const hasEvents = dayEvents.length > 0;
                const hasEval = checkEvaluation(dayObj.dateStr);
                const hasAttendance = checkHasAttendance(dayObj.dateStr);

                return (
                  <button
                    key={`${dayObj.dateStr}-${idx}`}
                    onClick={() => {
                      if (isSelected) {
                        setShowTodoInput(true);
                      } else {
                        setSelectedDateStr(dayObj.dateStr);
                      }
                    }}
                    onDoubleClick={() => {
                      setSelectedDateStr(dayObj.dateStr);
                      setShowTodoInput(true);
                    }}
                    className={`min-h-[72px] p-1.5 border border-gray-100/50 rounded-xl flex flex-col items-stretch justify-between transition-all cursor-pointer relative ${
                      dayObj.isCurrentMonth ? "bg-white" : "bg-gray-50/40"
                    } ${
                      isSelected
                        ? "ring-2 ring-[#2563EB] bg-blue-50/20 border-blue-200"
                        : "hover:bg-gray-50/75"
                    }`}
                  >
                    {/* Top Row: Date Number and Indicators */}
                    <div className="w-full flex items-center justify-between">
                      <span
                        className={`text-xs font-extrabold w-5 h-5 flex items-center justify-center rounded-full ${
                          isToday
                            ? "bg-[#2563EB] text-white shadow-xs"
                            : isSelected
                            ? "text-[#2563EB]"
                            : !dayObj.isCurrentMonth
                            ? "text-gray-300"
                            : isSunday
                            ? "text-red-500"
                            : isSaturday
                            ? "text-blue-500"
                            : "text-gray-700"
                        }`}
                      >
                        {dayObj.day}
                      </span>

                      {/* Event & Attendance Indicators */}
                      <div className="flex gap-0.5">
                        {hasEvents && (
                          <span className="w-1.5 h-1.5 bg-[#2563EB] rounded-full shrink-0 animate-pulse" title="일정 있음" />
                        )}
                        {hasAttendance && (
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0 animate-pulse" title="출결 작성됨" />
                        )}
                      </div>
                    </div>

                    {/* Todo & Event Title Text list (Small fonts per user request) */}
                    <div className="w-full mt-1.5 space-y-0.5 flex-1 flex flex-col justify-end overflow-hidden">
                      {[
                        ...dayEvents.map((ev) => ({ text: ev, type: "event" })),
                        ...dayTodos.map((td) => ({ text: td.title, type: "todo", isCompleted: td.isCompleted })),
                      ].slice(0, 2).map((item, index) => (
                        <div
                          key={index}
                          className={`text-[8px] font-bold px-1 py-0.5 rounded-sm truncate text-left leading-tight shrink-0 ${
                            item.type === "event"
                              ? "bg-blue-50 text-[#2563EB] border border-blue-100/50"
                              : item.isCompleted
                              ? "bg-gray-150 text-gray-400 line-through"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-100/50"
                          }`}
                          title={item.text}
                        >
                          {item.text}
                        </div>
                      ))}
                    </div>

                    {/* Bottom Row: Evaluation Indicator */}
                    {hasEval && (
                      <div className="w-full text-center mt-1">
                        <span className="inline-block text-[8px] font-extrabold text-amber-600 bg-amber-50 border border-amber-100 px-1 rounded-sm leading-none py-0.5 whitespace-nowrap">
                          📝 평가
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
        </div>

        {/* Selected Date Attendance details inside the Calendar Card */}
        {checkHasAttendance(selectedDateStr) && (
          <div className="p-2.5 bg-rose-50/50 border border-rose-100 rounded-xl flex items-start gap-2 text-[11px] text-rose-900 animate-fade-in shadow-3xs shrink-0">
            <Users className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-left">
              <span className="font-extrabold text-rose-700">출결 현황: </span>
              <span className="font-semibold text-rose-800">
                {[
                  selectedAttendance.absent.length > 0 ? `결석(${selectedAttendance.absent.join(", ")})` : "",
                  selectedAttendance.experiential.length > 0 ? `체험학습(${selectedAttendance.experiential.join(", ")})` : "",
                  selectedAttendance.tardy.length > 0 ? `지각(${selectedAttendance.tardy.join(", ")})` : "",
                  selectedAttendance.earlyLeave.length > 0 ? `조퇴(${selectedAttendance.earlyLeave.join(", ")})` : "",
                ].filter(Boolean).join(", ")}
              </span>
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-150 pr-12 shrink-0">
          <p className="text-[10px] text-gray-500 font-semibold leading-relaxed text-left">
            💡 <strong>할 일 관리:</strong> 날짜를 더블클릭(또는 터치)하거나 + 버튼을 누르면 달력 팝업에서 할 일을 직접 수정/삭제/추가할 수 있습니다.
          </p>
        </div>
      </div>

      {/* Floating Add Todo Button in the bottom-right */}
      <button
        onClick={() => {
          setShowTodoInput(true);
          setNewTodoText("");
        }}
        className="absolute bottom-4 right-4 p-2.5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 cursor-pointer z-10 flex items-center justify-center border border-blue-600/30"
        title="선택한 날짜에 할 일 등록"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Todo input overlay dialog (Re-purposed as a full To-Do Manager for Selected Date) */}
      {showTodoInput && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-20 rounded-2xl animate-fade-in">
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm shadow-xl border border-gray-150 animate-scale-up text-left flex flex-col max-h-[90%]">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100 shrink-0">
              <span className="text-xs font-extrabold text-[#2563EB] bg-blue-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-[#2563EB]" />
                {getKoreanFormattedDate(selectedDateStr)} 할 일 관리
              </span>
              <button
                onClick={() => {
                  setShowTodoInput(false);
                  setNewTodoText("");
                }}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1.5 py-0.5 rounded-md hover:bg-gray-100 cursor-pointer"
              >
                닫기
              </button>
            </div>
            
            {/* List area */}
            <div className="space-y-1.5 overflow-y-auto scrollbar-thin pr-0.5 flex-1 mb-3 max-h-[220px]">
              {todos.filter((t) => t.date === selectedDateStr).length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-[10px] font-semibold italic">
                  이 날짜에 등록된 할 일이 없습니다. 아래에서 추가해보세요!
                </div>
              ) : (
                todos
                  .filter((t) => t.date === selectedDateStr)
                  .map((todo) => {
                    const isTodoEditing = editingTodoId === todo.id;
                    return (
                      <div
                        key={todo.id}
                        className="flex items-center justify-between gap-2 p-1.5 bg-gray-50/50 border border-gray-100 rounded-lg group"
                      >
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {/* Checkbox */}
                          <button
                            onClick={() => handleToggleTodo(todo.id)}
                            className="text-gray-400 hover:text-[#2563EB] transition-colors cursor-pointer shrink-0"
                          >
                            {todo.isCompleted ? (
                              <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300" />
                            )}
                          </button>

                          {/* Title Input or Text */}
                          <div className="flex-1 min-w-0">
                            {isTodoEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingTodoText}
                                  onChange={(e) => setEditingTodoText(e.target.value)}
                                  className="w-full bg-white border border-gray-200 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-gray-800 focus:outline-hidden focus:border-[#2563EB] transition-all"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveEditTodo(todo.id);
                                    if (e.key === "Escape") setEditingTodoId(null);
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveEditTodo(todo.id)}
                                  className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer shrink-0"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingTodoId(null)}
                                  className="p-0.5 text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span
                                onDoubleClick={() => handleStartEditTodo(todo.id, todo.title)}
                                className={`text-[11px] font-bold tracking-tight truncate cursor-pointer select-none block ${
                                  todo.isCompleted
                                    ? "text-gray-400 line-through"
                                    : "text-gray-700 hover:text-gray-950"
                                }`}
                                title="더블클릭하여 수정 가능"
                              >
                                {todo.title}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        {!isTodoEditing && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEditTodo(todo.id, todo.title)}
                              className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-150 rounded transition-all cursor-pointer"
                              title="수정"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTodo(todo.id)}
                              className="p-0.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            {/* Quick add within Dialog */}
            <div className="border-t border-gray-100 pt-3 shrink-0">
              <p className="text-[10px] text-gray-400 font-bold mb-1">새 할 일 추가</p>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  placeholder="할 일 내용을 입력하세요"
                  className="flex-1 bg-gray-50 border border-gray-200 focus:border-[#2563EB] text-[11px] font-semibold px-2.5 py-1.5 rounded-lg focus:outline-hidden text-gray-800"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateTodoFromCalendar();
                    }
                  }}
                />
                <button
                  onClick={handleCreateTodoFromCalendar}
                  className="px-3 py-1.5 text-xs font-extrabold text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>추가</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
