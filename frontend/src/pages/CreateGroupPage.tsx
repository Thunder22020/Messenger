import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { API_URL } from "../config";
import { authFetch } from "../utils/authFetch";
import { useIsMobile } from "../hooks/useIsMobile";

interface User {
    id: number;
    username: string;
}

export default function CreateGroupPage() {

    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [title, setTitle] = useState("");
    const [query, setQuery] = useState("");

    const navigate = useNavigate();
    const isMobile = useIsMobile();

    useEffect(() => {
        const timer = setTimeout(async () => {
            const url = query.trim()
                ? `${API_URL}/users/search?query=${query}`
                : `${API_URL}/users/search`;

            const res = await authFetch(url);
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
            alert("Group name required");
            return;
        }

        if (selectedUsers.length === 0) {
            alert("Select at least one participant");
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
            alert("Failed to create group");
            return;
        }

        const data = await res.json();

        navigate(`/chat/${data.chatId}`);
    };

    const selectedIds = new Set(selectedUsers.map(u => u.id));
    const filteredResults = searchResults.filter(u => !selectedIds.has(u.id));

    return (
        <AppLayout mobileChatView={isMobile}>

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
                    <h2>Create group</h2>

                    <input
                        className="group-title-input"
                        placeholder="Group name..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={50}
                    />

                    <div className="group-search-label">
                        Search users
                    </div>

                    <input
                        placeholder="Search users..."
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

                                <div className="group-user-avatar">
                                    {user.username.charAt(0).toUpperCase()}
                                </div>

                                <div className="group-user-name">
                                    {user.username}
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

                                <div className="group-user-avatar">
                                    {user.username.charAt(0).toUpperCase()}
                                </div>

                                <div className="group-user-name">
                                    {user.username}
                                </div>
                            </div>
                        ))}

                        {searchResults.length === 0 && selectedUsers.length === 0 && (
                            <div className="group-empty">
                                No users found
                            </div>
                        )}
                    </div>

                    <button
                        className="group-create-btn"
                        onClick={createGroup}
                    >
                        Create group
                    </button>
                </div>
            </div>

        </AppLayout>
    );
}
