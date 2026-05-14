import React from 'react';
import WaveformBars from './ui/WaveformBars';

export default function TranscriptBox({ text, role = 'user', isSpeaking = false, wasInterrupted = false }) {
  if (!text) return null;

  const isAgent = role === 'agent';
  
  const bg = isAgent 
    ? (wasInterrupted ? 'rgba(247,106,138,0.06)' : 'rgba(124,106,247,0.06)') 
    : 'var(--glass)';
    
  const border = isAgent 
    ? (wasInterrupted ? '1px solid rgba(247,106,138,0.2)' : '1px solid rgba(124,106,247,0.15)') 
    : '1px solid var(--border)';

  return (
    <div style={{
      width:'100%', padding:'12px 16px',
      background: bg,
      border: border,
      borderRadius:12,
      animation: isAgent && wasInterrupted ? 'interrupt-flash 0.6s ease' : 'fadeIn 0.3s ease',
      transition:'background 0.4s, border-color 0.4s',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
        <span style={{ 
          fontSize:11, 
          color: isAgent ? (isSpeaking ? '#6a8af7' : 'var(--accent)') : 'var(--muted)', 
          letterSpacing:'0.08em', 
          textTransform:'uppercase' 
        }}>
          {isAgent ? 'Agent' : 'You said'}
        </span>
        {isAgent && isSpeaking && <WaveformBars active color="#6a8af7" />}
      </div>
      <p style={{ marginTop: isAgent ? 0 : 4, fontSize:14, lineHeight:1.6, color: isAgent ? '#d0cedf' : '#e8e6f0' }}>
        {text}
      </p>
    </div>
  );
}