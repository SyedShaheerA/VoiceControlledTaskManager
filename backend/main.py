import os
import json
import uuid
from datetime import datetime
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from typing import Dict, Optional, List

from database import get_all_tasks, create_task, delete_task, update_task
from model_manager import model_manager

load_dotenv()
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Session Store ─────────────────────────────────────────────────────────────
sessions: Dict[str, Dict] = {}

def get_or_create_session(session_id: str) -> Dict:
    if session_id not in sessions:
        sessions[session_id] = {
            "history":         [],
            "last_task_id":    None,
            "last_task_title": None,
            "last_read_tasks": [],
            "pending_delete":  None,   # task_id awaiting confirmation
        }
    return sessions[session_id]

# ─── Request / Response Models ─────────────────────────────────────────────────
class ChatRequest(BaseModel):
    text: str

class ChatResponse(BaseModel):
    intent:       str
    tts_response: str
    session_id:   str
    model_used:   str

# ─── Helpers ───────────────────────────────────────────────────────────────────
def get_current_datetime_context() -> str:
    now = datetime.now()
    return (
        f"Current date : {now.strftime('%A, %B %d, %Y')}\n"
        f"Current time : {now.strftime('%I:%M %p')}\n"
        f"Time periods : morning = before 12 PM | afternoon = 12–5 PM | "
        f"evening = 5–9 PM | night = after 9 PM"
    )

def build_last_task_hint(session: Dict) -> str:
    parts = []

    if session["last_task_id"] is not None:
        lid    = session["last_task_id"]
        ltitle = session.get("last_task_title") or f"ID {lid}"
        parts.append(
            f"*** CRITICAL CONTEXT ***\n"
            f"The LAST task the user explicitly referenced was: '{ltitle}' (ID: {lid}).\n"
            f"If the user says ANYTHING vague — 'the previous one', 'that one', 'it',\n"
            f"'actually', 'change that', 'change it', 'move it' — you MUST use "
            f"target_task_id: {lid} in that action.\n"
            f"Do NOT pick a different task unless the user explicitly names one by title.\n"
            f"*** END CRITICAL CONTEXT ***"
        )

    last_read = session.get("last_read_tasks", [])
    if last_read:
        ordered = "\n".join(
            f"  Position {i+1}: '{t['title']}' at {t['time_context']} (ID: {t['id']})"
            for i, t in enumerate(last_read)
        )
        parts.append(
            f"*** LAST READ LIST ***\n"
            f"The assistant just listed these tasks in this order:\n{ordered}\n"
            f"If the user says 'the first one', 'the second one', 'the last one', etc.,\n"
            f"resolve from this list and use that task's ID in the relevant action.\n"
            f"*** END LAST READ LIST ***"
        )

    return "\n\n".join(parts)


# ─── Semantic category map ─────────────────────────────────────────────────────
# Maps common spoken concepts → keywords likely found in task titles
SEMANTIC_CATEGORIES = {
    "workout":    ["workout", "gym", "exercise", "run", "running", "training", "fitness",
                   "yoga", "pilates", "crossfit", "lift", "weights", "jog", "swim", "cycling", "bike"],
    "meeting":    ["meeting", "meet", "sync", "call", "standup", "stand-up", "catch-up",
                   "catchup", "1:1", "one on one", "interview", "review", "session"],
    "linkedin":   ["linkedin", "post", "social", "content", "publish", "share"],
    "email":      ["email", "mail", "inbox", "reply", "respond", "message"],
    "lunch":      ["lunch", "eat", "food", "meal", "dinner", "breakfast", "coffee", "cafe"],
    "doctor":     ["doctor", "dentist", "appointment", "checkup", "clinic", "hospital", "physio"],
    "study":      ["study", "read", "reading", "course", "class", "lecture", "homework", "revision"],
    "errand":     ["errand", "shop", "shopping", "grocery", "groceries", "bank", "pickup"],
    "travel":     ["travel", "flight", "commute", "drive", "uber", "taxi", "train", "bus"],
}

def build_semantic_hint(user_text: str, tasks: list) -> str:
    """
    Detects semantic concepts in the user utterance and finds tasks
    whose titles match those concepts. Injects a targeted hint so
    Gemini can resolve vague references like 'my evening workout'.
    """
    text_lower = user_text.lower()
    matched_tasks = {}  # task_id → task

    for concept, keywords in SEMANTIC_CATEGORIES.items():
        if any(kw in text_lower for kw in keywords):
            # Find tasks whose title contains any keyword from this category
            for task in tasks:
                title_lower = task["title"].lower()
                if any(kw in title_lower for kw in keywords):
                    matched_tasks[task["id"]] = task

    # Also apply time-period narrowing from the utterance
    time_filters = {
        "morning":   lambda t: (parse_minutes(t) or 9999) < 720,    # before 12:00
        "afternoon": lambda t: 720 <= (parse_minutes(t) or 0) < 1020,
        "evening":   lambda t: 1020 <= (parse_minutes(t) or 0) < 1260,
        "night":     lambda t: (parse_minutes(t) or 0) >= 1260,
    }
    active_filter = None
    for period, fn in time_filters.items():
        if period in text_lower:
            active_filter = fn
            break

    if active_filter and matched_tasks:
        narrowed = {
            tid: t for tid, t in matched_tasks.items()
            if active_filter(t.get("time_context", ""))
        }
        if narrowed:
            matched_tasks = narrowed

    if not matched_tasks:
        return ""

    task_list = "\n".join(
        f"  - '{t['title']}' at {t['time_context']} on {t.get('date_context','today')} (ID: {t['id']})"
        for t in matched_tasks.values()
    )
    return (
        f"\n\n*** SEMANTIC MATCH ***"
        f"\nThe user said '{user_text}'. Based on semantic analysis, the most likely "
        f"task(s) they are referring to:\n{task_list}"
        f"\nUse the ID from this list as target_task_id. If only one match, use it directly."
        f"\nIf multiple matches exist, pick the one that best fits the time period mentioned."
        f"\n*** END SEMANTIC MATCH ***"
    )

def resolve_confirmation(text: str) -> Optional[bool]:
    """
    Returns True = confirmed, False = cancelled, None = unrelated input.
    Detects the LAST matching word so 'actually wait no' correctly cancels.
    """
    cleaned = text.lower()
    for p in ".,!?;:'\"": cleaned = cleaned.replace(p, "")
    padded = f" {cleaned} "

    confirms = ["yes","yeah","yep","sure","ok","okay","confirm","please","do it","go ahead","delete it"]
    cancels  = ["no","nope","cancel","stop","nevermind","never mind","dont","wait","keep it"]

    last_confirm = max([padded.rfind(f" {w} ") for w in confirms] + [-1])
    last_cancel  = max([padded.rfind(f" {w} ") for w in cancels]  + [-1])

    if last_confirm == -1 and last_cancel == -1:
        return None
    return last_confirm > last_cancel


def parse_minutes(time_str: str) -> Optional[int]:
    """Convert a time string like '11:05 AM', '9 PM', '14:30' to total minutes since midnight."""
    import re
    if not time_str:
        return None
    s = time_str.strip().upper()
    # Try HH:MM AM/PM
    m = re.match(r"(\d{1,2}):(\d{2})\s*(AM|PM)?", s)
    if m:
        h, mn, period = int(m.group(1)), int(m.group(2)), m.group(3)
        if period == "PM" and h != 12: h += 12
        if period == "AM" and h == 12: h = 0
        return h * 60 + mn
    # Try H AM/PM (no minutes)
    m = re.match(r"(\d{1,2})\s*(AM|PM)", s)
    if m:
        h, period = int(m.group(1)), m.group(2)
        if period == "PM" and h != 12: h += 12
        if period == "AM" and h == 12: h = 0
        return h * 60
    return None

def find_closest_task(requested_time: str, tasks: list, threshold_minutes: int = 60) -> Optional[dict]:
    """
    Returns the task whose time_context is closest to requested_time,
    only if within threshold_minutes. Returns None if no close match.
    """
    req_mins = parse_minutes(requested_time)
    if req_mins is None:
        return None

    best_task  = None
    best_delta = threshold_minutes + 1

    for task in tasks:
        task_mins = parse_minutes(task.get("time_context", ""))
        if task_mins is None:
            continue
        delta = abs(task_mins - req_mins)
        if delta < best_delta:
            best_delta = delta
            best_task  = task

    return best_task if best_task else None

# ─── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/api/tasks")
async def get_tasks_endpoint():
    return get_all_tasks()

@app.get("/api/models")
async def list_models_endpoint():
    return {"models": model_manager.status()}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    x_session_id: Optional[str] = Header(default=None),
):
    session_id = x_session_id or str(uuid.uuid4())
    session    = get_or_create_session(session_id)

    session["history"].append({"role": "user", "text": request.text})
    print(f"[{session_id}] User: {request.text}")

    # ── Pending delete confirmation check ──────────────────────────────────────
    if session["pending_delete"] is not None:
        confirmed = resolve_confirmation(request.text)
        pending_id = session["pending_delete"]

        if confirmed is True:
            matched = next((t for t in get_all_tasks() if t["id"] == pending_id), None)
            session["pending_delete"] = None
            if matched:
                delete_task(pending_id)
                if session["last_task_id"] == pending_id:
                    session["last_task_id"]    = None
                    session["last_task_title"] = None
                msg = f"Done, I've deleted '{matched['title']}' scheduled at {matched['time_context']}."
            else:
                msg = "That task no longer exists."
            session["history"].append({"role": "agent", "text": msg})
            return ChatResponse(intent="DELETE", tts_response=msg, session_id=session_id, model_used="confirmation-handler")

        elif confirmed is False:
            session["pending_delete"] = None
            msg = "Got it, I'll keep the task. Anything else?"
            session["history"].append({"role": "agent", "text": msg})
            return ChatResponse(intent="CHAT", tts_response=msg, session_id=session_id, model_used="confirmation-handler")

        else:
            # User changed subject — clear pending and fall through to normal AI flow
            session["pending_delete"] = None

    # ── Build prompt ───────────────────────────────────────────────────────────
    current_tasks     = get_all_tasks()
    datetime_context  = get_current_datetime_context()
    formatted_history = "\n".join(f"{m['role'].upper()}: {m['text']}" for m in session["history"])
    hint_block        = build_last_task_hint(session)

    # ── Pre-resolve 1: fuzzy time match ──────────────────────────────────────
    import re as _re
    _time_pat = _re.search(
        r"\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b", request.text
    )
    _fuzzy_hint = ""
    if _time_pat:
        _req_time = _time_pat.group(1)
        _req_mins = parse_minutes(_req_time)
        _exact = any(
            parse_minutes(t.get("time_context","")) == _req_mins
            for t in current_tasks
        )
        if not _exact and _req_mins is not None:
            _closest = find_closest_task(_req_time, current_tasks, threshold_minutes=90)
            if _closest:
                _fuzzy_hint = (
                    f"\n*** FUZZY TIME MATCH ***"
                    f"\nThe user asked about a task at {_req_time} but NO task exists at that exact time."
                    f"\nThe CLOSEST task is: '{_closest['title']}' at {_closest['time_context']} (ID: {_closest['id']})."
                    f"\nIf the user intent is DELETE or UPDATE, use ID {_closest['id']} as target_task_id."
                    f"\nDo NOT say the task was not found. Instead use this closest match."
                    f"\n*** END FUZZY TIME MATCH ***"
                )

    # ── Pre-resolve 2: semantic concept match ─────────────────────────────────
    _semantic_hint = build_semantic_hint(request.text, current_tasks)

    system_prompt = f"""
You are an intelligent Voice Task Manager. You MUST handle multiple actions in a single response when the user asks for them.

{datetime_context}

{hint_block}{_fuzzy_hint}{_semantic_hint}

Current tasks in the database:
{json.dumps(current_tasks, indent=2)}

Conversation history (oldest → newest):
{formatted_history}

Output a strict JSON object with NO markdown. Each action in the "actions" array is independent.

Schema:
{{
  "actions": [
    {{
      "intent": "CREATE" | "UPDATE" | "DELETE" | "READ" | "CHAT",
      "target_task_id": <integer task ID for UPDATE/DELETE, or null>,
      "entities": {{
        "title":        "Task title — required for CREATE, optional for UPDATE (if renaming)",
        "time_context": "e.g. '7:00 AM' — required for CREATE, optional for UPDATE",
        "date_context": "e.g. 'today', 'tomorrow', 'YYYY-MM-DD' — required for CREATE, optional for UPDATE",
        "time_filter":  "morning|afternoon|evening|night|today|tomorrow|all — READ only"
      }},
      "read_task_ids": [ordered list of task IDs mentioned — READ only, else omit]
    }}
  ],
  "tts_response": "A single natural spoken reply covering ALL actions together."
}}

Rules — READ CAREFULLY:
1. MULTI-ACTION: If the user requests N things (e.g. 3 tasks, or create + delete), produce N action objects.
   Example: "Gym at 7, sync at 9, LinkedIn at 11 tomorrow" → 3 CREATE actions.
   Example: "Delete LinkedIn and add a call at 4 PM" → 1 DELETE + 1 CREATE action.

2. CREATE: Every CREATE action needs its own title, time_context, date_context (default 'today').

3. UPDATE: target_task_id goes INSIDE the action object. Only fill changed entity fields.

4. DELETE: target_task_id goes INSIDE the action object. Set entities to {{}}.
   Only use IDs that exist in the database list. Never invent IDs.

5. READ: Use time_filter to select which tasks to mention. Speak naturally, not as a list.
   Fill read_task_ids in the order you mention them.

6. tts_response is ONE combined reply for everything, e.g.:
   "Done! I've added Gym at 7 AM, Team sync at 9 AM, and LinkedIn post at 11 AM — all for tomorrow morning."

7. Vague references ('the previous one', 'it', 'that', 'the second one'):
   Resolve using the CRITICAL CONTEXT and LAST READ LIST hints above.
   Never invent task IDs.

8. Semantic references ('my workout', 'the meeting', 'evening run', 'the LinkedIn thing'):
   Resolve using the SEMANTIC MATCH hint above when present.
   Match by concept, not exact wording — 'gym session' matches a task called 'Morning Workout'.
   If a time period is mentioned ('evening workout'), use it to narrow among multiple matches.
   Always prefer the SEMANTIC MATCH hint ID over guessing from the task title alone.

Time-filter reference:
- morning   → before 12 PM
- afternoon → 12 PM – 5 PM
- evening   → 5 PM – 9 PM
- night     → after 9 PM
- today / tomorrow → by date
- all       → no filter
"""

    try:
        response_text, model_used = model_manager.call_with_fallback(system_prompt)
        ai_decision  = json.loads(response_text)
        actions      = ai_decision.get("actions", [])
        tts_response = ai_decision.get("tts_response", "Done.")

        print(f"[{session_id}] Decision ({model_used}) — {len(actions)} action(s):", ai_decision)

        last_intent = "CHAT"

        for action in actions:
            intent   = action.get("intent", "CHAT")
            tid      = action.get("target_task_id")
            entities = action.get("entities", {})
            last_intent = intent

            if intent == "CREATE":
                task_title = entities.get("title", "Untitled")
                new_task   = create_task(
                    task_title,
                    entities.get("time_context", ""),
                    entities.get("date_context", "today"),
                )
                if isinstance(new_task, dict) and "id" in new_task:
                    session["last_task_id"]    = new_task["id"]
                    session["last_task_title"] = task_title

            elif intent == "UPDATE":
                if tid:
                    update_task(
                        tid,
                        new_time=entities.get("time_context"),
                        new_date=entities.get("date_context"),
                        new_title=entities.get("title"),  # <-- ADD THIS LINE
                    )
                    session["last_task_id"] = tid
                    matched = next((t for t in current_tasks if t.get("id") == tid), None)
                    session["last_task_title"] = matched["title"] if matched else None

            elif intent == "DELETE":
                import re as _re2
                # ── Step 1: exact match by ID Gemini provided ──────────────────
                matched = next((t for t in current_tasks if t.get("id") == tid), None) if tid else None

                # ── Step 2: fallback — fuzzy match from raw utterance ──────────
                if not matched:
                    _tp = _re2.search(r"\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b", request.text)
                    _rts = _tp.group(1) if _tp else ""
                    matched = find_closest_task(_rts, current_tasks, threshold_minutes=90) if _rts else None

                if matched:
                    # ── Step 3: always confirm before deleting ─────────────────
                    req_time_str = ""
                    _tp2 = _re2.search(r"\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b", request.text)
                    if _tp2:
                        req_time_str = _tp2.group(1)

                    exact_match = parse_minutes(req_time_str) == parse_minutes(matched["time_context"]) if req_time_str else True

                    if exact_match:
                        confirm_msg = (
                            f"Just to confirm — delete '{matched['title']}' "
                            f"at {matched['time_context']}? Say yes to confirm or no to cancel."
                        )
                    else:
                        confirm_msg = (
                            f"I couldn't find a task at {req_time_str}. "
                            f"Did you mean '{matched['title']}' at {matched['time_context']}? "
                            f"Say yes to delete it or no to cancel."
                        )

                    session["pending_delete"] = matched["id"]
                    session["history"].append({"role": "agent", "text": confirm_msg})
                    return ChatResponse(
                        intent="CLARIFICATION",
                        tts_response=confirm_msg,
                        session_id=session_id,
                        model_used=model_used,
                    )
                # else: nothing found at all — fall through, AI tts_response handles it

            elif intent == "READ":
                read_ids   = action.get("read_task_ids", [])
                id_to_task = {t["id"]: t for t in current_tasks}
                if read_ids:
                    session["last_read_tasks"] = [
                        id_to_task[rid] for rid in read_ids if rid in id_to_task
                    ]
                    if session["last_read_tasks"]:
                        last = session["last_read_tasks"][-1]
                        session["last_task_id"]    = last["id"]
                        session["last_task_title"] = last["title"]

        session["history"].append({"role": "agent", "text": tts_response})

        return ChatResponse(
            intent=last_intent,
            tts_response=tts_response,
            session_id=session_id,
            model_used=model_used,
        )

    except RuntimeError as e:
        msg = "All AI models are currently rate-limited. Please wait a moment and try again."
        print(f"[{session_id}] {e}")
        session["history"].append({"role": "agent", "text": msg})
        return ChatResponse(intent="ERROR", tts_response=msg, session_id=session_id, model_used="none")

    except Exception as e:
        msg = "Sorry, I had trouble processing that request."
        print(f"[{session_id}] Error: {e}")
        session["history"].append({"role": "agent", "text": msg})
        return ChatResponse(intent="ERROR", tts_response=msg, session_id=session_id, model_used="unknown")