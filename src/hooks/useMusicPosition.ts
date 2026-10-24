import { useEffect, useState } from 'react';
import { audioController } from '../features/live-mode/audioController';

/**
 * Tracks the position of the main music track.
 *
 * The poll runs on an interval instead of a render loop so the rest of the
 * application is not re-rendered on every frame.
 */
export function useMusicPosition(enabled: boolean): number {
  const [position, setPosition] = useState(() => audioController.getMusicPosition());

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      setPosition(audioController.getMusicPosition());
    }, 60);
    return () => clearInterval(timer);
  }, [enabled]);

  return position;
}
