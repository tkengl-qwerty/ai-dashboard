import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  KeyRound,
  Settings,
  X,
  ShieldCheck,
} from 'lucide-react';
import {
  verifyAdminPassword,
  triggerGitHubRefreshWorkflow,
  fetchLatestWorkflowRun,
  hasConfiguredGitHubToken,
  saveAndEncryptGitHubToken,
  updateAdminPassword,
  isSessionUnlocked,
  setSessionUnlocked,
  GITHUB_REPO_OWNER,
  GITHUB_REPO_NAME,
  GITHUB_WORKFLOW_FILE,
  WorkflowRunStatus,
} from '../utils/adminAuth';

interface AdminRefreshModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

export const AdminRefreshModal: React.FC<AdminRefreshModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [rawTokenInput, setRawTokenInput] = useState('');
  const [needsTokenInput, setNeedsTokenInput] = useState(!hasConfiguredGitHubToken());

  const [isDispatching, setIsDispatching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [latestRun, setLatestRun] = useState<WorkflowRunStatus | null>(null);
  const [isPollingRun, setIsPollingRun] = useState(false);

  // Settings drawer state (for updating password or token)
  const [showSettings, setShowSettings] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);

  const workflowPageUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${GITHUB_WORKFLOW_FILE}`;

  useEffect(() => {
    if (isOpen) {
      setNeedsTokenInput(!hasConfiguredGitHubToken());
      setAuthError(null);
      setStatusMessage(null);
      if (isSessionUnlocked()) {
        setIsUnlocked(true);
      }
      // Load latest workflow run status
      fetchLatestWorkflowRun(password).then((run) => {
        if (run) setLatestRun(run);
      });
    }
  }, [isOpen]);

  // Poll workflow status when a run is queued or in_progress
  useEffect(() => {
    if (!isOpen || !isPollingRun) return;

    const interval = setInterval(async () => {
      const run = await fetchLatestWorkflowRun(password);
      if (run) {
        setLatestRun(run);
        if (run.status === 'completed') {
          setIsPollingRun(false);
          if (run.conclusion === 'success') {
            setStatusMessage({
              type: 'success',
              text: 'GitHub Action finished building and publishing! Reloading snapshot data now...',
            });
            onRefreshData();
          } else {
            setStatusMessage({
              type: 'error',
              text: `Workflow completed with status: ${run.conclusion ?? 'unknown'}. Check GitHub Actions log for details.`,
            });
          }
        }
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [isOpen, isPollingRun, password, onRefreshData]);

  if (!isOpen) return null;

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setStatusMessage(null);

    if (verifyAdminPassword(password)) {
      setIsUnlocked(true);
      setSessionUnlocked(true);
      setNeedsTokenInput(!hasConfiguredGitHubToken());
    } else {
      setAuthError('Invalid password. Access restricted to dashboard owner.');
    }
  };

  const handleTriggerWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setStatusMessage(null);

    const activePwd = password || '';
    if (!verifyAdminPassword(activePwd)) {
      setIsUnlocked(false);
      setSessionUnlocked(false);
      setAuthError('Session expired or password changed. Please re-enter your password.');
      return;
    }

    setIsDispatching(true);
    try {
      const result = await triggerGitHubRefreshWorkflow(
        activePwd,
        rawTokenInput.trim() ? rawTokenInput.trim() : undefined
      );

      if (result.ok) {
        setRawTokenInput('');
        setNeedsTokenInput(false);
        setStatusMessage({
          type: 'success',
          text: result.message,
        });
        setIsPollingRun(true);
        setTimeout(async () => {
          const run = await fetchLatestWorkflowRun(activePwd);
          if (run) setLatestRun(run);
        }, 2500);
      } else {
        if (result.needsToken) {
          setNeedsTokenInput(true);
        }
        setStatusMessage({
          type: result.needsToken ? 'info' : 'error',
          text: result.message,
        });
      }
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsFeedback(null);

    if (rawTokenInput.trim()) {
      const tokenRes = await saveAndEncryptGitHubToken(rawTokenInput.trim(), password);
      if (!tokenRes.ok) {
        setSettingsFeedback(tokenRes.message);
        return;
      }
      setRawTokenInput('');
      setNeedsTokenInput(false);
    }

    if (newPasswordInput.trim()) {
      const pwdRes = await updateAdminPassword(password, newPasswordInput.trim());
      if (!pwdRes.ok) {
        setSettingsFeedback(pwdRes.message);
        return;
      }
      setPassword(newPasswordInput.trim());
      setNewPasswordInput('');
    }

    setSettingsFeedback('Settings saved and encrypted in browser storage.');
  };

  const handleLockSession = () => {
    setSessionUnlocked(false);
    setIsUnlocked(false);
    setPassword('');
    setShowSettings(false);
    setStatusMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-[#131b27] border border-slate-700/90 rounded-xs shadow-2xl overflow-hidden text-slate-100 font-sans">
        {/* Modal Header */}
        <div className="bg-[#192434] border-b border-slate-700/80 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isUnlocked ? (
              <Unlock className="w-4 h-4 text-sky-400" />
            ) : (
              <Lock className="w-4 h-4 text-blue-400" />
            )}
            <h2 className="text-xs font-bold tracking-wider uppercase font-display text-slate-100">
              Owner On-Demand Refresh (GitHub Action)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer p-1"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 space-y-4">
          {!isUnlocked ? (
            /* STEP 1: Password Gate */
            <form onSubmit={handleUnlockSubmit} className="space-y-3.5">
              <p className="text-xs text-slate-300 leading-relaxed">
                Enter your private admin password to unlock and trigger the{' '}
                <span className="font-mono text-sky-300">daily-5am-refresh.yml</span> GitHub Action
                for an immediate market data &amp; macro news refresh.
              </p>

              <div>
                <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5">
                  Admin Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter owner password..."
                    autoFocus
                    className="w-full bg-[#0e141d] border border-slate-700 focus:border-blue-500 rounded-xs px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              {authError && (
                <div className="flex items-start gap-2 bg-rose-950/40 border border-rose-800/60 px-3 py-2 rounded-xs text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xs transition-colors cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Unlock Refresh</span>
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: Unlocked Dispatch Controls */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#0e141d] border border-slate-800 px-3 py-2 rounded-xs">
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin Session Unlocked</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-[11px] font-mono text-slate-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3 h-3" />
                    <span>{showSettings ? 'Hide Settings' : 'Settings'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLockSession}
                    className="text-[11px] font-mono text-slate-400 hover:text-rose-300 cursor-pointer"
                  >
                    Lock
                  </button>
                </div>
              </div>

              <form onSubmit={handleTriggerWorkflow} className="space-y-3">
                {/* Confirm password if session was restored from sessionStorage without password in state */}
                {!password && (
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
                      Confirm Admin Password to Decrypt Trigger
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Re-enter password..."
                      required
                      className="w-full bg-[#0e141d] border border-slate-700 focus:border-blue-500 rounded-xs px-3 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                )}

                {/* One-time token setup if no encrypted token is stored yet */}
                {needsTokenInput && (
                  <div className="bg-[#0e141d] border border-blue-800/60 p-3 rounded-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase text-sky-300 flex items-center gap-1.5 font-semibold">
                        <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                        One-Time GitHub Action Token Setup
                      </span>
                      <a
                        href="https://github.com/settings/personal-access-tokens/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-blue-400 hover:text-sky-300 inline-flex items-center gap-1"
                      >
                        <span>Create Token</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      To trigger GitHub Actions from Porkbun static hosting, paste a GitHub
                      Fine-Grained PAT scoped to{' '}
                      <span className="text-slate-200 font-mono">
                        {GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}
                      </span>{' '}
                      with <span className="text-slate-200 font-mono">Actions: Read &amp; Write</span>
                      . It will be AES-256 encrypted with your password (or add{' '}
                      <span className="text-slate-200 font-mono">GH_WORKFLOW_TOKEN</span> in GitHub
                      Repo Secrets).
                    </p>
                    <input
                      type="password"
                      value={rawTokenInput}
                      onChange={(e) => setRawTokenInput(e.target.value)}
                      placeholder="github_pat_..."
                      className="w-full bg-[#131b27] border border-slate-700 focus:border-blue-500 rounded-xs px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isDispatching}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60 text-white text-xs font-semibold tracking-wide uppercase rounded-xs transition-colors cursor-pointer"
                >
                  {isDispatching ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Dispatching GitHub Action...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Trigger GitHub Action Refresh Now</span>
                    </>
                  )}
                </button>
              </form>

              {/* Status Feedback Banner */}
              {statusMessage && (
                <div
                  className={`flex items-start gap-2 px-3 py-2.5 rounded-xs text-xs border ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                      : statusMessage.type === 'info'
                      ? 'bg-blue-950/40 border-blue-800/60 text-sky-300'
                      : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="leading-relaxed">{statusMessage.text}</p>
                  </div>
                </div>
              )}

              {/* Latest Workflow Run Status Card */}
              <div className="bg-[#0e141d] border border-slate-800 px-3 py-2.5 rounded-xs space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>WORKFLOW: {GITHUB_WORKFLOW_FILE}</span>
                  <a
                    href={latestRun?.htmlUrl || workflowPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-sky-300 inline-flex items-center gap-1"
                  >
                    <span>Open GitHub Actions</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {latestRun ? (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                    <span className="text-slate-300">
                      Status:{' '}
                      <strong
                        className={
                          latestRun.status === 'completed'
                            ? latestRun.conclusion === 'success'
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                            : 'text-amber-300'
                        }
                      >
                        {latestRun.status.toUpperCase()}
                        {latestRun.conclusion ? ` (${latestRun.conclusion.toUpperCase()})` : ''}
                      </strong>
                    </span>
                    <span className="text-slate-400 tabular-nums">
                      {new Date(latestRun.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    Ready to dispatch on branch <span className="text-slate-300">main</span>.
                  </div>
                )}
              </div>

              {/* Optional Owner Settings Drawer (Update Static Password or Token) */}
              {showSettings && (
                <form
                  onSubmit={handleSaveSettings}
                  className="bg-[#0e141d] border border-slate-700/80 p-3 rounded-xs space-y-3"
                >
                  <div className="text-[11px] font-mono uppercase text-slate-300 font-semibold">
                    Owner Password &amp; Token Configuration
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Update Admin Password (Optional)
                    </label>
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="Leave blank to keep current password"
                      className="w-full bg-[#131b27] border border-slate-700 rounded-xs px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Update GitHub Fine-Grained Token (Actions: Read &amp; Write)
                    </label>
                    <input
                      type="password"
                      value={rawTokenInput}
                      onChange={(e) => setRawTokenInput(e.target.value)}
                      placeholder="github_pat_... (encrypted with your password)"
                      className="w-full bg-[#131b27] border border-slate-700 rounded-xs px-2.5 py-1.5 text-xs font-mono text-slate-100 placeholder-slate-500"
                    />
                  </div>

                  {settingsFeedback && (
                    <p className="text-[11px] font-mono text-sky-300">{settingsFeedback}</p>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-3 py-1 bg-slate-700 hover:bg-blue-600 text-slate-100 text-xs font-mono rounded-xs transition-colors cursor-pointer"
                    >
                      Save Settings
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
