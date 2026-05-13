import { useEffect, useRef, useState, useCallback } from 'react';
import { useGemclawStore } from '../lib/store/useGemclawStore';
import { useVisionPulse } from './useVisionPulse';
import { handleNeuralTool } from '../lib/tools/neural-handlers';
import { ToolResult, Tool } from '../lib/types/live-api';

const MODEL = "models/gemini-2.5-flash"; // Upgraded to stable model

export function useLiveAPI(apiKey: string, onFunctionCall: (call: ToolResult) => void, accessToken?: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState<{ id: string; text: string; type: 'system' | 'user' | 'agent' | 'tool'; timestamp: string }[]>([]);
  const [volume, setVolume] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const addTranscriptMessage = useGemclawStore(state => state.addTranscriptMessage);
  const setInterrupted = useGemclawStore(state => state.setInterrupted);
  const setContextUsage = useGemclawStore(state => state.setContextUsage);

  // ─── Reconnection State (Gem #7: Gateway Backpressure) ────
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1s
  const maxReconnectDelay = 30000; // 30s
  const lastConnectArgsRef = useRef<{ systemInstruction?: string; voiceName?: string; tools?: Tool[] }>({});
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);

  // 1. Utility Callbacks (Top-Level)
  const addLog = useCallback((text: string, type: 'system' | 'user' | 'agent' | 'tool') => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { id: Math.random().toString(36).substring(7), text, type, timestamp }]);
  }, []);

  const updateVolume = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setVolume(average / 255);
    animationFrameRef.current = requestAnimationFrame(updateVolume);
  }, []);

  const playAudio = useCallback(async (base64Data: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    
    const audioContext = audioContextRef.current;
    
    // Gemini sends PCM 24kHz 16-bit mono
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }
    
    const audioBuffer = audioContext.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    if (!analyserRef.current) {
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
      updateVolume();
    }
    
    source.connect(analyserRef.current);
    analyserRef.current.connect(audioContext.destination);
    
    return new Promise<void>((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  }, [updateVolume]);

  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    await playAudio(chunk);
    
    // Only continue if we are still marked as playing
    if (isPlayingRef.current) {
      playNextInQueue();
    }
  }, [playAudio]);

  const enqueueAudio = useCallback((base64Data: string) => {
    audioQueueRef.current.push(base64Data);
    if (!isPlayingRef.current) {
      playNextInQueue();
    }
  }, [playNextInQueue]);

  const flushAudioQueue = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    
    // Attempt to quickly suspend and resume the context to halt any currently playing BufferSource
    if (audioContextRef.current && audioContextRef.current.state === 'running') {
      audioContextRef.current.suspend().then(() => {
          if (audioContextRef.current) {
               audioContextRef.current.resume();
          }
      });
    }
    addLog("Audio queue flushed (Interrupt).", "system");
  }, [addLog]);

  const sendVisionFrame = useCallback((base64Data: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: [{
            mimeType: 'image/jpeg',
            data: base64Data
          }]
        }
      }));
      addLog("Vision pulse transmitted.", "system");
    }
  }, [addLog]);

  const { isCapturing, startPulse, stopPulse } = useVisionPulse(sendVisionFrame);

  // 2. Core Logic Callbacks (Reconnection & Circular Handling)
  // We use a forward reference for reconnect to avoid TDZ in connect ws.onclose
  const scheduleReconnectRef = useRef<() => void>(() => {});

  const connect = useCallback(async (systemInstruction?: string, voiceName: string = "Zephyr", tools?: Tool[]) => {
    let activeKey = apiKey;
    
    if (!activeKey && !accessToken) {
      addLog("Fetching secure neural token...", "system");
      try {
        const response = await fetch('/api/gemini-token');
        if (!response.ok) throw new Error('Failed to fetch secure token');
        const data = await response.json();
        activeKey = data.token;
      } catch (err) {
        addLog("Security Error: Failed to acquire neural token.", "system");
        console.error(err);
        return;
      }
    }

    lastConnectArgsRef.current = { systemInstruction, voiceName, tools };
    intentionalDisconnectRef.current = false;
    
    addLog("Initializing neural connection...", "system");
    
    const wsUrl = accessToken 
      ? `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?accessToken=${accessToken}`
      : `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${activeKey}`;
    
    const ws = new WebSocket(wsUrl);
    const transcript = useGemclawStore.getState().transcript;
    const setLinkType = useGemclawStore.getState().setLinkType;

    ws.onopen = () => {
      setIsConnected(true);
      setLinkType('stateless'); // Reset to active state
      reconnectAttemptsRef.current = 0;
      addLog("Live API connected successfully.", "system");
      
    const setupMsg = {
        setup: {
          model: MODEL,
          systemInstruction: systemInstruction ? {
            parts: [{ text: systemInstruction }]
          } : undefined,
          tools: tools && tools.length > 0 ? tools : undefined,
          generationConfig: {
            responseModalities: ["AUDIO", "TEXT"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } }
            }
          }
        }
      };

      ws.send(JSON.stringify(setupMsg));

      // ─── Phase 17: Hibernate Re-injection (Context Recovery) ────
      if (transcript.length > 0) {
        addLog(`Synchronizing neural context (${transcript.length} nodes)...`, "system");
        setLinkType('hibernating');
        
        // We send a clientContent message to catch up the model
        // Using a ref-safe guard for the timeout
        const hibernateTimer = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              clientContent: {
                turns: [{
                  role: "user",
                  parts: [{ text: `System Note: This is a resumed session. Previous context: ${transcript.slice(-5).map(m => m.content).join(' | ')}` }]
                }],
                turnComplete: true
              }
            }));
            setLinkType('stateless');
          }
        }, 1000);

        return () => clearTimeout(hibernateTimer);
      }
    };

    ws.onmessage = async (event) => {
      if (!wsRef.current || wsRef.current !== ws) return;

      try {
        let data = event.data;
        if (data instanceof Blob) {
          data = await data.text();
        }
        
        if (typeof data !== 'string') return;
        const message = JSON.parse(data);
        
        if (message.toolCall) {
          const functionCalls = message.toolCall.functionCalls;
          if (functionCalls) {
            for (const call of functionCalls) {
              addLog(`Executing tool: ${call.name}`, "tool");
              
              const currentAudioCtx = audioContextRef.current;
              if (currentAudioCtx && currentAudioCtx.state !== 'suspended') {
                await currentAudioCtx.suspend();
              }
              
              try {
                const activeProjectId = useGemclawStore.getState().activeProjectId;
                const result = await handleNeuralTool(call.name, { ...call.args, accessToken, activeProjectId });
                
                addLog(`Tool ${call.name} executed successfully.`, "tool");
                onFunctionCall(result);

                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({
                    toolResponse: {
                      functionResponses: [{
                        id: call.id,
                        name: call.name,
                        response: result
                      }]
                    }
                  }));
                }
              } catch (err) {
                console.error("Neural Tool error:", err);
                addLog(`Error executing tool ${call.name}`, "system");
              } finally {
                if (currentAudioCtx && currentAudioCtx.state === 'suspended') {
                  await currentAudioCtx.resume();
                }
              }
            }
          }
        }

        if (message.serverContent?.modelTurn?.parts) {
          for (const part of message.serverContent.modelTurn.parts) {
            if (part.inlineData) {
              enqueueAudio(part.inlineData.data);
            }
            if (part.text) {
              addLog(part.text, "agent");
              addTranscriptMessage("agent", part.text);
            }
          }
        }
        if (message.serverContent?.interrupted) {
          setInterrupted(true);
          flushAudioQueue(); // Immediately flush the queue on server interrupt
          addLog("Server Interruption detected.", "system");
        }

        if (message.usageMetadata) {
          const { totalTokenCount } = message.usageMetadata;
          const usage = Math.min(totalTokenCount / 1000000, 1);
          setContextUsage(usage);
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("Live API error:", err);
      addLog("Connection error occurred.", "system");
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      wsRef.current = null;
      
      if (intentionalDisconnectRef.current) {
        addLog("Connection closed.", "system");
        useGemclawStore.getState().setLinkType('stateless');
      } else {
        addLog(`Connection lost (code: ${event.code}). Hibernating session...`, "system");
        useGemclawStore.getState().setLinkType('hibernating');
        scheduleReconnectRef.current();
      }
    };

    wsRef.current = ws;
  }, [apiKey, addLog, onFunctionCall, playAudio, addTranscriptMessage, setContextUsage, setInterrupted, accessToken]);

  const scheduleReconnect = useCallback(() => {
    if (intentionalDisconnectRef.current) return;
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      addLog(`Max reconnection attempts (${maxReconnectAttempts}) reached. Giving up.`, "system");
      reconnectAttemptsRef.current = 0;
      return;
    }

    const attempt = reconnectAttemptsRef.current;
    const delay = Math.min(baseReconnectDelay * Math.pow(2, attempt), maxReconnectDelay);
    const jitter = delay * 0.2 * Math.random();
    const actualDelay = Math.round(delay + jitter);

    addLog(`Reconnecting in ${(actualDelay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxReconnectAttempts})...`, "system");

    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      const args = lastConnectArgsRef.current;
      connect(args.systemInstruction, args.voiceName, args.tools);
    }, actualDelay);
  }, [addLog, connect]);

  // Sync ref
  useEffect(() => {
    scheduleReconnectRef.current = scheduleReconnect;
  }, [scheduleReconnect]);

  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
            await audioContextRef.current.close();
        }
        audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsConnected(false);
    addLog("Disconnected.", "system");
  }, [addLog]);

  // 2. Core Logic Callbacks (Reconnection & Circular Handling)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sabRef = useRef<SharedArrayBuffer | null>(null);
  const writePtrRef = useRef<Int32Array | null>(null);
  const readPtrRef = useRef<Int32Array | null>(null);
  const sabBufferRef = useRef<Int16Array | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // 10x Architecture: Hardware AEC, Noise Suppression, and AGC
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 24000
        } 
      });
      
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      
      const audioContext = audioContextRef.current;
      await audioContext.audioWorklet.addModule('/audio-processor.js');
      
      const source = audioContext.createMediaStreamSource(stream);
      workletNodeRef.current = new AudioWorkletNode(audioContext, 'neural-spine-processor');
      
      // Setup SharedArrayBuffer (Size: 8192 samples = ~340ms at 24kHz)
      const SAB_SIZE = 8 + (8192 * 2); 
      const sab = new SharedArrayBuffer(SAB_SIZE);
      sabRef.current = sab;
      writePtrRef.current = new Int32Array(sab, 0, 1);
      readPtrRef.current = new Int32Array(sab, 4, 1); // Gemini Read
      // Reserved: new Int32Array(sab, 8, 1) for Whisper read
      sabBufferRef.current = new Int16Array(sab, 16);
      
      workletNodeRef.current.port.postMessage({ type: 'sab_setup', sab });
      
      // Load Silero VAD locally
      try {
        const vad = await import('@ricky0123/vad-web');
        const myvad = await vad.MicVAD.new({
          // @ts-expect-error - compatibility with certain vad versions
          stream: stream,
          onSpeechStart: () => {
            console.log("[VAD] User speaking -> Barge-in initiated");
            flushAudioQueue();
            
            // Notify API of client interrupt to cancel current gemini generation
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                clientContent: {
                  turnComplete: false,
                  turns: [] // Empty turn acts as a break signal
                }
              }));
            }
          },
          onSpeechEnd: () => {
             console.log("[VAD] Speech ended.");
          }
        });
        myvad.start();
        // @ts-expect-error - store VAD instance on ref to destroy later 
        workletNodeRef.current._vadInstance = myvad;
        addLog("Neural Spine: VAD (Silero) initialized.", "system");
      } catch (vadError) {
        console.warn("[VAD] Failed to load Silero VAD. Falling back to continuous streaming.", vadError);
      }
      
      workletNodeRef.current.port.onmessage = (event) => {
        if (event.data.type === 'buffer_update') {
          if (!sabBufferRef.current || !readPtrRef.current || !writePtrRef.current) return;
          
          const readPtr = readPtrRef.current[0];
          const writePtr = writePtrRef.current[0];
          const buffer = sabBufferRef.current;
          
          if (readPtr === writePtr) return;
          
          let dataToRead = 0;
          if (writePtr > readPtr) {
            dataToRead = writePtr - readPtr;
          } else {
            dataToRead = buffer.length - readPtr + writePtr;
          }

          // We only send if we have a significant chunk or if we want ultra-low latency
          // Gemini likes small chunks (20-40ms). 24000Hz * 0.04s = 960 samples.
          if (dataToRead < 960) return;

          const pcm16 = new Int16Array(dataToRead);
          for (let i = 0; i < dataToRead; i++) {
            pcm16[i] = buffer[(readPtr + i) % buffer.length];
          }
          
          // Update read pointer
          readPtrRef.current[0] = (readPtr + dataToRead) % buffer.length;
          
          const uint8 = new Uint8Array(pcm16.buffer);
          let binary = "";
          const chunk_size = 8192;
          for (let i = 0; i < uint8.length; i += chunk_size) {
            binary += String.fromCharCode(...uint8.subarray(i, i + chunk_size));
          }
          const base64data = btoa(binary);
          
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [{
                  mimeType: 'audio/pcm;rate=24000',
                  data: base64data
                }]
              }
            }));
          }
        }
      };

      source.connect(workletNodeRef.current);
      setIsRecording(true);
      addLog("Neural Spine: Raw PCM streaming active.", "user");
    } catch (err) {
      console.error("Neural Spine transition failure:", err);
      addLog("Microphone access denied or Worklet failure.", "system");
    }
  }, [addLog]);

  const stopRecording = useCallback(() => {
    if (workletNodeRef.current) {
      // @ts-expect-error - vad instance added dynamically 
      if (workletNodeRef.current._vadInstance) {
        // @ts-expect-error - vad instance access 
        workletNodeRef.current._vadInstance.pause();
      }
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    setIsRecording(false);
    addLog("Neural Link: Microphone muted.", "user");
    setVolume(0);
  }, [addLog]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { 
    isConnected, 
    isRecording, 
    logs, 
    volume, 
    stopPulse,
    sab: sabRef.current,
    wsRef,
    analyserRef,
    startRecording,
    stopRecording,
    connect,
    disconnect
  };
}
