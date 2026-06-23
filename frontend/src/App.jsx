import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

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

function Dashboard({ username, onLogout }) {
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
      const [taskData, analyticsData] = await Promise.all([
        api.getTasks(),
        api.getAnalytics(),
      ]);
      setTasks(taskData.result || []);
      setAnalytics(analyticsData.result || []);
      if ((taskData.result || []).some((task) => task.is_active)) {
        setStartedAt(Date.now());
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
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Still home">
          <span className="brand-mark" />
          still
        </a>
        <div className="profile">
          <span>{username}</span>
          <button className="icon-button" onClick={onLogout} title="Sign out">
            {icons.logout}
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="welcome">
          <p className="eyebrow">{greeting()}, {username}</p>
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
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState(
    () => localStorage.getItem("still_username") || "",
  );
  const [authenticated, setAuthenticated] = useState(
    () => Boolean(localStorage.getItem("still_token")),
  );

  function logout() {
    localStorage.removeItem("still_token");
    localStorage.removeItem("still_username");
    setAuthenticated(false);
    setUsername("");
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

  return <Dashboard onLogout={logout} username={username} />;
}
