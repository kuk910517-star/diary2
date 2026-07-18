import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, Play, Pause, RotateCcw, Maximize2, Minimize2, AlertCircle } from "lucide-react";
import { globalTimer, TimerState } from "../lib/globalTimer";

interface TimerPageProps {
  onBack: () => void;
}

export default function TimerPage({ onBack }: TimerPageProps) {
  const [timerState, setTimerState] = useState<TimerState>(globalTimer.getState());
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Editing state for Hours, Minutes, Seconds
  const [isEditingH, setIsEditingH] = useState(false);
  const [isEditingM, setIsEditingM] = useState(false);
  const [isEditingS, setIsEditingS] = useState(false);

  const [inputH, setInputH] = useState("");
  const [inputM, setInputM] = useState("");
  const [inputS, setInputS] = useState("");

  const inputRefH = useRef<HTMLInputElement>(null);
  const inputRefM = useRef<HTMLInputElement>(null);
  const inputRefS = useRef<HTMLInputElement>(null);

  // Subscribe to Global Timer
  useEffect(() => {
    const unsubscribe = globalTimer.subscribe((state) => {
      setTimerState(state);
    });
    return unsubscribe;
  }, []);

  // ESC Key listener for Full Screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  const { timeLeft, initialSeconds, isRunning, isFinished } = timerState;

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  // Formatting helper
  const pad = (num: number) => String(num).padStart(2, "0");

  // Focus and start edit
  const startEditH = () => {
    if (isRunning) return;
    setInputH(pad(hours));
    setIsEditingH(true);
  };

  const startEditM = () => {
    if (isRunning) return;
    setInputM(pad(minutes));
    setIsEditingM(true);
  };

  const startEditS = () => {
    if (isRunning) return;
    setInputS(pad(seconds));
    setIsEditingS(true);
  };

  // Save edits
  const saveH = () => {
    setIsEditingH(false);
    let val = parseInt(inputH, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 99) val = 99; // Clamp
    globalTimer.setTime(val, minutes, seconds);
  };

  const saveM = () => {
    setIsEditingM(false);
    let val = parseInt(inputM, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 59) val = 59; // Clamp
    globalTimer.setTime(hours, val, seconds);
  };

  const saveS = () => {
    setIsEditingS(false);
    let val = parseInt(inputS, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 59) val = 59; // Clamp
    globalTimer.setTime(hours, minutes, val);
  };

  // Keyboard navigation
  const handleKeyH = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveH();
      inputRefH.current?.blur();
    }
  };

  const handleKeyM = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveM();
      inputRefM.current?.blur();
    }
  };

  const handleKeyS = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveS();
      inputRefS.current?.blur();
    }
  };

  // Control commands
  const handleStart = () => {
    globalTimer.start();
  };

  const handlePause = () => {
    globalTimer.pause();
  };

  const handleReset = () => {
    globalTimer.reset();
  };

  // Screen background depending on finish state
  // "00:00:00이 되면 화면 색상을 잠시 변경하여 종료를 알려주세요."
  const normalBg = "bg-[#F5F6F8]";
  const finishedBg = "bg-rose-100 animate-pulse";
  const bgClass = isFinished ? finishedBg : normalBg;

  // Inside Fullscreen
  if (isFullScreen) {
    return (
      <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-all duration-500 select-none ${
        isFinished ? "bg-rose-600 text-white animate-pulse" : "bg-slate-950 text-white"
      }`}>
        {/* Fullscreen Close instructions */}
        <button
          onClick={() => setIsFullScreen(false)}
          className="absolute top-6 right-6 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/10 transition-all cursor-pointer flex items-center gap-1"
        >
          <Minimize2 className="w-4 h-4" />
          <span>전체화면 종료 (ESC)</span>
        </button>

        {/* Big Giant Timer Numbers */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-8 md:gap-14 text-[12vw] md:text-[14vw] font-mono font-extrabold tracking-wider leading-none">
            {/* Hours */}
            <div className="flex flex-col items-center">
              <span>{pad(hours)}</span>
              <span className="text-lg md:text-2xl text-white/50 font-sans font-bold mt-2">시간</span>
            </div>
            <span className="text-white/30 mb-8">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <span>{pad(minutes)}</span>
              <span className="text-lg md:text-2xl text-white/50 font-sans font-bold mt-2">분</span>
            </div>
            <span className="text-white/30 mb-8">:</span>

            {/* Seconds */}
            <div className="flex flex-col items-center">
              <span>{pad(seconds)}</span>
              <span className="text-lg md:text-2xl text-white/50 font-sans font-bold mt-2">초</span>
            </div>
          </div>

          {/* Large Finished Warning Text */}
          {isFinished && (
            <div className="mt-12 text-2xl md:text-4xl font-extrabold tracking-widest text-white drop-shadow-md">
              📢 수업 시간이 종료되었습니다!
            </div>
          )}
        </div>

        {/* Micro Floating Controls in Fullscreen */}
        <div className="absolute bottom-10 flex gap-4">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="p-4 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all border border-white/20 cursor-pointer"
              title="시작"
            >
              <Play className="w-6 h-6 fill-white" />
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="p-4 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all border border-white/20 cursor-pointer"
              title="일시정지"
            >
              <Pause className="w-6 h-6" />
            </button>
          )}
          <button
            onClick={handleReset}
            className="p-4 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-full transition-all border border-white/20 cursor-pointer"
            title="초기화"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`transition-all duration-300 flex flex-col min-h-[calc(100vh-90px)] p-4 sm:p-6 lg:p-8 ${bgClass}`}>
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        {/* Back navigation header */}
        <div className="flex items-center gap-3 mb-8 shrink-0">
          <button
            onClick={onBack}
            className="p-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl transition-all cursor-pointer text-gray-500 hover:text-gray-950 flex items-center justify-center shadow-2xs"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md">
                대형 화면
              </span>
              <span className="text-[10px] text-gray-400 font-medium">실시간 전역 동기화</span>
            </div>
            <h1 className="font-sans font-extrabold text-xl text-gray-950 tracking-tight mt-0.5">
              전체 화면 수업 타이머
            </h1>
          </div>
        </div>

        {/* Main interactive Card container */}
        <div className={`bg-white rounded-3xl border ${isFinished ? "border-red-300 shadow-md" : "border-gray-100 shadow-sm"} p-8 md:p-12 flex flex-col items-center justify-center flex-1 transition-all`}>
          
          {/* Header info badge */}
          <div className="mb-6 flex items-center gap-2 bg-blue-50/50 border border-blue-100/30 px-3.5 py-1.5 rounded-full text-[#2563EB]">
            <AlertCircle className="w-4 h-4" />
            <span className="text-[11px] font-extrabold">숫자를 클릭해 직접 수정할 수 있습니다</span>
          </div>

          {/* Time digits */}
          <div className="flex items-center gap-4 md:gap-8 text-5xl md:text-8xl font-mono font-extrabold tracking-wider text-gray-800 mb-8 select-none">
            {/* Hours */}
            <div className="flex flex-col items-center">
              {isEditingH ? (
                <input
                  ref={inputRefH}
                  type="text"
                  maxLength={2}
                  value={inputH}
                  onChange={(e) => setInputH(e.target.value.replace(/\D/g, ""))}
                  onBlur={saveH}
                  onKeyDown={handleKeyH}
                  autoFocus
                  className="w-20 md:w-36 text-center bg-gray-50 border border-[#2563EB] text-gray-800 rounded-2xl focus:outline-hidden py-1.5 focus:ring-4 focus:ring-blue-100 transition-all font-mono"
                />
              ) : (
                <span
                  onClick={startEditH}
                  className={`px-2 py-1 rounded-xl cursor-pointer hover:bg-gray-100 hover:text-[#2563EB] transition-all duration-200 ${
                    isRunning ? "opacity-90 pointer-events-none" : ""
                  }`}
                  title={isRunning ? "" : "시(Hour) 클릭하여 수정"}
                >
                  {pad(hours)}
                </span>
              )}
              <span className="text-xs md:text-sm text-gray-400 font-sans font-bold mt-2">시(HH)</span>
            </div>

            <span className="text-gray-300 mb-6">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              {isEditingM ? (
                <input
                  ref={inputRefM}
                  type="text"
                  maxLength={2}
                  value={inputM}
                  onChange={(e) => setInputM(e.target.value.replace(/\D/g, ""))}
                  onBlur={saveM}
                  onKeyDown={handleKeyM}
                  autoFocus
                  className="w-20 md:w-36 text-center bg-gray-50 border border-[#2563EB] text-gray-800 rounded-2xl focus:outline-hidden py-1.5 focus:ring-4 focus:ring-blue-100 transition-all font-mono"
                />
              ) : (
                <span
                  onClick={startEditM}
                  className={`px-2 py-1 rounded-xl cursor-pointer hover:bg-gray-100 hover:text-[#2563EB] transition-all duration-200 ${
                    isRunning ? "opacity-90 pointer-events-none" : ""
                  }`}
                  title={isRunning ? "" : "분(Minute) 클릭하여 수정"}
                >
                  {pad(minutes)}
                </span>
              )}
              <span className="text-xs md:text-sm text-gray-400 font-sans font-bold mt-2">분(MM)</span>
            </div>

            <span className="text-gray-300 mb-6">:</span>

            {/* Seconds */}
            <div className="flex flex-col items-center">
              {isEditingS ? (
                <input
                  ref={inputRefS}
                  type="text"
                  maxLength={2}
                  value={inputS}
                  onChange={(e) => setInputS(e.target.value.replace(/\D/g, ""))}
                  onBlur={saveS}
                  onKeyDown={handleKeyS}
                  autoFocus
                  className="w-20 md:w-36 text-center bg-gray-50 border border-[#2563EB] text-gray-800 rounded-2xl focus:outline-hidden py-1.5 focus:ring-4 focus:ring-blue-100 transition-all font-mono"
                />
              ) : (
                <span
                  onClick={startEditS}
                  className={`px-2 py-1 rounded-xl cursor-pointer hover:bg-gray-100 hover:text-[#2563EB] transition-all duration-200 ${
                    isRunning ? "opacity-90 pointer-events-none" : ""
                  }`}
                  title={isRunning ? "" : "초(Second) 클릭하여 수정"}
                >
                  {pad(seconds)}
                </span>
              )}
              <span className="text-xs md:text-sm text-gray-400 font-sans font-bold mt-2">초(SS)</span>
            </div>
          </div>

          {/* Finished alert banner */}
          {isFinished && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-center">
              <span className="text-sm font-extrabold text-red-600 animate-pulse">
                ⏰ 수업 시간이 다 되었습니다!
              </span>
            </div>
          )}

          {/* Bottom Action Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mt-4">
            <div className="grid grid-cols-3 gap-3 w-full flex-1">
              <button
                onClick={handleStart}
                disabled={isRunning}
                className={`flex items-center justify-center gap-1.5 py-3.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-98 cursor-pointer ${
                  isRunning 
                    ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none" 
                    : "bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>시작</span>
              </button>
              <button
                onClick={handlePause}
                disabled={!isRunning}
                className={`flex items-center justify-center gap-1.5 py-3.5 rounded-xl text-xs font-bold transition-all active:scale-98 cursor-pointer ${
                  !isRunning
                    ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                    : "bg-amber-500 text-white hover:bg-amber-600 shadow-sm"
                }`}
              >
                <Pause className="w-4 h-4" />
                <span>일시정지</span>
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-1.5 py-3.5 bg-gray-50 text-gray-500 hover:bg-gray-150 border border-gray-200 rounded-xl text-xs font-bold transition-all active:scale-98 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>초기화</span>
              </button>
            </div>

            {/* Toggle Fullscreen button */}
            <button
              onClick={() => setIsFullScreen(true)}
              className="w-full sm:w-auto px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>전체화면</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
