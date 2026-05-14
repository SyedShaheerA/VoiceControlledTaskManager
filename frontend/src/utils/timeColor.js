export function getTimeColor(t = '') {
  const upper = t.toUpperCase();
  const h = parseInt(t);
  const isPM = upper.includes('PM');
  const isAM = upper.includes('AM');
  const hour = (!isNaN(h) && isPM && h !== 12) ? h + 12 : (!isNaN(h) && isAM && h === 12) ? 0 : h;
  
  if (hour < 12)  return '#f7c26a';   // morning  — amber
  if (hour < 17)  return '#6af7b8';   // afternoon — mint
  if (hour < 21)  return '#7c6af7';   // evening  — purple
  return '#f76a8a';                   // night    — pink
}