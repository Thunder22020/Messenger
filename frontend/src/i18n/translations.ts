export type Lang = "ru" | "en";

type Translations = Record<string, string>;

const en: Translations = {
  // Login
  "login.title": "Login",
  "login.username": "Username",
  "login.password": "Password",
  "login.submit": "Login",
  "login.createAccount": "Create account",
  "login.error.notFound": "User not found",
  "login.error.wrongPassword": "Wrong password",
  "login.error.failed": "Login failed",

  // Register
  "register.title": "Sign up",
  "register.username": "Username",
  "register.password": "Password",
  "register.submit": "Register",
  "register.error.usernameRequired": "Username is required",
  "register.error.noSpaces": "Username must not contain spaces",
  "register.error.noStartDigit": "Username must not start with a number",
  "register.error.mustHaveLetter": "Username must contain at least one letter",
  "register.error.minLength": "Username must be at least 3 characters",
  "register.error.maxLength": "Username must be at most 30 characters",
  "register.error.passwordRequired": "Password is required",
  "register.error.passwordMin": "Password must be at least 6 characters",
  "register.error.passwordMax": "Password must be at most 72 characters",
  "register.error.server": "Registration failed. Please try again.",

  // Home
  "home.title": "Welcome to Synk. messenger",
  "home.hint": "Search for people by username using the sidebar and start chatting",

  // Blank chat page
  "blank.title": "No chat selected",
  "blank.hint": "Pick a chat and start the conversation.",

  // Create group
  "group.title": "Create group",
  "group.namePlaceholder": "Group name...",
  "group.searchLabel": "Search users",
  "group.searchPlaceholder": "Search users...",
  "group.noUsersFound": "No users found",
  "group.createBtn": "Create group",
  "group.error.nameRequired": "Group name required",
  "group.error.noParticipants": "Select at least one participant",
  "group.error.failed": "Failed to create group",

  // Sidebar
  "sidebar.search": "Search",
  "sidebar.noChats": "No chats yet",
  "sidebar.noMessages": "No messages yet",
  "sidebar.people": "People",
  "sidebar.noPeopleFound": "No people found",
  "sidebar.typing": "typing...",
  "sidebar.typingOne": "{user} is typing...",
  "sidebar.typingTwo": "{user1}, {user2} are typing...",
  "sidebar.typingMany": "{user1}, {user2} and {count} others are typing...",

  // Messages
  "message.voice": "Voice message",

  // Settings
  "settings.lightTheme": "Light theme",
  "settings.muteSound": "Turn off notification sound",
  "settings.language": "Language",
  "settings.logout": "Log out",

  // Nav
  "nav.chats": "Chats",
  "nav.settings": "Settings",

  // Logout popup
  "logout.title": "Logout?",
  "logout.subtitle": "Are you sure you want to sign out?",
  "logout.cancel": "Cancel",
  "logout.confirm": "Logout",

  // Delete chat popup
  "deleteChat.title": "Delete chat?",
  "deleteChat.subtitle": "Are you sure you want to delete this chat? This cannot be undone.",
  "deleteChat.cancel": "Cancel",
  "deleteChat.confirm": "Delete",

  // Context menu
  "menu.pin": "Pin",
  "menu.unpin": "Unpin",
  "menu.delete": "Delete",

  // Chat input / search
  "chat.inputPlaceholder": "Type something...",
  "chat.searchPlaceholder": "Search messages...",

  // Chat header
  "chatHeader.online": "online",
  "chatHeader.members": "{count} members",
  "chatHeader.audioCall": "Audio Call",
  "chatHeader.videoCall": "Video Call",
  "chatHeader.search": "Search",
  "chatHeader.chatInfo": "Chat Info",

  // Chat info panel
  "info.tabs.members": "Members",
  "info.tabs.media": "Media",
  "info.tabs.files": "Files",
  "info.noMedia": "No media yet",
  "info.noFiles": "No files yet",
  "info.loading": "Loading…",
  "info.loadMore": "Load more",
  "info.noUsers": "No users found",
  "info.member": "Member",
  "info.you": "You",
  "info.addUser": "Add user",
  "info.searchUsers": "Search users...",
  "info.leaveGroup": "Leave group",
};

const ru: Translations = {
  // Login
  "login.title": "Вход",
  "login.username": "Имя пользователя",
  "login.password": "Пароль",
  "login.submit": "Войти",
  "login.createAccount": "Создать аккаунт",
  "login.error.notFound": "Пользователь не найден",
  "login.error.wrongPassword": "Неверный пароль",
  "login.error.failed": "Ошибка входа",

  // Register
  "register.title": "Регистрация",
  "register.username": "Имя пользователя",
  "register.password": "Пароль",
  "register.submit": "Зарегистрироваться",
  "register.error.usernameRequired": "Введите имя пользователя",
  "register.error.noSpaces": "Имя не должно содержать пробелы",
  "register.error.noStartDigit": "Имя не должно начинаться с цифры",
  "register.error.mustHaveLetter": "Имя должно содержать хотя бы одну букву",
  "register.error.minLength": "Минимум 3 символа",
  "register.error.maxLength": "Максимум 30 символов",
  "register.error.passwordRequired": "Введите пароль",
  "register.error.passwordMin": "Минимум 6 символов",
  "register.error.passwordMax": "Максимум 72 символа",
  "register.error.server": "Ошибка регистрации. Попробуйте снова.",

  // Home
  "home.title": "Добро пожаловать в Synk.",
  "home.hint": "Найдите пользователя по имени через боковую панель и начните общение",

  // Blank chat page
  "blank.title": "Чат не выбран",
  "blank.hint": "Выберите чат и начните общение.",

  // Create group
  "group.title": "Создать группу",
  "group.namePlaceholder": "Название группы...",
  "group.searchLabel": "Поиск пользователей",
  "group.searchPlaceholder": "Поиск пользователей...",
  "group.noUsersFound": "Пользователи не найдены",
  "group.createBtn": "Создать группу",
  "group.error.nameRequired": "Введите название группы",
  "group.error.noParticipants": "Выберите хотя бы одного участника",
  "group.error.failed": "Не удалось создать группу",

  // Sidebar
  "sidebar.search": "Поиск",
  "sidebar.noChats": "Нет чатов",
  "sidebar.noMessages": "Нет сообщений",
  "sidebar.people": "Люди",
  "sidebar.noPeopleFound": "Люди не найдены",
  "sidebar.typing": "печатает...",
  "sidebar.typingOne": "{user} печатает...",
  "sidebar.typingTwo": "{user1}, {user2} печатают...",
  "sidebar.typingMany": "{user1}, {user2} и ещё {count} печатают...",

  // Messages
  "message.voice": "Голосовое сообщение",

  // Settings
  "settings.lightTheme": "Светлая тема",
  "settings.muteSound": "Отключить звук уведомлений",
  "settings.language": "Язык",
  "settings.logout": "Выйти",

  // Nav
  "nav.chats": "Чаты",
  "nav.settings": "Настройки",

  // Logout popup
  "logout.title": "Выйти?",
  "logout.subtitle": "Вы уверены, что хотите выйти?",
  "logout.cancel": "Отмена",
  "logout.confirm": "Выйти",

  // Delete chat popup
  "deleteChat.title": "Удалить чат?",
  "deleteChat.subtitle": "Вы уверены? Это действие необратимо.",
  "deleteChat.cancel": "Отмена",
  "deleteChat.confirm": "Удалить",

  // Context menu
  "menu.pin": "Закрепить",
  "menu.unpin": "Открепить",
  "menu.delete": "Удалить",

  // Chat input / search
  "chat.inputPlaceholder": "Написать сообщение...",
  "chat.searchPlaceholder": "Поиск сообщений...",

  // Chat header
  "chatHeader.online": "в сети",
  "chatHeader.members": "{count} участников",
  "chatHeader.audioCall": "Голосовой звонок",
  "chatHeader.videoCall": "Видеозвонок",
  "chatHeader.search": "Поиск",
  "chatHeader.chatInfo": "Информация",

  // Chat info panel
  "info.tabs.members": "Участники",
  "info.tabs.media": "Медиа",
  "info.tabs.files": "Файлы",
  "info.noMedia": "Нет медиафайлов",
  "info.noFiles": "Нет файлов",
  "info.loading": "Загрузка…",
  "info.loadMore": "Загрузить ещё",
  "info.noUsers": "Пользователи не найдены",
  "info.member": "Участник",
  "info.you": "Вы",
  "info.addUser": "Добавить",
  "info.searchUsers": "Поиск пользователей...",
  "info.leaveGroup": "Покинуть группу",
};

export const translations: Record<Lang, Translations> = { en, ru };
