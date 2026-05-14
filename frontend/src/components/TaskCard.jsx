import React from 'react';
import { getTimeColor } from '../utils/timeColor';

export default function TaskCard({ task, index }) {
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