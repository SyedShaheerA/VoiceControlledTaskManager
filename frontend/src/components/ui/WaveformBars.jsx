import React from 'react';

export default function WaveformBars({ active, color = 'var(--accent)' }) {
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