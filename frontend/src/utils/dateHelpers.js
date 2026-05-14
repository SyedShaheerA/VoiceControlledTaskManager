export function groupByDate(tasks) {
  const groups = {};
  tasks.forEach(t => {
    const key = t.date_context || 'today';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return groups;
}

export function formatDateLabel(dateKey) {
  const today    = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  try {
    const d = new Date(dateKey + 'T00:00:00');
    if (d.getTime() === today.getTime())    return 'Today';
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  } catch { 
    return dateKey; 
  }
}