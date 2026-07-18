import React, { useState } from "react";
import { Award, User, ArrowRight } from "lucide-react";
import { setOwnerId } from "../lib/owner";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [ownerIdInput, setOwnerIdInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = ownerIdInput.trim();
    if (!trimmedId) {
      setErrorMsg("ID를 입력해 주세요.");
      return;
    }

    setOwnerId(trimmedId);
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4 font-sans animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-gray-100 p-8 flex flex-col gap-6">
        {/* Logo Section */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 bg-[#2563EB] rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-200">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-2xl tracking-tight text-gray-900 flex items-center gap-2 justify-center">
              담임노트
              <span className="text-xs font-medium bg-blue-50 text-[#2563EB] px-2 py-0.5 rounded-md">
                초등
              </span>
            </h1>
            <p className="text-xs text-gray-400 font-medium mt-1">
              언제 어디서나 동기화되는 스마트 담임교사용 교무 수첩
            </p>
          </div>
        </div>

        {/* Info / Error Message */}
        <div className="bg-blue-50/50 border border-blue-100/50 rounded-xl p-4 text-xs text-blue-700 leading-relaxed">
          <p className="font-semibold text-blue-800 mb-1">💡 안내사항</p>
          담임노트는 개인용 교무수첩 앱입니다. 본인의 고유 ID를 입력하면, 해당 ID로 데이터가 안전하게 동기화 및 저장됩니다.
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">
              내 ID를 입력하세요
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                placeholder="나만의 고유 ID 입력 (예: teacher_hong)"
                value={ownerIdInput}
                onChange={(e) => {
                  setOwnerIdInput(e.target.value);
                  setErrorMsg(null);
                }}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2563EB] focus:bg-white transition-all text-gray-800 placeholder-gray-400 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-xl shadow-xs hover:bg-[#1D4ED8] transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            <span>담임노트 시작하기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
