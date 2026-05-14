import { useState, useRef, useEffect, useCallback } from 'react';

export function useSpeech(onTranscriptComplete) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [agentResponse, setAgentResponse] = useState('Tap the mic and speak your task.');

  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false);
  const interruptedRef = useRef(false);

  // Keep the callback fresh for the event listeners
  const onTranscriptCompleteRef = useRef(onTranscriptComplete);
  useEffect(() => {
    onTranscriptCompleteRef.current = onTranscriptComplete;
  }, [onTranscriptComplete]);

  const speakText = useCallback((text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onstart = () => { setIsSpeaking(true); isSpeakingRef.current = true; };
    utterance.onend = () => { setIsSpeaking(false); isSpeakingRef.current = false; interruptedRef.current = false; };
    utterance.onerror = () => { setIsSpeaking(false); isSpeakingRef.current = false; interruptedRef.current = false; };
    window.speechSynthesis.speak(utterance);
    setAgentResponse(text);
  }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      // Real-time interruption logic
      if (isSpeakingRef.current && !interruptedRef.current) {
        interruptedRef.current = true;
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setWasInterrupted(true);
        setTimeout(() => setWasInterrupted(false), 600);
      }

      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setUserTranscript(transcript);
      setAgentResponse('Listening...');
      transcriptRef.current = transcript;
    };

    recognition.onend = () => {
      setIsListening(false);
      isListeningRef.current = false;
      const final = transcriptRef.current.trim();
      if (final) {
        transcriptRef.current = '';
        if (onTranscriptCompleteRef.current) onTranscriptCompleteRef.current(final);
      } else {
        interruptedRef.current = false;
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== 'aborted') console.error('Recognition error:', e.error);
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      recognitionRef.current?.stop();
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      if (isSpeakingRef.current) {
        interruptedRef.current = true;
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setWasInterrupted(true);
        setTimeout(() => setWasInterrupted(false), 600);
      }
      transcriptRef.current = '';
      setUserTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        isListeningRef.current = true;
      } catch (e) {
        console.error('Mic start error:', e);
        interruptedRef.current = false;
      }
    }
  }, []);

  const resetInterruption = useCallback(() => {
    interruptedRef.current = false;
  }, []);

  return {
    isListening,
    isSpeaking,
    wasInterrupted,
    userTranscript,
    agentResponse,
    setAgentResponse,
    speakText,
    toggleListening,
    resetInterruption
  };
}