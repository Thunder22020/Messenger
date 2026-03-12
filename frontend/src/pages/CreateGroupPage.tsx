import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { API_URL } from "../config";
import { authFetch } from "../utils/authFetch";

interface User {
    id: number;
    username: string;
}

export default function CreateGroupPage() {

    const [users, setUsers] = useState<User[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [title, setTitle] = useState("");
    const [query, setQuery] = useState("");

    const navigate = useNavigate();

    useEffect(() => {

        const loadUsers = async () => {

            const url = query.trim()
                ? `${API_URL}/users/search?query=${query}`
                : `${API_URL}/users/search`;

            const res = await authFetch(url);

            if (!res || !res.ok) return;

            const data = await res.json();
            setUsers(data);
        };

        loadUsers();

    }, [query]);

    const toggleUser = (userId: number) => {

        setSelectedUsers(prev => {

            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            }

            return [...prev, userId];
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
                    participantIds: selectedUsers
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

    return (
        <AppLayout>

            <div className="group-create-container">
                <div className="group-create-card">
                    <h2>Create group</h2>

                    <input
                        className="group-title-input"
                        placeholder="Group name..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
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
                        {users.map(user => {
                            const checked = selectedUsers.includes(user.id);

                            return (
                                <div
                                    key={user.id}
                                    onClick={() => toggleUser(user.id)}
                                    className={`group-user-item ${checked ? "selected" : ""}`}
                                >
                                    <div className="group-user-checkbox">
                                        {checked && <div className="group-user-dot" />}
                                    </div>

                                    <div className="group-user-avatar">
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="group-user-name">
                                        {user.username}
                                    </div>
                                </div>
                            );
                        })}

                        {users.length === 0 && (
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