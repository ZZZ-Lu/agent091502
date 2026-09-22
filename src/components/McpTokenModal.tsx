import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
  Sparkles,
  Server,
  Activity,
  Trash2,
  Plus,
  RefreshCw,
  Cpu,
  Layers,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMcpKey } from '../hooks/useMcpKey';
import { McpKeyItem, DEFAULT_SERVER_URL } from '../utils/mcpStorage';

interface McpTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const McpTokenModal: React.FC<McpTokenModalProps> = ({ isOpen, onClose }) => {
  const { keys, activeKey, saveKey, selectActive, removeKey } = useMcpKey();

  const [tokenInput, setTokenInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [serverUrlInput, setServerUrlInput] = useState(DEFAULT_SERVER_URL);
  const [showPassword, setShowPassword] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState<string | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency?: number;
    toolsCount?: number;
    tools?: Array<{ name: string; description: string }>;
    error?: string;
  } | null>(null);

  const [saveSuccessTip, setSaveSuccessTip] = useState(false);

  // Sync inputs when activeKey changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (activeKey) {
        setTokenInput(activeKey.token);
        setNameInput(activeKey.name);
        setServerUrlInput(activeKey.serverUrl || DEFAULT_SERVER_URL);
        setIsEditingExisting(activeKey.id);
        if (activeKey.lastTestStatus) {
          setTestResult({
            success: activeKey.lastTestStatus === 'success',
            toolsCount: activeKey.discoveredTools?.length,
            tools: activeKey.discoveredTools?.map(name => ({ name, description: '' })),
            error: activeKey.lastTestMessage,
          });
        }
      } else {
        setTokenInput('');
        setNameInput('WorkRally 默认密钥');
        setServerUrlInput(DEFAULT_SERVER_URL);
        setIsEditingExisting(null);
        setTestResult(null);
      }
    }
  }, [isOpen, activeKey]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!tokenInput.trim()) {
      setTestResult({ success: false, error: '请先填入 Token 密钥' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/mcp/workrally/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput.trim(),
          serverUrl: serverUrlInput.trim() || DEFAULT_SERVER_URL,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          latency: data.latency,
          toolsCount: data.toolsCount,
          tools: data.tools || [],
        });

        // Update active key test status in IndexedDB if editing
        if (isEditingExisting) {
          saveKey({
            id: isEditingExisting,
            name: nameInput.trim() || 'WorkRally 密钥',
            token: tokenInput.trim(),
            serverUrl: serverUrlInput.trim() || DEFAULT_SERVER_URL,
            lastTestedAt: Date.now(),
            lastTestStatus: 'success',
            discoveredTools: (data.tools || []).map((t: any) => t.name),
            isActive: true,
          });
        }
      } else {
        setTestResult({
          success: false,
          latency: data.latency,
          error: data.error || '连接失败，请检查 Token 或服务地址',
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        error: e.message || '网络请求异常',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndApply = async () => {
    if (!tokenInput.trim()) return;

    try {
      await saveKey({
        id: isEditingExisting || undefined,
        name: nameInput.trim() || 'WorkRally 密钥',
        token: tokenInput.trim(),
        serverUrl: serverUrlInput.trim() || DEFAULT_SERVER_URL,
        lastTestedAt: testResult?.success ? Date.now() : undefined,
        lastTestStatus: testResult?.success ? 'success' : undefined,
        discoveredTools: testResult?.tools?.map(t => t.name),
        isActive: true,
      });

      setSaveSuccessTip(true);
      setTimeout(() => {
        setSaveSuccessTip(false);
        onClose();
      }, 600);
    } catch (e) {
      console.error('Save MCP key failed', e);
    }
  };

  const handleSwitchKey = (item: McpKeyItem) => {
    selectActive(item.id);
    setTokenInput(item.token);
    setNameInput(item.name);
    setServerUrlInput(item.serverUrl || DEFAULT_SERVER_URL);
    setIsEditingExisting(item.id);
    setTestResult(item.lastTestStatus ? {
      success: item.lastTestStatus === 'success',
      toolsCount: item.discoveredTools?.length,
      tools: item.discoveredTools?.map(name => ({ name, description: '' })),
      error: item.lastTestMessage,
    } : null);
  };

  const handleCreateNew = () => {
    setIsEditingExisting(null);
    setNameInput(`WorkRally 密钥 ${keys.length + 1}`);
    setTokenInput('');
    setServerUrlInput(DEFAULT_SERVER_URL);
    setTestResult(null);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2">
                WorkRally MCP 密钥配置
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  IndexedDB 本地加密存储
                </span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                连接腾讯 WorkRally MCP 模型服务，驱动画布与卡片的 AI 生图 / 生视频
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Key Switcher Pills */}
          {keys.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                  已保存密钥列表 ({keys.length})
                </label>
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新建密钥
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    onClick={() => handleSwitchKey(k)}
                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                      k.isActive
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-xs'
                        : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700/80 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${k.isActive ? 'bg-blue-500' : 'bg-neutral-400'}`} />
                    <span className="truncate max-w-[140px]">{k.name}</span>
                    {k.isActive && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-blue-200/80 dark:bg-blue-900/80 rounded-md font-bold">
                        当前
                      </span>
                    )}
                    {keys.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeKey(k.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5 ml-1"
                        title="删除该密钥"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Details Form */}
          <div className="space-y-3.5 bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
            {/* Key Name */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                密钥备注名称
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="例如: 腾讯 WorkRally 官方 Token"
                className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            {/* Token Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  WorkRally MCP Token <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-neutral-500">直接填入 Token 或 Bearer 串</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Bearer your_workrally_token_here"
                  className="w-full pl-3 pr-10 py-2 text-sm font-mono rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Server Endpoint URL */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                MCP 服务端点 URL
              </label>
              <input
                type="text"
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder={DEFAULT_SERVER_URL}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-neutral-600 dark:text-neutral-300 text-xs"
              />
            </div>

            {/* Test Connection Button & Status */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !tokenInput.trim()}
                className="w-full py-2 px-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    正在握手并探测 MCP 服务与工具...
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5" />
                    测试连接与探测注册工具
                  </>
                )}
              </button>

              {/* Test Output Box */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1.5">
                      {testResult.success ? (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                      {testResult.success ? 'MCP 握手成功并已就绪' : '连接失败'}
                    </span>
                    {testResult.latency !== undefined && (
                      <span className="font-mono text-[11px] opacity-75">
                        延迟: {testResult.latency}ms
                      </span>
                    )}
                  </div>

                  {testResult.error && (
                    <div className="text-[11px] text-red-700 dark:text-red-300 whitespace-pre-wrap">
                      {testResult.error}
                    </div>
                  )}

                  {testResult.tools && testResult.tools.length > 0 && (
                    <div className="pt-1">
                      <div className="text-[11px] font-medium opacity-90 mb-1">
                        已探测到 {testResult.tools.length} 个可用模型工具：
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {testResult.tools.map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 font-mono text-[10px]"
                            title={t.description}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MCP JSON Schema Reference Info */}
          <div className="text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-100/70 dark:bg-neutral-800/40 p-3 rounded-xl border border-neutral-200/50 dark:border-neutral-800 flex items-start gap-2">
            <Cpu className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <div>
              <div className="font-medium text-neutral-700 dark:text-neutral-300">MCP 生态标准化连接</div>
              <div>
                生图或生视频时，系统将通过 MCP 协议自动向该服务发起调用，并智能适配提示词、画幅比例与参考图参数。
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="text-xs text-neutral-500">
            {saveSuccessTip && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 已保存至 IndexedDB
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={!tokenInput.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              保存并设为当前密钥
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
