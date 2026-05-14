import React, { useEffect, useRef } from 'react';

// Hooks
import { useSpeech } from './hooks/useSpeech';
import { useBackend } from './hooks/useBackend';
import { useTasks } from './hooks/useTasks';

// Components
import MicButton from './components/MicButton';
import StatusBar from './components/StatusBar';
import InterruptBanner from './components/InterruptBanner';
import TranscriptBox from './components/TranscriptBox';
import AgendaList from './components/AgendaList';

// Styles
import './styles/global.css';
import './styles/animations.css';

export default function App() {
  const { tasks, fetchTasks } = useTasks();
  const { isThinking, modelUsed, sendToBackend } = useBackend();
  const speakTextRef = useRef(null);

  // 1. Define what happens when the user finishes speaking
  const handleTranscript = async (text) => {
    const res = await sendToBackend(text);
    if (res.success) {
      speakTextRef.current?.(res.data.tts_response);
      fetchTasks(); // Refresh the agenda
    } else {
      speakTextRef.current?.("Sorry, I lost connection to the server.");
    }
  };

  // 2. Initialize the speech engine
  const {
    isListening, isSpeaking, wasInterrupted, userTranscript,
    agentResponse, speakText, toggleListening
  } = useSpeech(handleTranscript);

  // Keep a fresh reference to the TTS function for our async callback
  useEffect(() => { speakTextRef.current = speakText; }, [speakText]);

  // Load tasks when the app starts
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // 3. Render the UI
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

      {/* Interaction Card */}
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:20,
        padding:'32px 24px', background:'var(--surface)',
        border: wasInterrupted ? '1px solid rgba(247,106,138,0.4)' : '1px solid var(--border)',
        borderRadius:24, marginBottom:28, animation:'fadeSlideUp 0.5s 0.1s ease both',
        transition:'border-color 0.3s',
      }}>
        <MicButton isListening={isListening} isSpeaking={isSpeaking} onClick={toggleListening} />
        
        <StatusBar isListening={isListening} isSpeaking={isSpeaking} isThinking={isThinking} wasInterrupted={wasInterrupted} />
        
        {wasInterrupted && <InterruptBanner />}
        
        <TranscriptBox text={userTranscript} role="user" />
        
        {agentResponse && !isThinking && (
          <TranscriptBox text={agentResponse} role="agent" isSpeaking={isSpeaking} wasInterrupted={wasInterrupted} />
        )}
        
        {modelUsed && (
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.06em', opacity:0.5 }}>via {modelUsed}</div>
        )}
      </div>

      {/* Agenda List */}
      <AgendaList tasks={tasks} />

      {/* Footer Hint */}
      <div style={{ marginTop:32, textAlign:'center' }}>
        <p style={{ fontSize:11, color:'var(--muted)', opacity:0.5, letterSpacing:'0.04em' }}>
          Tap mic to speak · Speak or tap again to interrupt
        </p>
      </div>
      
    </div>
  );
}