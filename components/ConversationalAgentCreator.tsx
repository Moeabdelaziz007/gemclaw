'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGemclawStore } from '@/lib/store/useGemclawStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Activity,
  Mic,
  MicOff,
  ChevronLeft,
  X,
  SkipForward,
  Loader2
} from 'lucide-react';
import { useVoiceInteraction } from '../hooks/useVoiceInteraction';
import { useTextToSpeech } from '../lib/agents/ttsService';
import {
  CONVERSATION_FLOW,
  ConversationStep,
  getNextStep,
  getPreviousStep,
  getStepDataUpdate
} from '../lib/agents/conversationFlow';
import ClawHubWidget from './forge/widgets/ClawHubWidget';

interface AgentFormData {
  name: string;
  description: string;
  voiceName: string;
  computeTier: 'Standard' | 'Neural' | 'Gemclaw';
  systemPrompt: string;
  rules: string;
  soul: string;
  tools: Record<string, boolean>;
  skills: Record<string, boolean>;
  skills_desc: string; // Added for ClawHub skill IDs
}

interface ConversationalAgentCreatorProps {
  onClose: () => void;
  onSubmit: (data: AgentFormData) => void;
}

export default function ConversationalAgentCreator({
  onClose,
  onSubmit
}: ConversationalAgentCreatorProps) {
  const [currentStep, setCurrentStep] = useState<ConversationStep>('GREETING');
  const [userInput, setUserInput] = useState('');
  const setPendingManifest = useGemclawStore((state) => state.setPendingManifest);
  const pendingManifest = useGemclawStore((state) => state.pendingManifest);

  type ConversationMessage = {
    speaker: 'ASTRAEUS' | 'USER';
    text: string;
    timestamp: Date;
  };

  const [messages, setMessages] = useState<ConversationMessage[]>([
    {
      speaker: 'ASTRAEUS',
      text: CONVERSATION_FLOW.GREETING.text,
      timestamp: new Date(),
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAstraeusThinking, setIsAstraeusThinking] = useState(false);
  const [agentData, setAgentData] = useState<Partial<AgentFormData>>({});
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [permissionChecked, setPermissionChecked] = useState(false);
  const setVoiceSession = useGemclawStore(state => state.setVoiceSession);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  // Voice hooks
  const {
    transcript,
    confidence,
    isListening,
    startListening,
    stopListening,
    isSupported: speechRecognitionSupported,
    resetTranscript
  } = useVoiceInteraction();

  const { speak, cancel: cancelSpeech, isSpeaking } = useTextToSpeech();

  // Define functions first to avoid hoisting issues
  async function handleSendMessage(text?: string) {
    const inputText = text || userInput;
    if (!inputText.trim()) return;

    setIsProcessing(true);
    cancelSpeech();
    setIsAstraeusThinking(true); 

    const newMessage: ConversationMessage = {
      speaker: 'USER',
      text: inputText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setUserInput('');
    await processStepResponse(inputText);
  }

  async function synthesizeBlueprint() {
    try {
      const transcriptText = messages.map(m => `${m.speaker}: ${m.text}`).join('\n');
      const response = await fetch('/api/forge/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: agentData.description,
          currentTranscript: transcriptText
        }),
      });

      const data = await response.json();
      if (isMounted.current && data.blueprint) {
        setAgentData(prev => ({
          ...prev,
          name: data.blueprint.name,
          systemPrompt: data.blueprint.systemPrompt,
          voiceName: data.blueprint.voiceName,
          tools: data.blueprint.tools,
          skills: data.blueprint.skills
        }));

        const pitchMessage: ConversationMessage = {
          speaker: 'ASTRAEUS',
          text: `Neural Synthesis complete. I have architected "${data.blueprint.name}", target role: ${data.blueprint.role}. I've pre-configured your entity with ${Object.values(data.blueprint.tools as Record<string, boolean>).filter(Boolean).length} sensory tools and ${Object.values(data.blueprint.skills as Record<string, boolean>).filter(Boolean).length} workspace bridges. Does this align with your vision?`,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, pitchMessage]);
        speak(pitchMessage.text).then(() => {
          setTimeout(() => {
            if (isMounted.current) {
              setCurrentStep('VOICE_SELECTION');
            }
          }, 2000);
        });
      }
    } catch (error) {
      console.error('Synthesis failed:', error);
    }
  }

  async function processStepResponse(input: string) {
    const message = CONVERSATION_FLOW[currentStep];

    if (message.requiresInput && message.validation) {
      const result = message.validation(input);
      if (!result.valid) {
        const errorMessage: ConversationMessage = {
          speaker: 'ASTRAEUS',
          text: `I need clarification: ${result.error}. ${message.text}`,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, errorMessage]);
        speak(errorMessage.text);
        setIsProcessing(false);
        setIsAstraeusThinking(false);
        return;
      }
    }

    const updates = getStepDataUpdate(currentStep, input);
    if (Object.keys(updates).length > 0) {
      setAgentData(prev => ({ ...prev, ...updates }));
    }

    const next = getNextStep(currentStep);
    if (next) {
      setTimeout(() => {
        if (isMounted.current) {
          setCurrentStep(next);
          setIsProcessing(false);
          setIsAstraeusThinking(false);
        }
      }, 1000);
    } else {
      finalizeCreation();
    }
  }

  function finalizeCreation() {
    const finalData: AgentFormData = {
      name: agentData.name || 'Unknown',
      description: agentData.description || 'AI Assistant',
      voiceName: agentData.voiceName || 'Zephyr',
      computeTier: agentData.computeTier || 'Neural',
      systemPrompt: agentData.systemPrompt || 'You are a helpful assistant.',
      rules: agentData.rules || 'Be helpful and honest.',
      soul: agentData.soul || 'Friendly and curious.',
      tools: agentData.tools || {},
      skills: agentData.skills || {},
      skills_desc: agentData.skills_desc || '',
    };

    const completionMessage: ConversationMessage = {
      speaker: 'ASTRAEUS',
      text: "Consciousness matrix initialized. Your sovereign AI entity awakens now.",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, completionMessage]);
    speak(completionMessage.text).then(() => {
      onSubmit(finalData);
    });
  }

  function handleGoBack() {
    const prev = getPreviousStep(currentStep);
    if (prev) {
      cancelSpeech();
      setCurrentStep(prev);
    }
  }

  function handleSkipStep() {
    const next = getNextStep(currentStep);
    if (next) {
      cancelSpeech();
      setCurrentStep(next);
    }
  }

  // Lifecycle and Effects
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setPendingManifest({
      name: agentData.name,
      role: agentData.description,
      systemPrompt: agentData.systemPrompt,
      voiceName: agentData.voiceName,
      rules: agentData.rules,
      soul: agentData.soul,
      tools: agentData.tools as any,
      skills: agentData.skills as any,
      skills_desc: agentData.skills_desc,
    });
  }, [agentData, setPendingManifest]);

  useEffect(() => {
    if (pendingManifest?.skills_desc !== undefined && pendingManifest.skills_desc !== agentData.skills_desc) {
      setAgentData(prev => ({ ...prev, skills_desc: pendingManifest.skills_desc || '' }));
    }
  }, [pendingManifest?.skills_desc, agentData.skills_desc]);

  useEffect(() => {
    if (transcript && isListening === false) {
      if (confidence > 0.90) {
        handleSendMessage(transcript);
      } else if (confidence >= 0.70 && confidence <= 0.90) {
        setUserInput(transcript);
        setMessages(prev => [...prev, {
          speaker: 'ASTRAEUS',
          text: `[WARNING] Confidence ${Math.round(confidence * 100)}%. I heard: "${transcript}". Please confirm or repeat.`,
          timestamp: new Date()
        }]);
      } else if (confidence > 0 && confidence < 0.70) {
        const msg = "I didn't quite catch that. Could you repeat?";
        setMessages(prev => [...prev, {
          speaker: 'ASTRAEUS',
          text: msg,
          timestamp: new Date()
        }]);
        speak(msg);
        resetTranscript();
      }
    }
  }, [transcript, confidence, isListening]);

  useEffect(() => {
    setVoiceSession({ stage: 'forge', lastVoiceAction: 'Conversational forge opened. Checking microphone permission.' });
    
    async function checkMicPermission() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setMicPermission('denied');
        setPermissionChecked(true);
        setVoiceSession({ micPermission: 'denied', lastVoiceAction: 'Microphone API not available.' });
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setMicPermission('granted');
        setPermissionChecked(true);
        setVoiceSession({ micPermission: 'granted', lastVoiceAction: 'Mic ready.' });
      } catch (_err) {
        setMicPermission('denied');
        setPermissionChecked(true);
        setVoiceSession({ micPermission: 'denied', lastVoiceAction: 'Mic blocked.' });
      }
    }
    checkMicPermission();
  }, [setVoiceSession]);

  useEffect(() => {
    if (permissionChecked && micPermission === 'granted' && speechRecognitionSupported && !isListening && !isProcessing) {
      startListening();
    }
  }, [permissionChecked, micPermission, speechRecognitionSupported, isListening, isProcessing]);

  useEffect(() => {
    const message = CONVERSATION_FLOW[currentStep];

    if (currentStep === 'NEURAL_SYNTHESIS') {
      synthesizeBlueprint();
    }

    if (message.speaker === 'ASTRAEUS' && message.voicePrompt) {
      const timer = setTimeout(() => {
        speak(message.voicePrompt!, { rate: 0.95, pitch: 1.0 });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  return (
    <div data-testid="forge-conversational-root" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-7xl h-[90vh] bg-[#050505] border border-white/10 rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col"
      >
        {/* Main Content Area (Split View) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation Panel */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-white/5">
            {/* Header */}
            <div className="flex items-center justify-between px-10 py-8 border-b border-white/5 shrink-0 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-black border border-[#8eff71]/40 flex items-center justify-center shadow-[0_0_20px_rgba(142,255,113,0.15)]">
                  <Brain className="w-7 h-7 text-[#8eff71]" />
                </div>
                <div>
                  <h2
                    data-testid="aether-forge-heading"
                    className="text-2xl font-black tracking-[0.4em] uppercase text-white flex items-center gap-4"
                  >
                    <span className="text-[#8eff71]">Aether</span> Forge
                  </h2>
                  <p className="text-[11px] font-mono text-white/40 uppercase tracking-[0.4em] mt-1.5">
                    Neural Entity Synthesis
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGoBack}
                  disabled={currentStep === 'GREETING'}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-bold transition-all disabled:opacity-30 flex items-center gap-2 border border-white/5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleSkipStep}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-bold transition-all flex items-center gap-2 border border-white/5"
                >
                  Skip
                  <SkipForward className="w-4 h-4" />
                </button>
                <button 
                  onClick={onClose}
                  aria-label="Close"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/40 group-hover:text-white" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
              <div className="space-y-6 max-w-3xl mx-auto">
                <AnimatePresence>
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: msg.speaker === 'USER' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.speaker === 'USER' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] rounded-[24px] px-7 py-5 ${
                        msg.speaker === 'USER' 
                          ? 'bg-[#8eff71]/10 border border-[#8eff71]/20 text-white shadow-[0_0_30px_rgba(142,255,113,0.05)]' 
                          : 'bg-white/5 border border-white/5 text-white shadow-xl backdrop-blur-sm'
                      }`}>
                        <p className="text-[15px] leading-relaxed font-medium tracking-wide">{msg.text}</p>
                        <p className="text-[10px] font-mono text-white/20 mt-3 uppercase tracking-widest">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {msg.speaker}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                  {isAstraeusThinking && (
                    <motion.div
                      data-testid="forge-thinking-indicator"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex justify-start"
                  >
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#8eff71]/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-[#8eff71]/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-[#8eff71]/60 rounded-full animate-bounce" />
                    </div>
                  </motion.div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* Skill Forge Sidebar */}
          <div className="w-[480px] bg-black/40 backdrop-blur-md overflow-y-auto custom-scrollbar flex flex-col border-white/5">
            <div className="p-8 border-b border-white/5">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white/40 mb-1">Neural Integration</h3>
              <p className="text-[11px] text-white/20 font-mono uppercase tracking-widest">Active Skill Orchestration</p>
            </div>
            <div className="flex-1 p-4">
              <ClawHubWidget />
            </div>
          </div>
        </div>

        {/* Control Area (Bottom) */}
        <div className="border-t border-white/5 px-8 py-8 shrink-0 bg-black/80">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Status Bar */}
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.3em] pb-4 border-b border-white/5">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="text-[#8eff71] font-black">STEP</span>
                  <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">
                    {Math.min(Object.keys(CONVERSATION_FLOW).indexOf(currentStep) + 1, 9)}/9
                  </span>
                </div>
                <div className={`flex items-center gap-3 ${speechRecognitionSupported ? 'text-[#8eff71]' : 'text-red-400'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-red-500 animate-ping' : 'bg-[#8eff71]'}`} />
                  <span>LINK: {micPermission === 'granted' ? 'STABLE' : 'OPEN'}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className={`flex items-center gap-3 ${isSpeaking() ? 'text-purple-400' : 'text-white/20'}`}>
                  <Activity className="w-3 h-3" />
                  <span>OUTPUT: {isSpeaking() ? 'STREAMING' : 'IDLE'}</span>
                </div>
              </div>
            </div>

            {/* Input Row */}
            <div className="flex items-center gap-10">
              <div className="relative shrink-0">
                <motion.div 
                  initial={false}
                  animate={isListening ? { scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] } : { scale: 1, opacity: 0.3 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -inset-4 bg-[#8eff71]/20 rounded-full blur-2xl" 
                />
                <button
                  onClick={isListening ? stopListening : startListening}
                  aria-label="Voice Toggle"
                  data-testid="forge-mic-toggle"
                  className={`w-24 h-24 rounded-[32px] flex items-center justify-center transition-all relative z-10 group ${
                    isListening 
                      ? 'bg-red-500/10 border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)]' 
                      : 'bg-black border-2 border-[#8eff71]/50 hover:border-[#8eff71] shadow-[0_0_40px_rgba(142,255,113,0.1)] hover:shadow-[0_0_60px_rgba(142,255,113,0.3)]'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-9 h-9 text-red-500" />
                  ) : (
                    <Mic className="w-9 h-9 text-[#8eff71] group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>

              <div className="flex-1 relative">
                <div className="w-full bg-black/40 border border-white/10 rounded-[32px] px-10 py-8 text-white/60 font-mono text-base min-h-[100px] flex items-center shadow-inner group-hover:border-white/20 transition-colors">
                  {isListening ? (
                    <div className="flex flex-col gap-2 w-full">
                       <div className="flex items-center gap-3">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <span className="tracking-[0.2em] text-white text-xs">NEURAL IMPRINT DETECTED</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 overflow-hidden rounded-full">
                        <motion.div 
                          initial={{ x: '-100%' }}
                          animate={{ x: '100%' }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                          className="h-full w-1/3 bg-[#8eff71] shadow-[0_0_10px_#8eff71]" 
                        />
                      </div>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex items-center gap-4">
                      <Loader2 className="w-5 h-5 animate-spin text-[#8eff71]" />
                      <span className="tracking-[0.2em] text-sm">PROTOTYPING COGNITION...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <span className="tracking-[0.3em] opacity-30 text-xs italic">AWAITING NEURAL LINK...</span>
                      <span className="text-[10px] text-white/10 uppercase tracking-widest mt-1">Voice Activation Required</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
