'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLiveAPI } from '@/hooks/useLiveAPI';
import { useGemclawStore } from '@/lib/store/useGemclawStore';
import { Agent } from '@/lib/store/slices/createAgentSlice';
import { ToolResult } from '@/lib/types/live-api';

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  currentStep: 'intro' | 'description' | 'synthesis' | 'blueprint' | 'complete';
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'complete';
}

export type AgentFormData = Partial<Agent> & {
    description?: string;
    persona?: string;
    autoMaterialize?: boolean;
};

const DEFAULT_FORM_DATA: AgentFormData = {
  name: 'Nexus_Entity',
  description: '',
  systemPrompt: '',
  voiceName: 'Astraeus',
  soul: 'Analytical',
  role: 'Synthesized Intelligence',
  tools: { 
    googleSearch: true, 
    googleMaps: false,
    weather: false,
    news: false,
    crypto: false,
    calculator: false,
    semanticMemory: true 
  },
  skills: { 
    gmail: false,
    calendar: false,
    drive: false 
  },
  persona: 'Analytical',
  rules: 'Always remain objective. Prioritize user intent.',
  avatarUrl: '',
};

export function useForgeLogic() {
  const pendingManifest = useGemclawStore(state => state.pendingManifest);
  const setPendingManifest = useGemclawStore(state => state.setPendingManifest);
  
  // Local state for UI responsiveness, synced with Zustand
  const [formData, setLocalFormData] = useState<AgentFormData>((pendingManifest as AgentFormData) || DEFAULT_FORM_DATA);
  const [currentStep, setCurrentStep] = useState<VoiceState['currentStep']>('intro');
  const [status, setStatus] = useState<VoiceState['status']>('idle');
  const [showDeployment, setShowDeployment] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // Materialization logic
  //
  // finalizeMaterialization can be invoked multiple times (edit, finalize,
  // re-edit, finalize again). Each call writes the composed prompt back into
  // formData.systemPrompt via setLocalFormData, so the next call sees the
  // previously-stamped prompt as its base. To keep the operation idempotent
  // we strip the auto-stamped sections before re-stamping, BUT only when
  // we are about to re-add them. Stripping unconditionally would clobber
  // CORE DIRECTIVES content that the user/blueprint authored directly into
  // systemPrompt whenever formData.rules is empty.
  //
  // The trade-off: if formData.rules was set on a previous finalize call
  // and the user then clears it and finalizes again, the previously-stamped
  // trailer survives. That is acceptable because the alternative (always
  // strip) silently deletes author content, which is a worse failure mode.
  // The persona header gets the same conditional treatment for symmetry.
  const finalizeMaterialization = useCallback(() => {
    const rawSystemPrompt = formData.systemPrompt || `You are ${formData.name}, an AI assistant.`;

    let finalSystemPrompt = rawSystemPrompt;

    if (formData.persona) {
      // About to prepend a fresh persona header; strip any stacked existing
      // headers first so we don't accumulate duplicates across re-runs.
      finalSystemPrompt = finalSystemPrompt.replace(/^(?:\[PERSONA:[^\n]*\]\n\n)+/, '');
      finalSystemPrompt = `[PERSONA: ${formData.persona}]\n\n${finalSystemPrompt}`;
    }

    if (formData.rules) {
      // About to append a fresh directives trailer; strip an existing one
      // first. Skipping this branch preserves any user-authored CORE
      // DIRECTIVES section when rules is intentionally empty.
      finalSystemPrompt = finalSystemPrompt.replace(/\n\nCORE DIRECTIVES:\n[\s\S]*$/, '');
      finalSystemPrompt += `\n\nCORE DIRECTIVES:\n${formData.rules}`;
    }

    const finalData = { ...formData, systemPrompt: finalSystemPrompt };
    setLocalFormData(finalData);
    setPendingManifest(finalData as Partial<Agent>);
    setShowDeployment(true);
  }, [formData, setPendingManifest]);

  // Handle Tool Calls or specific responses from Live API
  const onFunctionCall = useCallback((result: ToolResult) => {
    console.log("[Forge] Neural Tool Result:", result);
  }, []);

  const { connect, disconnect, isRecording, startRecording, stopRecording } = useLiveAPI(
    '', // Security: Empty string triggers server-side proxy token fetch
    onFunctionCall
  );

  const handleSynthesis = useCallback(async (userText: string) => {
    setStatus('processing');
    setCurrentStep('synthesis');
    
    try {
      const resp = await fetch('/api/forge/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText }),
      });

      if (!resp.ok) throw new Error('Synthesis failure');
      const blueprint = await resp.json();

      const newFormData: AgentFormData = {
        ...formData,
        description: userText,
        name: blueprint.name || formData.name,
        role: blueprint.role || formData.role,
        persona: blueprint.persona || 'Analytical',
        rules: Array.isArray(blueprint.rules) ? blueprint.rules.join('. ') : (blueprint.rules || formData.rules),
        skills: { ...formData.skills, ...blueprint.skills },
        tools: { ...formData.tools, ...blueprint.tools },
        systemPrompt: blueprint.systemPrompt || formData.systemPrompt,
        avatarUrl: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${blueprint.name || 'nexus'}`
      };

      setLocalFormData(newFormData);
      setPendingManifest(newFormData as Partial<Agent>);
      setStatus('idle');
      setCurrentStep('blueprint');
      
      // Auto-finalize for MVP flow
      setTimeout(() => finalizeMaterialization(), 1500);
    } catch (err) {
      console.error("Neural Core Error:", err);
      setStatus('idle');
    }
  }, [formData, finalizeMaterialization, setPendingManifest]);

  // Initial greeting
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentStep('description');
      setStatus('listening');
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Voice State Mapping
  const voiceState: VoiceState = {
    isListening: isRecording,
    isSpeaking: false, // Managed by LiveAPI internally
    currentStep,
    status: isRecording ? 'listening' : status
  };

  return {
    formData,
    setFormData: (data: AgentFormData) => {
        setLocalFormData(data);
        setPendingManifest(data as Partial<Agent>);
    },
    voiceState,
    transcript,
    setTranscript,
    showDeployment,
    setShowDeployment,
    connect,
    disconnect,
    startListening: startRecording,
    stopListening: stopRecording,
    finalizeMaterialization,
    setCurrentStep,
    resynthesize: () => {
      setTranscript('');
      setCurrentStep('description');
      setStatus('idle');
    },
    speak: (text: string) => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
      console.log(`[Forge] Logic: ${text}`);
    },
    handleManualSubmit: handleSynthesis // For fallback/testing
  };
}
