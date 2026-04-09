import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { authFetch } from "../utils/authFetch";
import { useIsMobile } from "../hooks/useIsMobile";
import { useLanguage } from "../context/LanguageContext";

interface User {
    id: number;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
}

export default function CreateGroupPage() {

    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [title, setTitle] = useState("");
    const [query, setQuery] = useState("");

    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const { t } = useLanguage();

    useEffect(() => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            const res = await authFetch(`${API_URL}/users/search?query=${query}`);
            if (!res || !res.ok) return;

            const data = await res.json();
            setSearchResults(data);
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const toggleUser = (user: User) => {
        setSelectedUsers(prev => {
            if (prev.some(u => u.id === user.id)) {
                return prev.filter(u => u.id !== user.id);
            }
            return [...prev, user];
        });
    };

    const createGroup = async () => {

        if (!title.trim()) {
            alert(t("group.error.nameRequired"));
            return;
        }

        if (selectedUsers.length === 0) {
            alert(t("group.error.noParticipants"));
            return;
        }

        const res = await authFetch(
            `${API_URL}/chat/group`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title,
                    participantIds: selectedUsers.map(u => u.id)
                })
            }
        );

        if (!res || !res.ok) {
            alert(t("group.error.failed"));
            return;
        }

        const data = await res.json();

        navigate(`/chat/${data.chatId}`);
    };

    const selectedIds = new Set(selectedUsers.map(u => u.id));
    const filteredResults = searchResults.filter(u => !selectedIds.has(u.id));

    return (
        <div className="group-create-container">
                {isMobile && (
                    <button
                        className="chat-header-back-btn user-info-back-btn"
                        onClick={() => navigate("/chat")}
                        aria-label="Back"
                    >
                        <img src="/icons/left-chevron.png" alt="back" />
                    </button>
                )}
                <div className="group-create-card">
                    <h2>{t("group.title")}</h2>

                    <input
                        className="group-title-input"
                        placeholder={t("group.namePlaceholder")}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={50}
                    />

                    <div className="group-search-label">
                        {t("group.searchLabel")}
                    </div>

                    <input
                        placeholder={t("group.searchPlaceholder")}
                        className="search-input"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />

                    <div className="group-users-list">
                        {selectedUsers.map(user => (
                            <div
                                key={user.id}
                                onClick={() => toggleUser(user)}
                                className="group-user-item selected"
                            >
                                <div className="group-user-checkbox">
                                    <div className="group-user-dot" />
                                </div>

                                <div className="search-person-avatar">
                                    {user.avatarUrl
                                        ? <img src={user.avatarUrl} className="chat-avatar-img" alt="" />
                                        : (user.displayName ?? user.username).charAt(0).toUpperCase()}
                                </div>

                                <div className="search-person-info">
                                    <span className="search-person-name">
                                        {user.displayName ?? user.username}
                                    </span>
                                    {user.displayName && (
                                        <span className="search-person-username">@{user.username}</span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {filteredResults.map(user => (
                            <div
                                key={user.id}
                                onClick={() => toggleUser(user)}
                                className="group-user-item"
                            >
                                <div className="group-user-checkbox" />

                                <div className="search-person-avatar">
                                    {user.avatarUrl
                                        ? <img src={user.avatarUrl} className="chat-avatar-img" alt="" />
                                        : (user.displayName ?? user.username).charAt(0).toUpperCase()}
                                </div>

                                <div className="search-person-info">
                                    <span className="search-person-name">
                                        {user.displayName ?? user.username}
                                    </span>
                                    {user.displayName && (
                                        <span className="search-person-username">@{user.username}</span>
                                    )}
                                </div>
                            </div>
                        ))}

                        {searchResults.length === 0 && selectedUsers.length === 0 && (
                            <div className="group-empty">
                                {t("group.noUsersFound")}
                            </div>
                        )}
                    </div>

                    <button
                        className="group-create-btn"
                        onClick={createGroup}
                    >
                        {t("group.createBtn")}
                    </button>
                </div>
        </div>
    );
}
