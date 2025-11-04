import { useEffect, useMemo, useRef, useState } from "react";


// ---------- Utilities (maintainability: small, pure helpers) ----------
const uid = () => Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
const loadJSON = (k, d) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : d;
  } catch {
    return d;
  }
};
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};



export default function App() {
  // lazy-init state (performance: avoid parsing JSON every render)
  const [tasks, setTasks] = useState(() => loadJSON("tt_tasks", []));
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirm, setConfirm] = useState(null); // { id, title }
  const [announce, setAnnounce] = useState(""); // aria-live updates (QA1)
  const [undoStack, setUndoStack] = useState(() => loadJSON("tt_undo", []));

  // form state
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [estimate, setEstimate] = useState("");
  const [privateEmail, setPrivateEmail] = useState(false);

  const titleRef = useRef(null);

  // persist
  useEffect(() => saveJSON("tt_tasks", tasks), [tasks]);
  useEffect(() => saveJSON("tt_undo", undoStack), [undoStack]);

  // accessibility live-region announcer
  const say = (msg) => {
    setAnnounce(msg);
    // brief reset so screen readers read subsequent identical text
    setTimeout(() => setAnnounce(""), 500);
  };

  // performance: memoize filtered results
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchQ = !q || t.title.toLowerCase().includes(q);
      const matchS = statusFilter === "all" || t.status === statusFilter;
      return matchQ && matchS;
    });
  }, [tasks, query, statusFilter]);

  // performance: debounce expensive state updates from search
  const onSearchChange = useMemo(() => debounce((v) => setQuery(v), 150), []);

  // ----- Actions -----
  const resetForm = () => {
    setTitle("");
    setDue("");
    setEstimate("");
    setPrivateEmail(false);
  };

  const addTask = () => {
    if (!title.trim()) return; // QA1: error prevention (IH#8 counterpart)
    const task = {
      id: uid(),
      title: title.trim(),
      due: due || null,
      estimateMin: estimate ? Number(estimate) : null,
      status: "todo",
      privateEmail,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [task, ...prev]);
    say(`Task “${task.title}” added`);
    resetForm();
    titleRef.current?.focus(); // QA1 keyboard flow
  };

  const requestDelete = (task) => {
    // IH#8: confirm to prevent destructive mistakes
    setConfirm({ id: task.id, title: task.title });
  };

  const deleteTask = (id) => {
    setTasks((prev) => {
      const toDelete = prev.find((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      setUndoStack((u) => [{ type: "delete", payload: toDelete }, ...u].slice(0, 20));
      say(`Deleted “${toDelete?.title ?? "task"}”. Undo available.`);
      return next;
    });
    setConfirm(null);
  };

  const toggleStatus = (id) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "done" ? "todo" : "done" }
          : t
      )
    );
  };

  const undo = () => {
    const top = undoStack[0];
    if (!top) return;
    setUndoStack((u) => u.slice(1));
    if (top.type === "delete") {
      setTasks((prev) => [top.payload, ...prev]);
      say(`Undo restored “${top.payload.title}”.`);
    }
  };

  // keyboard: Enter adds task (IH#7: redundancy)
  const onKeyPressAdd = (e) => {
    if (e.key === "Enter") addTask();
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-8">
      {/* IH#1: clear purpose & value proposition */}
      <header className="max-w-4xl mx-auto mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Task Tracker — Milestone #1</h1>
        <p className="mt-1 text-sm sm:text-base">
          Plan and track tasks quickly. Add a task, filter, mark done, and undo mistakes.
        </p>
        {/* IH#2: communicate cost/time */}
        <p className="text-xs text-gray-600 mt-1">
          Set up takes about 10 seconds 
        </p>
      </header>

      {/* aria-live region for screen reader announcements (QA1) */}
      <div aria-live="polite" className="sr-only">{announce}</div>

      <main className="max-w-4xl mx-auto grid gap-4">
        {/* Add Task Form (IH#6 clear next steps; IH#7 redundant affordances) */}
        <section
          aria-label="Add a task"
          className="rounded-2xl shadow p-4 bg-white border"
        >
          <h2 className="font-semibold text-lg mb-2">Add Task</h2>
          <div className="grid sm:grid-cols-5 gap-2 items-end">
            <div className="sm:col-span-2">
              <label className="block text-sm" htmlFor="title">Task title</label>
              <input
                id="title"
                ref={titleRef}
                className="w-full rounded border px-3 py-2"
                placeholder="e.g., Write milestone script"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={onKeyPressAdd}
                aria-describedby="title-hint"
              />
              {/* IH#4 familiar mimicry: Google-like hint, plain text field */}
              <p id="title-hint" className="text-xs text-gray-600 mt-1">
                Press Enter or click Add.
              </p>
            </div>
            <div>
              <label className="block text-sm" htmlFor="due">Due</label>
              <input
                id="due"
                type="datetime-local"
                className="w-full rounded border px-3 py-2"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                min={nowISO()}
              />
            </div>
            <div>
              <label className="block text-sm" htmlFor="est">Estimate (min)</label>
              <input
                id="est"
                type="number"
                inputMode="numeric"
                min={1}
                className="w-full rounded border px-3 py-2"
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
              />
            </div>
            <div className="sm:col-span-5 flex items-center gap-2">
              {/* IH#3 user control & privacy toggle */}
              <input
                id="priv"
                type="checkbox"
                checked={privateEmail}
                onChange={(e) => setPrivateEmail(e.target.checked)}
              />
              <label htmlFor="priv" className="text-sm">Mark my email private for this task’s notifications</label>
            </div>
            <div className="sm:col-span-5 flex gap-2">
              <button
                className="rounded-2xl border px-4 py-2 shadow text-sm font-medium"
                onClick={addTask}
                aria-label="Add task"
              >
                Add Task
              </button>
              {/* IH#5 backtrack affordance present at all times */}
              <button
                className="rounded-2xl border px-4 py-2 shadow text-sm"
                onClick={undo}
                disabled={!undoStack.length}
                aria-disabled={!undoStack.length}
              >
                Undo Delete
              </button>
            </div>
          </div>
        </section>

        {/* Search & Filters (IH#6 next steps; IH#7 redundancy keyboard+button) */}
        <section aria-label="Search and filters" className="rounded-2xl shadow p-4 bg-white border">
          <div className="grid sm:grid-cols-3 gap-2 items-end">
            <div className="sm:col-span-2">
              <label className="block text-sm" htmlFor="q">Search tasks</label>
              <input
                id="q"
                className="w-full rounded border px-3 py-2"
                placeholder="Type to filter..."
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm" htmlFor="status">Status</label>
              <select
                id="status"
                className="w-full rounded border px-3 py-2"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="todo">To do</option>
                <option value="doing">Doing</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>
        </section>

        {/* Tasks list */}
        <section aria-label="Tasks" className="rounded-2xl shadow p-4 bg-white border">
          <h2 className="font-semibold text-lg mb-2">Tasks</h2>
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-600">No tasks yet. Add one above.</p>
          ) : (
            <ul className="grid gap-2" role="list">
              {filtered.map((t) => (
                <li key={t.id} className="border rounded-xl p-3 flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        id={`done-${t.id}`}
                        type="checkbox"
                        checked={t.status === "done"}
                        onChange={() => toggleStatus(t.id)}
                        aria-label={t.status === "done" ? "Mark as to do" : "Mark as done"}
                      />
                      <label htmlFor={`done-${t.id}`} className={`font-medium ${t.status === "done" ? "line-through text-gray-500" : ""}`}>
                        {t.title}
                      </label>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {t.due && <span className="mr-3">Due: {new Date(t.due).toLocaleString()}</span>}
                      {t.estimateMin && <span className="mr-3">Est: {t.estimateMin} min</span>}
                      <span>Status: {t.status}</span>
                      {t.privateEmail && <span className="ml-3">• Email is private</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-xl border px-3 py-1 text-sm"
                      onClick={() => requestDelete(t)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* IH#8: Destructive action confirmation */}
      {confirm && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow max-w-sm w-full p-4">
            <h3 className="font-semibold text-lg">Delete task?</h3>
            <p className="text-sm text-gray-700 mt-1">Are you sure you want to delete “{confirm.title}”? This can be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-xl border px-3 py-1 text-sm" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="rounded-xl border px-3 py-1 text-sm" onClick={() => deleteTask(confirm.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* IH#6: Next steps always visible at bottom */}
      <footer className="max-w-4xl mx-auto text-xs text-gray-600 mt-8">
        <p>
          Tip: Press <kbd>Enter</kbd> to add. Use the filter to find tasks quickly. You can undo accidental deletes.
        </p>
      </footer>
    </div>
  );
}