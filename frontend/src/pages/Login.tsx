import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { IntroAnimation } from "./IntroAnimation";

type IntroState = "animating" | "transitioning" | "done";

export default function Login({
  setAccessToken,
}: {
  setAccessToken: (token: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isFirstTime   = !localStorage.getItem("synk_intro_seen");

  const [introState, setIntroState] = useState<IntroState>(
    () => (reducedMotion ? "done" : "animating")
  );

  const [logoGreen, setLogoGreen] = useState(false);

  const handleTransition = useCallback(() => {
    setIntroState("transitioning");
    setLogoGreen(true);
    // Logo travels ~850ms, then let the green dot sit for another ~600ms before removing
    setTimeout(() => setLogoGreen(false), 1500);
  }, []);
  const handleDone = useCallback(() => {
    setIntroState("done");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const contentClass = [
    "login-with-logo",
    introState === "done"          ? "login-with-logo--ready"    :
    introState === "transitioning" ? "login-with-logo--entering" :
                                     "login-with-logo--hidden",
  ].join(" ");

  return (
    <div className="page-center">
      {introState !== "done" && (
        <IntroAnimation
          isFirstTime={isFirstTime}
          onTransition={handleTransition}
          onDone={handleDone}
        />
      )}

      <div className={contentClass}>
        <div className={`auth-page-logo${logoGreen ? " auth-page-logo--green" : ""}`} role="img" aria-label="Synk" />
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
          <button className="btn-secondary" onClick={() => navigate("/register")}>
            Create account
          </button>
        </div>
      </div>
    </div>
  );
}
