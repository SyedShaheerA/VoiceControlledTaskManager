import React from 'react';

export default function InterruptBanner() {
  return (
    <div style={{
      width:'100%', padding:'8px 14px',
      background:'rgba(247,106,138,0.08)', border:'1px solid rgba(247,106,138,0.2)', borderRadius:10,
      animation:'fadeIn 0.15s ease',
      display:'flex', alignItems:'center', gap:8,
    }}>
      <span style={{ fontSize:12 }}>⚡</span>
      <span style={{ fontSize:12, color:'#f76a8a', letterSpacing:'0.05em' }}>Interrupted — go ahead</span>
    </div>
  );
}