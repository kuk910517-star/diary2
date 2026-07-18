import React, { useState, useEffect } from "react";
import { CheckSquare, Square, Plus, Trash2, Edit2, Check, GripVertical, Loader2 } from "lucide-react";
import { TodoItem } from "../types";
import { 
  getCachedTodos, 
  saveCachedTodos, 
  getCachedSetting, 
  saveCachedSetting, 
  useSupabaseInitStatus,
  addTodoToDB,
  updateTodoInDB,
  deleteTodoFromDB
} from "../lib/supabase";

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadTodos(): TodoItem[] {
  const todayStr = getTodayDateString();
  let stored: TodoItem[] = [];
  try {
    const raw = getCachedTodos();
    if (raw && raw.length > 0) {
      stored = raw;
    } else {
      // Default initial todos
      stored = [
        { id: "todo-1", title: "출결 확인", isCompleted: false },
        { id: "todo-2", title: "알림장 작성", isCompleted: false },
        { id: "todo-3", title: "상담 기록", isCompleted: false },
        { id: "todo-4", title: "가정통신문 확인", isCompleted: false },
        { id: "todo-5", title: "생활기록부 작성", isCompleted: false },
      ];
    }
  } catch (e) {
    console.error("Failed to load todos", e);
  }

  // "체크한 할 일은 당일에는 완료 상태로 표시하고, 다음날이 되면 자동으로 목록에서 제거됩니다."
  // "오늘 할 일에서 체크되지 않은 내용은 다음 날에도 연동(이월)되어 계속 유지됩니다."
  // "출결은 날짜가 지나도 저장해두지만 나머지 내용은 날짜가 지나고 나면 삭제해줘."
  stored = stored.filter((todo) => {
    // If a todo belongs to a past date, delete it (non-attendance content is deleted when date passes)
    if (todo.date && todo.date < todayStr) {
      return false;
    }
    // "달력 날짜에 입력되어 있는 할 일은 오늘 할 일에도 자동으로 연동시켜줘."
    // We allow future calendar todos to be visible and linked in Today's Todos too.
    if (todo.isCompleted) {
      return !todo.completedAt || todo.completedAt === todayStr;
    }
    return true; // 미완료(체크되지 않은) 할 일은 다음 날에도 목록에 연동되어 계속 보존됩니다.
  });

  // "매주 금요일에는 아래 두 가지 할 일을 자동으로 목록에 추가해주세요: 주안 작성, 육아시간 사용"
  const todayDate = new Date();
  const isFriday = todayDate.getDay() === 5;
  if (isFriday) {
    const lastFridayAdded = getCachedSetting("teacher_notes_todo_last_friday_added", "");
    if (lastFridayAdded !== todayStr) {
      const hasJuan = stored.some(t => t.title === "주안 작성" && !t.isCompleted);
      const hasYuga = stored.some(t => t.title === "육아시간 사용" && !t.isCompleted);

      const autoTodos: TodoItem[] = [];
      if (!hasJuan) {
        autoTodos.push({ id: `auto-friday-juan-${Date.now()}`, title: "주안 작성", isCompleted: false });
      }
      if (!hasYuga) {
        autoTodos.push({ id: `auto-friday-yuga-${Date.now()}`, title: "육아시간 사용", isCompleted: false });
      }

      if (autoTodos.length > 0) {
        stored = [...stored, ...autoTodos];
      }
      saveCachedSetting("teacher_notes_todo_last_friday_added", todayStr);
    }
  }

  return stored;
}

function saveTodos(todos: TodoItem[]): void {
  try {
    saveCachedTodos(todos);
  } catch (e) {
    console.error("Failed to save todos", e);
  }
}

export default function TodoCard() {
  const { initialized, isConnected } = useSupabaseInitStatus();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize and run auto-cleanup with real-time reactivity
  useEffect(() => {
    const handleStorageChange = () => {
      const loaded = loadTodos();
      setTodos(loaded);
    };
    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);


  const handleToggleComplete = async (id: string | number) => {
    const todayStr = getTodayDateString();
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const nextCompleted = !todo.isCompleted;
    const completedAt = nextCompleted ? todayStr : undefined;

    // Optimistic UI update
    setTodos(prev => prev.map(t => t.id === id ? { ...t, isCompleted: nextCompleted, completedAt } : t));

    // Supabase update
    await updateTodoInDB(id, { isCompleted: nextCompleted, completedAt });
  };

  const handleAddTodo = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    setError(null);
    setNewTitle("");

    try {
      // Supabase insert - returns the saved todo with database assigned ID
      const saved = await addTodoToDB(trimmed);
      if (saved) {
        setTodos(prev => {
          if (prev.some(t => t.id === saved.id)) return prev;
          return [...prev, saved];
        });
      }
    } catch (err: any) {
      console.error("handleAddTodo error:", err);
      setError(err?.message || err?.details || String(err));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddTodo();
    }
  };

  const handleStartEdit = (todo: TodoItem) => {
    if (todo.isCompleted) return; // Prevent editing completed items
    setEditingId(todo.id);
    setEditingText(todo.title);
  };

  const handleSaveEdit = async (id: string | number) => {
    const trimmed = editingText.trim();
    if (!trimmed) {
      handleDeleteTodo(id);
      setEditingId(null);
      return;
    }

    // Optimistic UI update
    setTodos(prev => prev.map(t => t.id === id ? { ...t, title: trimmed } : t));
    setEditingId(null);

    // Supabase update
    await updateTodoInDB(id, { title: trimmed });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleDeleteTodo = async (id: string | number) => {
    // Optimistic UI update
    setTodos(prev => prev.filter(t => t.id !== id));

    // Supabase delete
    await deleteTodoFromDB(id);
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const reordered = [...todos];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    setTodos(reordered);
    saveTodos(reordered);
    setDraggedIndex(null);
  };

  return (
    <div id="todo-card" className="bg-white rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-300 border border-gray-100 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-[#2563EB] rounded-lg">
            <CheckSquare className="w-4 h-4" />
          </div>
          <h2 className="font-sans font-bold text-sm text-gray-800">오늘 할 일</h2>
          <button
            onClick={handleAddTodo}
            className="p-1 bg-[#2563EB] hover:bg-[#1d4ed8] text-white rounded-md transition-all hover:scale-105 cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
            title="할 일 추가"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <span className="text-[10px] font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md">
          완료 {todos.filter((t) => t.isCompleted).length} / 전체 {todos.length}
        </span>
      </div>

      {/* Quick Add Form - Now below the header */}
      <div className="mb-2 pb-2 border-b border-gray-100 flex items-center gap-1.5 shrink-0">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="새로운 할 일을 추가하세요..."
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 focus:outline-hidden focus:border-[#2563EB] focus:ring-1 focus:ring-blue-100 transition-all placeholder-gray-300"
        />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold px-2.5 py-2 rounded-lg mb-2 flex items-center justify-between shrink-0 leading-tight">
          <span className="truncate pr-2" title={error}>{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="text-rose-400 hover:text-rose-600 font-bold ml-1 shrink-0 cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Todo List Scroll Area (With scroll bar for overflow but compact styling) */}
      <div className="space-y-1 flex-1 overflow-y-auto scrollbar-thin pr-1 relative">
        {isConnected && !initialized ? (
          <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center text-center p-4">
            <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin mb-2" />
            <span className="text-[11px] font-bold text-gray-600">할 일 불러오는 중...</span>
            <span className="text-[9px] text-gray-400 mt-1">Supabase 연동 완료 대기 중</span>
          </div>
        ) : null}
        {todos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-6">
            <CheckSquare className="w-6 h-6 text-gray-200 mb-1" />
            <p className="text-[11px] font-semibold">오늘 할 일이 없습니다.</p>
            <p className="text-[9px] text-gray-400 mt-0.5">상단 입력창에서 새로운 할 일을 등록하세요.</p>
          </div>
        ) : (
          todos.map((todo, idx) => {
            const isEditing = editingId === todo.id;

            return (
              <div
                key={todo.id}
                draggable={!isEditing}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                className={`flex items-center gap-1.5 p-1 px-2 rounded-lg border border-transparent hover:bg-gray-50/50 transition-all group ${
                  todo.isCompleted ? "opacity-60 bg-gray-50/30" : ""
                } ${draggedIndex === idx ? "opacity-40 border-dashed border-blue-300 bg-blue-50/10" : ""}`}
              >
                {/* Drag Handle */}
                <div className="text-gray-300 group-hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0">
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Checkbox Icon */}
                <button
                  onClick={() => handleToggleComplete(todo.id)}
                  className="text-gray-400 shrink-0 hover:text-[#2563EB] transition-colors cursor-pointer"
                  title={todo.isCompleted ? "미완료로 변경" : "완료로 변경"}
                >
                  {todo.isCompleted ? (
                    <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-300" />
                  )}
                </button>

                {/* Title / Inline Edit field */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleSaveEdit(todo.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(todo.id);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                        className="w-full bg-white border border-gray-200 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-gray-800 focus:outline-hidden focus:border-[#2563EB] transition-all"
                      />
                      <button
                        onMouseDown={() => handleSaveEdit(todo.id)}
                        className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p
                        onDoubleClick={() => handleStartEdit(todo)}
                        className={`text-[11px] font-bold tracking-tight truncate cursor-pointer select-none ${
                          todo.isCompleted
                            ? "text-gray-400 line-through"
                            : "text-gray-700 hover:text-gray-900"
                        }`}
                        title="더블클릭하여 수정 가능"
                      >
                        {todo.title}
                      </p>
                      {todo.date && (
                        <span className="text-[8px] font-extrabold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-sm shrink-0 select-none">
                          {todo.date.slice(5).replace("-", "/")}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions: Edit & Delete buttons */}
                {!isEditing && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!todo.isCompleted && (
                      <button
                        onClick={() => handleStartEdit(todo)}
                        className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all cursor-pointer"
                        title="할 일 이름 수정"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="p-0.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                      title="할 일 삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
