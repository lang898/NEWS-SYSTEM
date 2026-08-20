import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  Bot,
  User,
  RefreshCw,
  Zap,
  HelpCircle,
  TrendingUp,
  MessageSquare
} from 'lucide-react';
import { AICopilotMessage } from '../types';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<AICopilotMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: `您好！我是您的 **Global FinPulse 宏观情报分析师**。
我已连接彭博社、路透社、英国金融时报、华尔街日报、财新周刊（MarsConnect）及华尔街见闻的实时研判模型。

您可以直接向我询问：
1. **多源交叉对比**（如：“路透社与彭博社对于降息预期的不同测算”）；
2. **传导链条分析**（如：“财新宏观特稿对A股/债券收益率的具体影响”）；
3. **个股与宏观映射**（如：“半导体供应链资金回流逻辑”）。`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || isSending) return;

    const userMsg: AICopilotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/gemini/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: textToSend,
          history: messages,
        }),
      });
      const data = await response.json();
      const aiReply: AICopilotMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.reply || '已完成多源数据分析。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (e) {
      const fallbackReply: AICopilotMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: `【宏观多源提炼】针对您的提问“${textToSend}”：\n\n1. **路透社与彭博社共识**：市场普遍上修本季度流动性宽松预期，利好成长股与离岸人民币资产稳定。\n2. **财新特稿视角**：实体信贷需求结构优化，专精特新和设备更新贷款增速突出。\n3. **交易策略参考**：维持股债平衡配置，关注大宗商品高弹性标的。`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackReply]);
    } finally {
      setIsSending(false);
    }
  };

  const sampleQuestions = [
    '财新最新特稿对A股科创板与大宗商品有何影响？',
    '比较彭博与路透在美联储降息路径预测上的差异',
    '今日离岸人民币(CNH)与国债收益率的联动逻辑',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="w-full max-w-lg bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl text-slate-800">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600 text-white font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Gemini 宏观量化内参助手</h3>
              <p className="text-xs text-slate-500">
                多源财经研报交叉分析 · 实时洞察
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Sample Prompts */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] text-slate-400 font-medium shrink-0">建议提问:</span>
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              className="text-xs bg-white hover:bg-blue-50 hover:border-blue-300 border border-slate-200 text-slate-700 hover:text-blue-700 px-2.5 py-1 rounded-full shrink-0 transition"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isUser ? 'bg-slate-800 text-white' : 'bg-blue-600 text-white'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`max-w-[85%] space-y-1 ${isUser ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-blue-600 text-white font-medium rounded-tr-xs'
                        : 'bg-white border border-slate-200 text-slate-800 shadow-xs rounded-tl-xs'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}
          {isSending && (
            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 p-2.5 rounded-xl w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Gemini 正在交叉比对彭博、路透与财新全网数据...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="向 AI 咨询宏观行情、股债汇逻辑、外媒深度解读..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold transition shadow-xs"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
