# Mobile Responsive Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile layout mode (<768px) where sidebar and chat are separate full-screen panels that slide between each other, with a back button in the chat header and the info panel as a full-screen overlay.

**Architecture:** A `useIsMobile()` hook drives all conditional behavior. `AppLayout` renders either the existing desktop flex layout or a mobile stacked layout with CSS slide transitions based on whether a `chatId` is present in the URL. `ChatHeader` gets an optional `onBack` prop. `ChatInfoPanel` gets an `isMobile` prop that switches it to `position: fixed` full-screen only when `isOpen` is true. Desktop layout is completely unchanged.

**Tech Stack:** React 19, TypeScript, CSS (no new libraries)

**Note on `useIsMobile` duplication:** The hook is called independently in both `AppLayout` and `ChatPage`. These are separate route-level components with no shared ancestor that could pass it down, so two lightweight resize listeners is the right tradeoff over adding a context.

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/hooks/useIsMobile.ts` | **Create** — resize-aware boolean hook |
| `frontend/src/components/AppLayout.tsx` | **Modify** — mobile stacked layout with slide transition |
| `frontend/src/pages/chat/ChatHeader.tsx` | **Modify** — add optional `onBack` prop + back button |
| `frontend/src/pages/ChatPage.tsx` | **Modify** — pass `onBack`, `isMobile`, add mobile Escape handler |
| `frontend/src/pages/chat/ChatInfoPanel.tsx` | **Modify** — add `isMobile` prop, full-screen overlay mode |
| `frontend/src/styles/global.css` | **Modify** — mobile layout CSS, transitions, touch targets |

---

### Task 1: `useIsMobile` hook

**Files:**
- Create: `frontend/src/hooks/useIsMobile.ts`

- [ ] Create the file:

```typescript
import { useState, useEffect } from "react";

const BREAKPOINT = 768;

export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < BREAKPOINT);

    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < BREAKPOINT);
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);

    return isMobile;
}
```

- [ ] Verify no TypeScript errors: `cd frontend && npx tsc --noEmit`
  Expected: no output (clean)

- [ ] Commit:
```bash
git add frontend/src/hooks/useIsMobile.ts
git commit -m "add useIsMobile hook"
```

---

### Task 2: Mobile CSS foundation

**Files:**
- Modify: `frontend/src/styles/global.css` (append at end of file)

- [ ] Append the following to the end of `global.css`:

```css
/* ===== MOBILE LAYOUT (< 768px) ===== */

.mobile-layout {
    position: relative;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
}

.mobile-sidebar-panel,
.mobile-chat-panel {
    position: absolute;
    inset: 0;
    overflow: hidden;
    will-change: transform;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    background: var(--bg-main);
}

/* List view: sidebar visible, chat off-screen right */
.mobile-layout.list-active .mobile-sidebar-panel { transform: translateX(0); }
.mobile-layout.list-active .mobile-chat-panel     { transform: translateX(100%); }

/* Chat view: sidebar off-screen left, chat visible */
.mobile-layout.chat-active .mobile-sidebar-panel  { transform: translateX(-100%); }
.mobile-layout.chat-active .mobile-chat-panel     { transform: translateX(0); }

/* Sidebar fills the full mobile panel */
.mobile-sidebar-panel .sidebar {
    width: 100% !important;
    height: 100dvh;
    border-right: none;
}

/* Content fills the full mobile panel */
.mobile-chat-panel .content {
    height: 100dvh;
}

/* ===== MOBILE TOUCH + RESPONSIVE POLISH ===== */

@media (max-width: 768px) {
    /* Prevent iOS font-size zoom on input focus */
    .chat-input-bar textarea {
        font-size: 16px;
    }

    /* Touch-friendly tap targets */
    .chat-tile       { min-height: 64px; }
    .chat-menu-btn   { width: 40px; height: 40px; }
    .chat-attach-btn { width: 40px; height: 40px; }

    /* Auth / card pages */
    .card {
        padding: 28px 20px;
    }

    .placeholder-card {
        max-width: 100%;
        min-height: 200px;
    }

    /* Slightly smaller image max on small screens */
    .attachment-grid.single .message-image,
    .attachment-grid.single .attachment-img-wrapper {
        max-width: 240px;
    }
}

/* ===== MOBILE: CHAT HEADER BACK BUTTON ===== */

.chat-header-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.75;
    transition: opacity 0.15s;
}

.chat-header-back-btn:hover { opacity: 1; }

.chat-header-back-btn img {
    width: 18px;
    height: 18px;
    object-fit: contain;
}

/* ===== MOBILE: INFO PANEL FULL-SCREEN OVERLAY ===== */

/* Only applied when isMobile AND isOpen — see ChatInfoPanel.tsx */
.chat-info-panel.info-panel-mobile {
    position: fixed !important;
    inset: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    z-index: 200;
    border-left: none !important;
    border-radius: 0 !important;
}

.info-panel-back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    border-radius: 50%;
    flex-shrink: 0;
    opacity: 0.75;
    transition: opacity 0.15s;
    margin-right: 4px;
}

.info-panel-back-btn:hover { opacity: 1; }

.info-panel-back-btn img {
    width: 18px;
    height: 18px;
    object-fit: contain;
}
```

- [ ] Verify: resize browser to < 768px — no layout breakage (classes not applied yet)

- [ ] Commit:
```bash
git add frontend/src/styles/global.css
git commit -m "add mobile layout CSS - foundation, transitions, touch targets"
```

---

### Task 3: AppLayout mobile stacking

**Files:**
- Modify: `frontend/src/components/AppLayout.tsx`

`AppLayout` already reads `chatId` via `useParams()` for the active chat tile highlight — we reuse that same value to drive mobile panel visibility.

- [ ] Add import at the top:

```typescript
import { useIsMobile } from "../hooks/useIsMobile";
```

- [ ] Add the hook call inside the `AppLayout` function, near the top with other hooks:

```typescript
const isMobile = useIsMobile();
```

- [ ] Extract the entire `<div className="sidebar" ...>...</div>` JSX into a `const sidebarJSX` variable just before the return. When on mobile, omit the inline `width` style (CSS `width: 100% !important` handles it) and omit the resizer (no resize on mobile):

```typescript
const sidebarJSX = (
    <div className="sidebar" style={isMobile ? undefined : { width: sidebarWidth }}>
        {/* ── Header ── */}
        {/* ... all existing sidebar content verbatim ... */}

        {/* ── Bottom navigation ── */}
        {/* ... */}

        {/* ── Logout popup ── */}
        {/* ... */}

        {/* Resizer: desktop only */}
        {!isMobile && (
            <div
                className="sidebar-resizer"
                onMouseDown={() => setIsResizing(true)}
            />
        )}
    </div>
);
```

- [ ] Replace the existing return with a conditional:

```typescript
if (isMobile) {
    return (
        <div className={`mobile-layout ${chatId ? "chat-active" : "list-active"}`}>
            <div className="mobile-sidebar-panel">
                {sidebarJSX}
            </div>
            <div className="mobile-chat-panel">
                {/* position: fixed children (ChatInfoPanel, MediaViewer) escape
                    overflow: hidden naturally, so rightPanel works correctly here */}
                <div className="content">
                    {children}
                </div>
                {rightPanel}
            </div>
        </div>
    );
}

// Desktop layout — unchanged
return (
    <div className="app-layout">
        {sidebarJSX}
        <div className="content">
            {children}
        </div>
        {rightPanel}
    </div>
);
```

- [ ] Verify desktop (> 768px): layout identical to before — sidebar + content side by side, resizer works.

- [ ] Verify mobile (< 768px):
  - At `/` or `/chat` → `list-active`: sidebar fills full screen, chat panel is off-screen right
  - Tap a chat tile → navigates to `/chat/:id` → `chat-active`: slides to chat view
  - `/chat` (BlankChatPage) correctly shows `list-active` because `chatId` is `undefined` on that route, so the blank card content is hidden off-screen and only the sidebar is visible — correct behavior

- [ ] Commit:
```bash
git add frontend/src/components/AppLayout.tsx
git commit -m "AppLayout: mobile single-panel stacked layout with slide transition"
```

---

### Task 4: ChatHeader back button

**Files:**
- Modify: `frontend/src/pages/chat/ChatHeader.tsx`

- [ ] Add `onBack?: () => void` to the props type and destructuring:

```typescript
export function ChatHeader(props: {
    chatName: string;
    chatType: string | null;
    participantsCount: number;
    isOnline?: boolean;
    typingText?: string;
    onHeaderClick: () => void;
    onToggleInfo: () => void;
    onToggleSearch: () => void;
    isSearchOpen: boolean;
    onBack?: () => void;
}) {
    const { chatName, chatType, participantsCount, isOnline, typingText,
            onHeaderClick, onToggleInfo, onToggleSearch, isSearchOpen,
            onBack } = props;
```

- [ ] Inside `.chat-header`, render the back button as the very first child:

```tsx
<div className="chat-header">
    {onBack && (
        <button className="chat-header-back-btn" onClick={onBack} aria-label="Back">
            <img src="/icons/left-chevron.png" alt="back" />
        </button>
    )}
    {/* rest of existing header content unchanged */}
```

- [ ] Verify: on desktop (no `onBack` prop passed) the header looks identical.

- [ ] Commit:
```bash
git add frontend/src/pages/chat/ChatHeader.tsx
git commit -m "ChatHeader: optional back button for mobile"
```

---

### Task 5: ChatPage — wire mobile props + Escape fix

**Files:**
- Modify: `frontend/src/pages/ChatPage.tsx`

- [ ] Add import:

```typescript
import { useIsMobile } from "../hooks/useIsMobile";
```

- [ ] Add hook call near the top of `ChatPage`:

```typescript
const isMobile = useIsMobile();
```

- [ ] Pass `onBack` to `ChatHeader`:

```tsx
<ChatHeader
    chatName={chatName}
    chatType={chatType}
    participantsCount={participants.length}
    isOnline={chatType === "PRIVATE" ? isOnline(chatName) : undefined}
    typingText={typingUsers.length > 0 ? getTypingText() : undefined}
    onHeaderClick={handleHeaderClick}
    onToggleInfo={() => setIsInfoOpen(prev => !prev)}
    onToggleSearch={() => isSearchOpen ? closeSearch() : openSearch()}
    isSearchOpen={isSearchOpen}
    onBack={isMobile ? () => navigate("/chat") : undefined}
/>
```

- [ ] Pass `isMobile` to `ChatInfoPanel`:

```tsx
<ChatInfoPanel
    isOpen={isInfoOpen}
    chatName={chatName}
    chatType={chatType}
    chatId={numericChatId}
    participants={participants}
    currentUsername={currentUsername}
    onUserClick={(id) => navigate(`/user/${id}`)}
    onMediaClick={(items, index, meta) =>
        setViewerState({ items, index, sender: meta.sender, createdAt: meta.createdAt })
    }
    onClose={() => setIsInfoOpen(false)}
    isMobile={isMobile}
/>
```

- [ ] Fix the Escape key handler in `ChatPage` to navigate back on mobile when no modal/overlay is active. Find the existing `onKeyDown` handler (inside the `useEffect` that listens for Escape) and add a mobile fallback at the end:

```typescript
const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (contextMenu) {
        setContextMenu(null);
    } else if (isSearchOpen) {
        closeSearch();
    } else if (editingMessageId !== null) {
        cancelEditing();
    } else if (replyingTo !== null) {
        cancelReply();
    } else if (isMobile) {
        // Nothing open — go back to chat list on mobile
        navigate("/chat");
    }
};
```

Also add `isMobile` and `navigate` to the `useEffect` dependency array.

- [ ] Verify mobile: back button visible in chat header. Tapping it returns to chat list with slide. Pressing Escape with nothing open also returns to list.

- [ ] Verify desktop: no back button. Escape behavior unchanged.

- [ ] Commit:
```bash
git add frontend/src/pages/ChatPage.tsx
git commit -m "ChatPage: mobile back button, isMobile to InfoPanel, Escape fix"
```

---

### Task 6: ChatInfoPanel mobile full-screen overlay

**Files:**
- Modify: `frontend/src/pages/chat/ChatInfoPanel.tsx`

**Important:** The root element's actual class is `chat-info-panel` (not `info-panel`). Read the file before editing to confirm the exact JSX structure.

- [ ] Read `frontend/src/pages/chat/ChatInfoPanel.tsx` fully before making changes.

- [ ] Add `isMobile?: boolean` to the `ChatInfoPanel` props type and destructure it.

- [ ] Add `info-panel-mobile` to the root element's className **only when `isMobile && isOpen`** — the class must not be applied when the panel is closed, otherwise `width: 100% !important` would make a closed panel cover the screen:

```tsx
<div className={`chat-info-panel ${isOpen ? "open" : ""}${isMobile && isOpen ? " info-panel-mobile" : ""}`}>
```

- [ ] In the panel's header row, add a back button as the first element, only on mobile. Find the existing header/title row and prepend:

```tsx
{isMobile && (
    <button className="info-panel-back-btn" onClick={onClose} aria-label="Back">
        <img src="/icons/left-chevron.png" alt="back" />
    </button>
)}
```

- [ ] Verify mobile: tapping info icon opens a full-screen overlay. Back button closes it and returns to chat. Members/media/files tabs all work.

- [ ] Verify desktop: info panel slides from right as before. No back button. Class not applied.

- [ ] Commit:
```bash
git add frontend/src/pages/chat/ChatInfoPanel.tsx
git commit -m "ChatInfoPanel: full-screen overlay on mobile"
```

---

### Task 7: Final verification pass

- [ ] **Desktop** (browser > 768px):
  - Sidebar + chat side by side, resizer functional ✓
  - Info panel slides from right ✓
  - No back button in chat header ✓
  - All message features (send, edit, delete, reply, attachments, search) ✓
  - WebSocket (typing, presence, read receipts) ✓

- [ ] **Mobile** (browser < 768px):
  - `/` → `list-active`, sidebar full-screen ✓
  - `/chat` → `list-active`, sidebar full-screen (BlankChatPage card is off-screen) ✓
  - Tap chat → `chat-active`, slides to chat view ✓
  - Back button in header → navigates to `/chat` → `list-active`, slides back ✓
  - Escape with nothing open → same as back button ✓
  - Info icon → full-screen overlay ✓
  - Back in info panel → returns to chat ✓
  - MediaViewer works (`position: fixed` escapes `overflow: hidden` correctly) ✓
  - Image/file upload works ✓

- [ ] **Resize transition** (drag browser width across 768px):
  - Layout switches cleanly ✓
  - No visual glitches ✓

- [ ] Commit any final polish:
```bash
git add -A
git commit -m "mobile responsive - final polish"
```
