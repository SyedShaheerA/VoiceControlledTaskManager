// import { useState, useRef, useEffect, useCallback } from 'react';
// import './App.css';

// function App() {
//   const [isListening, setIsListening]   = useState(false);
//   const [userTranscript, setUserTranscript] = useState("");
//   const [agentResponse, setAgentResponse]   = useState("Waiting for you to speak...");
//   const [tasks, setTasks]               = useState([]);
//   const [modelUsed, setModelUsed]       = useState("");

//   const recognitionRef = useRef(null);
//   const transcriptRef  = useRef("");
//   const sessionIdRef   = useRef(null);   // server-side session ID

//   // ── Fetch tasks ─────────────────────────────────────────────────────────────
//   const fetchTasks = useCallback(async () => {
//     try {
//       const response = await fetch('http://localhost:8000/api/tasks');
//       if (response.ok) {
//         const data = await response.json();
//         setTasks(data);
//       }
//     } catch (error) {
//       console.error("Error fetching tasks:", error);
//     }
//   }, []);

//   useEffect(() => { fetchTasks(); }, [fetchTasks]);

//   // ── TTS ──────────────────────────────────────────────────────────────────────
//   const speakText = useCallback((text) => {
//     window.speechSynthesis.cancel();
//     const utterance = new SpeechSynthesisUtterance(text);
//     utterance.rate  = 1.0;
//     utterance.pitch = 1.0;
//     window.speechSynthesis.speak(utterance);
//     setAgentResponse(text);
//   }, []);

//   // ── Send to backend ──────────────────────────────────────────────────────────
//   const sendToBackend = useCallback(async (text) => {
//     try {
//       setAgentResponse("Thinking...");

//       const headers = { 'Content-Type': 'application/json' };
//       if (sessionIdRef.current) {
//         headers['X-Session-ID'] = sessionIdRef.current;
//       }

//       const response = await fetch('http://localhost:8000/api/chat', {
//         method: 'POST',
//         headers,
//         body: JSON.stringify({ text }),   // just the utterance — server owns history
//       });

//       if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

//       const data = await response.json();

//       // Persist session ID for subsequent requests
//       if (data.session_id) {
//         sessionIdRef.current = data.session_id;
//       }

//       if (data.model_used) {
//         setModelUsed(data.model_used);
//       }

//       speakText(data.tts_response);
//       fetchTasks();

//     } catch (error) {
//       console.error("Error talking to backend:", error);
//       speakText("Sorry, I lost connection to the server.");
//     }
//   }, [speakText, fetchTasks]);

//   // ── Speech recognition ───────────────────────────────────────────────────────
//   useEffect(() => {
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

//     if (!SpeechRecognition) {
//       alert("Your browser does not support the Web Speech API. Please use Google Chrome.");
//       return;
//     }

//     const recognition         = new SpeechRecognition();
//     recognition.continuous    = false;
//     recognition.interimResults = true;
//     recognition.lang          = 'en-US';

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
//     return () => recognition.stop();
//   }, [sendToBackend]);

//   // ── Toggle mic ───────────────────────────────────────────────────────────────
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
//         console.error("Microphone error:", error);
//       }
//     }
//   };

//   // ── UI ───────────────────────────────────────────────────────────────────────
//   return (
//     <div className="app-container">
//       <h1>Voice Task Manager</h1>

//       <div className="status-box">
//         <p><strong>You said:</strong> {userTranscript || "—"}</p>
//         <p><strong>Agent says:</strong> {agentResponse}</p>
//         {modelUsed && (
//           <p style={{ fontSize: '12px', color: '#888' }}>
//             Model: {modelUsed}
//           </p>
//         )}
//       </div>

//       <button
//         onClick={toggleListening}
//         style={{
//           backgroundColor: isListening ? 'red' : 'green',
//           color: 'white',
//           padding: '15px',
//           fontSize: '18px',
//           borderRadius: '50px',
//           marginBottom: '20px',
//           cursor: 'pointer',
//           border: 'none',
//         }}
//       >
//         {isListening ? "🎙 Stop Listening" : "🎤 Start Listening"}
//       </button>

//       <div className="task-list">
//         <h2>Your Agenda</h2>
//         {tasks.length === 0 ? (
//           <p style={{ color: '#888' }}>No tasks scheduled yet.</p>
//         ) : (
//           tasks.map(task => (
//             <div
//               key={task.id}
//               className="task-item"
//               style={{
//                 padding: '15px',
//                 border: '1px solid #ddd',
//                 margin: '10px 0',
//                 borderRadius: '8px',
//                 display: 'flex',
//                 justifyContent: 'space-between',
//                 background: '#fff',
//               }}
//             >
//               <span style={{ fontWeight: 'bold' }}>{task.title}</span>
//               <span style={{ color: '#555' }}>{task.time_context}</span>
//             </div>
//           ))
//         )}
//       </div>
//     </div>
//   );
// }

import { useState, useRef, useEffect, useCallback } from 'react';
 
/* ─── Inline styles & keyframes injected once ─────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
 
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
 
  body {
    background: #0a0a0f;
    color: #e8e6f0;
    font-family: 'DM Mono', monospace;
    min-height: 100vh;
    overflow-x: hidden;
  }
 
  :root {
    --accent:   #7c6af7;
    --accent2:  #f76a8a;
    --glass:    rgba(255,255,255,0.04);
    --border:   rgba(255,255,255,0.08);
    --surface:  #13121a;
    --muted:    #6b697a;
    --radius:   16px;
  }
 
  /* Noise overlay */
  body::before {
    content: '';
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    opacity: 0.4;
  }
 
  @keyframes pulse-ring {
    0%   { transform: scale(1);   opacity: .6; }
    100% { transform: scale(1.7); opacity: 0;  }
  }
  @keyframes wave {
    0%, 100% { transform: scaleY(0.3); }
    50%       { transform: scaleY(1);   }
  }
  @keyframes spin-slow {
    to { transform: rotate(360deg); }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  @keyframes thinking-dot {
    0%, 80%, 100% { transform: scale(0); opacity: 0; }
    40%            { transform: scale(1); opacity: 1; }
  }
  @keyframes task-pop {
    0%   { opacity: 0; transform: translateX(-10px) scale(0.97); }
    100% { opacity: 1; transform: translateX(0)     scale(1);    }
  }
  @keyframes glow-pulse {
    0%, 100% { box-shadow: 0 0 20px rgba(124,106,247,0.3); }
    50%       { box-shadow: 0 0 40px rgba(124,106,247,0.6); }
  }
`;
 
/* ─── Grouped tasks by date ─────────────────────────────────────────────────── */
function groupByDate(tasks) {
  const groups = {};
  tasks.forEach(t => {
    const key = t.date_context || 'today';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return groups;
}
 
function formatDateLabel(dateKey) {
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  try {
    const d = new Date(dateKey + 'T00:00:00');
    if (d.getTime() === today.getTime())    return 'Today';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
  } catch { return dateKey; }
}
 
/* ─── Waveform bars (speaking animation) ───────────────────────────────────── */
function WaveformBars({ active }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, height:28 }}>
      {[...Array(7)].map((_, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 99,
          background: active ? 'var(--accent)' : 'var(--muted)',
          height: '100%',
          transform: 'scaleY(0.3)',
          transformOrigin: 'center',
          animation: active ? `wave ${0.6 + i * 0.1}s ease-in-out ${i * 0.08}s infinite alternate` : 'none',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}
 
/* ─── Thinking dots ─────────────────────────────────────────────────────────── */
function ThinkingDots() {
  return (
    <span style={{ display:'inline-flex', gap:5, alignItems:'center', marginLeft:6 }}>
      {[0,1,2].map(i => (
        <span key={i} style={{
          width:6, height:6, borderRadius:'50%', background:'var(--accent)',
          display:'inline-block',
          animation: `thinking-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}
 
/* ─── Mic button ─────────────────────────────────────────────────────────────── */
function MicButton({ isListening, isSpeaking, onClick }) {
  return (
    <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:120, height:120 }}>
      {/* Pulse rings when listening */}
      {isListening && [1,2].map(i => (
        <div key={i} style={{
          position:'absolute', inset:0, borderRadius:'50%',
          border: '2px solid var(--accent)',
          animation: `pulse-ring ${1 + i * 0.4}s ease-out ${i * 0.3}s infinite`,
        }} />
      ))}
      {/* Glow ring when speaking */}
      {isSpeaking && (
        <div style={{
          position:'absolute', inset:-4, borderRadius:'50%',
          animation: 'glow-pulse 1.5s ease-in-out infinite',
        }} />
      )}
      <button
        onClick={onClick}
        style={{
          width:90, height:90, borderRadius:'50%', border:'none', cursor:'pointer',
          background: isListening
            ? 'linear-gradient(135deg, #f76a8a, #e8467a)'
            : isSpeaking
            ? 'linear-gradient(135deg, #6a8af7, #7c6af7)'
            : 'linear-gradient(135deg, #7c6af7, #9d8af7)',
          color:'#fff', fontSize:32,
          display:'flex', alignItems:'center', justifyContent:'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
          boxShadow: isListening
            ? '0 0 30px rgba(247,106,138,0.5)'
            : '0 0 20px rgba(124,106,247,0.4)',
          transform: isListening ? 'scale(1.05)' : 'scale(1)',
          position: 'relative', zIndex:1,
        }}
      >
        {isListening ? '⏹' : isSpeaking ? '🔊' : '🎤'}
      </button>
    </div>
  );
}
 
/* ─── Task card ──────────────────────────────────────────────────────────────── */
function TaskCard({ task, index }) {
  const timeColors = {
    morning:   '#f7c26a',
    afternoon: '#6af7b8',
    evening:   '#7c6af7',
    night:     '#f76a8a',
  };
  const getTimeColor = (t = '') => {
    const h = parseInt(t);
    if (!isNaN(h)) {
      if (h < 12) return timeColors.morning;
      if (h < 17) return timeColors.afternoon;
      if (h < 21) return timeColors.evening;
      return timeColors.night;
    }
    const tl = t.toLowerCase();
    if (tl.includes('am')) return timeColors.morning;
    if (tl.includes('pm')) {
      const hh = parseInt(t);
      if (!isNaN(hh) && hh < 5) return timeColors.afternoon;
      return timeColors.evening;
    }
    return 'var(--muted)';
  };
  const dot = getTimeColor(task.time_context);
 
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:14,
      padding:'14px 18px',
      background:'var(--glass)',
      border:'1px solid var(--border)',
      borderRadius:'var(--radius)',
      animation: `task-pop 0.3s ease both`,
      animationDelay: `${index * 0.05}s`,
      transition:'background 0.2s, border-color 0.2s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(124,106,247,0.08)';
        e.currentTarget.style.borderColor = 'rgba(124,106,247,0.3)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--glass)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{ width:8, height:8, borderRadius:'50%', background:dot, flexShrink:0, boxShadow:`0 0 8px ${dot}` }} />
      <span style={{ flex:1, fontSize:14, fontWeight:400, letterSpacing:'0.01em' }}>{task.title}</span>
      <span style={{ fontSize:12, color:dot, fontWeight:500, letterSpacing:'0.03em' }}>{task.time_context}</span>
    </div>
  );
}
 
/* ─── Main App ───────────────────────────────────────────────────────────────── */
export default function App() {
  const [isListening,    setIsListening]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [isThinking,     setIsThinking]     = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [agentResponse,  setAgentResponse]  = useState('Tap the mic and speak your task.');
  const [tasks,          setTasks]          = useState([]);
  const [modelUsed,      setModelUsed]      = useState('');
 
  const recognitionRef = useRef(null);
  const transcriptRef  = useRef('');
  const sessionIdRef   = useRef(null);
  const isSpeakingRef  = useRef(false);   // sync ref for onresult handler
 
  /* Inject global CSS once */
  useEffect(() => {
    const tag = document.createElement('style');
    tag.textContent = GLOBAL_CSS;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);
 
  /* ── Fetch tasks ──────────────────────────────────────────────────────────── */
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/tasks');
      if (res.ok) setTasks(await res.json());
    } catch (e) { console.error('fetchTasks:', e); }
  }, []);
 
  useEffect(() => { fetchTasks(); }, [fetchTasks]);
 
  /* ── TTS with speaking state ──────────────────────────────────────────────── */
  const speakText = useCallback((text) => {
    window.speechSynthesis.cancel();
    const utterance    = new SpeechSynthesisUtterance(text);
    utterance.rate     = 1.05;
    utterance.pitch    = 1.0;
    utterance.onstart  = () => { setIsSpeaking(true);  isSpeakingRef.current = true;  };
    utterance.onend    = () => { setIsSpeaking(false); isSpeakingRef.current = false; };
    utterance.onerror  = () => { setIsSpeaking(false); isSpeakingRef.current = false; };
    window.speechSynthesis.speak(utterance);
    setAgentResponse(text);
  }, []);
 
  /* ── Send to backend ──────────────────────────────────────────────────────── */
  const sendToBackend = useCallback(async (text) => {
    setIsThinking(true);
    setAgentResponse('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionIdRef.current) headers['X-Session-ID'] = sessionIdRef.current;
 
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST', headers,
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
 
      if (data.session_id) sessionIdRef.current = data.session_id;
      if (data.model_used) setModelUsed(data.model_used);
 
      setIsThinking(false);
      speakText(data.tts_response);
      fetchTasks();
    } catch (e) {
      console.error('sendToBackend:', e);
      setIsThinking(false);
      speakText('Sorry, I lost connection to the server.');
    }
  }, [speakText, fetchTasks]);
 
  /* ── Speech recognition ───────────────────────────────────────────────────── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Please use Google Chrome for voice support.'); return; }
 
    const recognition          = new SR();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';
 
    recognition.onresult = (event) => {
      /* ── Interruption handling ──────────────────────────────────────────
         If the assistant is speaking and the user speaks, cancel TTS
         immediately so the new utterance feels like a real interruption.   */
      if (isSpeakingRef.current) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      }
 
      setAgentResponse('Listening...');
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setUserTranscript(transcript);
      transcriptRef.current = transcript;
    };
 
    recognition.onend = () => {
      setIsListening(false);
      const final = transcriptRef.current.trim();
      if (final) {
        sendToBackend(final);
        transcriptRef.current = '';
      }
    };
 
    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [sendToBackend]);
 
  /* ── Toggle mic ───────────────────────────────────────────────────────────── */
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      /* Also interrupt any ongoing TTS */
      if (isSpeakingRef.current) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      }
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setUserTranscript('');
      } catch (e) { console.error('Mic start error:', e); }
    }
  };
 
  /* ── Grouped tasks ────────────────────────────────────────────────────────── */
  const grouped = groupByDate(tasks);
  const dateKeys = Object.keys(grouped).sort();
 
  /* ── Status label ─────────────────────────────────────────────────────────── */
  const statusLabel = isListening ? 'Listening' : isSpeaking ? 'Speaking' : isThinking ? 'Thinking' : 'Ready';
  const statusColor = isListening ? '#f76a8a' : isSpeaking ? '#6a8af7' : isThinking ? '#f7c26a' : 'var(--muted)';
 
  return (
    <div style={{ position:'relative', zIndex:1, minHeight:'100vh', maxWidth:560, margin:'0 auto', padding:'32px 20px 60px' }}>
 
      {/* ── Header ── */}
      <div style={{ marginBottom:40, animation:'fadeSlideUp 0.5s ease both' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 10px var(--accent)' }} />
          <span style={{ fontFamily:'Syne, sans-serif', fontSize:11, fontWeight:600, letterSpacing:'0.15em', textTransform:'uppercase', color:'var(--muted)' }}>
            Voice Task Manager
          </span>
        </div>
        <h1 style={{ fontFamily:'Syne, sans-serif', fontSize:32, fontWeight:800, letterSpacing:'-0.02em', lineHeight:1.1 }}>
          Your AI<br/>
          <span style={{ background:'linear-gradient(90deg, var(--accent), var(--accent2))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Agenda
          </span>
        </h1>
      </div>
 
      {/* ── Mic area ── */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:20,
        padding:'32px 24px',
        background:'var(--surface)',
        border:'1px solid var(--border)',
        borderRadius:24,
        marginBottom:28,
        animation:'fadeSlideUp 0.5s 0.1s ease both',
        opacity:0,
      }}>
        <MicButton isListening={isListening} isSpeaking={isSpeaking} onClick={toggleListening} />
 
        {/* Status row */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:statusColor, transition:'background 0.3s', boxShadow:`0 0 8px ${statusColor}` }} />
          <span style={{ fontSize:12, color:statusColor, fontWeight:500, letterSpacing:'0.08em', textTransform:'uppercase', transition:'color 0.3s' }}>
            {statusLabel}
          </span>
          {isThinking && <ThinkingDots />}
          {(isListening || isSpeaking) && <WaveformBars active={true} />}
        </div>
 
        {/* Transcript */}
        {userTranscript && (
          <div style={{
            width:'100%', padding:'12px 16px',
            background:'var(--glass)', border:'1px solid var(--border)', borderRadius:12,
            animation:'fadeIn 0.2s ease',
          }}>
            <span style={{ fontSize:11, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase' }}>You said</span>
            <p style={{ marginTop:4, fontSize:14, lineHeight:1.5 }}>{userTranscript}</p>
          </div>
        )}
 
        {/* Agent response */}
        {agentResponse && !isThinking && (
          <div style={{
            width:'100%', padding:'12px 16px',
            background:'rgba(124,106,247,0.06)', border:'1px solid rgba(124,106,247,0.15)', borderRadius:12,
            animation:'fadeIn 0.3s ease',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:11, color:'var(--accent)', letterSpacing:'0.08em', textTransform:'uppercase' }}>Agent</span>
              {isSpeaking && <WaveformBars active={true} />}
            </div>
            <p style={{ fontSize:14, lineHeight:1.6, color:'#d0cedf' }}>{agentResponse}</p>
          </div>
        )}
 
        {isThinking && (
          <div style={{
            width:'100%', padding:'12px 16px',
            background:'rgba(247,194,106,0.05)', border:'1px solid rgba(247,194,106,0.15)', borderRadius:12,
          }}>
            <span style={{ fontSize:13, color:'#f7c26a' }}>Processing your request</span>
            <ThinkingDots />
          </div>
        )}
 
        {/* Model badge */}
        {modelUsed && (
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.06em', opacity:0.6 }}>
            via {modelUsed}
          </div>
        )}
      </div>
 
      {/* ── Task list ── */}
      <div style={{ animation:'fadeSlideUp 0.5s 0.2s ease both', opacity:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontFamily:'Syne, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.01em' }}>Agenda</span>
          <span style={{ fontSize:11, color:'var(--muted)', background:'var(--glass)', border:'1px solid var(--border)', borderRadius:99, padding:'3px 10px' }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>
 
        {tasks.length === 0 ? (
          <div style={{
            padding:'40px 24px', textAlign:'center',
            background:'var(--glass)', border:'1px dashed var(--border)', borderRadius:'var(--radius)',
          }}>
            <p style={{ fontSize:24, marginBottom:8 }}>🗓</p>
            <p style={{ color:'var(--muted)', fontSize:13 }}>No tasks yet. Say something like<br/><em style={{ color:'var(--accent)' }}>"Add a meeting at 3 PM today"</em></p>
          </div>
        ) : (
          dateKeys.map(dateKey => (
            <div key={dateKey} style={{ marginBottom:20 }}>
              <div style={{
                fontSize:10, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase',
                color:'var(--muted)', marginBottom:8, paddingLeft:4,
                display:'flex', alignItems:'center', gap:8,
              }}>
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
                {formatDateLabel(dateKey)}
                <div style={{ flex:1, height:1, background:'var(--border)' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {grouped[dateKey].map((task, i) => (
                  <TaskCard key={task.id} task={task} index={i} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
 
      {/* ── Hint footer ── */}
      <div style={{ marginTop:32, textAlign:'center' }}>
        <p style={{ fontSize:11, color:'var(--muted)', opacity:0.5, letterSpacing:'0.04em' }}>
          Tap mic to speak · Speak again to interrupt
        </p>
      </div>
    </div>
  );
}


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


