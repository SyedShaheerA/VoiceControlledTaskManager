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

    system_prompt = f"""
You are an intelligent Voice Task Manager. You MUST handle multiple actions in a single response when the user asks for them.

{datetime_context}

{hint_block}

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
        "title":        "Task title — required for CREATE",
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
                    )
                    session["last_task_id"] = tid
                    matched = next((t for t in current_tasks if t.get("id") == tid), None)
                    session["last_task_title"] = matched["title"] if matched else None

            elif intent == "DELETE":
                if tid:
                    matched = next((t for t in current_tasks if t.get("id") == tid), None)
                    if matched:
                        # Ask for confirmation before deleting
                        session["pending_delete"] = tid
                        confirm_msg = (
                            f"Just to confirm — delete '{matched['title']}' "
                            f"at {matched['time_context']}? Say yes to confirm or no to cancel."
                        )
                        session["history"].append({"role": "agent", "text": confirm_msg})
                        return ChatResponse(
                            intent="CLARIFICATION",
                            tts_response=confirm_msg,
                            session_id=session_id,
                            model_used=model_used,
                        )

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