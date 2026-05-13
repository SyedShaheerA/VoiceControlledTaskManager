import sqlite3
from datetime import datetime, date, timedelta


# ─── Init ──────────────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect('tasks.db')
    cursor = conn.cursor()

    # Create table with new date_context column
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            title        TEXT    NOT NULL,
            time_context TEXT    NOT NULL,
            date_context TEXT    NOT NULL DEFAULT 'today',
            status       TEXT    DEFAULT 'pending'
        )
    ''')

    # Migrate existing DB: add date_context if it doesn't exist yet
    try:
        cursor.execute("ALTER TABLE tasks ADD COLUMN date_context TEXT NOT NULL DEFAULT 'today'")
        print("Migration: added date_context column.")
    except sqlite3.OperationalError:
        pass  # Column already exists — safe to ignore

    conn.commit()
    conn.close()


# ─── Helpers ───────────────────────────────────────────────────────────────────
def get_db_connection():
    conn = sqlite3.connect('tasks.db')
    conn.row_factory = sqlite3.Row
    return conn

def resolve_date(date_context: str) -> str:
    """
    Converts natural language date strings into ISO format (YYYY-MM-DD).
    Accepts: 'today', 'tomorrow', 'YYYY-MM-DD', or any existing value.
    Returns the resolved ISO date string, or the raw value if unrecognised.
    """
    if not date_context:
        return date.today().isoformat()

    normalised = date_context.strip().lower()

    if normalised == "today":
        return date.today().isoformat()
    elif normalised == "tomorrow":
        return (date.today() + timedelta(days=1)).isoformat()
    elif normalised == "yesterday":
        return (date.today() - timedelta(days=1)).isoformat()

    # Already an ISO date — return as-is
    try:
        datetime.strptime(date_context.strip(), "%Y-%m-%d")
        return date_context.strip()
    except ValueError:
        pass

    # Unrecognised — store raw so AI-generated strings like "next Monday" are kept
    return date_context.strip()


# ─── CRUD ──────────────────────────────────────────────────────────────────────
def get_all_tasks():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE status = 'pending' ORDER BY date_context, time_context")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_tasks_by_date(date_context: str):
    """Fetch pending tasks for a specific date (accepts 'today', 'tomorrow', or ISO date)."""
    resolved = resolve_date(date_context)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM tasks WHERE status = 'pending' AND date_context = ? ORDER BY time_context",
        (resolved,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def create_task(title: str, time_context: str, date_context: str = "today"):
    resolved_date = resolve_date(date_context)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO tasks (title, time_context, date_context) VALUES (?, ?, ?)",
        (title, time_context, resolved_date)
    )
    conn.commit()
    new_id = cursor.lastrowid
    conn.close()
    # Return the created task so main.py can track last_task_id
    return {"id": new_id, "title": title, "time_context": time_context, "date_context": resolved_date}


def delete_task(task_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()


def update_task(task_id: int, new_time: str = None, new_date: str = None, new_title: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()

    if new_time:
        cursor.execute("UPDATE tasks SET time_context = ? WHERE id = ?", (new_time, task_id))
    if new_date:
        resolved = resolve_date(new_date)
        cursor.execute("UPDATE tasks SET date_context = ? WHERE id = ?", (resolved, task_id))
    if new_title:
        cursor.execute("UPDATE tasks SET title = ? WHERE id = ?", (new_title, task_id))

    conn.commit()
    conn.close()


def complete_task(task_id: int):
    """Mark a task as done without deleting it."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE tasks SET status = 'done' WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("Database initialised successfully.")