import { useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';
import { isTauri } from '../services/bridge';

/** Keeps the window title in sync with the open project. */
export function useWindowTitle(): void {
  const project = useProjectStore((state) => state.project);

  useEffect(() => {
    if (!isTauri()) return;
    const title = project ? `CueStage — ${project.name}` : 'CueStage';
    void getCurrentWindow()
      .setTitle(title)
      .catch(() => {
        /* The window may not be available yet; the title is cosmetic. */
      });
  }, [project]);
}

/** Re-applies the visual preferences whenever they change. */
export function useVisualPreferences(): void {
  const theme = useSettingsStore((state) => state.settings.theme);
  const reduceMotion = useSettingsStore((state) => state.settings.reduceMotion);
  const controlScale = useSettingsStore((state) => state.settings.controlScale);

  useEffect(() => {
    applyTheme(theme, reduceMotion, controlScale);
  }, [theme, reduceMotion, controlScale]);

  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyTheme(theme, reduceMotion, controlScale);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme, reduceMotion, controlScale]);
}

function applyTheme(
  theme: string,
  reduceMotion: boolean,
  scale: string,
): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  root.dataset['theme'] = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  root.dataset['motion'] = reduceMotion ? 'reduced' : 'full';
  root.dataset['scale'] = scale;
}
