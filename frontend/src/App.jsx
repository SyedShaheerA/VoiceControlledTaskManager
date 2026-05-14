import { useState, useRef, useEffect, useCallback } from 'react';

/* ─── Global CSS ─────────────────────────────────────────────────────────────── */
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
    --accent:  #7c6af7;
    --accent2: #f76a8a;
    --glass:   rgba(255,255,255,0.04);
    --border:  rgba(255,255,255,0.08);
    --surface: #13121a;
    --muted:   #6b697a;
    --radius:  16px;
  }
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
    50%       { transform: scaleY(1);  }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes fadeIn {
    from { opacity: 0; } to { opacity: 1; }
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
  @keyframes interrupt-flash {
    0%   { background: rgba(247,106,138,0.15); }
    100% { background: rgba(124,106,247,0.06); }
  }
`;

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
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

/* ─── Sub-components ─────────────────────────────────────────────────────────── */
function WaveformBars({ active, color = 'var(--accent)' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:3, height:24 }}>
      {[...Array(7)].map((_, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 99, height: '100%',
          background: active ? color : 'var(--muted)',
          transform: 'scaleY(0.3)', transformOrigin: 'center',
          animation: active
            ? `wave ${0.6 + i * 0.1}s ease-in-out ${i * 0.08}s infinite alternate`
            : 'none',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}

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

function MicButton({ isListening, isSpeaking, wasInterrupted, onClick }) {
  const bg = isListening
    ? 'linear-gradient(135deg, #f76a8a, #e8467a)'
    : isSpeaking
    ? 'linear-gradient(135deg, #6a8af7, #7c6af7)'
    : 'linear-gradient(135deg, #7c6af7, #9d8af7)';

  const shadow = isListening
    ? '0 0 30px rgba(247,106,138,0.5)'
    : '0 0 20px rgba(124,106,247,0.4)';

  const icon = isListening ? '⏹' : isSpeaking ? '🔊' : '🎤';

  return (
    <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:120, height:120 }}>
      {isListening && [1,2].map(i => (
        <div key={i} style={{
          position:'absolute', inset:0, borderRadius:'50%',
          border: '2px solid var(--accent)',
          animation: `pulse-ring ${1 + i * 0.4}s ease-out ${i * 0.3}s infinite`,
        }} />
      ))}
      {isSpeaking && (
        <div style={{
          position:'absolute', inset:-4, borderRadius:'50%',
          animation: 'glow-pulse 1.5s ease-in-out infinite',
        }} />
      )}
      <button onClick={onClick} style={{
        width:90, height:90, borderRadius:'50%', border:'none', cursor:'pointer',
        background: bg, color:'#fff', fontSize:32,
        display:'flex', alignItems:'center', justifyContent:'center',
        transition: 'transform 0.15s, box-shadow 0.15s',
        boxShadow: shadow,
        transform: isListening ? 'scale(1.05)' : 'scale(1)',
        position:'relative', zIndex:1,
      }}>
        {icon}
      </button>
    </div>
  );
}

function TaskCard({ task, index }) {
  const getTimeColor = (t = '') => {
    const upper = t.toUpperCase();
    const h = parseInt(t);
    const isPM = upper.includes('PM');
    const isAM = upper.includes('AM');
    const hour = (!isNaN(h) && isPM && h !== 12) ? h + 12 : (!isNaN(h) && isAM && h === 12) ? 0 : h;
    if (hour < 12)  return '#f7c26a';   // morning  — amber
    if (hour < 17)  return '#6af7b8';   // afternoon — mint
    if (hour < 21)  return '#7c6af7';   // evening  — purple
    return '#f76a8a';                    // night    — pink
  };
  const dot = getTimeColor(task.time_context);

  return (
    <div
      style={{
        display:'flex', alignItems:'center', gap:14,
        padding:'14px 18px',
        background:'var(--glass)', border:'1px solid var(--border)',
        borderRadius:'var(--radius)',
        animation:'task-pop 0.3s ease both',
        animationDelay:`${index * 0.05}s`,
        transition:'background 0.2s, border-color 0.2s',
        cursor:'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background     = 'rgba(124,106,247,0.08)';
        e.currentTarget.style.borderColor    = 'rgba(124,106,247,0.3)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background  = 'var(--glass)';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{ width:8, height:8, borderRadius:'50%', background:dot, flexShrink:0, boxShadow:`0 0 8px ${dot}` }} />
      <span style={{ flex:1, fontSize:14, letterSpacing:'0.01em' }}>{task.title}</span>
      <span style={{ fontSize:12, color:dot, fontWeight:500, letterSpacing:'0.03em' }}>{task.time_context}</span>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────────────── */
export default function App() {
  const [isListening,    setIsListening]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [isThinking,     setIsThinking]     = useState(false);
  const [wasInterrupted, setWasInterrupted] = useState(false);  // flash effect
  const [userTranscript, setUserTranscript] = useState('');
  const [agentResponse,  setAgentResponse]  = useState('Tap the mic and speak your task.');
  const [tasks,          setTasks]          = useState([]);
  const [modelUsed,      setModelUsed]      = useState('');

  // Refs — never stale inside event handlers
  const recognitionRef    = useRef(null);
  const transcriptRef     = useRef('');
  const sessionIdRef      = useRef(null);
  const isSpeakingRef     = useRef(false);
  const isListeningRef    = useRef(false);  // mirrors isListening for handlers
  const interruptedRef    = useRef(false);  // true while processing an interruption

  /* Inject CSS once */
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

  /* ── TTS ──────────────────────────────────────────────────────────────────── */
  const speakText = useCallback((text) => {
    window.speechSynthesis.cancel();
    const utterance   = new SpeechSynthesisUtterance(text);
    utterance.rate    = 1.05;
    utterance.pitch   = 1.0;
    utterance.onstart = () => { setIsSpeaking(true);  isSpeakingRef.current = true;  };
    utterance.onend   = () => { setIsSpeaking(false); isSpeakingRef.current = false; interruptedRef.current = false; };
    utterance.onerror = () => { setIsSpeaking(false); isSpeakingRef.current = false; interruptedRef.current = false; };
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
      interruptedRef.current = false;
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
      /* ── Real-time interruption ────────────────────────────────────────────
         Fires the moment the browser detects ANY speech.
         If the agent is mid-sentence, kill it immediately.              */
      if (isSpeakingRef.current && !interruptedRef.current) {
        interruptedRef.current = true;
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setWasInterrupted(true);
        setTimeout(() => setWasInterrupted(false), 600); // flash effect
      }

      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setUserTranscript(transcript);
      setAgentResponse('Listening...');
      transcriptRef.current = transcript;
    };

    recognition.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      const final = transcriptRef.current.trim();
      if (final) {
        transcriptRef.current = '';
        sendToBackend(final);
      } else {
        interruptedRef.current = false;
      }
    };

    recognition.onerror = (e) => {
      // 'aborted' fires when we call .stop() intentionally — safe to ignore
      if (e.error !== 'aborted') console.error('Recognition error:', e.error);
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [sendToBackend]);

  /* ── Toggle mic ───────────────────────────────────────────────────────────── */
  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      // Manual stop
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      // If agent is speaking, interrupt it then start listening
      if (isSpeakingRef.current) {
        interruptedRef.current = true;
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setWasInterrupted(true);
        setTimeout(() => setWasInterrupted(false), 600);
      }
      transcriptRef.current = '';
      setUserTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
      } catch (e) {
        console.error('Mic start error:', e);
        interruptedRef.current = false;
      }
    }
  }, []);

  /* ── Derived state ────────────────────────────────────────────────────────── */
  const grouped  = groupByDate(tasks);
  const dateKeys = Object.keys(grouped).sort();

  const statusLabel = isListening ? 'Listening'
    : isSpeaking    ? 'Speaking'
    : isThinking    ? 'Thinking'
    : 'Ready';
  const statusColor = isListening ? '#f76a8a'
    : isSpeaking    ? '#6a8af7'
    : isThinking    ? '#f7c26a'
    : 'var(--muted)';

  /* ── Render ───────────────────────────────────────────────────────────────── */
  return (
    <div style={{ position:'relative', zIndex:1, minHeight:'100vh', maxWidth:560, margin:'0 auto', padding:'32px 20px 60px' }}>

      {/* Header */}
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

      {/* Interaction card */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:20,
        padding:'32px 24px',
        background:'var(--surface)',
        border: wasInterrupted ? '1px solid rgba(247,106,138,0.4)' : '1px solid var(--border)',
        borderRadius:24,
        marginBottom:28,
        animation:'fadeSlideUp 0.5s 0.1s ease both',
        opacity:0,
        transition:'border-color 0.3s',
      }}>
        <MicButton
          isListening={isListening}
          isSpeaking={isSpeaking}
          wasInterrupted={wasInterrupted}
          onClick={toggleListening}
        />

        {/* Status row */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:statusColor, transition:'background 0.3s', boxShadow:`0 0 8px ${statusColor}` }} />
          <span style={{ fontSize:12, color:statusColor, fontWeight:500, letterSpacing:'0.08em', textTransform:'uppercase', transition:'color 0.3s' }}>
            {wasInterrupted ? 'Interrupted' : statusLabel}
          </span>
          {isThinking && <ThinkingDots />}
          {(isListening || isSpeaking) && <WaveformBars active color={isListening ? '#f76a8a' : '#6a8af7'} />}
        </div>

        {/* Interrupted banner */}
        {wasInterrupted && (
          <div style={{
            width:'100%', padding:'8px 14px',
            background:'rgba(247,106,138,0.08)', border:'1px solid rgba(247,106,138,0.2)', borderRadius:10,
            animation:'fadeIn 0.15s ease',
            display:'flex', alignItems:'center', gap:8,
          }}>
            <span style={{ fontSize:12 }}>⚡</span>
            <span style={{ fontSize:12, color:'#f76a8a', letterSpacing:'0.05em' }}>Interrupted — go ahead</span>
          </div>
        )}

        {/* User transcript */}
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
            background: wasInterrupted ? 'rgba(247,106,138,0.06)' : 'rgba(124,106,247,0.06)',
            border: `1px solid ${wasInterrupted ? 'rgba(247,106,138,0.2)' : 'rgba(124,106,247,0.15)'}`,
            borderRadius:12,
            animation: wasInterrupted ? 'interrupt-flash 0.6s ease' : 'fadeIn 0.3s ease',
            transition:'background 0.4s, border-color 0.4s',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:11, color: isSpeaking ? '#6a8af7' : 'var(--accent)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                Agent
              </span>
              {isSpeaking && <WaveformBars active color="#6a8af7" />}
            </div>
            <p style={{ fontSize:14, lineHeight:1.6, color:'#d0cedf' }}>{agentResponse}</p>
          </div>
        )}

        {/* Thinking state */}
        {isThinking && (
          <div style={{
            width:'100%', padding:'12px 16px',
            background:'rgba(247,194,106,0.05)', border:'1px solid rgba(247,194,106,0.15)', borderRadius:12,
          }}>
            <span style={{ fontSize:13, color:'#f7c26a' }}>Processing</span>
            <ThinkingDots />
          </div>
        )}

        {modelUsed && (
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.06em', opacity:0.5 }}>
            via {modelUsed}
          </div>
        )}
      </div>

      {/* Task list */}
      <div style={{ animation:'fadeSlideUp 0.5s 0.2s ease both', opacity:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontFamily:'Syne, sans-serif', fontSize:16, fontWeight:700, letterSpacing:'-0.01em' }}>Agenda</span>
          <span style={{ fontSize:11, color:'var(--muted)', background:'var(--glass)', border:'1px solid var(--border)', borderRadius:99, padding:'3px 10px' }}>
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </span>
        </div>

        {tasks.length === 0 ? (
          <div style={{ padding:'40px 24px', textAlign:'center', background:'var(--glass)', border:'1px dashed var(--border)', borderRadius:'var(--radius)' }}>
            <p style={{ fontSize:24, marginBottom:8 }}>🗓</p>
            <p style={{ color:'var(--muted)', fontSize:13 }}>
              No tasks yet. Say something like<br/>
              <em style={{ color:'var(--accent)' }}>"Add a meeting at 3 PM today"</em>
            </p>
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

      {/* Footer hint */}
      <div style={{ marginTop:32, textAlign:'center' }}>
        <p style={{ fontSize:11, color:'var(--muted)', opacity:0.5, letterSpacing:'0.04em' }}>
          Tap mic to speak · Speak or tap again to interrupt
        </p>
      </div>
    </div>
  );
}