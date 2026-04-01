import { createContext, useContext } from "react";

interface AppLayoutContextValue {
    setRightPanel: (node: React.ReactNode) => void;
}

export const AppLayoutContext = createContext<AppLayoutContextValue>({
    setRightPanel: () => {},
});

export const useSetRightPanel = () => useContext(AppLayoutContext).setRightPanel;
