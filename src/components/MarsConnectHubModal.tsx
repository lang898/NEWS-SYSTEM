import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Lock,
  ExternalLink,
  Zap,
  RefreshCw,
  Sparkles,
  Layers,
  AlertCircle,
  HelpCircle,
  Puzzle,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { SourceId, AccountSession } from '../types';
import { SOURCES_CONFIG } from '../data/sources';

interface MarsConnectHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Record<SourceId, AccountSession>;
  onUpdateSession: (sourceId: SourceId, session: AccountSession) => void;
  targetSourceId?: SourceId;
}

export const MarsConnectHubModal: React.FC<MarsConnectHubModalProps> = ({
  isOpen,
  onClose,
  sessions,
  onUpdateSession,
  targetSourceId,
}) => {
  const [selectedSource, setSelectedSource] = useState<SourceId>(targetSourceId || 'caixin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [marsConnectToken, setMarsConnectToken] = useState('mc_auth_caixin_99812x_live');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSource = SOURCES_CONFIG[selectedSource];
  const currentSession = sessions[selectedSource];
  const isConnected = currentSession?.isConnected;

  const handleConnectMarsConnect = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const response = await fetch('/api/accounts/marsconnect/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionInstalled: true,
          token: marsConnectToken,
          accountId: username || 'caixin_mars_user',
        }),
      });
      const data = await response.json();
      if (data.success) {
        onUpdateSession('caixin', data.session);
        // 诚实提示：这是演示会话，并未真正连接财新账户或解锁任何付费内容
        setSyncFeedback('✅ MarsConnect 演示会话已建立（未连接真实财新账户，不解锁任何付费内容）。');
      } else {
        setSyncFeedback('❌ 演示会话建立失败，请稍后重试。');
      }
    } catch (e: any) {
      // 不在本地伪造"已连接"的会话
      setSyncFeedback('❌ 无法连接服务端，演示会话未建立。');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const response = await fetch('/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: selectedSource,
          username,
          password,
          apiToken,
        }),
      });
      const data = await response.json();
      if (data.success) {
        onUpdateSession(selectedSource, data.session);
        setSyncFeedback(`✅ ${currentSource.nameCn} 演示会话已建立（未连接真实订阅账户）。如需阅读付费内容，请前往官网登录。`);
      } else {
        setSyncFeedback('❌ 演示会话建立失败，请稍后重试。');
      }
    } catch (e) {
      // 不在本地伪造"已连接"的会话
      setSyncFeedback(`❌ 无法连接服务端，${currentSource.nameCn} 演示会话未建立。`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = () => {
    onUpdateSession(selectedSource, {
      sourceId: selectedSource,
      isConnected: false,
    });
    setSyncFeedback(`已断开 ${currentSource.nameCn} 连接。`);
  };

  return (
    <div
      id="marsconnect-hub-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col my-auto relative text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>多源财经账号一站式鉴权与 MarsConnect 插件网关</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  安全沙箱存储
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                “有账户的就登录，没账户的也可以以后想要登录的时候在这一个网站登录就可以了”
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Left Column: Source Selection List */}
          <div className="md:col-span-4 p-4 space-y-2 bg-slate-50">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 block">
              支持一键绑定的媒体源
            </span>
            {Object.values(SOURCES_CONFIG).map((src) => {
              const sess = sessions[src.id];
              const isSelected = selectedSource === src.id;
              return (
                <button
                  key={src.id}
                  onClick={() => {
                    setSelectedSource(src.id);
                    setSyncFeedback(null);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {src.supportsMarsConnect ? (
                      <Puzzle className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-red-600'}`} />
                    ) : (
                      <KeyRound className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    )}
                    <div>
                      <div className="font-bold text-xs">{src.nameCn}</div>
                      <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                        {src.name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {sess?.isConnected ? (
                      <span className={`text-[10px] font-mono font-bold flex items-center gap-1 ${
                        isSelected ? 'text-emerald-200' : 'text-emerald-600'
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        已联通
                      </span>
                    ) : (
                      <span className={`text-[10px] ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                        未登录
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Connection Details & Forms */}
          <div className="md:col-span-8 p-6 space-y-6">
            {/* Header info of selected source */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{currentSource.nameCn}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium border ${currentSource.badgeBg}`}>
                    {currentSource.name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  专家评语: {currentSource.userReview} · (综合评级: {currentSource.stars}分)
                </p>
              </div>

              {isConnected && (
                <button
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-1 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>退出/断开连接</span>
                </button>
              )}
            </div>

            {/* Sync Feedback Message */}
            {syncFeedback && (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium animate-fadeIn">
                {syncFeedback}
              </div>
            )}

            {/* Connection Mode A: MarsConnect Chrome Extension (Special support for Caixin) */}
            {currentSource.supportsMarsConnect ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <Puzzle className="w-5 h-5 text-red-600" />
                    <div>
                      <h4 className="text-sm font-bold text-red-950">
                        财新 MarsConnect Chrome 扩展插件协议桥接
                      </h4>
                      <p className="text-xs text-red-700 mt-0.5">
                        本系统已内置 MarsConnect 插件通信握手模块，可直接读取已授权的财新 Token，实现免登录畅读。
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-700 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      <span>插件状态: <strong>已就绪 (MarsConnect v2.4 协议兼容)</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                      <span>权限范围: <strong>财新通、财新周刊、数据通深度机构特稿</strong></span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleConnectMarsConnect}
                      disabled={isSyncing}
                      className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? '正在与 MarsConnect 插件握手...' : '立即通过 MarsConnect 插件一键联通'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-center text-xs text-slate-400">或者使用财新账号密码常规登录</div>
              </div>
            ) : null}

            {/* Connection Mode B: Standard Username/Password or API Key */}
            <form onSubmit={handleManualLogin} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-blue-600" />
                <span>{currentSource.nameCn} 账号直连配置</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    订阅账户 / 邮箱 / 机构 ID
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={`输入 ${currentSource.name} 用户名`}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    账户密码 / 动态授权码
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  API Token / Terminal Secret (选填)
                </label>
                <input
                  type="text"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="如 Bloomberg Anywhere / Reuters Eikon API 密钥"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  加密密钥仅保存在本地客户端，不经过第三方中间服务器。
                </span>
                <button
                  type="submit"
                  disabled={isSyncing}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition"
                >
                  {isSyncing ? '验证登录中...' : isConnected ? '更新登录凭据' : '立即登录并保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
