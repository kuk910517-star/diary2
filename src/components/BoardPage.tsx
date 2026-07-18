import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, PenTool, BookOpen, Sparkles, Trash2, Save, FileText, Check, AlertCircle, Type, Palette, Bold, Underline, Maximize2, Minimize2 } from "lucide-react";
import { getScheduleForDate, formatDate } from "../lib/storage";
import { 
  getCachedSetting, 
  saveCachedSetting, 
  getCachedNoticeHtml, 
  saveCachedNoticeHtml 
} from "../lib/supabase";

interface BoardPageProps {
  onBack: () => void;
}

interface EvaluationItem {
  dateStr: string;
  formattedDate: string;
  subject: string;
  content: string;
}

export default function BoardPage({ onBack }: BoardPageProps) {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const dateVal = String(today.getDate()).padStart(2, "0");
  const formattedTodayDot = `${year}.${month}.${dateVal}`;

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Zoom Level (100% - 300%) for presentation view
  const [zoomLevel, setZoomLevel] = useState<number>(() => {
    return parseInt(localStorage.getItem("teacher_notes_board_zoom_level") || "140");
  });

  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const next = Math.min(300, prev + 20);
      localStorage.setItem("teacher_notes_board_zoom_level", String(next));
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const next = Math.max(80, prev - 20);
      localStorage.setItem("teacher_notes_board_zoom_level", String(next));
      return next;
    });
  };

  // Keydown listener for Escape to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Synchronized active tab
  const [activeTab, setActiveTab] = useState<"notice" | "chalk">( () => {
    return (getCachedSetting("teacher_notes_board_active_tab", "notice") as "notice" | "chalk") || "notice";
  });

  // HTML content states
  const [chalkHtml, setChalkHtml] = useState("<div></div>");
  const [noticeHtml, setNoticeHtml] = useState("<div></div>");

  // State for tomorrow's schedule & evaluations
  const [tomorrowSubjects, setTomorrowSubjects] = useState<string[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);

  // Refs for editors and values
  const noticeEditorRef = useRef<HTMLDivElement>(null);
  const chalkEditorRef = useRef<HTMLDivElement>(null);
  const tomorrowSubjectsRef = useRef<string[]>([]);

  // Sync tab changes to settings
  const handleTabChange = (tab: "notice" | "chalk") => {
    setActiveTab(tab);
    saveCachedSetting("teacher_notes_board_active_tab", tab);
  };

  // Helper to sanitize, clean, and structure notice HTML for CSS counter
  const sanitizeAndCleanHtml = (html: string): string => {
    if (!html || html.trim() === "" || html === "<div></div>" || html === "<div><br></div>") {
      const scheduleText = tomorrowSubjectsRef.current.length > 0 ? tomorrowSubjectsRef.current.join(" ") : "시간표 미지정";
      return `<div>${scheduleText}</div>`;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    let childNodes = Array.from(doc.body.childNodes);
    if (childNodes.length === 1 && childNodes[0].nodeName === "DIV" && childNodes[0].childNodes.length > 1) {
      const parentEl = childNodes[0] as HTMLElement;
      const nestedDivs = parentEl.querySelectorAll("div, p");
      if (nestedDivs.length > 0) {
        childNodes = Array.from(nestedDivs);
      }
    } else {
      const divs = doc.querySelectorAll("div, p");
      if (divs.length > 0) {
        childNodes = Array.from(divs);
      }
    }

    if (childNodes.length === 0) {
      const text = doc.body.innerHTML || "";
      const cleaned = text.replace(/^\s*\d+\s*\.\s*(?:&nbsp;|\s)*/gi, "");
      return `<div>${cleaned || "<br>"}</div>`;
    }

    const cleanedHTMLs = childNodes.map((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        const cleaned = text.replace(/^\s*\d+\s*\.\s*(?:&nbsp;|\s)*/gi, "");
        return `<div>${cleaned || "<br>"}</div>`;
      }
      
      const el = node as HTMLElement;
      let inner = el.innerHTML || "";
      inner = inner.replace(/^\s*\d+\s*\.\s*(?:&nbsp;|\s)*/gi, "");
      
      const styleAttr = el.getAttribute("style");
      if (styleAttr) {
        return `<div style="${styleAttr}">${inner || "<br>"}</div>`;
      }
      return `<div>${inner || "<br>"}</div>`;
    });

    return cleanedHTMLs.join("");
  };

  // Auto-generation logic for Tomorrow's Schedule & Evaluations
  const loadTomorrowScheduleAndEvaluations = () => {
    const todayStr = formatDate(new Date());
    const todayDate = new Date(todayStr);

    const getTomorrowDateStr = (date: Date): string => {
      const tomorrow = new Date(date);
      const day = date.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
      let daysToAdd = 1;
      if (day === 5) daysToAdd = 3;
      else if (day === 6) daysToAdd = 2;
      tomorrow.setDate(date.getDate() + daysToAdd);
      
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const dayStr = String(tomorrow.getDate()).padStart(2, "0");
      return `${year}-${month}-${dayStr}`;
    };

    const tomorrowStr = getTomorrowDateStr(todayDate);
    const tomorrowSchedule = getScheduleForDate(tomorrowStr);
    let subjects: string[] = [];
    if (tomorrowSchedule) {
      subjects = tomorrowSchedule.lessons
        .map((l) => l.subject || "")
        .filter((s) => s.trim() !== "");
      setTomorrowSubjects(subjects);
    } else {
      setTomorrowSubjects([]);
    }
    tomorrowSubjectsRef.current = subjects;

    // 2. Evaluations: Check from today to next week's Friday
    const currentDay = todayDate.getDay();
    const daysToThisFriday = 5 - currentDay;
    const daysToNextFriday = daysToThisFriday + 7;

    const endSearchDate = new Date(todayDate);
    endSearchDate.setDate(todayDate.getDate() + daysToNextFriday);

    const foundEvaluations: EvaluationItem[] = [];
    const tempDate = new Date(todayDate);

    while (tempDate <= endSearchDate) {
      const dateStr = formatDate(tempDate);
      const schedule = getScheduleForDate(dateStr);

      if (schedule) {
        schedule.lessons.forEach((lesson) => {
          if (lesson.content && lesson.content.includes("평가")) {
            const m = tempDate.getMonth() + 1;
            const d = tempDate.getDate();
            const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
            const dayName = weekdays[tempDate.getDay()];

            foundEvaluations.push({
              dateStr,
              formattedDate: `${m}월 ${d}일(${dayName})`,
              subject: lesson.subject || "미입력",
              content: lesson.content,
            });
          }
        });
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    setEvaluations(foundEvaluations);
  };

  // Load Notice Board and Chalkboard HTML from settings and sync using storage events
  useEffect(() => {
    const handleStorageChange = () => {
      // Load tomorrow's schedule first to set tomorrowSubjectsRef
      loadTomorrowScheduleAndEvaluations();

      // 1. Notice Board HTML
      const savedNotice = getCachedNoticeHtml();
      let sanitized = sanitizeAndCleanHtml(savedNotice);
      
      const isCustom = localStorage.getItem("teacher_notes_line1_is_custom") === "true";
      const scheduleText = tomorrowSubjectsRef.current.length > 0 ? tomorrowSubjectsRef.current.join(" ") : "시간표 미지정";
      
      if (!isCustom) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = sanitized;
        const firstChild = tempDiv.firstElementChild;
        if (firstChild) {
          firstChild.innerHTML = scheduleText;
        } else {
          tempDiv.innerHTML = `<div>${scheduleText}</div>`;
        }
        sanitized = tempDiv.innerHTML;
      }

      setNoticeHtml(sanitized);
      if (noticeEditorRef.current && document.activeElement !== noticeEditorRef.current) {
        if (noticeEditorRef.current.innerHTML !== sanitized) {
          noticeEditorRef.current.innerHTML = sanitized;
        }
      }

      // 2. Chalkboard HTML
      const defaultChalk = "<div>수업 중 임시 메모장 용도입니다. (화면을 벗어나면 지워집니다)</div>";
      const currentChalk = getCachedSetting("teacher_notes_board_chalk_html", defaultChalk);

      setChalkHtml(currentChalk);
      if (chalkEditorRef.current && document.activeElement !== chalkEditorRef.current) {
        if (chalkEditorRef.current.innerHTML !== currentChalk) {
          chalkEditorRef.current.innerHTML = currentChalk;
        }
      }

      // 3. Active Tab
      const tab = (getCachedSetting("teacher_notes_board_active_tab", "notice") as "notice" | "chalk") || "notice";
      setActiveTab(tab);
    };

    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Sync noticeHtml state to noticeEditorRef safely without losing focus/cursor
  useEffect(() => {
    if (noticeEditorRef.current && document.activeElement !== noticeEditorRef.current) {
      if (noticeEditorRef.current.innerHTML !== noticeHtml) {
        noticeEditorRef.current.innerHTML = noticeHtml;
      }
    }
  }, [noticeHtml]);

  // Debounced auto-save noticeHtml
  useEffect(() => {
    const savedNotice = getCachedNoticeHtml();
    if (savedNotice === noticeHtml) {
      return;
    }
    const timer = setTimeout(() => {
      saveCachedNoticeHtml(noticeHtml);
    }, 1000);
    return () => clearTimeout(timer);
  }, [noticeHtml]);

  // Handle notice input change
  const handleNoticeInput = () => {
    if (noticeEditorRef.current) {
      const html = noticeEditorRef.current.innerHTML;

      // Determine if the first line is customized
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const firstChild = tempDiv.firstElementChild;
      if (firstChild) {
        const text = firstChild.textContent || (firstChild as HTMLElement).innerText || "";
        const scheduleText = tomorrowSubjectsRef.current.length > 0 ? tomorrowSubjectsRef.current.join(" ") : "시간표 미지정";
        if (text.trim() !== scheduleText.trim() && text.trim() !== "") {
          localStorage.setItem("teacher_notes_line1_is_custom", "true");
        }
      }

      setNoticeHtml(html);
    }
  };

  // Sync Line 1 with tomorrow's schedule manually
  const syncLine1WithSchedule = () => {
    localStorage.setItem("teacher_notes_line1_is_custom", "false");
    const scheduleText = tomorrowSubjectsRef.current.length > 0 ? tomorrowSubjectsRef.current.join(" ") : "시간표 미지정";
    
    if (noticeEditorRef.current) {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = noticeEditorRef.current.innerHTML;
      const firstChild = tempDiv.firstElementChild;
      if (firstChild) {
        firstChild.innerHTML = scheduleText;
      } else {
        tempDiv.innerHTML = `<div>${scheduleText}</div>`;
      }
      
      noticeEditorRef.current.innerHTML = tempDiv.innerHTML;
      handleNoticeInput();
      noticeEditorRef.current.focus();
    }
  };

  // Handle updates in Chalk Editor
  const handleChalkInput = () => {
    if (chalkEditorRef.current) {
      const html = chalkEditorRef.current.innerHTML;
      setChalkHtml(html);
      saveCachedSetting("teacher_notes_board_chalk_html", html);
    }
  };

  // Apply rich text styles to highlight selection
  const applyStyle = (styleName: "fontSize" | "color" | "cmd", value: string = "") => {
    // If command (bold, underline)
    if (styleName === "cmd") {
      document.execCommand(value, false);
      if (activeTab === "notice") {
        handleNoticeInput();
      } else {
        handleChalkInput();
      }
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      if (styleName === "color") {
        document.execCommand("foreColor", false, value);
      }
      return;
    }

    const span = document.createElement("span");
    if (styleName === "fontSize") {
      span.style.fontSize = value;
      span.style.lineHeight = "1.5";
    } else if (styleName === "color") {
      span.style.color = value;
    }

    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);

      if (activeTab === "notice") {
        handleNoticeInput();
      } else {
        handleChalkInput();
      }
    } catch (e) {
      console.error("Failed to apply formatting: ", e);
    }
  };

  const clearNoticeText = () => {
    if (window.confirm("알림장 내용을 모두 초기화하시겠습니까?")) {
      localStorage.setItem("teacher_notes_line1_is_custom", "false");
      const scheduleText = tomorrowSubjectsRef.current.length > 0 ? tomorrowSubjectsRef.current.join(" ") : "시간표 미지정";
      const resetHtml = `<div>${scheduleText}</div>`;
      setNoticeHtml(resetHtml);
      if (noticeEditorRef.current) {
        noticeEditorRef.current.innerHTML = resetHtml;
        noticeEditorRef.current.focus();
      }
    }
  };

  const clearChalkText = () => {
    if (window.confirm("칠판 메모 내용을 모두 지우시겠습니까?")) {
      const emptyVal = "<div></div>";
      setChalkHtml(emptyVal);
      if (chalkEditorRef.current) {
        chalkEditorRef.current.innerHTML = emptyVal;
        chalkEditorRef.current.focus();
      }
      saveCachedSetting("teacher_notes_board_chalk_html", emptyVal);
    }
  };

  return (
    <div className={`animate-fade-in flex flex-col ${
      isFullscreen 
        ? "fixed inset-0 bg-[#F5F6F8] z-[999] p-0 h-screen w-screen overflow-hidden" 
        : "max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-90px)] w-full"
    }`}>
      {/* Fullscreen Presentation slim Header */}
      {isFullscreen && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-xs select-none shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-extrabold text-[#2563EB] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md animate-pulse">
              프레젠테이션 모드
            </span>
            <h2 className="font-sans font-extrabold text-sm text-gray-900">
              {activeTab === "notice" ? "알림장 전체화면" : "칠판 전체화면"}
            </h2>
            <span className="text-xs text-gray-400 font-medium hidden sm:inline">기준일: {formattedTodayDot}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch inside fullscreen */}
            <div className="flex bg-gray-100 p-0.5 rounded-xl">
              <button
                onClick={() => handleTabChange("notice")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === "notice"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <BookOpen className="w-3 h-3" />
                <span>알림장</span>
              </button>
              <button
                onClick={() => handleTabChange("chalk")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === "chalk"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <PenTool className="w-3 h-3" />
                <span>칠판</span>
              </button>
            </div>

            {/* Font Zoom Controls */}
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-0.5 gap-1">
              <button
                onClick={handleZoomOut}
                className="w-8 h-8 flex items-center justify-center text-xs font-bold hover:bg-white rounded-lg transition-colors text-gray-600 border border-transparent hover:border-gray-150 cursor-pointer select-none"
                title="글자 크기 축소"
              >
                A-
              </button>
              <span className="text-[10px] font-extrabold text-gray-500 px-1.5 min-w-[36px] text-center select-none">
                {zoomLevel}%
              </span>
              <button
                onClick={handleZoomIn}
                className="w-8 h-8 flex items-center justify-center text-xs font-bold hover:bg-white rounded-lg transition-colors text-gray-600 border border-transparent hover:border-gray-150 cursor-pointer select-none"
                title="글자 크기 확대"
              >
                A+
              </button>
            </div>

            {/* Exit Fullscreen */}
            <button
              onClick={() => setIsFullscreen(false)}
              className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="전체화면 종료 (ESC)"
            >
              <Minimize2 className="w-4 h-4 text-white" />
              <span>종료</span>
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      {!isFullscreen && (
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
                  담임업무
                </span>
                <span className="text-[10px] text-gray-400 font-medium">기준일: {formattedTodayDot}</span>
              </div>
              <h1 className="font-sans font-extrabold text-xl text-gray-950 tracking-tight mt-0.5">
                알림장 / 칠판 관리
              </h1>
            </div>
          </div>

          {/* Tab Selection Switcher & Fullscreen Button */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => handleTabChange("notice")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "notice"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>알림장</span>
              </button>
              <button
                onClick={() => handleTabChange("chalk")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "chalk"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>칠판 (임시)</span>
              </button>
            </div>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="px-3 py-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-all cursor-pointer flex items-center justify-center text-xs font-bold gap-1.5 shrink-0"
              title="전체화면 활성화"
            >
              <Maximize2 className="w-4 h-4 text-gray-400" />
              <span>전체화면</span>
            </button>
          </div>
        </div>
      )}

      {/* Format Toolbar Controls */}
      {!isFullscreen && (
        <div className="bg-white rounded-xl border border-gray-150 p-3 mb-4 flex flex-wrap items-center gap-2 shadow-3xs select-none">
          <div className="flex flex-wrap items-center gap-1">
            <Type className="w-3.5 h-3.5 text-gray-400 mr-1" />
            <span className="text-xs font-bold text-gray-400 mr-1.5 font-sans">글자 크기</span>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("fontSize", "9px"); }}
              className="px-2 py-0.5 text-[10px] bg-gray-50 hover:bg-gray-100 rounded-md font-bold text-gray-700 cursor-pointer border border-gray-200"
            >
              아주 작게
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("fontSize", "11px"); }}
              className="px-2 py-0.5 text-[10px] bg-gray-50 hover:bg-gray-100 rounded-md font-bold text-gray-700 cursor-pointer border border-gray-200"
            >
              작게
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("fontSize", "14px"); }}
              className="px-2 py-0.5 text-[10px] bg-gray-50 hover:bg-gray-100 rounded-md font-bold text-gray-700 cursor-pointer border border-gray-200"
            >
              보통
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("fontSize", "18px"); }}
              className="px-2 py-0.5 text-[10px] bg-gray-50 hover:bg-gray-100 rounded-md font-bold text-gray-700 cursor-pointer border border-gray-200"
            >
              크게
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("fontSize", "24px"); }}
              className="px-2 py-0.5 text-[10px] bg-gray-50 hover:bg-gray-100 rounded-md font-bold text-gray-700 cursor-pointer border border-gray-200"
            >
              아주 크게
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("fontSize", "32px"); }}
              className="px-2 py-0.5 text-[10px] bg-gray-50 hover:bg-gray-100 rounded-md font-bold text-gray-700 cursor-pointer border border-gray-200"
            >
              거대하게
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("fontSize", "40px"); }}
              className="px-2 py-0.5 text-[10px] bg-gray-50 hover:bg-gray-100 rounded-md font-bold text-gray-700 cursor-pointer border border-gray-200"
            >
              초거대하게
            </button>
          </div>

          <div className="w-px h-5 bg-gray-200 mx-2"></div>

          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-gray-400 mr-1" />
            <span className="text-xs font-bold text-gray-400 mr-1">글자 색상</span>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("color", "#111827"); }}
              className="w-5.5 h-5.5 rounded-full bg-gray-900 border border-gray-300 hover:scale-110 transition-transform cursor-pointer"
              title="검정"
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("color", "#EF4444"); }}
              className="w-5.5 h-5.5 rounded-full bg-red-500 border border-gray-300 hover:scale-110 transition-transform cursor-pointer"
              title="빨강"
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("color", "#3B82F6"); }}
              className="w-5.5 h-5.5 rounded-full bg-blue-500 border border-gray-300 hover:scale-110 transition-transform cursor-pointer"
              title="파랑"
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("color", "#F59E0B"); }}
              className="w-5.5 h-5.5 rounded-full bg-amber-500 border border-gray-300 hover:scale-110 transition-transform cursor-pointer"
              title="노랑"
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("color", "#10B981"); }}
              className="w-5.5 h-5.5 rounded-full bg-emerald-500 border border-gray-300 hover:scale-110 transition-transform cursor-pointer"
              title="초록"
            />
          </div>

          <div className="w-px h-5 bg-gray-200 mx-2"></div>

          <div className="flex items-center gap-1">
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("cmd", "bold"); }}
              className="p-1 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md w-7 h-7 flex items-center justify-center cursor-pointer"
              title="굵게 (Bold)"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyStyle("cmd", "underline"); }}
              className="p-1 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-md w-7 h-7 flex items-center justify-center cursor-pointer"
              title="밑줄 (Underline)">
              <Underline className="w-4 h-4" />
            </button>
          </div>

          <div className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
            💡 드래그하여 글자를 선택한 뒤 글자 크기와 색상을 조절해 보세요. 1번 항목은 내일 시간표와 자동으로 연동되며, 직접 수정도 가능합니다.
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`w-full flex-1 ${isFullscreen ? "overflow-hidden flex flex-col min-h-0 bg-[#F5F6F8] p-4 sm:p-6 lg:p-8" : ""}`}>
        {/* Editor Area (Full width) */}
        <div className={`bg-white shadow-sm flex flex-col ${
          isFullscreen 
            ? "flex-1 min-h-0 h-full overflow-hidden rounded-3xl border border-gray-250 p-6 lg:p-10" 
            : "rounded-2xl border border-gray-100 p-6 h-full min-h-[500px]"
        }`}>
          {activeTab === "notice" ? (
            <div className="flex flex-col h-full flex-1 min-h-0">
              {!isFullscreen && (
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#2563EB]" />
                    <span className="text-xs font-extrabold text-gray-800">알림장 작성란 (서식 지원)</span>
                    <button
                      onClick={syncLine1WithSchedule}
                      className="ml-3 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] hover:text-blue-700 rounded-md border border-blue-100 transition-all text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      title="내일 시간표 자동 연동 상태로 되돌립니다."
                    >
                      <Sparkles className="w-3 h-3 text-[#2563EB]" />
                      <span>시간표 자동 연동</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-medium">자동 저장 완료</span>
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="p-1 hover:bg-blue-50 text-gray-500 hover:text-[#2563EB] rounded-md transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 border border-gray-100 hover:border-blue-100 px-1.5"
                      title={isFullscreen ? "전체화면 종료" : "전체화면"}
                    >
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isFullscreen ? "축소" : "전체화면"}</span>
                    </button>
                    <button
                      onClick={clearNoticeText}
                      className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                      title="초기화"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>초기화</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Notice ContentEditable Box with Unified Design */}
              <div 
                id="notice-editor-container" 
                className={`flex-1 flex flex-col border border-gray-200 hover:border-gray-300 focus-within:border-[#2563EB] focus-within:ring-3 focus-within:ring-blue-100 rounded-2xl bg-white transition-all shadow-3xs overflow-y-auto ${
                  isFullscreen ? "min-h-0 border-none ring-0 shadow-none p-2 lg:p-4" : "p-5 min-h-[350px]"
                }`}
              >
                <style>{`
                  #notice-editor {
                    counter-reset: line-counter;
                    outline: none;
                    font-size: ${isFullscreen ? `${zoomLevel}%` : "100%"};
                    line-height: 1.6;
                    min-height: ${isFullscreen ? "100%" : "350px"};
                  }
                  #notice-editor > div, #notice-editor > p {
                    position: relative;
                    padding-left: ${isFullscreen ? `${zoomLevel * 0.26}px` : "28px"};
                    min-height: ${isFullscreen ? `${zoomLevel * 0.18}px` : "24px"};
                    margin-bottom: ${isFullscreen ? "0.9rem" : "0.5rem"};
                  }
                  #notice-editor > div::before, #notice-editor > p::before {
                    counter-increment: line-counter;
                    content: counter(line-counter) ".";
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: ${isFullscreen ? `${zoomLevel * 0.20}px` : "20px"};
                    font-weight: 800;
                    color: #2563eb;
                    user-select: none;
                  }
                  #notice-editor:empty:before {
                    content: attr(placeholder);
                    color: rgb(209, 213, 219);
                    font-weight: 500;
                    cursor: text;
                  }
                `}</style>
                
                <div
                  id="notice-editor"
                  ref={noticeEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleNoticeInput}
                  placeholder="알림장 내용을 입력하세요..."
                  className={`flex-1 w-full break-all focus:outline-hidden outline-hidden ${
                    isFullscreen ? "font-bold text-gray-950" : "font-semibold text-gray-800"
                  }`}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full flex-1 min-h-0">
              {!isFullscreen && (
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 shrink-0">
                  <div className="flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-slate-700" />
                    <span className="text-xs font-extrabold text-gray-800">칠판 메모장 (임시 화면 - 비저장)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">저장 안 됨 (임시)</span>
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="p-1 hover:bg-blue-50 text-gray-500 hover:text-[#2563EB] rounded-md transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1 border border-gray-100 hover:border-blue-100 px-1.5"
                      title={isFullscreen ? "전체화면 종료" : "전체화면"}
                    >
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{isFullscreen ? "축소" : "전체화면"}</span>
                    </button>
                    <button
                      onClick={clearChalkText}
                      className="p-1 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer text-xs font-semibold flex items-center gap-1"
                      title="지우기"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>전체 지우기</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Chalkboard ContentEditable Box */}
              <div className={`flex-1 flex flex-col bg-slate-900 border border-slate-950 rounded-2xl relative overflow-hidden ${
                isFullscreen ? "min-h-0 p-6 lg:p-8" : "p-4 shadow-inner"
              }`}>
                {!isFullscreen && (
                  <div className="absolute top-3 right-3 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700 text-[9px] text-slate-400 font-bold tracking-wider uppercase select-none">
                    Chalkboard
                  </div>
                )}
                <div
                  id="chalkboard-editor"
                  ref={chalkEditorRef}
                  contentEditable
                  onInput={handleChalkInput}
                  placeholder="칠판에 적을 임시 메모나 자유로운 지시사항을 기록하세요. 페이지를 벗어나면 지워집니다..."
                  style={{ fontSize: isFullscreen ? `${zoomLevel}%` : "inherit" }}
                  className={`flex-1 w-full bg-transparent border-none text-emerald-50 focus:outline-hidden overflow-y-auto whitespace-pre-wrap ${
                    isFullscreen ? "min-h-0 font-extrabold leading-relaxed" : "min-h-[350px] font-semibold text-xs leading-relaxed"
                  }`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
