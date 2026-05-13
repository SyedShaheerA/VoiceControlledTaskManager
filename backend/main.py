import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import google.generativeai as genai
from typing import List, Dict

from database import get_all_tasks, create_task, delete_task, update_task

load_dotenv()
genai.configure(api_key=os.environ["GEMINI_API_KEY"])


app = FastAPI()

# Setting up CORS so React can talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # all origin for local testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# # to get the exact shape of the data coming from React
# class ChatRequest(BaseModel):
#     text: str

# # Create the endpoint
# @app.post("/api/chat")
# async def chat_endpoint(request: ChatRequest):
#     # Log what the user said 
#     print(f"Received from React: {request.text}")
    
#     # Return the dummy JSON response back
#     return {"intent": "CHAT", "tts_response": "I heard you!"}


class ChatRequest(BaseModel):
    history: List[Dict[str, str]]
    # text: str


@app.get("/api/tasks")
async def get_tasks_endpoint():
    return get_all_tasks()



@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    
    latest_user_text = request.history[-1]["text"]
    print(f"Received from React: {latest_user_text}")
    
    # 1. Fetch current tasks from the SQLite database
    current_tasks = get_all_tasks()
    

    # 2. Convert the history array into a readable script for Gemini
    formatted_history = ""
    for msg in request.history:
        formatted_history += f"{msg['role'].upper()}: {msg['text']}\n"


    # 2. Build the strict System Prompt
    system_prompt = f"""
    You are an intelligent Voice Task Manager.
    
  
    Here are the user's current tasks from the database:
    {json.dumps(current_tasks)}

    Here is the recent conversation history:
    {formatted_history}
    
    Based on the conversation history and the LATEST user request, you must figure out what the user wants to do and output a strict JSON object.
    Do NOT use markdown formatting outside the JSON.

    Use this exact JSON schema:
    {{
        "intent": "UPDATE" | CREATE" | "DELETE" | "READ" | "CHAT",
        "entities": {{"title": "Task name here", "time_context": "Time here"}},
        "target_task_id": 123, 
        "tts_response": "What you should say back to the user naturally."
    }}
    
    Rules:
    - If intent is CREATE, fill out the entities.
    - If intent is UPDATE, provide the target_task_id AND the new time in entities.
    - If intent is DELETE, fill out target_task_id based on the database list.
    - If intent is READ, summarize the tasks in tts_response.
    """
    
    try:
        # 3. Call Gemini and force it to return JSON
        # model = genai.GenerativeModel(
        #     'gemini-2.5-flash', 
        # generation_config={"response_mime_type": "application/json"}
        # )
        # for m in genai.list_models():
        #     print(m.name)

        model = genai.GenerativeModel(
            # 'gemini-2.0-flash', 
            'gemini-3.1-flash-lite',
            # 'gemini-2.5-flash-lite',
            generation_config={"response_mime_type": "application/json"}
        )

        # model = genai.GenerativeModel('gemini-3.1-flash-live-preview')
        response = model.generate_content(system_prompt)
       

        # Parse Gemini's text response into a Python dictionary
        ai_decision = json.loads(response.text)
        print("Gemini Decision:", ai_decision)
        
        # 4. The Router: Execute the Database Actions!
        intent = ai_decision.get("intent")
        
        if intent == "CREATE":
            create_task(
                ai_decision["entities"]["title"], 
                ai_decision["entities"]["time_context"]
            )
        elif intent == "UPDATE":
            if ai_decision.get("target_task_id") and "time_context" in ai_decision.get("entities", {}):
                update_task(
                    ai_decision["target_task_id"], 
                    ai_decision["entities"]["time_context"]
                )
        elif intent == "DELETE":
            # Only delete if Gemini found a valid ID
            if ai_decision.get("target_task_id"):
                delete_task(ai_decision["target_task_id"])
                
        # 5. Send the exact JSON object back to the React frontend
        return ai_decision

    except Exception as e:
        print(f"Error during AI processing: {e}")
        return {
            "intent": "ERROR", 
            "tts_response": "Sorry, I had trouble processing that request."
        }