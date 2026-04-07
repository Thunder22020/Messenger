import { API_URL } from "../config";

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
        try {
            const res = await fetch(`${API_URL}/api/auth/refresh`, {
                method: "POST",
                credentials: "include",
            });
            if (res.status === 401 || res.status === 400 || res.status === 403) {
                localStorage.removeItem("accessToken");
                window.location.href = "/login";
                return null;
            }
            if (!res.ok) throw new Error(`Refresh failed with status ${res.status}`);
            const data = await res.json();
            localStorage.setItem("accessToken", data.accessToken);
            return data.accessToken as string;
        } finally {
            refreshPromise = null;
        }
    })();
    return refreshPromise;
}

export async function authFetch(
    url: string,
    options: RequestInit = {}
) {
    const token = localStorage.getItem("accessToken");

    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
        },
    });

    if (response.status !== 401) {
        return response;
    }

    let newToken: string | null;
    try {
        newToken = await refreshAccessToken();
    } catch {
        throw new Error("Network error during token refresh");
    }

    if (!newToken) return;

    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${newToken}`,
        },
    });
}