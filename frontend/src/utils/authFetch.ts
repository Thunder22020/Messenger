import { API_URL } from "../config";

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

    // пробуем refresh
    let refreshResponse: Response;
    try {
        refreshResponse = await fetch(
            `${API_URL}/api/auth/refresh`,
            {
                method: "POST",
                credentials: "include",
            }
        );
    } catch {
        // network error — backend is down/restarting, don't log out
        throw new Error("Network error during token refresh");
    }

    // only log out on actual auth failures, not transient server errors
    if (refreshResponse.status === 401 || refreshResponse.status === 400 || refreshResponse.status === 403) {
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
        return;
    }

    if (!refreshResponse.ok) {
        throw new Error(`Refresh failed with status ${refreshResponse.status}`);
    }

    const data = await refreshResponse.json();
    localStorage.setItem("accessToken", data.accessToken);

    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${data.accessToken}`,
        },
    });
}