import { useLanguage } from "../context/LanguageContext";

export default function BlankChatPage() {
    const { t } = useLanguage();
    return (
        <div className="content-placeholder">
            <div className="card placeholder-card">
                <div className="placeholder-body">
                    <p className="placeholder-title">{t("blank.title")}</p>
                    <p className="placeholder-hint">{t("blank.hint")}</p>
                </div>
            </div>
        </div>
    );
}
