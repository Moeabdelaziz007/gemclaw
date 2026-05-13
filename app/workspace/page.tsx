'use client';

import React, { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Smartphone } from 'lucide-react';
import { useWorkspaceLogic } from '@/lib/hooks/useWorkspaceLogic';
import { PureVoiceCanvas } from '@/components/workspace/PureVoiceCanvas';
import { SpatialCanvas } from '@/components/spatial/SpatialCanvas';
import { AddToHomeScreen } from '@/components/ui/AddToHomeScreen';

/**
 * 🛰️ Workspace Content Component
 * Encapsulates the neural logic and voice interface.
 * Separated to allow for a Suspense boundary at the page level.
 */
function WorkspaceContent() {
  const { user, activeAgent, isLoading, hasError, errorDetails } = useWorkspaceLogic();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black px-4 py-10">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5 text-center">
          <div className="relative mx-auto h-20 w-20 sm:h-24 sm:w-24">
            <div className="absolute inset-0 rounded-full border-2 border-gemigram-neon/20" />
            <motion.div
              className="absolute inset-0 rounded-full border-t-2 border-gemigram-neon"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
          <div className="space-y-2">
            <p className="text-base font-medium text-white/70">Connecting Neural Link</p>
            <p className="text-[10px] uppercase tracking-widest text-white/30">Synchronizing Agent Matrix...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black p-4 sm:p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-red-500/20 bg-black/40 p-6 backdrop-blur-xl sm:p-8"
        >
          <div className="mb-5 flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-400" />
            <h2 className="text-xl font-bold text-white">Neural Link Failure</h2>
          </div>
          <p className="mb-6 text-white/60">{errorDetails || 'Failed to initialize workspace environment.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-3 font-bold uppercase tracking-widest text-red-400 transition-all hover:bg-red-500/20"
          >
            Reinitialize System
          </button>
        </motion.div>
      </div>
    );
  }

  if (!activeAgent) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <AlertCircle className="mx-auto h-8 w-8 text-gemigram-neon/40 animate-pulse" />
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/20">Awaiting_Neural_Link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      {/* 📱 Installation Trigger */}
      <AnimatePresence>
        {!showInstallPrompt && (
          <motion.button
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            onClick={() => setShowInstallPrompt(true)}
            className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-full border border-gemigram-neon/30 bg-[#050B14]/60 p-2 pl-4 pr-4 text-[10px] font-black uppercase tracking-widest text-gemigram-neon backdrop-blur-xl transition-all hover:bg-gemigram-neon hover:text-black active:scale-95 shadow-[0_0_20px_rgba(16,255,135,0.2)]"
          >
            <Smartphone className="h-3 w-3" />
            Deploy Agent
          </motion.button>
        )}
      </AnimatePresence>

      {/* 🚀 Add to Home Screen Modal */}
      <AnimatePresence>
        {showInstallPrompt && (
          <AddToHomeScreen 
            agent={activeAgent} 
            userId={user.uid} 
            onClose={() => setShowInstallPrompt(false)} 
          />
        )}
      </AnimatePresence>

      {/* ✨ Spatial Drag & Drop Workspace */}
      <div className="absolute inset-0 z-0">
        <SpatialCanvas />
      </div>

      {/* 🎙️ Voice Interface */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="pointer-events-auto h-full w-full">
          <PureVoiceCanvas activeAgent={activeAgent} />
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center bg-black">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-2 border-gemigram-neon/20" />
          <motion.div
            className="absolute inset-0 rounded-full border-t-2 border-gemigram-neon"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>
    }>
      <WorkspaceContent />
    </Suspense>
  );
}
