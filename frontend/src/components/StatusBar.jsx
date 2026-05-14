import React from 'react';
import ThinkingDots from './ui/ThinkingDots';
import WaveformBars from './ui/WaveformBars';

export default function StatusBar({ isListening, isSpeaking, isThinking, wasInterrupted }) {
  const statusLabel = isListening ? 'Listening'
    : isSpeaking    ? 'Speaking'
    : isThinking    ? 'Thinking'
    : 'Ready';

  const statusColor = isListening ? '#f76a8a'
    : isSpeaking    ? '#6a8af7'
    : isThinking    ? '#f7c26a'
    : 'var(--muted)';

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background:statusColor, transition:'background 0.3s', boxShadow:`0 0 8px ${statusColor}` }} />
      <span style={{ fontSize:12, color:statusColor, fontWeight:500, letterSpacing:'0.08em', textTransform:'uppercase', transition:'color 0.3s' }}>
        {wasInterrupted ? 'Interrupted' : statusLabel}
      </span>
      {isThinking && <ThinkingDots />}
      {(isListening || isSpeaking) && <WaveformBars active color={isListening ? '#f76a8a' : '#6a8af7'} />}
    </div>
  );
}