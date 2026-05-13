import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

function App() {
  const [isListening, setIsListening]   = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [agentResponse, setAgentResponse]   = useState("Waiting for you to speak...");
  const [tasks, setTasks]               = useState([]);
  const [modelUsed, setModelUsed]       = useState("");

  const recognitionRef = useRef(null);
  const transcriptRef  = useRef("");
  const sessionIdRef   = useRef(null);   // server-side session ID

  // ── Fetch tasks ─────────────────────────────────────────────────────────────
  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // ── TTS ──────────────────────────────────────────────────────────────────────
  const speakText = useCallback((text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    setAgentResponse(text);
  }, []);

  // ── Send to backend ──────────────────────────────────────────────────────────
  const sendToBackend = useCallback(async (text) => {
    try {
      setAgentResponse("Thinking...");

      const headers = { 'Content-Type': 'application/json' };
      if (sessionIdRef.current) {
        headers['X-Session-ID'] = sessionIdRef.current;
      }

      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),   // just the utterance — server owns history
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      // Persist session ID for subsequent requests
      if (data.session_id) {
        sessionIdRef.current = data.session_id;
      }

      if (data.model_used) {
        setModelUsed(data.model_used);
      }

      speakText(data.tts_response);
      fetchTasks();

    } catch (error) {
      console.error("Error talking to backend:", error);
      speakText("Sorry, I lost connection to the server.");
    }
  }, [speakText, fetchTasks]);

  // ── Speech recognition ───────────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support the Web Speech API. Please use Google Chrome.");
      return;
    }

    const recognition         = new SpeechRecognition();
    recognition.continuous    = false;
    recognition.interimResults = true;
    recognition.lang          = 'en-US';

    recognition.onresult = (event) => {
      window.speechSynthesis.cancel();
      setAgentResponse("Listening...");

      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }

      setUserTranscript(currentTranscript);
      transcriptRef.current = currentTranscript;
    };

    recognition.onend = () => {
      setIsListening(false);
      const finalUtterance = transcriptRef.current.trim();
      if (finalUtterance !== "") {
        sendToBackend(finalUtterance);
        transcriptRef.current = "";
      }
    };

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [sendToBackend]);

  // ── Toggle mic ───────────────────────────────────────────────────────────────
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      window.speechSynthesis.cancel();
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Microphone error:", error);
      }
    }
  };

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <h1>Voice Task Manager</h1>

      <div className="status-box">
        <p><strong>You said:</strong> {userTranscript || "—"}</p>
        <p><strong>Agent says:</strong> {agentResponse}</p>
        {modelUsed && (
          <p style={{ fontSize: '12px', color: '#888' }}>
            Model: {modelUsed}
          </p>
        )}
      </div>

      <button
        onClick={toggleListening}
        style={{
          backgroundColor: isListening ? 'red' : 'green',
          color: 'white',
          padding: '15px',
          fontSize: '18px',
          borderRadius: '50px',
          marginBottom: '20px',
          cursor: 'pointer',
          border: 'none',
        }}
      >
        {isListening ? "🎙 Stop Listening" : "🎤 Start Listening"}
      </button>

      <div className="task-list">
        <h2>Your Agenda</h2>
        {tasks.length === 0 ? (
          <p style={{ color: '#888' }}>No tasks scheduled yet.</p>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              className="task-item"
              style={{
                padding: '15px',
                border: '1px solid #ddd',
                margin: '10px 0',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                background: '#fff',
              }}
            >
              <span style={{ fontWeight: 'bold' }}>{task.title}</span>
              <span style={{ color: '#555' }}>{task.time_context}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default App;


// import { useState, useRef, useEffect } from 'react';
// import './App.css'; 

// function App() {
//   const [isListening, setIsListening] = useState(false);
//   const [userTranscript, setUserTranscript] = useState("");
//   const [agentResponse, setAgentResponse] = useState("Waiting for you to speak...");
  
//   const [tasks, setTasks] = useState([]);
//   const [chatHistory, setChatHistory] = useState([]);

//   const recognitionRef = useRef(null);
//   const transcriptRef = useRef(""); 
  
//   // 1. ADDED: A ref to secretly hold the chat history so the mic doesn't crash
//   const chatHistoryRef = useRef([]);

//   // 2. Keep the ref perfectly synced with the state
//   useEffect(() => {
//     chatHistoryRef.current = chatHistory;
//   }, [chatHistory]);

//   const fetchTasks = async () => {
//     try {
//       const response = await fetch('http://localhost:8000/api/tasks');
//       if (response.ok) {
//         const data = await response.json();
//         setTasks(data); 
//       }
//     } catch (error) {
//       console.error("Error fetching tasks:", error);
//     }
//   };

//   useEffect(() => {
//     fetchTasks();
//   }, []);

//   const speakText = (text) => {
//     window.speechSynthesis.cancel(); 
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.rate = 1.0; 
//     utterance.pitch = 1.0;
//     window.speechSynthesis.speak(utterance);
//     setAgentResponse(text);
//   };

//   const toggleListening = () => {
//     if (isListening) {
//       recognitionRef.current.stop();
//       setIsListening(false);
//     } else {
//       window.speechSynthesis.cancel(); 
//       try {
//         recognitionRef.current.start();
//         setIsListening(true);
//       } catch (error) {
//         console.error("Microphone is already started", error);
//       }
//     }
//   };

//   const sendToBackend = async (text) => {
//     try {
//       setAgentResponse("Thinking...");

//       // 3. USE THE REF HERE: This prevents the stale closure bug safely!
//       const currentHistory = [...chatHistoryRef.current, { role: "user", text: text }];

//       const response = await fetch('http://localhost:8000/api/chat', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ history: currentHistory }),
//       });

//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }

//       const data = await response.json(); 
//       console.log("Backend response data:", data); 
      
//       speakText(data.tts_response);
//       fetchTasks();

//       setChatHistory([
//         ...currentHistory, 
//         { role: "agent", text: data.tts_response }
//       ]);

//     } catch (error) {
//       console.error("Error talking to backend:", error);
//       speakText("Sorry, I lost connection to the server.");
//     }
//   };

//   // speech to text (ears)
//   useEffect(() => {
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
//     if (!SpeechRecognition) {
//       alert("Your browser does not support the Web Speech API.");
//       return;
//     }

//     const recognition = new SpeechRecognition();
//     recognition.continuous = false; 
//     recognition.interimResults = true; 
//     recognition.lang = 'en-US';

//     recognition.onresult = (event) => {
//       window.speechSynthesis.cancel();
//       setAgentResponse("Listening...");

//       let currentTranscript = '';
//       for (let i = event.resultIndex; i < event.results.length; ++i) {
//         currentTranscript += event.results[i][0].transcript;
//       }

//       setUserTranscript(currentTranscript);
//       transcriptRef.current = currentTranscript; 
//     };

//     recognition.onend = () => {
//       setIsListening(false);
      
//       const finalUtterance = transcriptRef.current.trim();
      
//       if (finalUtterance !== "") {
//         sendToBackend(finalUtterance); 
//         transcriptRef.current = ""; 
//       }
//     };

//     recognitionRef.current = recognition;

//     return () => {
//       recognition.stop();
//     };
//   // 4. FIXED: Returned this back to an empty array so the mic never auto-kills itself!
//   }, []); 
  
//   return (
//     <div className="app-container">
//       <h1>Voice Task Manager</h1>
      
//       <div className="status-box">
//         <p><strong>You said:</strong> {userTranscript}</p>
//         <p><strong>Agent says:</strong> {agentResponse}</p>
//       </div>

//       <button 
//         onClick={toggleListening} 
//         style={{ backgroundColor: isListening ? 'red' : 'green', color: 'white', padding: '15px', fontSize: '18px', borderRadius: '50px', marginBottom: '20px', cursor: 'pointer', border: 'none' }}
//       >
//         {isListening ? "Stop Listening" : "Start Listening"}
//       </button>

//       <div className="task-list">
//         <h2>Your Agenda</h2>
//         {tasks.length === 0 ? (
//           <p style={{ color: '#888' }}>No tasks scheduled yet.</p>
//         ) : (
//           tasks.map(task => (
//             <div key={task.id} className="task-item" style={{ 
//               padding: '15px', 
//               border: '1px solid #ddd', 
//               margin: '10px 0', 
//               borderRadius: '8px',
//               display: 'flex',
//               justifyContent: 'space-between',
//               background: '#fff'
//             }}>
//               <span style={{ fontWeight: 'bold' }}>{task.title}</span> 
//               <span style={{ color: '#555' }}>{task.time_context}</span>
//             </div>
//           ))
//         )}
//       </div>
//     </div>
//   );
// }

// export default App;

// import { useState, useRef, useEffect } from 'react';
// import './App.css'; 

// function App() {
//   const [isListening, setIsListening] = useState(false);
//   const [userTranscript, setUserTranscript] = useState("");
//   const [agentResponse, setAgentResponse] = useState("Waiting for you to speak...");
  

//   const [tasks, setTasks] = useState([]);
//   const [chatHistory, setChatHistory] = useState([]);


//   const recognitionRef = useRef(null);


//   const fetchTasks = async () => {
//     try {
//       const response = await fetch('http://localhost:8000/api/tasks');
//       if (response.ok) {
//         const data = await response.json();
//         setTasks(data); // Update the React state with the database rows
//       }
//     } catch (error) {
//       console.error("Error fetching tasks:", error);
//     }
//   };

//   useEffect(() => {
//     fetchTasks();
//   }, []);

//   const speakText = (text) => {
//     // to Cancel any ongoing speech so it dont overlap
//     window.speechSynthesis.cancel(); 

//     const utterance = new SpeechSynthesisUtterance(text);
    
//     // to change the voice, pitch, and rate 
//     utterance.rate = 1.0; 
//     utterance.pitch = 1.0;
    
//     window.speechSynthesis.speak(utterance);
//     setAgentResponse(text);
//   };


//   const toggleListening = () => {
//     if (isListening) {
//       recognitionRef.current.stop();
//       setIsListening(false);
//     } else {
//       // Make sure the agent isn't talking while we try to listen
//       window.speechSynthesis.cancel(); 
      
//       try {
//         recognitionRef.current.start();
//         setIsListening(true);
//       } catch (error) {
//         console.error("Microphone is already started", error);
//       }
//     }
//   };




// const sendToBackend = async (text) => {
//     try {
//       setAgentResponse("Thinking...");

//       const currentHistory = [...chatHistory, { role: "user", text: text }];

//       const response = await fetch('http://localhost:8000/api/chat', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ history: currentHistory }),
//         //body: JSON.stringify({ text: text }), // This turns your text into a JSON format to send
//       });

//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }

//       // response.json() automatically parses the backend response safely. 
//       // Do NOT use JSON.parse() here.
//       const data = await response.json(); 
      
//       console.log("Backend response data:", data); // Add this to see the data in your browser console!
      
//       speakText(data.tts_response);
//       fetchTasks();

//       setChatHistory([
//         ...currentHistory, 
//         { role: "agent", text: data.tts_response }
//       ]);

//     } catch (error) {
//       console.error("Error talking to backend:", error);
//       speakText("Sorry, I lost connection to the server.");
//     }
//   };






//   // speech to text (ears)
//   useEffect(() => {
//     // to check for browser support
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
//     if (!SpeechRecognition) {
//       alert("Your browser does not support the Web Speech API. Please use Google Chrome.");
//       return;
//     }

//     const recognition = new SpeechRecognition();
//     recognition.continuous = false; // to stop listening automatically after a pause
//     recognition.interimResults = false; // Only gives final text, not the partial guesses
//     recognition.lang = 'en-US';

//     // // What happens when the browser successfully turns your voice into text
//     // recognition.onresult = (event) => {

      
//     //   const currentTranscript = event.results[0][0].transcript;
//     //   setUserTranscript(currentTranscript);
      
       
//     //   // For now, let's just make the agent echo it back to test the loop!
//     //   // speakText(`I heard you say: ${currentTranscript}`);

//     //   // Send the text to FastAPI!
//     //   sendToBackend(currentTranscript);
//     // };

//     recognition.onresult = (event) => {
//       window.speechSynthesis.cancel();
//       setAgentResponse("Listening...");

//       let finalTranscript = '';
//       let interimTranscript = '';

//       for (let i = event.resultIndex; i < event.results.length; ++i) {
//         if (event.results[i].isFinal) {
//           finalTranscript += event.results[i][0].transcript;
//         } else {
//           interimTranscript += event.results[i][0].transcript;
//         }
//       }

//       setUserTranscript(finalTranscript || interimTranscript);

//       // FIX: Only trigger the backend once, and stop the mic immediately!
//       if (finalTranscript) {
//         recognition.stop(); // Force the mic off so it doesn't double-fire
//         setIsListening(false); // Update the UI button
//         sendToBackend(finalTranscript); 
//       }
//     };

//     // Handle the UI state when it stops listening naturally
//     recognition.onend = () => {
//       setIsListening(false);
//     };

//     // Save the instance to our ref so we can start/stop it from the button
//     recognitionRef.current = recognition;

//     // Cleanup function when component unmounts
//     return () => {
//       recognition.stop();
//     };
//   }, []);
  
  

//   return (
//     <div className="app-container">
//       <h1>Voice Task Manager</h1>
      
//       <div className="status-box">
//         <p><strong>You said:</strong> {userTranscript}</p>
//         <p><strong>Agent says:</strong> {agentResponse}</p>
//       </div>

//       <button 
//         onClick={toggleListening} 
//         style={{ backgroundColor: isListening ? 'red' : 'green', color: 'white', padding: '15px', fontSize: '18px', borderRadius: '50px' }}
//       >
//         {isListening ? "Stop Listening" : "Start Listening"}
//       </button>


//       <div className="task-list">
//         <h2>Your Agenda</h2>
//         {tasks.length === 0 ? (
//           <p style={{ color: '#888' }}>No tasks scheduled yet.</p>
//         ) : (
//           tasks.map(task => (
//             <div key={task.id} className="task-item" style={{ 
//               padding: '15px', 
//               border: '1px solid #ddd', 
//               margin: '10px 0', 
//               borderRadius: '8px',
//               display: 'flex',
//               justifyContent: 'space-between',
//               background: '#fff'
//             }}>
//               <span style={{ fontWeight: 'bold' }}>{task.title}</span> 
//               <span style={{ color: '#555' }}>{task.time_context}</span>
//             </div>
//           ))
//         )}
//       </div>
//     </div>


//   );
// }

// export default App;


