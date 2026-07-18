import React, { useState, useEffect, useRef } from "react";
import { Timer, Play, Pause, RotateCcw, Maximize2 } from "lucide-react";
import { globalTimer, TimerState } from "../lib/globalTimer";

interface TimerCardProps {
  onNavigateToTimer: () => void;
}

export default function TimerCard({ onNavigateToTimer }: TimerCardProps) {
  const [timerState, setTimerState] = useState<TimerState>(globalTimer.getState());

  // Editing state for Hours, Minutes, Seconds inside the dashboard card
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

  const { timeLeft, isRunning, isFinished } = timerState;

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  // Format helper
  const pad = (num: number) => String(num).padStart(2, "0");

  // Inline editing actions
  const startEditH = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) return;
    setInputH(pad(hours));
    setIsEditingH(true);
  };

  const startEditM = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) return;
    setInputM(pad(minutes));
    setIsEditingM(true);
  };

  const startEditS = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) return;
    setInputS(pad(seconds));
    setIsEditingS(true);
  };

  const saveH = () => {
    setIsEditingH(false);
    let val = parseInt(inputH, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 99) val = 99;
    globalTimer.setTime(val, minutes, seconds);
  };

  const saveM = () => {
    setIsEditingM(false);
    let val = parseInt(inputM, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 59) val = 59;
    globalTimer.setTime(hours, val, seconds);
  };

  const saveS = () => {
    setIsEditingS(false);
    let val = parseInt(inputS, 10);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 59) val = 59;
    globalTimer.setTime(hours, minutes, val);
  };

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

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    globalTimer.start();
  };

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    globalTimer.pause();
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    globalTimer.reset();
  };

  return (
    <div
      id="timer-card"
      onClick={onNavigateToTimer}
      className={`rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-300 border flex flex-col h-full cursor-pointer group select-none ${
        isFinished 
          ? "bg-rose-50 border-rose-300 animate-pulse" 
          : "bg-white border-gray-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-blue-50 text-[#2563EB] rounded-lg">
            <Timer className="w-4 h-4" />
          </div>
          <h2 className="font-sans font-bold text-xs text-gray-800">수업 타이머</h2>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToTimer();
          }}
          className="text-[10px] font-bold text-gray-400 group-hover:text-[#2563EB] transition-colors flex items-center gap-0.5 cursor-pointer"
        >
          <span>크게 보기</span>
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>

      {/* Large Digital Timer UI */}
      <div className="flex-1 flex flex-col justify-center">
        <div
          className={`border rounded-xl py-4 px-6 text-center w-full shadow-3xs transition-colors ${
            isFinished 
              ? "bg-rose-100/60 border-rose-200" 
              : "bg-gray-50 border-gray-150"
          }`}
        >
          {/* Digits with click-to-edit support */}
          <div className="flex items-center justify-center gap-1.5 text-2xl font-extrabold font-mono text-gray-800 tracking-wider">
            {/* Hour Block */}
            <div className="flex flex-col">
              {isEditingH ? (
                <input
                  ref={inputRefH}
                  type="text"
                  maxLength={2}
                  value={inputH}
                  onChange={(e) => setInputH(e.target.value.replace(/\D/g, ""))}
                  onBlur={saveH}
                  onKeyDown={handleKeyH}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="w-10 text-center bg-white border border-[#2563EB] text-gray-800 rounded-md focus:outline-hidden text-lg font-mono"
                />
              ) : (
                <span
                  onClick={startEditH}
                  className={`px-1 rounded-md transition-colors ${
                    isRunning ? "opacity-95 pointer-events-none" : "hover:bg-gray-200 hover:text-[#2563EB]"
                  }`}
                  title={isRunning ? "" : "시(Hour) 직접 입력"}
                >
                  {pad(hours)}
                </span>
              )}
            </div>

            <span className="text-gray-300 font-sans font-medium">:</span>

            {/* Minute Block */}
            <div className="flex flex-col">
              {isEditingM ? (
                <input
                  ref={inputRefM}
                  type="text"
                  maxLength={2}
                  value={inputM}
                  onChange={(e) => setInputM(e.target.value.replace(/\D/g, ""))}
                  onBlur={saveM}
                  onKeyDown={handleKeyM}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="w-10 text-center bg-white border border-[#2563EB] text-gray-800 rounded-md focus:outline-hidden text-lg font-mono"
                />
              ) : (
                <span
                  onClick={startEditM}
                  className={`px-1 rounded-md transition-colors ${
                    isRunning ? "opacity-95 pointer-events-none" : "hover:bg-gray-200 hover:text-[#2563EB]"
                  }`}
                  title={isRunning ? "" : "분(Minute) 직접 입력"}
                >
                  {pad(minutes)}
                </span>
              )}
            </div>

            <span className="text-gray-300 font-sans font-medium">:</span>

            {/* Second Block */}
            <div className="flex flex-col">
              {isEditingS ? (
                <input
                  ref={inputRefS}
                  type="text"
                  maxLength={2}
                  value={inputS}
                  onChange={(e) => setInputS(e.target.value.replace(/\D/g, ""))}
                  onBlur={saveS}
                  onKeyDown={handleKeyS}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="w-10 text-center bg-white border border-[#2563EB] text-gray-800 rounded-md focus:outline-hidden text-lg font-mono"
                />
              ) : (
                <span
                  onClick={startEditS}
                  className={`px-1 rounded-md transition-colors ${
                    isRunning ? "opacity-95 pointer-events-none" : "hover:bg-gray-200 hover:text-[#2563EB]"
                  }`}
                  title={isRunning ? "" : "초(Second) 직접 입력"}
                >
                  {pad(seconds)}
                </span>
              )}
            </div>
          </div>

          <p className={`text-[9px] font-bold mt-1 tracking-widest uppercase ${isFinished ? "text-rose-600 animate-pulse" : "text-gray-400"}`}>
            {isFinished ? "종료되었습니다" : "수업 활동 시간"}
          </p>
        </div>

        {/* Start / Pause / Reset button UI */}
        <div className="grid grid-cols-3 gap-2 w-full mt-3.5">
          <button
            onClick={handleStart}
            disabled={isRunning}
            className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-extrabold transition-all active:scale-97 cursor-pointer ${
              isRunning
                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                : "bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>시작</span>
          </button>
          <button
            onClick={handlePause}
            disabled={!isRunning}
            className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-extrabold transition-all active:scale-97 cursor-pointer border ${
              !isRunning
                ? "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed"
                : "bg-amber-500 border-amber-600 text-white hover:bg-amber-600"
            }`}
          >
            <Pause className="w-3 h-3" />
            <span>일시정지</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-1 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 rounded-xl text-[11px] font-extrabold transition-all active:scale-97 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>초기화</span>
          </button>
        </div>
      </div>
    </div>
  );
}
