import AppLayout from "../components/AppLayout";

export default function BlankChatPage() {
    return (
        <AppLayout>
            <div className="content-placeholder">
                <div className="card placeholder-card">
                    <div className="placeholder-body">
                        <p className="placeholder-title">No chat selected</p>
                        <p className="placeholder-hint">Choose a chat and start messaging</p>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
