import { useState, useCallback } from 'react';
import { API_BASE_URL } from '../utils/constants';

export function useTasks() {
  const [tasks, setTasks] = useState([]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks`);
      if (res.ok) setTasks(await res.json());
    } catch (e) { 
      console.error('fetchTasks:', e); 
    }
  }, []);

  return { tasks, fetchTasks };
}