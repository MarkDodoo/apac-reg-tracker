"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

interface ChromeState {
  /** True while a search is active — drives the header→sidebar morph. */
  searchActive: boolean;
  setSearchActive: (active: boolean) => void;
}

const ChromeContext = createContext<ChromeState>({
  searchActive: false,
  setSearchActive: () => {},
});

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [searchActive, setSearchActive] = useState(false);
  const value = useMemo(
    () => ({ searchActive, setSearchActive }),
    [searchActive],
  );
  return (
    <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>
  );
}

export function useChrome(): ChromeState {
  return useContext(ChromeContext);
}
