import torch
from transformers import pipeline
import json
import re

print("Loading local model...")
pipe = pipeline(
    "text-generation", 
    model="Qwen/Qwen2.5-0.5B-Instruct", 
    device="cpu", 
    torch_dtype=torch.bfloat16,
    clean_up_tokenization_spaces=False
)

current_tasks = []
chat_history = []
task_id_counter = 1

def extract_json(text):
    try:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        return None
    except:
        return None

scenarios = [
    "Create a task for syncing with the product manager at 10 AM.",
    "Create a task for posting on LinkedIn at 5 PM.",
    "Change the LinkedIn task to 6 PM.",
    "Actually change the previous one to 7 PM.",
    "Delete the 9:15 task."
]

for user_input in scenarios:
    print(f"\nUSER: {user_input}")

    # STRENGHTENED PROMPT
    prompt = f"""<|im_start|>system
You are a Task Manager. 
Current Database: {json.dumps(current_tasks)}
History: {json.dumps(chat_history[-2:])}

RULES:
1. ONLY use target_task_id from the Database list provided. NEVER make up an ID.
2. If the user mentions a task not in the DB, intent is CREATE.
3. If user says "previous one", find the ID of the last task we discussed.
4. If a specific time is mentioned (like 9:15) that isn't in the DB, use intent "CLARIFY".
5. Use "time" as a simple string like "10 AM". Do not add dates.

Schema:
{{"intent": "CREATE"|"UPDATE"|"DELETE"|"CLARIFY", "target_task_id": int|null, "entities": {{"title": "string", "time": "string"}}, "tts_response": "string"}}
<|im_end|>
<|im_start|>user
{user_input}
<|im_end|>
<|im_start|>assistant
"""

    # Fix: Remove max_length to stop the warning, use only max_new_tokens
    output = pipe(prompt, max_new_tokens=128, return_full_text=False, do_sample=False)
    ai_decision = extract_json(output[0]['generated_text'].strip())

    if not ai_decision:
        print("Model failed to generate JSON.")
        continue

    # --- LOGIC GATE ---
    intent = ai_decision.get("intent")
    
    # Validation: Don't let the model hallucinate IDs that don't exist
    valid_ids = [t['id'] for t in current_tasks]
    target_id = ai_decision.get("target_task_id")
    if target_id and target_id not in valid_ids and intent != "CREATE":
        ai_decision["intent"] = "CLARIFY"
        ai_decision["tts_response"] = f"I couldn't find a task with ID {target_id}. Which one did you mean?"
        intent = "CLARIFY"

    # Execute DB actions
    if intent == "CREATE":
        new_task = {"id": task_id_counter, "title": ai_decision['entities'].get('title'), "time": ai_decision['entities'].get('time')}
        current_tasks.append(new_task)
        task_id_counter += 1
    elif intent == "UPDATE":
        for t in current_tasks:
            if t["id"] == target_id:
                if ai_decision['entities'].get('time'): t["time"] = ai_decision['entities'].get('time')
    elif intent == "DELETE":
        current_tasks = [t for t in current_tasks if t["id"] != target_id]

    chat_history.append({"u": user_input, "id": target_id if intent != "CREATE" else task_id_counter-1})

    print(f"ASSISTANT: {ai_decision.get('tts_response')}")
    print(f"INTENT: {intent} | TARGET_ID: {target_id}")
    print(f"DB: {current_tasks}")