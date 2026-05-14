# 🎙️ Voice-Controlled Task Manager (AI Agent)

[cite_start]This is a professional AI Voice Assistant developed for the **Urban Ground** Software Engineer Assessment[cite: 1, 2]. [cite_start]The application enables users to manage their daily agenda exclusively through natural voice conversation, moving away from traditional manual CRUD interfaces[cite: 3, 9, 21].

### 🔗 Live Links
* **Live Demo (Frontend):** [https://syedshaheera.github.io/VoiceControlledTaskManager/](https://syedshaheera.github.io/VoiceControlledTaskManager/)
* [cite_start]**GitHub Repository:** [https://github.com/SyedShaheerA/VoiceControlledTaskManager](https://github.com/SyedShaheerA/VoiceControlledTaskManager) [cite: 173]
* [cite_start]**Backend API (Hugging Face Docker):** [https://huggingface.co/spaces/SyedShaheer/voice-task-backend/](https://huggingface.co/spaces/SyedShaheer/voice-task-backend/) [cite: 176, 198]
* [cite_start]**Demo Video:** [https://www.youtube.com/watch?v=sGiwQj3yR1E](https://www.youtube.com/watch?v=sGiwQj3yR1E) [cite: 175]

---

## 🌟 Key Features

* [cite_start]**Zero-UI CRUD**: Full task lifecycle management (Create, Read, Update, Delete) performed entirely through voice with no manual buttons or typing[cite: 4, 11, 14, 27].
* [cite_start]**Multi-Action Orchestration**: Capability to process multiple requests in a single command (e.g., "Schedule gym at 7 AM, a meeting at 9 AM, and post to LinkedIn at 11 AM")[cite: 134, 135, 138].
* [cite_start]**Semantic & Fuzzy Matching**: The assistant understands tasks by meaning (e.g., "workout" matches "Gym Session") and can resolve discrepancies in time-based requests[cite: 123, 126].
* [cite_start]**Contextual Memory**: Maintains conversation history, allowing users to use pronouns like "it" or "that one" when referring to previously mentioned tasks[cite: 70, 72, 82].
* **Noise-Robust Interruption**: Features a manual-trigger interruption model. [cite_start]Clicking the microphone button immediately halts the assistant's speech (TTS) to listen for a new command, ensuring reliability in noisy environments[cite: 127, 131, 133].
* [cite_start]**Safety Guardrails**: Automatically requests voice confirmation before performing destructive actions like deleting a task[cite: 90, 163].

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


### 3. Frontendd Setup
# Navigate to frontend folder
cd ../frontend

# Install dependencies
npm install

# Run the development server
npm run dev

## 🏗️ Architecture

### **Planner & Execution Agents**
[cite_start]The system is structured with specialized logic handlers to manage conversation flow and task execution [cite: 166-170]:
* **Conversation Agent**: Manages natural language responses and clarifies unclear user intents.
* **Execution Agent**: Interacts with the SQLite database to perform CRUD operations.
* **Semantic Processor**: Maps spoken concepts (e.g., "lunch," "meeting") to database entries using categorized keyword matching to ensure accurate task identification.

### **Reliability Expectations**
[cite_start]To meet Urban Ground's high standards for a "real AI voice agent," the system includes fallback responses for LLM timeouts and handles connection failures gracefully [cite: 21, 142, 157-159, 164-165].

---

## 📄 License
Copyright (c) 2026 Syed Shaheer Ali. All Rights Reserved.
*Submitted for the Urban Ground Software Engineer (Student) Take-Home Assessment.*

