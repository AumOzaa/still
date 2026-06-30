import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { io } from "socket.io-client";

// const socket = io("http://192.168.1.181:3000");
const socket = io("http://localhost:3000");

const icons = {
    plus: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
        </svg>
    ),
    play: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 9 6-9 6V6Z" />
        </svg>
    ),
    pause: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 7v10M15 7v10" />
        </svg>
    ),
    trash: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14M10 11v5M14 11v5M8 7l1-2h6l1 2M7 7l1 13h8l1-13" />
        </svg>
    ),
    logout: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" />
        </svg>
    ),
    check: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 13 4 4L19 7" />
        </svg>
    ),
    clock: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
    ),
};

function formatDuration(totalSeconds = 0) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    return hours
        ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

function formatDueDate(value) {
    if (!value) return "No deadline";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Deadline unavailable";
    return date.toLocaleString();
}

function getDueTone(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const hoursLeft = (date.getTime() - Date.now()) / 36e5;
    if (hoursLeft <= 3) return "urgent";
    if (hoursLeft <= 12) return "soon";
    return "";
}

function Auth({ onAuthenticated }) {
    const [mode, setMode] = useState("signin");
    const [form, setForm] = useState({ username: "", password: "" });
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setError("");
        setNotice("");
        setLoading(true);

        try {
            if (mode === "signup") {
                const result = await api.signUp(form);
                if (result.msg?.toLowerCase() === "user exists") {
                    setError("That username is already taken.");
                    return;
                }
                setMode("signin");
                setNotice("Your account is ready. Sign in to begin.");
                setForm((current) => ({ ...current, password: "" }));
                return;
            }

            const result = await api.signIn(form);
            if (!result.accessToken) throw new Error("We couldn't sign you in.");
            localStorage.setItem("still_token", result.accessToken);
            localStorage.setItem("still_username", result.username);
            onAuthenticated(result.username);
        } catch (err) {
            setError(
                err.status === 401
                    ? "That password doesn't look right."
                    : err.message || "Something went wrong. Try again.",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-shell">
            <section className="auth-intro">
                <a className="brand" href="/" aria-label="Still home">
                    <span className="brand-mark" />
                    still
                </a>
                <div className="intro-copy">
                    <p className="eyebrow">One thing at a time</p>
                    <h1>A quieter place for your attention.</h1>
                    <p>
                        Choose what matters now, start a gentle focus session, and let the
                        rest wait.
                    </p>
                </div>
                <p className="auth-footnote">No streaks. No guilt. Just today.</p>
            </section>

            <section className="auth-panel">
                <div className="auth-card">
                    <div className="auth-heading">
                        <p className="eyebrow">{mode === "signin" ? "Welcome back" : "Start gently"}</p>
                        <h2>{mode === "signin" ? "Make a little space." : "Create your space."}</h2>
                    </div>

                    <div className="auth-tabs" role="tablist" aria-label="Account action">
                        <button
                            className={mode === "signin" ? "active" : ""}
                            onClick={() => {
                                setMode("signin");
                                setError("");
                            }}
                            type="button"
                        >
                            Sign in
                        </button>
                        <button
                            className={mode === "signup" ? "active" : ""}
                            onClick={() => {
                                setMode("signup");
                                setError("");
                            }}
                            type="button"
                        >
                            Create account
                        </button>
                    </div>

                    <form onSubmit={submit}>
                        <label>
                            Username
                            <input
                                autoComplete="username"
                                minLength="3"
                                onChange={(event) =>
                                    setForm({ ...form, username: event.target.value })
                                }
                                placeholder="Your name"
                                required
                                value={form.username}
                            />
                        </label>
                        <label>
                            Password
                            <input
                                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                                minLength="3"
                                onChange={(event) =>
                                    setForm({ ...form, password: event.target.value })
                                }
                                placeholder="At least 3 characters"
                                required
                                type="password"
                                value={form.password}
                            />
                        </label>
                        {error && <p className="form-message error">{error}</p>}
                        {notice && <p className="form-message success">{notice}</p>}
                        <button className="primary-button" disabled={loading} type="submit">
                            {loading ? "Just a moment…" : mode === "signin" ? "Enter your space" : "Create account"}
                        </button>
                    </form>
                </div>
            </section>
        </main>
    );
}

function AppHeader({ activePage, onLogout, onPageChange, username }) {
    return (
        <header className="topbar">
            <a className="brand" href="/" aria-label="Still home">
                <span className="brand-mark" />
                still
            </a>
            <nav className="page-nav" aria-label="Main navigation">
                <button
                    className={activePage === "focus" ? "active" : ""}
                    onClick={() => onPageChange("focus")}
                    type="button"
                >
                    Focus
                </button>
                <button
                    className={activePage === "todos" ? "active" : ""}
                    onClick={() => onPageChange("todos")}
                    type="button"
                >
                    Todos
                </button>
            </nav>
            <div className="profile">
                <span>{username}</span>
                <button className="icon-button" onClick={onLogout} title="Sign out">
                    {icons.logout}
                </button>
            </div>
        </header>
    );
}

function Dashboard({ onLogout }) {
    const [tasks, setTasks] = useState([]);
    const [analytics, setAnalytics] = useState([]);
    const [taskName, setTaskName] = useState("");
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [busyTask, setBusyTask] = useState(null);
    const [message, setMessage] = useState("");
    const [startedAt, setStartedAt] = useState(Date.now());
    const [tick, setTick] = useState(0);

    const activeTask = useMemo(
        () => tasks.find((task) => task.is_active),
        [tasks],
    );

    const loadData = useCallback(async () => {
        try {
            const [taskData, analyticsData, timeSinceStartData] = await Promise.all([
                api.getTasks(),
                api.getAnalytics(),
                api.getTimeSinceStart(),
            ]);
            const loadedTasks = taskData.result || [];
            setTasks(loadedTasks);
            setAnalytics(analyticsData.result || []);

            if (loadedTasks.some((task) => task.is_active)) {
                const elapsedSeconds = Math.max(
                    0,
                    Number(timeSinceStartData.toStartTime?.elapsed_seconds) || 0,
                );

                setStartedAt(Date.now() - elapsedSeconds * 1000);
            }
        } catch (err) {
            if (err.status === 401) onLogout();
            else setMessage(err.message);
        } finally {
            setLoading(false);
        }
    }, [onLogout]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const userId = localStorage.getItem("userId");

        socket.emit("join-user-room", localStorage.getItem("still_token"));

        socket.on("task-started", async () => {
            await loadData();
        });

        socket.on("task-stopped", async () => {
            await loadData();
        });

        return () => {
            socket.off("task-started");
            socket.off("task-stopped");
        };
    }, [socket, loadData]);
    useEffect(() => {
        if (!activeTask) return undefined;
        const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
        return () => window.clearInterval(interval);
    }, [activeTask]);

    const liveSeconds = activeTask
        ? Math.floor((Date.now() - startedAt) / 1000) + tick * 0
        : 0;

    async function createTask(event) {
        event.preventDefault();
        const trimmedName = taskName.trim();
        if (trimmedName.length < 2) return;
        setCreating(true);
        setMessage("");
        try {
            const result = await api.createTask(trimmedName);
            setTasks((current) => [
                ...current,
                { id: result.taskId, name: result.task, is_active: false },
            ]);
            setTaskName("");
        } catch (err) {
            setMessage(err.message);
        } finally {
            setCreating(false);
        }
    }

    async function toggleTask(task) {
        if (activeTask && activeTask.id !== task.id) {
            setMessage(`Pause “${activeTask.name}” before starting something else.`);
            return;
        }

        setBusyTask(task.id);
        setMessage("");
        try {
            const wasActive = Boolean(task.is_active);
            const result = await api.toggleTask(task.id);
            if (!wasActive && result.message === "You already have one session running!") {
                setMessage(result.message);
                await loadData();
                return;
            }
            setTasks((current) =>
                current.map((item) =>
                    item.id === task.id ? { ...item, is_active: !wasActive } : item,
                ),
            );
            if (!wasActive) setStartedAt(Date.now());
            else {
                const analyticsData = await api.getAnalytics();
                setAnalytics(analyticsData.result || []);
            }
        } catch (err) {
            setMessage(err.message);
        } finally {
            setBusyTask(null);
        }
    }

    async function deleteTask(task) {
        setBusyTask(task.id);
        setMessage("");
        try {
            await api.deleteTask(task.id);
            setTasks((current) => current.filter((item) => item.id !== task.id));
        } catch (err) {
            setMessage(err.message);
        } finally {
            setBusyTask(null);
        }
    }

    const totalToday = analytics.reduce(
        (sum, item) => sum + Number(item.sum || 0),
        0,
    );

    return (
        <main className="dashboard">
            <section className="welcome">
                <p className="eyebrow">{greeting()}</p>
                <h1>What deserves your attention?</h1>
                <p>Pick one small thing. That is enough.</p>
            </section>

            <div className="dashboard-grid">
                <section className={`focus-card ${activeTask ? "active" : ""}`}>
                    <div>
                        <p className="eyebrow">{activeTask ? "Focusing now" : "Your focus space"}</p>
                        <h2>{activeTask ? activeTask.name : "Nothing running"}</h2>
                        <p>
                            {activeTask
                                ? "Everything else can wait for a moment."
                                : "Start a task when you feel ready."}
                        </p>
                    </div>
                    <div className="focus-time">
                        <span>{activeTask ? formatDuration(liveSeconds) : "00:00"}</span>
                        <small>{activeTask ? "this session" : "ready when you are"}</small>
                    </div>
                    {activeTask && (
                        <button
                            className="stop-button"
                            disabled={busyTask === activeTask.id}
                            onClick={() => toggleTask(activeTask)}
                        >
                            <span className="button-icon">{icons.pause}</span>
                            Pause focus
                        </button>
                    )}
                </section>

                <aside className="today-card">
                    <p className="eyebrow">Today</p>
                    <strong>{formatDuration(totalToday)}</strong>
                    <span>focused so far</span>
                    <div className="analytics-list">
                        {analytics.slice(0, 3).map((item) => (
                            <div key={item.name}>
                                <span>{item.name}</span>
                                <span>{formatDuration(item.sum)}</span>
                            </div>
                        ))}
                        {!analytics.length && <p>Your focus time will appear here.</p>}
                    </div>
                </aside>
            </div>

            <section className="tasks-section">
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">Gentle queue</p>
                        <h2>Your tasks</h2>
                    </div>
                    <span>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
                </div>

                <form className="task-form" onSubmit={createTask}>
                    <span className="form-plus">{icons.plus}</span>
                    <input
                        aria-label="New task name"
                        maxLength="120"
                        minLength="2"
                        onChange={(event) => setTaskName(event.target.value)}
                        placeholder="Add one small thing…"
                        value={taskName}
                    />
                    <button disabled={creating || taskName.trim().length < 2}>
                        {creating ? "Adding…" : "Add task"}
                    </button>
                </form>

                {message && <p className="dashboard-message">{message}</p>}

                <div className="task-list">
                    {loading && <div className="empty-state">Gathering your tasks…</div>}
                    {!loading && !tasks.length && (
                        <div className="empty-state">
                            <span className="empty-dot" />
                            <h3>Your list is quiet.</h3>
                            <p>Add the smallest useful next step above.</p>
                        </div>
                    )}
                    {tasks.map((task) => (
                        <article className={`task-row ${task.is_active ? "active" : ""}`} key={task.id}>
                            <span className="task-status" />
                            <div className="task-copy">
                                <h3>{task.name}</h3>
                                <p>{task.is_active ? "In focus" : "Waiting gently"}</p>
                            </div>
                            <div className="task-actions">
                                <button
                                    className="task-start"
                                    disabled={busyTask === task.id}
                                    onClick={() => toggleTask(task)}
                                >
                                    <span className="button-icon">
                                        {task.is_active ? icons.pause : icons.play}
                                    </span>
                                    {task.is_active ? "Pause" : "Focus"}
                                </button>
                                <button
                                    aria-label={`Delete ${task.name}`}
                                    className="icon-button delete-button"
                                    disabled={busyTask === task.id || task.is_active}
                                    onClick={() => deleteTask(task)}
                                    title={task.is_active ? "Pause before deleting" : "Delete task"}
                                >
                                    {icons.trash}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
}

function TodoPage({ onLogout }) {
    const [todos, setTodos] = useState([]);
    const [todoName, setTodoName] = useState("");
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [busyTodo, setBusyTodo] = useState(null);
    const [message, setMessage] = useState("");

    const loadTodos = useCallback(async () => {
        try {
            const data = await api.getTodos();
            setTodos(data.result || []);
            setMessage("");
        } catch (err) {
            if (err.status === 401) onLogout();
            else setMessage(err.message);
        } finally {
            setLoading(false);
        }
    }, [onLogout]);

    useEffect(() => {
        loadTodos();
    }, [loadTodos]);

    useEffect(() => {
        socket.emit("join-user-room", localStorage.getItem("still_token"));

        const refresh = async () => {
            await loadTodos();
        };

        socket.on("todo-created", refresh);
        socket.on("todo-completed", refresh);
        socket.on("todo-extended", refresh);
        socket.on("todo-deleted", refresh);
        socket.on("todos-expired", refresh);

        return () => {
            socket.off("todo-created", refresh);
            socket.off("todo-completed", refresh);
            socket.off("todo-extended", refresh);
            socket.off("todo-deleted", refresh);
            socket.off("todos-expired", refresh);
        };
    }, [loadTodos]);

    async function createTodo(event) {
        event.preventDefault();
        const trimmedName = todoName.trim();
        if (trimmedName.length < 2) return;

        setCreating(true);
        setMessage("");
        try {
            const data = await api.createTodo(trimmedName);
            if (data.result) {
                setTodos((current) =>
                    [...current, data.result].sort(
                        (a, b) => new Date(a.expires_at || 0) - new Date(b.expires_at || 0),
                    ),
                );
            } else {
                await loadTodos();
            }
            setTodoName("");
        } catch (err) {
            setMessage(err.message);
        } finally {
            setCreating(false);
        }
    }

    async function completeTodo(todo) {
        setBusyTodo(todo.id);
        setMessage("");
        try {
            await api.completeTodo(todo.id);
            setTodos((current) => current.filter((item) => item.id !== todo.id));
        } catch (err) {
            setMessage(err.message);
        } finally {
            setBusyTodo(null);
        }
    }

    async function extendTodo(todo) {
        setBusyTodo(todo.id);
        setMessage("");
        try {
            const data = await api.extendTodo(todo.id);
            if (data.result) {
                setTodos((current) =>
                    current
                        .map((item) => (item.id === todo.id ? data.result : item))
                        .sort(
                            (a, b) =>
                                new Date(a.expires_at || 0) - new Date(b.expires_at || 0),
                        ),
                );
            } else {
                await loadTodos();
            }
        } catch (err) {
            setMessage(err.message);
        } finally {
            setBusyTodo(null);
        }
    }

    async function deleteTodo(todo) {
        setBusyTodo(todo.id);
        setMessage("");
        try {
            await api.deleteTodo(todo.id);
            setTodos((current) => current.filter((item) => item.id !== todo.id));
        } catch (err) {
            setMessage(err.message);
        } finally {
            setBusyTodo(null);
        }
    }

    return (
        <main className="dashboard">
            <section className="welcome todos-welcome">
                <p className="eyebrow">Loose ends</p>
                <h1>A clean little list for later.</h1>
                <p>Todos live separately from focus tasks, so your attention stays uncluttered.</p>
            </section>

            <section className="todos-panel">
                <div className="section-heading">
                    <div>
                        <p className="eyebrow">Todo queue</p>
                        <h2>Things to remember</h2>
                    </div>
                    <span>{todos.length} {todos.length === 1 ? "todo" : "todos"}</span>
                </div>

                <form className="task-form todo-form" onSubmit={createTodo}>
                    <span className="form-plus">{icons.plus}</span>
                    <input
                        aria-label="New todo name"
                        maxLength="120"
                        minLength="2"
                        onChange={(event) => setTodoName(event.target.value)}
                        placeholder="Add a todo before it floats away…"
                        value={todoName}
                    />
                    <button disabled={creating || todoName.trim().length < 2}>
                        {creating ? "Adding…" : "Add todo"}
                    </button>
                </form>

                {message && <p className="dashboard-message">{message}</p>}

                <div className="todo-list">
                    {loading && <div className="empty-state">Fetching your todos…</div>}
                    {!loading && !todos.length && (
                        <div className="empty-state">
                            <span className="empty-dot" />
                            <h3>No active todos.</h3>
                            <p>Add one thing you want to keep in sight.</p>
                        </div>
                    )}

                    {todos.map((todo) => {
                        const dueTone = getDueTone(todo.expires_at);
                        return (
                            <article className={`todo-row ${dueTone}`} key={todo.id}>
                                <button
                                    aria-label={`Complete ${todo.name}`}
                                    className="todo-check"
                                    disabled={busyTodo === todo.id}
                                    onClick={() => completeTodo(todo)}
                                    title="Mark complete"
                                    type="button"
                                >
                                    {icons.check}
                                </button>
                                <div className="todo-copy">
                                    <h3>{todo.name}</h3>
                                    <p>
                                        <span className="button-icon">{icons.clock}</span>
                                        {formatDueDate(todo.expires_at)}
                                    </p>
                                </div>
                                <div className="task-actions">
                                    <button
                                        className="task-start"
                                        disabled={busyTodo === todo.id}
                                        onClick={() => extendTodo(todo)}
                                        type="button"
                                    >
                                        +24h
                                    </button>
                                    <button
                                        aria-label={`Delete ${todo.name}`}
                                        className="icon-button delete-button"
                                        disabled={busyTodo === todo.id}
                                        onClick={() => deleteTodo(todo)}
                                        title="Delete todo"
                                        type="button"
                                    >
                                        {icons.trash}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>
        </main>
    );
}

export default function App() {
    const [username, setUsername] = useState(
        () => localStorage.getItem("still_username") || "",
    );
    const [authenticated, setAuthenticated] = useState(
        () => Boolean(localStorage.getItem("still_token")),
    );
    const [activePage, setActivePage] = useState(
        () => localStorage.getItem("still_page") || "focus",
    );

    // const socket = useMemo(
    //     () => io("http://192.168.1.181:3000"),
    //     []
    // );

    function logout() {
        localStorage.removeItem("still_token");
        localStorage.removeItem("still_username");
        localStorage.removeItem("still_page");
        setAuthenticated(false);
        setUsername("");
        setActivePage("focus");
    }

    function changePage(page) {
        setActivePage(page);
        localStorage.setItem("still_page", page);
    }

    if (!authenticated) {
        return (
            <Auth
                onAuthenticated={(name) => {
                    setUsername(name);
                    setAuthenticated(true);
                }}
            />
        );
    }

    return (
        <div className="app-shell">
            <AppHeader
                activePage={activePage}
                onLogout={logout}
                onPageChange={changePage}
                username={username}
            />
            {activePage === "todos" ? (
                <TodoPage onLogout={logout} />
            ) : (
                <Dashboard onLogout={logout} />
            )}
        </div>
    );
}
