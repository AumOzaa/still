const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
        request("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify(credentials),
        }),
    signIn: (credentials) =>
        request("/api/auth/signin", {
            method: "POST",
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
        request(`/api/tasks/del/tasks/${id}`, { method: "DELETE" }),
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
};
