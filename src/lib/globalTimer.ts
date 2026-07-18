// Global Timer Singleton for Real-time Synchronization across Components
import { getCachedSetting, saveCachedSetting } from "./supabase";

export interface TimerState {
  timeLeft: number;      // total seconds left
  initialSeconds: number; // the last set time (for reset)
  isRunning: boolean;
  isFinished: boolean;
}

type TimerCallback = (state: TimerState) => void;

class GlobalTimer {
  private timeLeft: number = 600; // default 10 minutes (600 seconds)
  private initialSeconds: number = 600;
  private isRunning: boolean = false;
  private isFinished: boolean = false;
  private intervalId: any = null;
  private subscribers: Set<TimerCallback> = new Set();

  constructor() {
    this.loadFromSettings();
    // Listen to database load completion event to update state dynamically
    if (typeof window !== "undefined") {
      window.addEventListener("storage", () => {
        // Only update if the timer is not currently running to avoid disturbing the user's active session
        if (!this.isRunning) {
          this.loadFromSettings();
          this.emit();
        }
      });
    }
  }

  private loadFromSettings() {
    try {
      const stored = getCachedSetting("teacher_notes_timer_initial_seconds", "600");
      if (stored) {
        const secs = parseInt(stored, 10);
        if (!isNaN(secs) && secs >= 0) {
          this.initialSeconds = secs;
          this.timeLeft = secs;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  public getState(): TimerState {
    return {
      timeLeft: this.timeLeft,
      initialSeconds: this.initialSeconds,
      isRunning: this.isRunning,
      isFinished: this.isFinished,
    };
  }

  public subscribe(callback: TimerCallback): () => void {
    this.subscribers.add(callback);
    // Call immediately with current state
    callback(this.getState());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private emit() {
    const state = this.getState();
    this.subscribers.forEach((cb) => cb(state));
  }

  public setTime(hours: number, minutes: number, seconds: number) {
    this.stopInterval();
    const total = hours * 3600 + minutes * 60 + seconds;
    this.initialSeconds = total;
    this.timeLeft = total;
    this.isRunning = false;
    this.isFinished = false;

    try {
      saveCachedSetting("teacher_notes_timer_initial_seconds", total.toString());
    } catch (e) {
      console.error(e);
    }

    this.emit();
  }


  public start() {
    if (this.isRunning) return;
    if (this.timeLeft <= 0) {
      this.isFinished = true;
      this.emit();
      return;
    }

    this.isRunning = true;
    this.isFinished = false;
    this.emit();

    this.intervalId = setInterval(() => {
      if (this.timeLeft > 1) {
        this.timeLeft -= 1;
        this.emit();
      } else {
        this.timeLeft = 0;
        this.isRunning = false;
        this.isFinished = true;
        this.stopInterval();
        this.emit();
      }
    }, 1000);
  }

  public pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.stopInterval();
    this.emit();
  }

  public reset() {
    this.stopInterval();
    this.timeLeft = this.initialSeconds;
    this.isRunning = false;
    this.isFinished = false;
    this.emit();
  }

  private stopInterval() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const globalTimer = new GlobalTimer();
