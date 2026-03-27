import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";

interface FieldErrors {
    username?: string;
    password?: string;
    server?: string;
}

function validateUsername(value: string): string | undefined {
    if (!value) return "Username is required";
    if (/^\d/.test(value)) return "Username must not start with a number";
    if (!/[a-zA-Z]/.test(value)) return "Username must contain at least one letter";
    if (value.length < 3) return "Username must be at least 3 characters";
    if (value.length > 30) return "Username must be at most 30 characters";
    return undefined;
}

function validatePassword(value: string): string | undefined {
    if (!value) return "Password is required";
    if (value.length < 6) return "Password must be at least 6 characters";
    if (value.length > 72) return "Password must be at most 72 characters";
    return undefined;
}

export default function Register() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [errors, setErrors] = useState<FieldErrors>({});
    const [touched, setTouched] = useState({ username: false, password: false });
    const navigate = useNavigate();

    const handleBlur = (field: "username" | "password") => {
        setTouched(prev => ({ ...prev, [field]: true }));
        if (field === "username") setErrors(prev => ({ ...prev, username: validateUsername(username) }));
        if (field === "password") setErrors(prev => ({ ...prev, password: validatePassword(password) }));
    };

    const handleUsernameChange = (value: string) => {
        setUsername(value);
        if (touched.username) setErrors(prev => ({ ...prev, username: validateUsername(value), server: undefined }));
    };

    const handlePasswordChange = (value: string) => {
        setPassword(value);
        if (touched.password) setErrors(prev => ({ ...prev, password: validatePassword(value), server: undefined }));
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        const usernameError = validateUsername(username);
        const passwordError = validatePassword(password);
        setTouched({ username: true, password: true });

        if (usernameError || passwordError) {
            setErrors({ username: usernameError, password: passwordError });
            return;
        }

        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => null);
            setErrors({ server: data?.error ?? "Registration failed. Please try again." });
            return;
        }

        navigate("/login");
    };

    return (
        <div className="page-center">
            <div className="login-with-logo login-with-logo--ready">
                <div className="auth-page-logo" role="img" aria-label="Synk" />
                <div className="card">
                    <h2>Sign up</h2>
                    <form onSubmit={handleRegister}>
                        <div className="form-group">
                            <input
                                placeholder="Username"
                                value={username}
                                onChange={(e) => handleUsernameChange(e.target.value)}
                                onBlur={() => handleBlur("username")}
                                className={touched.username && errors.username ? "input-error" : ""}
                            />
                            <div className="form-field-error">
                                {touched.username && errors.username}
                            </div>
                        </div>
                        <div className="form-group">
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => handlePasswordChange(e.target.value)}
                                onBlur={() => handleBlur("password")}
                                className={touched.password && errors.password ? "input-error" : ""}
                            />
                            <div className="form-field-error">
                                {touched.password && errors.password}
                            </div>
                        </div>
                        <div className="form-field-error form-server-error">
                            {errors.server}
                        </div>
                        <button className="btn-primary" type="submit">
                            Register
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
