import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { SEED_VERSION, seedState } from './seed';
import type { State } from './types';

const KEY = 'boom-cotizador:v1';

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (parsed.version === SEED_VERSION) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt: start from seed */
  }
  return seedState();
}

interface Toast { id: number; text: string }

interface Ctx {
  state: State;
  /** Mutate a draft copy of the state; the copy becomes the new state. */
  update: (fn: (draft: State) => void) => void;
  reset: () => void;
  toast: (text: string) => void;
  toasts: Toast[];
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const update = useCallback((fn: (draft: State) => void) => {
    setState(prev => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
  }, []);

  // Keep the signed-in user when restoring sample data.
  const reset = useCallback(() => setState(prev => ({ ...seedState(), user: prev.user, loggedIn: prev.loggedIn })), []);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  return (
    <StoreCtx.Provider value={{ state, update, reset, toast, toasts }}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

export const uid = (p = 'id') => `${p}-${Math.random().toString(36).slice(2, 9)}`;
