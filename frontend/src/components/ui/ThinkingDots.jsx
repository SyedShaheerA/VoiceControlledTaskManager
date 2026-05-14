import React from 'react';

export default function ThinkingDots() {
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