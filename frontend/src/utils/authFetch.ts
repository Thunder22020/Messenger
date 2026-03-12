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
    const refreshResponse = await fetch(
        `${API_URL}/api/auth/refresh`,
        {
            method: "POST",
            credentials: "include",
        }
    );

    if (!refreshResponse.ok) {
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
        return;
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