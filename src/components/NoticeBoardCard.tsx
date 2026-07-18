import React, { useState, useEffect } from "react";
import { PenTool, BookOpen, Clock, AlertTriangle, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { getScheduleForDate, formatDate } from "../lib/storage";
import { 
  getCachedSetting, 
  saveCachedSetting, 
  getCachedNoticeHtml,
  useSupabaseInitStatus
} from "../lib/supabase";

interface NoticeBoardCardProps {
  onNavigateToBoard: () => void;
}

export default function NoticeBoardCard({ onNavigateToBoard }: NoticeBoardCardProps) {
  const { initialized, isConnected } = useSupabaseInitStatus();
  // Localized tab state
  const [activeTab, setActiveTab] = useState<"notice" | "chalk">(() => {
    return (getCachedSetting("teacher_notes_board_active_tab", "notice") as "notice" | "chalk") || "notice";
  });

  const [noticeHtml, setNoticeHtml] = useState("");
  const [chalkHtml, setChalkHtml] = useState("");
  const [tomorrowSubjects, setTomorrowSubjects] = useState<string[]>([]);
  const [evaluationsCount, setEvaluationsCount] = useState(0);

  // Helper to cap preview font size to prevent card overflow and show text smaller on the main screen dashboard
  const getPreviewFontSize = (sizeStr: string): string => {
    const val = parseInt(sizeStr);
    if (isNaN(val)) return "10px";
    if (val <= 11) return "9px";
    if (val <= 14) return "10px";
    if (val <= 18) return "10px";
    return "11px"; // Cap to maximum 11px on the dashboard card for high readability and compact fit
  };

  const getLineStyles = (html: string) => {
    if (!html) return { fontSize: "inherit", color: "inherit", fontWeight: "inherit" };
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    let fontSize = "inherit";
    let color = "inherit";
    let fontWeight = "inherit";
    
    const fontTags = doc.querySelectorAll("font");
    const spanTags = doc.querySelectorAll("span");
    const bTags = doc.querySelectorAll("b, strong");
    
    for (const tag of Array.from(fontTags)) {
      if (tag.style.fontSize) {
        fontSize = tag.style.fontSize;
      }
      if (tag.color) {
        color = tag.color;
      }
    }
    
    for (const tag of Array.from(spanTags)) {
      if (tag.style.fontSize) {
        fontSize = tag.style.fontSize;
      }
      if (tag.style.color) {
        color = tag.style.color;
      }
      if (tag.style.fontWeight === "bold" || tag.style.fontWeight === "800") {
        fontWeight = "800";
      }
    }

    if (bTags.length > 0) {
      fontWeight = "800";
    }
    
    return { fontSize, color, fontWeight };
  };

  const sanitizeAndCleanHtml = (html: string): string => {
    if (!html || html.trim() === "" || html === "<div></div>" || html === "<div><br></div>") {
      const scheduleText = tomorrowSubjects.length > 0 ? tomorrowSubjects.join(" ") : "시간표 미지정";
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

  const renderStyledNoticePreview = () => {
    const scheduleText = tomorrowSubjects.length > 0 ? tomorrowSubjects.join(" ") : "시간표 미지정";
    
    if (!noticeHtml) {
      return `<div>${scheduleText}</div>`;
    }

    const sanitized = sanitizeAndCleanHtml(noticeHtml);

    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitized, "text/html");
    
    const styledElements = doc.querySelectorAll("[style]");
    styledElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style.fontSize) {
        htmlEl.style.fontSize = getPreviewFontSize(htmlEl.style.fontSize);
      }
    });

    return doc.body.innerHTML;
  };

  // Poll or reload values when mounting / updating
  useEffect(() => {
    const handleStorageChange = () => {
      const html = getCachedNoticeHtml() || "";
      setNoticeHtml(html);

      const defaultChalk = "<div>수업 중 임시 메모장 용도입니다. (화면을 벗어나면 지워집니다)</div>";
      const chalk = getCachedSetting("teacher_notes_board_chalk_html", defaultChalk);
      setChalkHtml(chalk);

      const tab = (getCachedSetting("teacher_notes_board_active_tab", "notice") as "notice" | "chalk") || "notice";
      setActiveTab(tab);

      // Compute Tomorrow's schedule & Evaluation counts reactively
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
      if (tomorrowSchedule) {
        const subs = tomorrowSchedule.lessons
          .map((l) => l.subject || "")
          .filter((s) => s.trim() !== "");
        setTomorrowSubjects(subs);
      } else {
        setTomorrowSubjects([]);
      }

      // Evaluation count (today to next week's Friday)
      const currentDay = todayDate.getDay();
      const daysToThisFriday = 5 - currentDay;
      const daysToNextFriday = daysToThisFriday + 7;

      const endSearchDate = new Date(todayDate);
      endSearchDate.setDate(todayDate.getDate() + daysToNextFriday);

      let count = 0;
      const tempDate = new Date(todayDate);
      while (tempDate <= endSearchDate) {
        const dateStr = formatDate(tempDate);
        const schedule = getScheduleForDate(dateStr);
        if (schedule) {
          schedule.lessons.forEach((lesson) => {
            if (lesson.content && lesson.content.includes("평가")) {
              count++;
            }
          });
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
      setEvaluationsCount(count);
    };

    window.addEventListener("storage", handleStorageChange);
    // Also check on mount
    handleStorageChange();

    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleTabClick = (tab: "notice" | "chalk", e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card navigation
    setActiveTab(tab);
    saveCachedSetting("teacher_notes_board_active_tab", tab);
  };

  const handleCardClick = () => {
    onNavigateToBoard();
  };

  return (
    <div
      id="notice-board-card"
      onClick={handleCardClick}
      className="bg-white rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-300 border border-gray-100 flex flex-col h-full cursor-pointer group"
    >
      {/* Card Header with Tab switch inside */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 shrink-0">
        <div className="flex bg-gray-100 p-0.5 rounded-lg">
          <button
            onClick={(e) => handleTabClick("notice", e)}
            className={`tab-button px-3 py-1 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === "notice"
                ? "bg-white text-gray-900 shadow-3xs"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>알림장</span>
          </button>
          <button
            onClick={(e) => handleTabClick("chalk", e)}
            className={`tab-button px-3 py-1 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
              activeTab === "chalk"
                ? "bg-white text-gray-900 shadow-3xs"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <PenTool className="w-3 h-3" />
            <span>칠판</span>
          </button>
        </div>

        {/* Go to Board page indicator */}
        <span className="text-[10px] font-bold text-gray-400 group-hover:text-[#2563EB] transition-colors flex items-center gap-0.5">
          <span>작성하기</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Preview Content Area (Fits perfectly in notice-board card with no internal scrollbar) */}
      <div className="flex-1 overflow-hidden pr-0.5 flex flex-col relative">
        {isConnected && !initialized ? (
          <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center text-center p-4">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin mb-2" />
            <span className="text-[11px] font-bold text-gray-600">알림장 불러오는 중...</span>
            <span className="text-[9px] text-gray-400 mt-1">Supabase 연동 완료 대기 중</span>
          </div>
        ) : null}
        {activeTab === "notice" ? (
          <div className="space-y-1.5 flex-1 flex flex-col overflow-hidden">
            {/* Dynamic Evaluations Flag */}
            {evaluationsCount > 0 && (
              <div className="bg-amber-50/40 border border-amber-100/20 rounded-xl px-3 py-1 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                  📌 예정된 평가 안내
                </span>
                <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-full">
                  {evaluationsCount}건
                </span>
              </div>
            )}

            {/* Integrated HTML preview (No scroll) */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <style>{`
                .preview-notice-container {
                  counter-reset: line-counter;
                }
                .preview-notice-container > div, .preview-notice-container > p {
                  position: relative;
                  padding-left: 18px;
                  min-height: 16px;
                  line-height: 1.4;
                }
                .preview-notice-container > div::before, .preview-notice-container > p::before {
                  counter-increment: line-counter;
                  content: counter(line-counter) ".";
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 14px;
                  font-weight: 800;
                  color: #9ca3af;
                }
              `}</style>
              <div
                className="preview-notice-container text-[11px] font-semibold text-gray-600 leading-tight space-y-0.5 overflow-hidden pr-1 flex-1 break-all"
                dangerouslySetInnerHTML={{
                  __html: renderStyledNoticePreview()
                }}
              />
            </div>
          </div>
        ) : (
          /* Chalkboard Preview - Rendering cached chalkboard content */
          <div className="h-full bg-slate-900 border border-slate-950 rounded-xl p-3 shadow-inner flex flex-col justify-between flex-1 overflow-hidden">
            <div 
              className="text-slate-200 text-[10px] leading-relaxed pr-1 flex-1 overflow-hidden"
              dangerouslySetInnerHTML={{ __html: chalkHtml }}
            />
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-800/60 text-[9px] font-bold text-slate-500 uppercase tracking-widest shrink-0">
              <span>Chalkboard</span>
              <span>Saved</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
