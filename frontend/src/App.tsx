import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";

function EscapeToHome() {
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && location.pathname !== "/") navigate("/");
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [location.pathname, navigate]);
    return null;
}
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import ChatPage from "./pages/ChatPage";
import {WebSocketProvider} from "./context/WebSocketContext.tsx";
import { PresenceProvider } from "./context/PresenceContext.tsx";
import CreateGroupPage from "./pages/CreateGroupPage.tsx";
import UserInfoPage from "./pages/UserInfoPage.tsx";

function App() {
    const [accessToken, setAccessToken] = useState<string | null>(
        localStorage.getItem("accessToken")
    );

    return (
        <WebSocketProvider key={accessToken} accessToken={accessToken}>
           <PresenceProvider>
           <BrowserRouter>
               <EscapeToHome />
               <Routes>
                       <Route
                           path="/"
                           element={
                               accessToken ? (
                                   <Home />
                               ) : (
                                   <Navigate to="/login" />
                               )
                           }
                       />
                       <Route
                           path="/login"
                           element={<Login setAccessToken={setAccessToken} />}
                       />
                       <Route path="/register" element={<Register />} />
                       <Route
                           path="/chat"
                           element={
                               accessToken ? <ChatPage /> : <Navigate to="/login" />
                           }
                       />
                       <Route
                           path="/chat/:chatId"
                           element={
                               accessToken ? <ChatPage /> : <Navigate to="/login" />
                           }
                       />
                       <Route
                           path="/group"
                           element={
                               accessToken ? <CreateGroupPage /> : <Navigate to="/login" />
                           }
                       />
                       <Route path="/user/:userId" element={<UserInfoPage />} />
                   </Routes>
           </BrowserRouter>
           </PresenceProvider>
       </WebSocketProvider>
    );
}

export default App;