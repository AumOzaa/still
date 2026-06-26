const API_URL = import.meta.env.VITE_API_URL || "http://192.168.1.181:3000";

async function request(path, options = {}) {
    const token = localStorage.getItem("still_token");
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    let data = {};
    if (response.status !== 204) {
        data = await response.json().catch(() => ({}));
    }

    if (!response.ok) {
        const error = new Error(data.message || data.msg || "Something went wrong.");
        error.status = response.status;
        error.details = data;
        throw error;
    }

    return data;
}

export const api = {
    signUp: (credentials) =>
        request("/api/user/signup", {
            method: "POST",
            body: JSON.stringify(credentials),
        }),
    signIn: (credentials) =>
        request("/api/user/signin", {
            method: "POST",
            body: JSON.stringify(credentials),
        }),
    getTasks: () => request("/api/user/tasks"),
    getTimeSinceStart: () => request("/api/user/timeSinceStart"),
    createTask: (taskName) =>
        request("/api/user/createtask", {
            method: "POST",
            body: JSON.stringify({ taskName }),
        }),
    deleteTask: (id) =>
        request(`/api/user/del/task/${id}`, { method: "DELETE" }),
    toggleTask: (id) =>
        request(`/api/user/task/${id}`, { method: "POST" }),
    getAnalytics: () =>
        request("/api/user/dayAnalytics", { method: "POST" }),
    getTodos: () => request("/api/user/todo"),
    createTodo: (todoName) =>
        request("/api/user/todo", {
            method: "POST",
            body: JSON.stringify({ todoName }),
        }),
    completeTodo: (id) =>
        request(`/api/user/todo/${id}`, { method: "POST" }),
    extendTodo: (id) =>
        request(`/api/user/todo/extend/${id}`, { method: "POST" }),
    deleteTodo: (id) =>
        request(`/api/user/todo/${id}`, { method: "DELETE" }),
};
