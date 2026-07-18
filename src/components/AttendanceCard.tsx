import React, { useState, useEffect } from "react";
import { Users, Plane, UserX, UserMinus, Clock, X, Plus, Edit2 } from "lucide-react";
import { formatDate } from "../lib/storage";
import { DailyAttendance, SupabaseAttendanceItem } from "../types";
import { 
  getCachedAttendance, 
  addAttendanceToDB, 
  updateAttendanceInDB, 
  deleteAttendanceFromDB,
  useSupabaseInitStatus
} from "../lib/supabase";

export default function AttendanceCard() {
  const todayStr = formatDate(new Date()); // Today reference date in the workspace context
  const { initialized } = useSupabaseInitStatus();

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const dateVal = String(today.getDate()).padStart(2, "0");
  const dayName = ["일", "월", "화", "수", "목", "금", "토"][today.getDay()];
  const formattedToday = `${year}.${month}.${dateVal} (${dayName})`;
  
  const [attendanceItems, setAttendanceItems] = useState<SupabaseAttendanceItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showInputKey, setShowInputKey] = useState<keyof Omit<DailyAttendance, "date"> | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editingText, setEditingText] = useState("");

  // Load today's attendance on mount and when database state changes via the "storage" event
  useEffect(() => {
    const handleStorageChange = () => {
      setAttendanceItems(getCachedAttendance());
    };
    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [initialized]);

  const todayItems = attendanceItems.filter(item => item.date === todayStr);

  const attendance: DailyAttendance = {
    date: todayStr,
    absent: todayItems.filter(i => i.category === "absent").map(i => i.studentName),
    experiential: todayItems.filter(i => i.category === "experiential").map(i => i.studentName),
    tardy: todayItems.filter(i => i.category === "tardy").map(i => i.studentName),
    earlyLeave: todayItems.filter(i => i.category === "earlyLeave").map(i => i.studentName),
  };

  const categories = [
    {
      key: "experiential" as const,
      label: "교외체험학습",
      icon: <Plane className="w-4 h-4" />,
      bgClass: "bg-blue-50/60",
      textClass: "text-blue-700",
      iconClass: "text-blue-500",
      borderClass: "border-blue-100/70",
      badgeClass: "bg-blue-100/70 text-blue-800 border-blue-200",
    },
    {
      key: "absent" as const,
      label: "결석",
      icon: <UserX className="w-4 h-4" />,
      bgClass: "bg-rose-50/60",
      textClass: "text-rose-700",
      iconClass: "text-rose-500",
      borderClass: "border-rose-100/70",
      badgeClass: "bg-rose-100/70 text-rose-800 border-rose-200",
    },
    {
      key: "earlyLeave" as const,
      label: "조퇴",
      icon: <UserMinus className="w-4 h-4" />,
      bgClass: "bg-amber-50/60",
      textClass: "text-amber-700",
      iconClass: "text-amber-500",
      borderClass: "border-amber-100/70",
      badgeClass: "bg-amber-100/70 text-amber-800 border-amber-200",
    },
    {
      key: "tardy" as const,
      label: "지각",
      icon: <Clock className="w-4 h-4" />,
      bgClass: "bg-purple-50/60",
      textClass: "text-purple-700",
      iconClass: "text-purple-500",
      borderClass: "border-purple-100/70",
      badgeClass: "bg-purple-100/70 text-purple-800 border-purple-200",
    },
  ];

  const handleAddStudent = async (key: keyof Omit<DailyAttendance, "date">) => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    const currentList = attendance[key] || [];
    if (currentList.includes(trimmed)) {
      // Avoid duplicate names in same list
      setShowInputKey(null);
      setInputVal("");
      return;
    }

    setShowInputKey(null);
    setInputVal("");

    try {
      await addAttendanceToDB(todayStr, key, trimmed);
    } catch (err) {
      console.error("Failed to add student", err);
    }
  };

  const handleDeleteStudent = async (itemId: string | number) => {
    try {
      await deleteAttendanceFromDB(itemId);
    } catch (err) {
      console.error("Failed to delete student", err);
    }
  };

  const handleStartEdit = (item: SupabaseAttendanceItem) => {
    setEditingId(item.id);
    setEditingText(item.studentName);
  };

  const handleSaveEdit = async (id: string | number) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      handleDeleteStudent(id);
      setEditingId(null);
      return;
    }

    setEditingId(null);
    try {
      await updateAttendanceInDB(id, { studentName: trimmed });
    } catch (err) {
      console.error("Failed to save edit", err);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <>
      {/* 1. Main View-Only Dashboard Card */}
      <div id="attendance-card" className="bg-white rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-300 border border-gray-100 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 text-[#2563EB] rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="font-sans font-bold text-sm text-gray-800">오늘 출결 상태</h2>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-[10px] font-bold text-[#2563EB] bg-blue-50/50 hover:bg-blue-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 border border-blue-100/30"
          >
            <Edit2 className="w-2.5 h-2.5" />
            <span>출결 관리</span>
          </button>
        </div>

        {/* 2x2 Grid Layout for categories (Scrolling enabled inside grid with compact padding) */}
        <div className="grid grid-cols-2 gap-2 flex-1 overflow-y-auto pr-0.5 scrollbar-thin">
          {categories.map((cat) => {
            const list = attendance[cat.key] || [];

            return (
              <div
                key={cat.key}
                className={`p-2 rounded-xl border flex flex-col min-h-[60px] transition-all ${cat.bgClass} ${cat.borderClass}`}
              >
                {/* Category Header */}
                <div className="flex items-center justify-between mb-1 shrink-0">
                  <span className="text-[10px] font-extrabold text-gray-600 tracking-tight flex items-center gap-1">
                    {cat.label}
                  </span>
                  <div className={`${cat.iconClass} shrink-0`}>
                    {React.cloneElement(cat.icon, { className: "w-3.5 h-3.5" })}
                  </div>
                </div>

                {/* Badge wrap layout (Scrollable if excessive names but wrapping) */}
                <div className="flex flex-wrap gap-1 items-start flex-1 overflow-y-auto max-h-[48px] scrollbar-thin pr-0.5">
                  {list.length === 0 ? (
                    <span className="text-[9px] font-semibold text-gray-400 italic mt-0.5">
                      없음
                    </span>
                  ) : (
                    list.map((name) => (
                      <span
                        key={name}
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border inline-flex items-center ${cat.badgeClass}`}
                      >
                        {name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Management Modal/Popup Popup */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-gray-100 flex flex-col max-h-[90vh] animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-[#2563EB] rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-sans font-extrabold text-base text-gray-800">
                    오늘 출결 관리
                  </h3>
                  <p className="text-[10px] text-gray-400 font-medium">
                    기준일: {formattedToday}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setShowInputKey(null);
                }}
                className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition-all cursor-pointer border border-transparent hover:border-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Active Editors for each of the 4 Categories */}
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const list = todayItems.filter((i) => i.category === cat.key);
                const isAdding = showInputKey === cat.key;

                return (
                  <div
                    key={cat.key}
                    className={`p-4 rounded-2xl border transition-all ${cat.bgClass} ${cat.borderClass}`}
                  >
                    {/* Category Title & Icon */}
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-white shadow-xs ${cat.iconClass}`}>
                          {cat.icon}
                        </div>
                        <span className="text-xs font-extrabold text-gray-700">
                          {cat.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">
                        총 {list.length}명
                      </span>
                    </div>

                    {/* Badge Wrap + Input element */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {list.map((item) => {
                        const isEditingThis = editingId === item.id;
                        return (
                          <span
                            key={item.id}
                            className={`text-xs font-bold px-2.5 py-1 rounded-xl border inline-flex items-center gap-1 shadow-xs transition-transform hover:scale-102 ${cat.badgeClass}`}
                            onDoubleClick={() => handleStartEdit(item)}
                          >
                            {isEditingThis ? (
                              <input
                                type="text"
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit(item.id);
                                  if (e.key === "Escape") handleCancelEdit();
                                }}
                                autoFocus
                                className="w-16 bg-transparent text-xs font-bold focus:outline-hidden border-b border-gray-400"
                              />
                            ) : (
                              <span title="더블클릭하여 수정" className="cursor-pointer">{item.studentName}</span>
                            )}
                            <button
                              onClick={() => handleDeleteStudent(item.id)}
                              className="p-0.5 hover:bg-black/5 text-gray-500 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                              title={`${item.studentName} 출결 삭제`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}

                      {/* Inline Add Input Field */}
                      {isAdding ? (
                        <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1 shadow-xs">
                          <input
                            type="text"
                            placeholder="학생 이름"
                            autoFocus
                            value={inputVal}
                            onChange={(e) => setInputVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddStudent(cat.key);
                              if (e.key === "Escape") {
                                setShowInputKey(null);
                                setInputVal("");
                              }
                            }}
                            className="w-18 text-xs font-extrabold text-gray-800 focus:outline-hidden"
                          />
                          <button
                            onClick={() => handleAddStudent(cat.key)}
                            className="text-[#2563EB] hover:text-blue-800 font-bold text-xs"
                          >
                            추가
                          </button>
                          <button
                            onClick={() => {
                              setShowInputKey(null);
                              setInputVal("");
                            }}
                            className="text-gray-400 hover:text-gray-600 font-bold text-xs"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setShowInputKey(cat.key);
                            setInputVal("");
                          }}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-xl border border-dashed border-gray-300 bg-white/60 hover:bg-white text-gray-500 hover:text-[#2563EB] hover:border-[#2563EB] text-xs font-bold transition-all duration-200 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>추가</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setShowInputKey(null);
                }}
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-extrabold rounded-xl text-xs shadow-sm transition-all hover:scale-102 cursor-pointer"
              >
                관리 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
