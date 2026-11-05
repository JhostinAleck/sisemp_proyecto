import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CommandRetry } from "./retry";
import type {
  Command,
  CommandResult,
  StateResponse,
  User,
  Workspace,
} from "../domains/shared/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      data.error || "No fue posible completar la solicitud.",
      response.status,
    );
  }
  return data as T;
}
const empty: Workspace = {
  inventory: [],
  projects: [],
  reservations: [],
  dispatches: [],
  movements: [],
  suppliers: [],
  offers: [],
};
interface Store {
  user: User | null;
  state: Workspace;
  loading: boolean;
  pending: boolean;
  error: string;
  notice: string;
  authenticate: (path: string, body: object) => Promise<void>;
  logout: () => Promise<void>;
  command: (command: Command) => Promise<CommandResult | null>;
  refresh: () => Promise<void>;
  clear: () => void;
}
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [state, setState] = useState(empty),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const version = useRef(-1),
    busy = useRef(false),
    retry = useRef(new CommandRetry()),
    generation = useRef(0);
  const apply = useCallback((result: StateResponse) => {
    if (result.version >= version.current) {
      version.current = result.version;
      setState(result.state);
      setUser(result.user);
    }
  }, []);
  const refresh = useCallback(async () => {
    const epoch = generation.current;
    try {
      const result = await api<StateResponse>("/state");
      if (epoch === generation.current) apply(result);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        setError((e as Error).message);
    }
  }, [apply]);
  useEffect(() => {
    const expire = () => {
      generation.current++;
      setUser(null);
      setState(empty);
      version.current = -1;
      retry.current.reset();
    };
    window.addEventListener("session-expired", expire);
    api<{ user: User | null }>("/auth/session")
      .then(async (data) => {
        setUser(data.user);
        if (data.user) await refresh();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => window.removeEventListener("session-expired", expire);
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(refresh, 15000);
    const focus = () => {
      if (!busy.current) void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [user?.id, refresh]);
  const authenticate = async (path: string, body: object) => {
    generation.current++;
    retry.current.reset();
    const result = await api<{ user: User }>(`/auth/${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setUser(result.user);
    version.current = -1;
    await refresh();
    setError("");
  };
  const command = async (value: Command) => {
    if (busy.current) return null;
    busy.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const result = await api<CommandResult>("/commands", {
        method: "POST",
        body: JSON.stringify(value),
        headers: { "Idempotency-Key": retry.current.next(user!.id, value) },
      });
      retry.current.settle(200);
      apply(result);
      setNotice(result.summary);
      return result;
    } catch (e) {
      retry.current.settle(e instanceof ApiError ? e.status : undefined);
      setError((e as Error).message);
      return null;
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const logout = async () => {
    generation.current++;
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setState(empty);
      version.current = -1;
      retry.current.reset();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Context.Provider
      value={{
        user,
        state,
        loading,
        pending,
        error,
        notice,
        authenticate,
        logout,
        command,
        refresh,
        clear: () => {
          setError("");
          setNotice("");
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("StoreProvider required");
  return value;
}
