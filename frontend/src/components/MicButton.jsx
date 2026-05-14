import React from 'react';

export default function MicButton({ isListening, isSpeaking, onClick }) {
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