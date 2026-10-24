import { create } from 'zustand';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../services/settingsService';
import type { AppSettings } from '../types';

interface SettingsState {
  settings: AppSettings;
  set: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  patch: (values: Partial<AppSettings>) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: loadSettings(),
  set: (key, value) => {
    const next = { ...get().settings, [key]: value };
    saveSettings(next);
    set({ settings: next });
  },
  patch: (values) => {
    const next = { ...get().settings, ...values };
    saveSettings(next);
    set({ settings: next });
  },
  reset: () => {
    saveSettings(DEFAULT_SETTINGS);
    set({ settings: { ...DEFAULT_SETTINGS } });
  },
}));
