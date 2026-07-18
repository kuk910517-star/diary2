import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import DashboardLayout from "./components/DashboardLayout";
import SchedulePage from "./components/SchedulePage";
import BoardPage from "./components/BoardPage";
import TimerPage from "./components/TimerPage";
import CalendarPage from "./components/CalendarPage";
import LoginPage from "./components/LoginPage";
import { initSupabaseData } from "./lib/supabase";
import { getOwnerId } from "./lib/owner";

export default function App() {
  const [view, setView] = useState<"dashboard" | "schedule" | "board" | "timer" | "calendar">( () => {
    const path = window.location.pathname;
    if (path === "/schedule") return "schedule";
    if (path === "/board") return "board";
    if (path === "/timer") return "timer";
    if (path === "/calendar") return "calendar";
    return "dashboard";
  });

  const [ownerId, setOwnerId] = useState<string>(() => getOwnerId());
  const [authLoading, setAuthLoading] = useState(true);

  // Initialize data if ownerId is found on startup
  useEffect(() => {
    if (ownerId) {
      initSupabaseData();
    }
    setAuthLoading(false);
  }, [ownerId]);

  // Sync state view with browser history
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/schedule") setView("schedule");
      else if (path === "/board") setView("board");
      else if (path === "/timer") setView("timer");
      else if (path === "/calendar") setView("calendar");
      else setView("dashboard");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateTo = (nextView: "dashboard" | "schedule" | "board" | "timer" | "calendar") => {
    setView(nextView);
    const path = nextView === "dashboard" ? "/" : `/${nextView}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("owner_id");
    setOwnerId("");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500 font-medium">ID 정보 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!ownerId) {
    return <LoginPage onLoginSuccess={() => setOwnerId(getOwnerId())} />;
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-gray-800 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-800">
      {/* Header stays on top for consistent navigation */}
      <Header
        onManageSchedule={() => navigateTo("schedule")}
        onGoHome={() => navigateTo("dashboard")}
        onLogout={handleLogout}
      />

      <div className="flex-1 overflow-auto">
        {view === "dashboard" && (
          <DashboardLayout
            onManageSchedule={() => navigateTo("schedule")}
            onNavigateToBoard={() => navigateTo("board")}
            onNavigateToTimer={() => navigateTo("timer")}
            onNavigateToCalendar={() => navigateTo("calendar")}
          />
        )}
        {view === "schedule" && (
          <SchedulePage onBack={() => navigateTo("dashboard")} />
        )}
        {view === "board" && (
          <BoardPage onBack={() => navigateTo("dashboard")} />
        )}
        {view === "timer" && (
          <TimerPage onBack={() => navigateTo("dashboard")} />
        )}
        {view === "calendar" && (
          <CalendarPage onBack={() => navigateTo("dashboard")} />
        )}
      </div>
    </div>
  );
}
