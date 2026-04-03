import { useLanguage } from "../context/LanguageContext";

export default function Home() {
    const { t } = useLanguage();
    return (
        <div className="content-placeholder">
            <div className="card placeholder-card">
                <div className="auth-page-logo placeholder-logo" role="img" aria-label="Synk" />
                <div className="placeholder-body">
                    <p className="placeholder-title">{t("home.title")}</p>
                    <p className="placeholder-hint">{t("home.hint")}</p>
                </div>
            </div>
        </div>
    );
}
