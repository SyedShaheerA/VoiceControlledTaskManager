import { useState, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../utils/constants';

export function useBackend() {
  const [isThinking, setIsThinking] = useState(false);
  const [modelUsed, setModelUsed] = useState('');
  const sessionIdRef = useRef(null);

  const sendToBackend = useCallback(async (text) => {
    setIsThinking(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (sessionIdRef.current) headers['X-Session-ID'] = sessionIdRef.current;

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({ text }),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.session_id) sessionIdRef.current = data.session_id;
      if (data.model_used) setModelUsed(data.model_used);

      return { success: true, data };
    } catch (e) {
      console.error('sendToBackend:', e);
      return { success: false, error: e };
    } finally {
      setIsThinking(false);
    }
  }, []);

  return { isThinking, modelUsed, sendToBackend };
}