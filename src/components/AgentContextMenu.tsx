import React, { useEffect, useRef } from 'react';
import { Sparkles, Image as ImageIcon, Trash2, Wand2, ArrowUp } from 'lucide-react';
import { motion } from 'motion/react';

interface AgentContextMenuProps {
  key?: string;
  isOpen: boolean;
  x: number;
  y: number;
  targetId: string | null;
  agentPrompt: string;
  onPromptChange: (val: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onAction: (actionType: string, targetId: string | null) => void;
}

export function AgentContextMenu({
  isOpen, x, y, targetId, agentPrompt, onPromptChange, onSubmit, onClose, onAction
}: AgentContextMenuProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed z-[100] flex flex-col gap-2 pointer-events-auto"
      style={{ top: y, left: x }}
      onPointerDown={e => e.stopPropagation()} // Prevent canvas drag
      onContextMenu={e => e.preventDefault()} // Prevent another context menu inside
    >
      {/* Agent Avatar / Bubble */}
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.25, delay: 0.2, type: 'spring' }}
        className="flex items-center gap-2 mb-1"
      >
        <div className="bg-purple-600 text-white dark:bg-purple-900 dark:text-purple-100 text-[13px] px-3.5 py-1.5 rounded-2xl corner-squircle shadow-md font-medium whitespace-nowrap ml-1 origin-bottom-left border border-purple-500/30 dark:border-purple-700/50">
          {targetId ? "选中了这组内容，要调整什么？" : "我能帮什么忙？"}
        </div>
      </motion.div>

      {/* Main Menu Panel */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        transition={{ duration: 0.15 }}
        className="bg-gray-100 dark:bg-neutral-800 border border-gray-200/80 dark:border-[#404040]/80 shadow-[0_12px_40px_rgb(0,0,0,0.12)] rounded-2xl corner-squircle w-[260px] overflow-hidden"
      >
        {/* Input Area */}
        <div className="p-2 flex items-center gap-1 border-b border-gray-100 dark:border-[#404040]">
          <input
            ref={inputRef}
            value={agentPrompt}
            onChange={e => onPromptChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && agentPrompt.trim()) {
                onSubmit();
                onClose();
              }
            }}
            placeholder="输入指令..."
            className="flex-1 min-w-0 px-2 py-1 bg-transparent text-[14px] text-gray-800 dark:text-neutral-200 placeholder-gray-400 dark:placeholder-neutral-500 outline-none font-medium"
          />
          <button
            onClick={() => {
              if (agentPrompt.trim()) {
                onSubmit();
                onClose();
              }
            }}
            disabled={!agentPrompt.trim()}
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${
              agentPrompt.trim()
                ? 'bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500'
                : 'bg-gray-100 text-gray-400 dark:bg-neutral-800 dark:text-neutral-500 cursor-not-allowed'
            }`}
          >
            <ArrowUp size={15} strokeWidth={2.5} />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="p-1.5 flex flex-col">
          {targetId ? (
            <>
              <ActionButton icon={<Wand2 size={14} />} label="生成变体" onClick={() => { onAction('variant', targetId); onClose(); }} />
              <ActionButton icon={<ImageIcon size={14} />} label="设为参考图" onClick={() => { onAction('reference', targetId); onClose(); }} />
              <ActionButton icon={<Trash2 size={14} />} label="删除卡片" destructive onClick={() => { onAction('delete', targetId); onClose(); }} />
            </>
          ) : (
            <>
              <ActionButton icon={<Sparkles size={14} />} label="新建生图卡片" onClick={() => { onAction('new_card', null); onClose(); }} />
              <ActionButton icon={<Trash2 size={14} />} label="清理画布" destructive onClick={() => { onAction('clear', null); onClose(); }} />
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, destructive = false }: { icon: React.ReactNode, label: string, onClick: () => void, destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors text-left ${
        destructive 
          ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950' 
          : 'text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-800'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}