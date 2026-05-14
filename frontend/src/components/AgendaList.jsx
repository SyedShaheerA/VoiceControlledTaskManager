import React from 'react';
import DateGroup from './DateGroup';
import { groupByDate } from '../utils/dateHelpers';

export default function AgendaList({ tasks }) {
  const grouped = groupByDate(tasks);
  const dateKeys = Object.keys(grouped).sort();

  return (
    <div style={{ animation:'fadeSlideUp 0.5s 0.2s ease both' }}>
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
          <DateGroup key={dateKey} dateKey={dateKey} tasks={grouped[dateKey]} />
        ))
      )}
    </div>
  );
}