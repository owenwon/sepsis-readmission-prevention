"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface CaregiverContextType {
  isCaregiver: boolean;
  setIsCaregiver: (value: boolean) => void;
}

const CaregiverContext = createContext<CaregiverContextType>({
  isCaregiver: false,
  setIsCaregiver: () => {},
});

export function CaregiverProvider({
  initialIsCaregiver = false,
  children,
}: {
  initialIsCaregiver?: boolean;
  children: ReactNode;
}) {
  const [isCaregiver, setIsCaregiverState] = useState(initialIsCaregiver);

  const setIsCaregiver = useCallback((value: boolean) => {
    setIsCaregiverState(value);
  }, []);

  return (
    <CaregiverContext.Provider value={{ isCaregiver, setIsCaregiver }}>
      {children}
    </CaregiverContext.Provider>
  );
}

export function useCaregiver() {
  return useContext(CaregiverContext);
}

export default CaregiverContext;
