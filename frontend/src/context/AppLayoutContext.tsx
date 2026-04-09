import { createContext, useContext } from "react";

interface AppLayoutContextValue {
    setRightPanel: (node: React.ReactNode) => void;
    showLogout: () => void;
}

export const AppLayoutContext = createContext<AppLayoutContextValue>({
    setRightPanel: () => {},
    showLogout: () => {},
});

export const useSetRightPanel = () => useContext(AppLayoutContext).setRightPanel;
export const useShowLogout = () => useContext(AppLayoutContext).showLogout;
