# 🎙️ Voice-Controlled Task Manager (AI Agent)

This is a professional AI Voice Assistant developed for the **Urban Ground** Software Engineer Assessment. The application enables users to manage their daily agenda exclusively through natural voice conversation, moving away from traditional manual CRUD interfaces.

### 🔗 Live Links
* **Live Demo (Frontend):** https://syedshaheera.github.io/VoiceControlledTaskManager/
* **GitHub Repository:** https://github.com/SyedShaheerA/VoiceControlledTaskManager
* **Backend API (Hugging Face Docker):** https://huggingface.co/spaces/SyedShaheer/voice-task-backend/
* **Demo Video:** https://www.youtube.com/watch?v=sGiwQj3yR1E

---

## 🌟 Key Features

* **Zero-UI CRUD**: Full task lifecycle management (Create, Read, Update, Delete) performed entirely through voice with no manual buttons or typing.
* **Multi-Action Orchestration**: Capability to process multiple requests in a single command (e.g., "Schedule gym at 7 AM, a meeting at 9 AM, and post to LinkedIn at 11 AM").
* **Semantic & Fuzzy Matching**: The assistant understands tasks by meaning (e.g., "workout" matches "Gym Session") and can resolve discrepancies in time-based requests.
* **Contextual Memory**: Maintains conversation history, allowing users to use pronouns like "it" or "that one" when referring to previously mentioned tasks.
* **Noise-Robust Interruption**: Features a manual-trigger interruption model. Clicking the microphone button immediately halts the assistant's speech (TTS) to listen for a new command, ensuring reliability in noisy environments.
* **Safety Guardrails**: Automatically requests voice confirmation before performing destructive actions like deleting a task.

---

## 🛠️ Tech Stack

* **Backend**: FastAPI (Python 3.11)
* **AI Engine**: Google Gemini 1.5 Flash (utilizing `google-generativeai`)
* **Orchestration**: Custom **Model Manager** with sliding-window rate limiting and automatic model fallback for high reliability.
* **Database**: SQLite with automated schema migrations for persistent storage.
* **Frontend**: React (Vite) using the Web Speech API for native STT/TTS performance.

---

## 🚀 Local Setup

### 1. Prerequisites
* Python 3.11+
* Node.js (for frontend)
* A Google Gemini API Key

### 2. Backend Setup
```bash
# Navigate to backend folder
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Copy .env.example to .env and add your GEMINI_API_KEY
uvicorn main:app --reload --port 7860
```

### 3. Frontend Setup
```bash
# Navigate to frontend folder
cd ../frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

---

## 🏗️ Architecture

### **Planner & Execution Agents**
The system is structured with specialized logic handlers to manage conversation flow and task execution:

* **Conversation Agent**: Manages natural language responses and clarifies unclear user intents.
* **Execution Agent**: Interacts with the SQLite database to perform CRUD operations.
* **Semantic Processor**: Maps spoken concepts (e.g., "lunch," "meeting") to database entries using categorized keyword matching to ensure accurate task identification.

### **Reliability Expectations**
To meet Urban Ground's high standards for a "real AI voice agent," the system includes fallback responses for LLM timeouts and handles connection failures gracefully.

---

## 📄 License
Copyright (c) 2026 Syed Shaheer Ali. All Rights Reserved.  
*Submitted for the Urban Ground Software Engineer (Student) Take-Home Assessment.*
