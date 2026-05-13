'use client';

import React, { useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
import { Cpu, Zap, Radio, Boxes } from 'lucide-react';

const ItemTypes = {
  NODE: 'node',
};

interface DragNodeProps {
  id: string;
  name: string;
  left: number;
  top: number;
  icon: React.ElementType;
}

const DraggableNode = ({ id, name, left, top, icon: Icon }: DragNodeProps) => {
  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: ItemTypes.NODE,
      item: { id, left, top },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [id, left, top]
  );

  return (
    <motion.div
      ref={dragRef as any}
      initial={{ scale: 0 }}
      animate={{ scale: isDragging ? 1.05 : 1, opacity: isDragging ? 0.5 : 1 }}
      className="absolute flex cursor-grab flex-col items-center justify-center space-y-2 rounded-2xl border border-gemigram-neon/30 bg-black/60 p-4 shadow-[0_0_20px_rgba(16,255,135,0.15)] backdrop-blur-xl transition hover:border-gemigram-neon/60 hover:shadow-[0_0_30px_rgba(16,255,135,0.3)] active:cursor-grabbing"
      style={{ left, top }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gemigram-neon/10">
        <Icon className="h-6 w-6 text-gemigram-neon" />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
        {name}
      </span>
      {/* Connector dot */}
      <div className="absolute -bottom-1 h-2 w-2 rounded-full bg-gemigram-neon shadow-[0_0_10px_rgba(16,255,135,0.8)]" />
    </motion.div>
  );
};

export const SpatialCanvas = () => {
  const [nodes, setNodes] = useState<{ [key: string]: DragNodeProps }>({
    'core-node': { id: 'core-node', name: 'ClawHub Core', left: 100, top: 100, icon: Boxes },
    'sensory-node': { id: 'sensory-node', name: 'Sensory', left: 300, top: 200, icon: Radio },
    'thalamic-node': { id: 'thalamic-node', name: 'Thalamic Gate', left: 200, top: 400, icon: Cpu },
    'galaxy-node': { id: 'galaxy-node', name: 'Galaxy Sync', left: 450, top: 150, icon: Zap },
  });

  const [, dropRef] = useDrop(
    () => ({
      accept: ItemTypes.NODE,
      drop: (item: { id: string; left: number; top: number }, monitor) => {
        const delta = monitor.getDifferenceFromInitialOffset();
        if (delta) {
          const left = Math.round(item.left + delta.x);
          const top = Math.round(item.top + delta.y);
          setNodes((prev) => ({
            ...prev,
            [item.id]: {
              ...prev[item.id],
              left,
              top,
            },
          }));
        }
        return undefined;
      },
    }),
    [setNodes]
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-black outline-none" ref={dropRef as any}>
      {/* Cyberpunk Grid Background */}
      <div 
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: 'linear-gradient(rgba(16, 255, 135, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 255, 135, 0.2) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      
      {/* Canvas Area */}
      <div className="absolute inset-0z-10 h-full w-full">
        {Object.keys(nodes).map((key) => (
          <DraggableNode key={key} {...nodes[key]} />
        ))}
      </div>
      
      {/* Title */}
      <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/40">
          Spatial Workspace /// <span className="text-gemigram-neon">Active</span>
        </h2>
      </div>
    </div>
  );
};
