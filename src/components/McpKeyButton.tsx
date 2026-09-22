import React, { useState } from 'react';
import { KeyRound, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useMcpKey } from '../hooks/useMcpKey';
import { McpTokenModal } from './McpTokenModal';

export const McpKeyButton: React.FC = () => {
  const { activeKey, keys } = useMcpKey();
  const [modalOpen, setModalOpen] = useState(false);

  const hasKey = !!activeKey?.token;
  const isTested = activeKey?.lastTestStatus === 'success';

  return (
    <>
      <button
        type="button"
        data-agent-target="top-right-mcp-key-btn"
        onClick={() => setModalOpen(true)}
        onPointerDown={(e) => e.stopPropagation()}
        className={`h-[36px] px-2.5 rounded-2xl corner-squircle border shadow-md flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer ${
          hasKey
            ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
            : 'bg-gray-100 dark:bg-neutral-800 border-gray-200/80 dark:border-[#404040]/80 text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-700'
        }`}
        title={
          hasKey
            ? `WorkRally MCP: ${activeKey.name} (${isTested ? '已连接' : '已配置'})`
            : '配置 WorkRally MCP 生图生视频密钥'
        }
      >
        <KeyRound className="w-3.5 h-3.5" />
        <span className="hidden sm:inline-block max-w-[110px] truncate">
          {hasKey ? activeKey.name : 'MCP 密钥'}
        </span>
        {hasKey ? (
          <span
            className={`w-2 h-2 rounded-full ${
              isTested ? 'bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-900' : 'bg-blue-500'
            }`}
          />
        ) : (
          <span className="w-2 h-2 rounded-full bg-amber-400" />
        )}
      </button>

      <McpTokenModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};
