import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { authFetch } from "../utils/authFetch";
import { API_URL } from "../config";

interface User {
    id: number;
    username: string;
}

export default function UserInfoPage() {
    const { userId } = useParams();
    const navigate = useNavigate();

    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const loadUser = async () => {
            const res = await authFetch(
                `${API_URL}/users/${userId}`
            );

            if (!res || !res.ok) {
                setLoading(false);
                return;
            }

            const data = await res.json();

            setUser(data);
            setLoading(false);   // ← ВОТ ЭТО ОБЯЗАТЕЛЬНО
        };

        loadUser();
    }, [userId]);

    const openChat = async () => {
        if (!user) return;

        const res = await authFetch(
            `${API_URL}/chat/private/${user.id}`,
            { method: "POST" }
        );

        if (!res || !res.ok) return;

        const data = await res.json();
        navigate(`/chat/${data.chatId}`);
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="user-info-container">
                    Loading...
                </div>
            </AppLayout>
        );
    }

    if (!user) {
        return (
            <AppLayout>
                <div className="user-info-container">
                    User not found
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="user-info-container">
                <div className="user-info-card">

                    <div className="user-info-avatar">
                        {user.username.charAt(0).toUpperCase()}
                    </div>

                    <div className="user-info-name">
                        {user.username}
                    </div>

                    <button
                        className="user-info-chat-btn"
                        onClick={openChat}
                    >
                        Open chat
                    </button>

                </div>
            </div>
        </AppLayout>
    );
}