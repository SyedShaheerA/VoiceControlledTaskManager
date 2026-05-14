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
            "history":          [],
            "last_task_id":     None,
            "last_task_title":  None,
            # Tracks the ordered list of tasks from the most recent READ
            # so "the second one", "the first one", etc. can be resolved
            "last_read_tasks":  [],
        }
    return sessions[session_id]

# ─── Models ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    text: str

class ChatResponse(BaseModel):
    intent:     str
    tts_response: str
    session_id: str
    model_used: str

# ─── Helpers ───────────────────────────────────────────────────────────────────
def get_current_datetime_context() -> str:
    """Inject real date/time so Gemini can resolve 'today', 'tomorrow', 'evening'."""
    now = datetime.now()
    return (
        f"Current date : {now.strftime('%A, %B %d, %Y')}\n"
        f"Current time : {now.strftime('%I:%M %p')}\n"
        f"Time periods : morning = before 12 PM, afternoon = 12–5 PM, "
        f"evening = 5–9 PM, night = after 9 PM"
    )

def build_last_task_hint(session: Dict) -> str:
    parts = []

    # Hint 1: last individually referenced task (UPDATE / DELETE context)
    if session["last_task_id"] is not None:
        lid    = session["last_task_id"]
        ltitle = session.get("last_task_title") or f"ID {lid}"
        parts.append(
            f"*** CRITICAL CONTEXT ***\n"
            f"The LAST task the user explicitly referenced was: '{ltitle}' (ID: {lid}).\n"
            f"If the user says ANYTHING vague — 'the previous one', 'that one', 'it',\n"
            f"'actually', 'change that', 'change it', 'move it' — you MUST use "
            f"target_task_id: {lid}.\n"
            f"Do NOT pick a different task unless the user explicitly names one by title.\n"
            f"*** END CRITICAL CONTEXT ***"
        )

    # Hint 2: ordered list from most recent READ (positional references)
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
            f"resolve the position from this list and use that task's ID.\n"
            f"*** END LAST READ LIST ***"
        )

    return "\n\n".join(parts)

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

    current_tasks     = get_all_tasks()
    datetime_context  = get_current_datetime_context()
    formatted_history = "\n".join(
        f"{m['role'].upper()}: {m['text']}" for m in session["history"]
    )
    hint_block = build_last_task_hint(session)

    system_prompt = f"""
You are an intelligent Voice Task Manager. You can handle MULTIPLE actions in one request.

{datetime_context}

{hint_block}

Current tasks in the database:
{json.dumps(current_tasks, indent=2)}

Conversation history (oldest → newest):
{formatted_history}

Based on the LATEST user message, output a strict JSON object with NO markdown.

Schema:
{{
"actions": [
  {{
  "intent": "CREATE" | "UPDATE" | "DELETE" | "READ" | "CHAT",
  "entities": {{
    "title": "Task title (CREATE only)",
    "time_context": "Time string e.g. '6:00 PM' (CREATE or UPDATE)",
    "date_context": "Date string e.g. 'today', 'tomorrow', or 'YYYY-MM-DD' (CREATE or UPDATE)",
    "time_filter": "morning | afternoon | evening | night | today | tomorrow | all | null"
  }}
}}],
  "target_task_id": <integer id from the database, or null>,
  "read_task_ids": [list of integer IDs included in this READ response, in the order mentioned],
  "tts_response": "A single natural combined response for all actions."
}}

Rules:
- CREATE : fill entities.title, entities.time_context, and entities.date_context (default to today if not specified).
- UPDATE : fill target_task_id. Fill only changed fields in entities (time_context and/or date_context).
- DELETE : fill target_task_id only.
- READ   : Use entities.time_filter to filter tasks by time period.
           Summarise conversationally, e.g. 'You have a sync at 6 PM and a LinkedIn post at 8 PM.'
           Fill read_task_ids with the IDs of tasks you mention, in the order you mention them.
           Do NOT just recite a flat list — speak naturally.
- CHAT   : general reply, no task action.

Time-filter logic (use the current date/time provided above):
- 'today'     → all tasks with no date or today's date
- 'tomorrow'  → tasks explicitly scheduled for tomorrow
- 'morning'   → tasks before 12 PM
- 'afternoon' → tasks 12 PM – 5 PM
- 'evening'   → tasks 5 PM – 9 PM
- 'night'     → tasks after 9 PM
- 'all'       → no filter

Positional references ('the first one', 'the second one', 'the last one'):
- Resolve using the LAST READ LIST in the hint block above.
- Never invent task IDs — only use IDs present in the database list.
"""

    try:
        pending_delete = session.get("pending_delete")

        if pending_delete:
            # Clean the string but keep it intact to preserve the order
            user_reply = request.text.lower()
            for p in ".,!?;:'\"":
                user_reply = user_reply.replace(p, "")
            
            # Pad the reply with spaces so we can match whole words cleanly
            padded_reply = f" {user_reply} "

            confirm_triggers = ["yes", "yeah", "yep", "sure", "ok", "okay", "confirm", "please", "do it", "go ahead"]
            cancel_triggers  = ["no", "cancel", "stop", "nevermind", "never mind", "dont", "wait"]

            # Find the highest index (right-most position) of any matching trigger
            # We wrap the trigger in spaces e.g., " ok " so it doesn't match inside " joke "
            last_confirm_idx = max([padded_reply.rfind(f" {w} ") for w in confirm_triggers] + [-1])
            last_cancel_idx  = max([padded_reply.rfind(f" {w} ") for w in cancel_triggers] + [-1])

            # If neither was found, the user changed the subject entirely
            if last_confirm_idx == -1 and last_cancel_idx == -1:
                session["pending_delete"] = None

            # If the last thing they said was a confirmation ("... never mind go ahead")
            elif last_confirm_idx > last_cancel_idx:
                matched = next(
                    (t for t in get_all_tasks() if t["id"] == pending_delete),
                    None
                )

                if matched:
                    delete_task(pending_delete)
                    session["pending_delete"] = None

                    return ChatResponse(
                        intent="DELETE",
                        tts_response=(
                            f"I've deleted the task '{matched['title']}' "
                            f"scheduled for {matched['time_context']}."
                        ),
                        session_id=session_id,
                        model_used="confirmation-handler",
                    )
            
            # If cancel is last ("... sure, actually wait no")
            else:
                session["pending_delete"] = None
                return ChatResponse(
                    intent="CHAT",
                    tts_response="Okay, I've canceled the deletion. The task is still there.",
                    session_id=session_id,
                    model_used="confirmation-handler",
                )

        # if pending_delete:
        #     # Strip both whitespace AND common punctuation
        #     user_reply = request.text.lower().strip(" .!?,;'\"")

        #     confirm_words = ["yes", "yeah", "yep", "sure", "ok", "okay", "confirm", "please"]
        #     cancel_words  = ["no", "cancel", "stop", "never mind", "nevermind"]

        #     if user_reply in confirm_words:
        #         matched = next(
        #             (t for t in get_all_tasks() if t["id"] == pending_delete),
        #             None
        #         )

        #         if matched:
        #             delete_task(pending_delete)
        #             session["pending_delete"] = None

        #             return ChatResponse(
        #                 intent="DELETE",
        #                 tts_response=(
        #                     f"I've deleted the task '{matched['title']}' "
        #                     f"scheduled for {matched['time_context']}."
        #                 ),
        #                 session_id=session_id,
        #                 model_used="confirmation-handler",
        #             )

        #     elif user_reply in cancel_words:
        #         session["pending_delete"] = None

        #         return ChatResponse(
        #             intent="CHAT",
        #             tts_response="Okay, I won't delete anything.",
        #             session_id=session_id,
        #             model_used="confirmation-handler",
        #         )
        #     else:
        #         # CRITICAL: If the user says something entirely different, 
        #         # clear the pending delete state so the app doesn't get stuck.
        #         session["pending_delete"] = None

        response_text, model_used = model_manager.call_with_fallback(system_prompt)
        ai_decision = json.loads(response_text)

        actions = ai_decision.get("actions", [])
        last_intent = "CHAT"

        print(f"[{session_id}] Decision ({model_used}):", ai_decision)

        for action in actions:
            intent   = ai_decision.get("intent")
            last_intent = intent
            tid      = ai_decision.get("target_task_id")
            entities = ai_decision.get("entities", {})

            # ── Execute DB action ──────────────────────────────────────────────────
            if intent == "CREATE":
                task_title = entities.get("title", "Untitled")
                new_task   = create_task(task_title, entities.get("time_context", ""), entities.get("date_context", "today"))
                if isinstance(new_task, dict) and "id" in new_task:
                    session["last_task_id"]    = new_task["id"]
                    session["last_task_title"] = task_title

            elif intent == "UPDATE":
                if tid:
                    update_task(tid, new_time=entities.get("time_context"), new_date=entities.get("date_context"))
                    session["last_task_id"] = tid
                    matched = next((t for t in current_tasks if t.get("id") == tid), None)
                    session["last_task_title"] = matched["title"] if matched else None

            elif intent == "DELETE":                
                if tid:
                    matched = next((t for t in current_tasks if t.get("id") == tid), None)

                    requested_time = request.text.lower()

                    # Verify the requested time actually exists in matched task
                    if matched and matched.get("time_context"):
                        actual_time = matched["time_context"].lower()

                        if actual_time not in requested_time:
                            # Save pending delete confirmation
                            session["pending_delete"] = tid
                            
                            return ChatResponse(
                                intent="CLARIFICATION",
                                tts_response=(
                                    f"I couldn't find a task at that exact time. "
                                    f"Did you mean the task at {matched['time_context']}?"
                                ),
                                session_id=session_id,
                                model_used=model_used,
                            )

                    delete_task(tid)
            elif intent == "READ":
                # Store the ordered task list so positional follow-ups work
                read_ids = ai_decision.get("read_task_ids", [])
                if read_ids:
                    id_to_task = {t["id"]: t for t in current_tasks}
                    session["last_read_tasks"] = [
                        id_to_task[rid] for rid in read_ids if rid in id_to_task
                    ]
                    # Also set last_task as the final one mentioned (for 'that one' follow-ups)
                    last = session["last_read_tasks"][-1]
                    session["last_task_id"]    = last["id"]
                    session["last_task_title"] = last["title"]

            session["history"].append({"role": "agent", "text": ai_decision["tts_response"]})

        return ChatResponse(
            intent=intent,
            tts_response=ai_decision["tts_response"],
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