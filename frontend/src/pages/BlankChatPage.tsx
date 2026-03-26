import AppLayout from "../components/AppLayout";

export default function BlankChatPage() {
    return (
        <AppLayout>
            <div className="content-placeholder">
                <div className="card placeholder-card">
                    <div className="placeholder-body">
                        <p className="placeholder-title">No chat selected</p>
                        <p className="placeholder-hint">Pick a chat and start the conversation.</p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
