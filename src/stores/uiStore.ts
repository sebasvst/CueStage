import { create } from 'zustand';
import type { AppSection } from '../types';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface UiState {
  section: AppSection;
  presentationMode: boolean;
  toasts: Toast[];
  setSection: (section: AppSection) => void;
  setPresentationMode: (value: boolean) => void;
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
}

let toastCounter = 0;
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useUiStore = create<UiState>()((set, get) => ({
  section: 'inicio',
  presentationMode: false,
  toasts: [],
  setSection: (section) => set({ section }),
  setPresentationMode: (presentationMode) => set({ presentationMode }),
  pushToast: (message, tone = 'info') => {
    toastCounter += 1;
    const id = `toast_${toastCounter}`;
    set({ toasts: [...get().toasts, { id, message, tone }] });
    const ttl = tone === 'error' ? 8000 : 4000;
    const timer = setTimeout(() => {
      toastTimers.delete(id);
      set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
    }, ttl);
    toastTimers.set(id, timer);
  },
  dismissToast: (id) => {
    const timer = toastTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      toastTimers.delete(id);
    }
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
  },
}));
