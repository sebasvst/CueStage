type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Asks the library to open the native file picker.
 *
 * It lets the tutorial guide take the user straight to the file selection
 * without having to pass callbacks through several components.
 */
export function requestFileImport(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      /* A failing listener must not break the guide. */
    }
  }
}

/** Subscribes to the request. Returns the function that cancels it. */
export function onFileImportRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
