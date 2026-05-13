import os
import json
import uuid
from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from typing import Dict, Optional

from database import get_all_tasks, create_task, delete_task, update_task
from model_manager import model_manager   # ← new

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

# ─── Server-side Session Store ────────────────────────────────────────────────
sessions: Dict[str, Dict] = {}

def get_or_create_session(session_id: str) -> Dict:
    if session_id not in sessions:
        sessions[session_id] = {
            "history": [],
            "last_task_id": None,
        }
    return sessions[session_id]

# ─── Request / Response Models ────────────────────────────────────────────────
class ChatRequest(BaseModel):
    text: str

class ChatResponse(BaseModel):
    intent: str
    tts_response: str
    session_id: str
    model_used: str

# ─── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/api/tasks")
async def get_tasks_endpoint():
    return get_all_tasks()

@app.get("/api/models")
async def list_models_endpoint():
    """Returns live quota status for every model in the pool."""
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

    current_tasks = get_all_tasks()

    formatted_history = "\n".join(
        f"{m['role'].upper()}: {m['text']}" for m in session["history"]
    )

    last_task_hint = ""
    if session["last_task_id"] is not None:
        last_task_hint = (
            f"\nThe most recently referenced task had ID: {session['last_task_id']}. "
            f"If the user says 'the previous one', 'that task', 'it', etc., "
            f"use this ID unless they clearly mean something else."
        )

    system_prompt = f"""
You are an intelligent Voice Task Manager.

Current tasks in the database:
{json.dumps(current_tasks, indent=2)}

Conversation history (oldest → newest):
{formatted_history}
{last_task_hint}

Based on the LATEST user message, output a strict JSON object with NO markdown.

Schema:
{{
  "intent": "CREATE" | "UPDATE" | "DELETE" | "READ" | "CHAT",
  "entities": {{
    "title": "Task title (for CREATE or UPDATE title change)",
    "time_context": "New time string (for CREATE or UPDATE)"
  }},
  "target_task_id": <integer id from the database, or null>,
  "tts_response": "Natural spoken reply to the user."
}}

Rules:
- CREATE: fill entities.title and entities.time_context.
- UPDATE: fill target_task_id. Fill only the fields that change inside entities.
- DELETE: fill target_task_id. entities can be empty.
- READ: summarise tasks in tts_response. target_task_id is null.
- CHAT: general reply only.
- Resolve vague references ("the previous one", "that", "it") using history and last_task_id.
- Never invent task IDs. Only use IDs present in the database list above.
"""

    try:
        # Auto-selects best available model, falls back on 429
        response_text, model_used = model_manager.call_with_fallback(system_prompt)
        ai_decision = json.loads(response_text)
        print(f"[{session_id}] Decision ({model_used}):", ai_decision)

        intent   = ai_decision.get("intent", "CHAT")
        tid      = ai_decision.get("target_task_id")
        entities = ai_decision.get("entities", {})

        if intent == "CREATE":
            new_task = create_task(
                entities.get("title", "Untitled"),
                entities.get("time_context", ""),
            )
            if isinstance(new_task, dict) and "id" in new_task:
                session["last_task_id"] = new_task["id"]

        elif intent == "UPDATE":
            if tid:
                update_task(
                    tid,
                    new_time=entities.get("time_context"),
                )
                session["last_task_id"] = tid

        elif intent == "DELETE":
            if tid:
                delete_task(tid)
                if session["last_task_id"] == tid:
                    session["last_task_id"] = None

        session["history"].append({"role": "agent", "text": ai_decision["tts_response"]})

        return ChatResponse(
            intent=intent,
            tts_response=ai_decision["tts_response"],
            session_id=session_id,
            model_used=model_used,
        )

    except RuntimeError as e:
        # All models exhausted
        msg = "All AI models are currently rate-limited. Please wait a moment and try again."
        print(f"[{session_id}] {e}")
        session["history"].append({"role": "agent", "text": msg})
        return ChatResponse(intent="ERROR", tts_response=msg, session_id=session_id, model_used="none")

    except Exception as e:
        msg = "Sorry, I had trouble processing that request."
        print(f"[{session_id}] Error: {e}")
        session["history"].append({"role": "agent", "text": msg})
        return ChatResponse(intent="ERROR", tts_response=msg, session_id=session_id, model_used="unknown")