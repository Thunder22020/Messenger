import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";

export default function Login({
                                  setAccessToken,
                              }: {
    setAccessToken: (token: string) => void;
}) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
            alert("Login failed");
            return;
        }

        const data = await res.json();
        localStorage.setItem("accessToken", data.accessToken);
        setAccessToken(data.accessToken);

        navigate("/");
    };

    return (
        <div className="page-center">
            <div className="card">
                <h2>Login</h2>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <input
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button className="btn-primary" type="submit">
                        Login
                    </button>
                </form>

                <button
                    className="btn-secondary"
                    onClick={() => navigate("/register")}
                >
                    Create account
                </button>
            </div>
        </div>
    );
}