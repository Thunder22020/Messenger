import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { IntroAnimation } from "./IntroAnimation";
import { useLanguage } from "../context/LanguageContext";

type IntroState = "animating" | "transitioning" | "done";

interface LoginErrors {
  username?: string;
  password?: string;
}

export default function Login({
                                setAccessToken,
                              }: {
  setAccessToken: (token: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const navigate = useNavigate();
  const { t } = useLanguage();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [introState, setIntroState] = useState<IntroState>(
      () => (reducedMotion ? "done" : "animating")
  );

  const [logoGreen, setLogoGreen] = useState(false);

  const handleTransition = useCallback(() => {
    setIntroState("transitioning");
    setLogoGreen(true);
    setTimeout(() => setLogoGreen(false), 1500);
  }, []);

  const handleDone = useCallback(() => {
    localStorage.setItem("synk_intro_seen", "1");
    setIntroState("done");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message: string = data?.error ?? "";

      if (message === "User not found") {
        setErrors({ username: t("login.error.notFound") });
      } else if (message === "Wrong password") {
        setErrors({ password: t("login.error.wrongPassword") });
      } else {
        setErrors({ username: t("login.error.failed") });
      }
      return;
    }

    const data = await res.json();
    localStorage.setItem("accessToken", data.accessToken);
    setAccessToken(data.accessToken);
    navigate("/");
  };

  const contentClass = [
    "login-with-logo",
    introState === "done"
        ? "login-with-logo--ready"
        : introState === "transitioning"
            ? "login-with-logo--entering"
            : "login-with-logo--hidden",
  ].join(" ");

  return (
      <div className="page-center">
        {introState !== "done" && (
            <IntroAnimation onTransition={handleTransition} onDone={handleDone} />
        )}

        <div className={contentClass}>
          <div
              className={`auth-page-logo${logoGreen ? " auth-page-logo--green" : ""}`}
              role="img"
              aria-label="Synk"
          />
          <div className="card">
            <h2>{t("login.title")}</h2>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <input
                    placeholder={t("login.username")}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setErrors({});
                    }}
                    className={errors.username ? "input-error" : ""}
                />
                <div className="form-field-error">{errors.username}</div>
              </div>

              <div className="form-group">
                <input
                    type="password"
                    placeholder={t("login.password")}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors({});
                    }}
                    className={errors.password ? "input-error" : ""}
                />
                <div className="form-field-error">{errors.password}</div>
              </div>

              <button className="btn-primary" type="submit">
                {t("login.submit")}
              </button>
            </form>

            <button
                className="btn-secondary"
                onClick={() => navigate("/register")}
            >
              {t("login.createAccount")}
            </button>
          </div>
        </div>
      </div>
  );
}