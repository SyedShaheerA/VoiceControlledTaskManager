import sqlite3
import sqlite3

def init_db():
    #Connect to the database file or create 'tasks.db' if it doesn't exist
    conn = sqlite3.connect('tasks.db')
    
    #Create a cursor object
    cursor = conn.cursor()

    #create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            time_context TEXT NOT NULL,
            status TEXT DEFAULT 'pending'
        )
    ''')

    #Commit changes and close the connection
    conn.commit()
    conn.close()




def get_db_connection():
    conn = sqlite3.connect('tasks.db')
    # makes rows act like dictionaries
    conn.row_factory = sqlite3.Row 
    return conn

def get_all_tasks():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE status = 'pending'")
    rows = cursor.fetchall()
    conn.close()
    
    # Convert rows to standard dictionaries
    return [dict(row) for row in rows]

def create_task(title, time_context):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # using '?' placeholders and not f-strings for SQL values to prevent injections.
    cursor.execute(
        "INSERT INTO tasks (title, time_context) VALUES (?, ?)", 
        (title, time_context)
    )
    
    conn.commit()
    conn.close()

def delete_task(task_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()

def update_task(task_id, new_time):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE tasks SET time_context = ? WHERE id = ?", 
        (new_time, task_id)
    )
    
    conn.commit()
    conn.close()


if __name__ == "__main__":
    init_db()
    print("Database and table created successfully!")