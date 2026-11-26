const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const ACCESS_TOKEN_KEY = "still_token";

let refreshPromise = null;

function createHttpError(data, status, fallbackMessage = "Something went wrong.") {
    const error = new Error(data.message || data.msg || fallbackMessage);
    error.status = status;
    error.details = data;
    return error;
}

function getStoredAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function saveAccessToken(accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

function clearAccessToken() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
}

function parseJwtPayload(token) {
    try {
        const payload = token.split(".")[1];
        const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
        const json = window.atob(normalizedPayload);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function isTokenExpiringSoon(token) {
    const payload = parseJwtPayload(token);
    if (!payload?.exp) return false;
    const expiresAt = payload.exp * 1000;
    return expiresAt - Date.now() < 10_000;
}

async function refreshAccessToken() {
    if (!refreshPromise) {
        refreshPromise = fetch(`${API_URL}/api/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then(async (response) => {
                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.accessToken) {
                    clearAccessToken();
                    throw createHttpError(data, 401, "Your session expired. Please sign in again.");
                }

                saveAccessToken(data.accessToken);
                return data.accessToken;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
}

async function getValidAccessToken() {
    const token = getStoredAccessToken();
    if (token && !isTokenExpiringSoon(token)) return token;
    return refreshAccessToken();
}

async function request(path, options = {}) {
    const { auth = true, retryOnUnauthorized = true, ...fetchOptions } = options;
    const token = auth ? await getValidAccessToken() : null;
    const response = await fetch(`${API_URL}${path}`, {
        ...fetchOptions,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...fetchOptions.headers,
        },
    });

    let data = {};
    if (response.status !== 204) {
        data = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
        if (auth && retryOnUnauthorized && [401, 403].includes(response.status)) {
            const refreshedToken = await refreshAccessToken();
            return request(path, {
                ...fetchOptions,
                auth,
                retryOnUnauthorized: false,
                headers: {
                    ...fetchOptions.headers,
                    Authorization: `Bearer ${refreshedToken}`,
                },
            });
        }

        throw createHttpError(data, response.status);
    }

    return data;
}

export const api = {
    getValidAccessToken,
    signUp: (credentials) =>
        request("/api/auth/signup", {
            method: "POST",
            auth: false,
            body: JSON.stringify(credentials),
        }),
    signIn: (credentials) =>
        request("/api/auth/signin", {
            method: "POST",
            auth: false,
            body: JSON.stringify(credentials),
        }),
    getTasks: (credentials) => request("/api/tasks/tasks", {
        method: "GET",
        body: JSON.stringify(credentials),
    }),
    getTimeSinceStart: (credentials) => request("/api/tasks/timeSinceStart", {
        method: "POST",
        body: JSON.stringify(credentials),
    }),
    createTask: (taskName) =>
        request("/api/tasks/createtask", {
            method: "POST",
            body: JSON.stringify({ taskName }),
        }),
    deleteTask: (id) =>
        request(`/api/tasks/del/task/${id}`, { method: "DELETE" }),
    toggleTask: (id) =>
        request(`/api/tasks/task/${id}`, { method: "POST" }),
    getAnalytics: () =>
        request("/api/tasks/dayAnalytics", { method: "POST" }),
    getTodos: () => request("/api/todos/todo"),
    createTodo: (todoName) =>
        request("/api/todos/todo", {
            method: "POST",
            body: JSON.stringify({ todoName }),
        }),
    completeTodo: (id) =>
        request(`/api/todos/todo/${id}`, { method: "POST" }),
    extendTodo: (id) =>
        request(`/api/todos/todo/extend/${id}`, { method: "POST" }),
    deleteTodo: (id) =>
        request(`/api/todos/todo/${id}`, { method: "DELETE" }),
    requestTodoImageUpload: (id, file) =>
        request(`/api/todos/todo/${id}/image/upload-url`, {
            method: "POST",
            body: JSON.stringify({ contentType: file.type, size: file.size }),
        }),
    confirmTodoImage: (id, key) =>
        request(`/api/todos/todo/${id}/image`, {
            method: "POST",
            body: JSON.stringify({ key }),
        }),
    removeTodoImage: (id) =>
        request(`/api/todos/todo/${id}/image`, { method: "DELETE" }),
    // Presigned POST: the file goes straight to S3. No auth header here, S3 rejects it.
    uploadTodoImage: async (id, file) => {
        const upload = await api.requestTodoImageUpload(id, file);

        const form = new FormData();
        Object.entries(upload.fields).forEach(([name, value]) => form.append(name, value));
        form.append("file", file); // the file must be the last field

        const s3Response = await fetch(upload.url, { method: "POST", body: form });
        if (!s3Response.ok) {
            throw createHttpError({}, s3Response.status, "Image upload failed. Please try again.");
        }

        return api.confirmTodoImage(id, upload.key);
    },
};
