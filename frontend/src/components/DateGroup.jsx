import React from 'react';
import TaskCard from './TaskCard';
import { formatDateLabel } from '../utils/dateHelpers';

export default function DateGroup({ dateKey, tasks }) {
  return (
    <div style={{ marginBottom:20 }}>
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
        {tasks.map((task, i) => (
          <TaskCard key={task.id || Math.random()} task={task} index={i} />
        ))}
      </div>
    </div>
  );
}