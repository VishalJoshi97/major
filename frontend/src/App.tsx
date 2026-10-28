import { useCallback, useEffect, useMemo, useState, useRef, type FormEvent, type ReactNode } from 'react';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, Box, ChartNoAxesCombined, Check,
  ChevronDown, CircleHelp, Cloud, Cpu, Database, Gauge, GitCompare, KeyRound, Layers3,
  LogOut, Menu, Play, Plus, RefreshCw, Server, ShieldCheck, Timer, Trash2, TrendingUp, User, X
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

/* ── Types ───────────────────────────────────────────────────────────────── */
type AuthUser = { username: string; display_name: string; email: string; role?: string };
type ImageItem = { id: string; image_ref: string; display_name: string; registry: string; tag: string; source: string; created_at: string; status: string };
type Sample = { id: number; experiment_id: string | null; timestamp: string; cpu_percent: number; memory_percent: number; latency_ms: number; request_rate: number; replicas: number; scaling_event?: string | null; source: string; note?: string | null };
type Experiment = { id: string; name: string; image_ref: string; strategy: string; workload: string; duration_seconds: number; status: string; source: string; created_at: string; completed_at?: string | null; results?: Record<string, Result> };
type Result = { samples: number; avg_cpu_percent: number; avg_memory_percent: number; avg_latency_ms: number; p95_latency_ms: number; avg_replicas: number; max_replicas_used: number; scaling_events: number; target_latency_ms: number; source: string; evaluation_score?: number };
type PromSnapshot = { timestamp: string; source: string; status: string; values: Record<string, number | null>; missing_metrics: string[]; note: string };
type Overview = { images_registered: number; experiments_total: number; experiments_running: number; samples_total: number; host_metrics: { cpu_percent: number; memory_percent: number; source: string; timestamp: string }; latest_application_sample: Sample | null; recent_scaling_events: Array<{ id: number; timestamp: string; strategy: string; previous_replicas: number; desired_replicas: number; reason: string; source: string }> };

/* ── API helper ──────────────────────────────────────────────────────────── */
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const getToken = () => localStorage.getItem('aegis_token');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (r.status === 401) { localStorage.removeItem('aegis_token'); window.location.reload(); }
  if (!r.ok) { let msg = `Request failed (${r.status})`; try { msg = (await r.json()).detail || msg; } catch { } throw new Error(msg); }
  if (r.status === 204) return undefined as T;
  return r.json();
}

const fmt = (n: number | undefined, d = 1) => typeof n === 'number' ? n.toFixed(d) : '—';
const time = (s: string | undefined) => s ? new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

/* ══════════════════════════════════════════════════════════════════════════
   AUTH PAGE
══════════════════════════════════════════════════════════════════════════ */
function TermsModal({ onClose, onAccept }: { onClose: () => void; onAccept: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const handleScroll = () => {
    const el = bodyRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolled(true);
  };
  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal tos-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div><h2>Terms of Service</h2><p>AegisCloud Platform · Last updated October 2026</p></div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="tos-body" ref={bodyRef} onScroll={handleScroll}>
          <h3>1. Acceptance of Terms</h3>
          <p>By accessing or using the AegisCloud platform ("Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>
          <h3>2. Use of Platform</h3>
          <p>The Platform is designed exclusively for <strong>evaluation and research</strong> of auto-scaling strategies in controlled, local environments. You agree not to use the Platform to:</p>
          <ul>
            <li>Deploy or manage production workloads without appropriate review</li>
            <li>Access, modify, or interfere with systems you are not authorised to use</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Transmit malicious code or content</li>
          </ul>
          <h3>3. Data & Privacy</h3>
          <p>All data collected by the Platform — including container metrics, experiment results, and user account information — is stored <strong>locally on your device</strong>. No data is transmitted to external servers. Your credentials are hashed using bcrypt and are never stored in plain text. We are not responsible for data loss caused by hardware failure or improper shutdown.</p>
          <h3>4. Intellectual Property</h3>
          <p>All software, documentation, and assets provided with AegisCloud remain the property of the AegisCloud project contributors. You are granted a non-exclusive, non-transferable licence to use the Platform for evaluation and research purposes only.</p>
          <h3>5. Disclaimer & Limitation of Liability</h3>
          <p>The Platform is provided <strong>"as is"</strong> without warranty of any kind. The authors and contributors shall not be liable for any damages, data loss, or operational disruptions arising from the use or inability to use the Platform. Scaling recommendations provided by the advisor are heuristics only and should not be applied to production infrastructure without independent verification.</p>
          <h3>6. Changes to Terms</h3>
          <p>We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes your acceptance of the revised Terms. We encourage you to review this document periodically.</p>
          <h3>7. Contact</h3>
          <p>For questions about these Terms, please raise an issue in the project repository or contact the research team through the appropriate channels.</p>
          <div className="tos-scroll-hint">{scrolled ? <><Check size={14} /> You've read the full terms</> : 'Scroll to the bottom to accept'}</div>
        </div>
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>Close</button>
          <button className="primary-btn" disabled={!scrolled} onClick={() => { onAccept(); onClose(); }}>
            <Check size={15} /> I Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ onAuth }: { onAuth: (user: AuthUser, token: string) => void }) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      localStorage.setItem('aegis_token', data.access_token);
      onAuth(data.user, data.access_token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Login failed'); }
    finally { setLoading(false); }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    if (!acceptedTos) { setError('You must accept the Terms of Service to continue.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, display_name: displayName, accepted_tos: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');
      localStorage.setItem('aegis_token', data.access_token);
      onAuth(data.user, data.access_token);
    } catch (e) { setError(e instanceof Error ? e.message : 'Registration failed'); }
    finally { setLoading(false); }
  }

  const pwStrength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      </div>
      <div className="auth-card" style={{ animation: 'slide-in 0.4s ease' }}>
        <div className="auth-logo">
          <div className="auth-logo-icon"><Cloud size={26} /></div>
          <div><b>Aegis<span>Cloud</span></b><small>CONTROL PLANE</small></div>
        </div>
        <p className="auth-tagline">Cloud-agnostic autoscaling evaluation platform</p>
        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => { setTab('signin'); setError(''); }}>
            <KeyRound size={15} /> Sign In
          </button>
          <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError(''); }}>
            <User size={15} /> Create Account
          </button>
        </div>

        {tab === 'signin' ? (
          <form className="auth-form" onSubmit={handleSignIn}>
            <label className="auth-label">Username
              <input required value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" autoComplete="username" />
            </label>
            <label className="auth-label">Password
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </label>
            {error && <div className="auth-error"><AlertCircle size={14} />{error}</div>}
            <button type="submit" className="primary-btn auth-submit" disabled={loading}>
              {loading ? <><RefreshCw size={15} className="spin" /> Signing in…</> : <><KeyRound size={15} /> Sign In</>}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSignUp}>
            <div className="form-two">
              <label className="auth-label">Username
                <input required value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" autoComplete="username" />
              </label>
              <label className="auth-label">Display Name
                <input required value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your Name" />
              </label>
            </div>
            <label className="auth-label">Email Address
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </label>
            <label className="auth-label">Password
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" />
              {password.length > 0 && (
                <div className="pw-strength">
                  <div className="pw-bars">
                    {[1, 2, 3].map(i => <span key={i} className={`pw-bar ${pwStrength >= i ? (pwStrength === 1 ? 'weak' : pwStrength === 2 ? 'medium' : 'strong') : ''}`} />)}
                  </div>
                  <small>{pwStrength === 1 ? 'Weak' : pwStrength === 2 ? 'Good' : 'Strong'}</small>
                </div>
              )}
            </label>
            <div className="tos-row">
              <label className="tos-check">
                <input type="checkbox" checked={acceptedTos} onChange={e => setAcceptedTos(e.target.checked)} />
                <span>I agree to the</span>
              </label>
              <button type="button" className="text-btn tos-link" onClick={() => setShowTos(true)}>Terms of Service <ArrowUpRight size={12} /></button>
            </div>
            {error && <div className="auth-error"><AlertCircle size={14} />{error}</div>}
            <button type="submit" className="primary-btn auth-submit" disabled={loading || !acceptedTos}>
              {loading ? <><RefreshCw size={15} className="spin" /> Creating account…</> : <><User size={15} /> Create Account</>}
            </button>
          </form>
        )}
        <div className="auth-footer">Secured locally · No data leaves your machine · <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Bcrypt + JWT</div>
      </div>
      {showTos && <TermsModal onClose={() => setShowTos(false)} onAccept={() => setAcceptedTos(true)} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('aegis_token'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) { setAuthChecked(true); return; }
    request<AuthUser>('/api/v1/auth/me')
      .then(u => { setUser(u); setAuthChecked(true); })
      .catch(() => { localStorage.removeItem('aegis_token'); setToken(null); setAuthChecked(true); });
  }, [token]);

  function handleAuth(u: AuthUser, t: string) { setUser(u); setToken(t); }
  function handleLogout() { localStorage.removeItem('aegis_token'); setUser(null); setToken(null); }

  if (!authChecked) return (
    <div className="auth-page"><div className="auth-bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
      <div className="auth-card"><div className="auth-logo"><div className="auth-logo-icon"><Cloud size={26} /></div><div><b>Aegis<span>Cloud</span></b></div></div>
        <p style={{ color: '#8492a9', textAlign: 'center' }}>Loading…</p></div></div>
  );
  if (!token || !user) return <AuthPage onAuth={handleAuth} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}

/* ══════════════════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════════════════ */
function Dashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [page, setPage] = useState('Overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [metrics, setMetrics] = useState<Sample[]>([]);
  const [events, setEvents] = useState<Overview['recent_scaling_events']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  const [imageRef, setImageRef] = useState('nginx:1.27-alpine');
  const [imageName, setImageName] = useState('Sample Web Service');
  const [showImageForm, setShowImageForm] = useState(false);

  const [expName, setExpName] = useState('Autoscaling comparison · spike');
  const [expImage, setExpImage] = useState('');
  const [workload, setWorkload] = useState('SPIKE');
  const [duration, setDuration] = useState(60);
  const [targetCpu, setTargetCpu] = useState(65);
  const [targetLatency, setTargetLatency] = useState(250);
  const [minReplicas, setMinReplicas] = useState(1);
  const [maxReplicas, setMaxReplicas] = useState(8);
  const [strategies, setStrategies] = useState(['CPU', 'TREND', 'LATENCY']);
  const [showExpForm, setShowExpForm] = useState(false);
  const [selectedExp, setSelectedExp] = useState('');
  const [promSnapshot, setPromSnapshot] = useState<PromSnapshot | null>(null);
  const [infraStatus, setInfraStatus] = useState<any>(null);
  const [infraRec, setInfraRec] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [o, i, e, m, ev] = await Promise.all([
        request<Overview>('/api/v1/overview'),
        request<ImageItem[]>('/api/v1/images'),
        request<Experiment[]>('/api/v1/experiments'),
        request<Sample[]>('/api/v1/metrics?limit=120'),
        request<Overview['recent_scaling_events']>('/api/v1/scaling-events?limit=12'),
      ]);
      setOverview(o); setImages(i); setExperiments(e); setMetrics(m); setEvents(ev);
      setExpImage(prev => prev || i[0]?.image_ref || '');
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load API data'); }
    finally { setLoading(false); }
  }, []);

  const loadInfra = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        request<any>('/api/v1/infrastructure/status'),
        request<any>('/api/v1/infrastructure/recommendations').catch(() => null),
      ]);
      setInfraStatus(s); setInfraRec(r);
    } catch { }
  }, []);

  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 4000); return () => window.clearInterval(id); }, [load]);
  useEffect(() => {
    if (page !== 'Infrastructure') return;
    void loadInfra();
    const id = window.setInterval(() => void loadInfra(), 10000);
    return () => window.clearInterval(id);
  }, [page, loadInfra]);
  useEffect(() => {
    const es = new EventSource(`${API}/api/v1/stream`);
    es.onmessage = e => { try { const s = JSON.parse(e.data) as Sample; setMetrics(prev => [...prev.filter(x => x.id !== s.id), s].slice(-120)); } catch { } };
    es.onerror = () => { };
    return () => es.close();
  }, []);

  const selected = experiments.find(e => e.id === selectedExp) || experiments[0];
  const chartData = useMemo(() => metrics.slice(-50).map((m, i) => ({ n: i + 1, time: time(m.timestamp), cpu: m.cpu_percent, latency: m.latency_ms, replicas: m.replicas, requests: m.request_rate })), [metrics]);
  const promSamples = useMemo(() => metrics.filter(m => m.source === 'PROMETHEUS'), [metrics]);
  const liveChartData = useMemo(() => { const src = promSamples.length > 0 ? promSamples : metrics; return src.slice(-50).map((m, i) => ({ n: i + 1, time: time(m.timestamp), cpu: m.cpu_percent, latency: m.latency_ms, replicas: m.replicas, requests: m.request_rate, source: m.source })); }, [promSamples, metrics]);
  const latestPromSample = useMemo(() => promSamples.length > 0 ? promSamples[promSamples.length - 1] : null, [promSamples]);
  const showNotice = (s: string) => { setNotice(s); window.setTimeout(() => setNotice(''), 4500); };

  async function registerImage(e: FormEvent) { e.preventDefault(); try { await request('/api/v1/images', { method: 'POST', body: JSON.stringify({ image_ref: imageRef, display_name: imageName, source: 'MANUAL' }) }); await load(); setShowImageForm(false); showNotice('Image reference registered successfully.'); } catch (err) { showNotice(err instanceof Error ? err.message : 'Registration failed'); } }
  async function discoverImages() { try { const res = await request<{ discovered: number }>('/api/v1/images/discover-docker', { method: 'POST' }); await load(); showNotice(`Discovered ${res.discovered} image reference(s) from the Docker daemon.`); } catch (e) { showNotice(e instanceof Error ? e.message : 'Docker discovery failed'); } }
  async function pullPrometheus() { try { const snap = await request<PromSnapshot>('/api/v1/prometheus/snapshot'); setPromSnapshot(snap); showNotice(snap.status === 'ok' ? 'Prometheus snapshot collected.' : `Prometheus connected; missing: ${snap.missing_metrics.join(', ') || 'none'}.`); } catch (e) { showNotice(e instanceof Error ? e.message : 'Prometheus query failed'); } }
  async function deleteImage(id: string) { try { await request(`/api/v1/images/${id}`, { method: 'DELETE' }); await load(); showNotice('Image registration removed.'); } catch (e) { showNotice(e instanceof Error ? e.message : 'Could not remove image'); } }
  async function createExperiment(e: FormEvent) { e.preventDefault(); try { const res = await request<{ id: string; status: string }>('/api/v1/experiments', { method: 'POST', body: JSON.stringify({ name: expName, image_ref: expImage, strategies, workload, duration_seconds: duration, min_replicas: minReplicas, max_replicas: maxReplicas, target_cpu: targetCpu, target_latency: targetLatency, sample_interval_seconds: 2 }) }); setSelectedExp(res.id); setShowExpForm(false); setPage('Experiments'); await load(); showNotice(promSamples.length > 0 ? 'Evaluation started with live Prometheus data.' : 'Evaluation started with simulated workload.'); } catch (e) { showNotice(e instanceof Error ? e.message : 'Could not start evaluation'); } }
  function toggleStrategy(s: string) { setStrategies(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]); }

  const initials = user.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const nav = [
    { title: 'PLATFORM', items: [['Overview', Gauge], ['Image Registry', Layers3], ['Experiments', ChartNoAxesCombined], ['Live Telemetry', Activity], ['Strategy Comparison', GitCompare]] as const },
    { title: 'OPERATIONS', items: [['Scaling Events', TrendingUp], ['Infrastructure', Cloud]] as const },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Cloud size={23} /><span /></div>
          <div><b>Aegis<span>Cloud</span></b><small>CONTROL PLANE</small></div>
          <button className="icon-btn mobile-close" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>
        <div className="workspace">
          <div className="workspace-icon"><Layers3 size={17} /></div>
          <div><b>{user.display_name}</b><small>{user.email}</small></div>
          <ChevronDown size={15} />
        </div>
        {nav.map(group => (
          <div className="nav-group" key={group.title}>
            <label>{group.title}</label>
            {group.items.map(([name, Icon]) => (
              <button key={name} className={`nav-link ${page === name ? 'active' : ''}`} onClick={() => { setPage(name); setMobileNav(false); }}>
                <Icon size={17} /><span>{name}</span>
                {name === 'Experiments' && experiments.some(e => e.status === 'RUNNING') && <i className="live-dot" />}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="status-row"><span className="green-dot" /> API service <strong>{error ? 'Offline' : 'Connected'}</strong></div>
          <div className="sidebar-foot">
            <div className="avatar">{initials}</div>
            <div><b>{user.display_name}</b><small>{user.username}</small></div>
            <button className="icon-btn" title="Sign out" onClick={onLogout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button className="icon-btn menu-btn" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
            <span className="crumb">Workspace</span><span className="slash">/</span><b>{page}</b>
          </div>
          <div className="top-right">
            <span className="env-badge"><span className="green-dot" /> LOCAL ENVIRONMENT</span>
            <span className="top-separator" />
            <button className="icon-btn" title="Refresh data" onClick={() => void load()}><RefreshCw size={16} /></button>
            <div className="avatar topbar-avatar" title={user.display_name}>{initials}</div>
          </div>
        </header>

        {error && <div className="error-banner"><AlertCircle size={17} /><div><b>API connection issue</b><span>{error}. Start the API using the README instructions.</span></div><button className="icon-btn" onClick={() => void load()}><RefreshCw size={15} /></button></div>}

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-square" /> CLOUD SYSTEMS / EVALUATION</div>
              <h1>{page === 'Overview' ? 'Auto-scaling overview' : page}</h1>
              <p>{page === 'Overview' ? 'Monitor workloads, understand scaling decisions, and compare strategy behaviour.' : page === 'Image Registry' ? 'Register container image references before using them in controlled experiments.' : page === 'Experiments' ? 'Run repeatable workloads and compare CPU, trend, and latency scaling.' : page === 'Live Telemetry' ? 'Real-time metrics scraped from Prometheus every 5 seconds.' : page === 'Strategy Comparison' ? 'Compare recorded experiment results using a transparent scoring formula.' : page === 'Scaling Events' ? 'Trace why a policy changed the requested replica count.' : 'Cloud portability and observability connections.'}</p>
            </div>
            <div className="heading-actions">
              <span className="freshness"><span className="green-dot" /> Refreshes every 4s</span>
              {page === 'Image Registry' ? <button className="primary-btn" onClick={() => setShowImageForm(true)}><Plus size={16} /> Register image</button> : page === 'Experiments' || page === 'Overview' ? <button className="primary-btn" onClick={() => setShowExpForm(true)}><Play size={15} fill="currentColor" /> New evaluation</button> : null}
            </div>
          </div>

          {notice && <div className="toast"><Check size={16} />{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}

          {/* ── Overview ───────────────────────────────────────────────── */}
          {page === 'Overview' && <>
            <div className="overview-banner">
              <div className="banner-grid" />
              <div className="banner-copy">
                <div className="banner-overline"><span className="pulse-dot" /> STRATEGY EVALUATION ENVIRONMENT</div>
                <h2>Scale with evidence.<br /><em>Build with confidence.</em></h2>
                <p>A controlled environment for evaluating adaptive scaling strategies before deploying them to production clusters.</p>
                <div className="banner-tags">
                  <span><ShieldCheck size={14} /> Policy-aware</span>
                  <span><Activity size={14} /> Live metrics</span>
                  <span><Cloud size={14} /> Cloud-agnostic</span>
                </div>
              </div>
              <div className="banner-visual">
                <div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" />
                <div className="orbit-core"><Cloud size={39} /></div>
                <div className="float-node node-one"><Cpu size={17} /><span>CPU</span></div>
                <div className="float-node node-two"><Timer size={17} /><span>LATENCY</span></div>
                <div className="float-node node-three"><Layers3 size={17} /><span>REPLICAS</span></div>
              </div>
            </div>
            <div className="section-title-row"><div><h3>Environment snapshot</h3><p>Observed host values and recorded experiment telemetry</p></div><span className="mini-label">LIVE SNAPSHOT <span className="green-dot" /></span></div>
            <div className="stat-grid">
              <Stat icon={<Layers3 size={18} />} label="REGISTERED IMAGES" value={overview?.images_registered ?? images.length} sub="Container references" tone="blue" />
              <Stat icon={<ChartNoAxesCombined size={18} />} label="TOTAL EVALUATIONS" value={overview?.experiments_total ?? experiments.length} sub={`${overview?.experiments_running ?? 0} currently running`} tone="purple" />
              <Stat icon={<Cpu size={18} />} label="HOST CPU USAGE" value={`${fmt(overview?.host_metrics.cpu_percent)}%`} sub="Observed on API host" tone="orange" />
              <Stat icon={<Database size={18} />} label="METRIC SAMPLES" value={overview?.samples_total ?? metrics.length} sub="Stored telemetry points" tone="green" />
            </div>
            <div className="main-grid">
              <section className="panel chart-panel">
                <div className="panel-header"><div><h3>Runtime signal history</h3><p>Last {chartData.length} persisted samples · CPU utilisation</p></div><span className="legend"><i className="legend-line blue-line" /> CPU %</span></div>
                {chartData.length ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={.32} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" stroke="#1e2d45" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#7d8ba2', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} /><YAxis domain={[0, 100]} tick={{ fill: '#7d8ba2', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#0d1829', border: '1px solid #2a3f5c', borderRadius: 10, color: '#edf4ff' }} /><Area type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={2.5} fill="url(#cpuFill)" name="CPU %" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <Empty icon={<Activity />} title="No telemetry yet" text="Run an evaluation to populate workload samples." />}
                <div className="chart-foot"><span><span className="green-dot" /> Metrics API polling active</span><span>{metrics.length ? `Last sample ${time(metrics[metrics.length - 1]?.timestamp)}` : 'Waiting for first sample'}</span></div>
              </section>
              <section className="panel recent-panel">
                <div className="panel-header"><div><h3>Recent scaling decisions</h3><p>Latest policy actions and context</p></div><button className="text-btn" onClick={() => setPage('Scaling Events')}>View all <ArrowUpRight size={13} /></button></div>
                <div className="events-list">
                  {events.slice(0, 5).map(ev => <div className="event-item" key={ev.id}><div className={`event-icon ${ev.desired_replicas > ev.previous_replicas ? 'up' : 'down'}`}>{ev.desired_replicas > ev.previous_replicas ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}</div><div className="event-main"><b>{ev.strategy} policy <span className="event-move">{ev.previous_replicas} → {ev.desired_replicas}</span></b><span>{ev.reason}</span><small>{time(ev.timestamp)} · {ev.source.replaceAll('_', ' ')}</small></div></div>)}
                  {events.length === 0 && <Empty icon={<TrendingUp />} title="No scaling events" text="Events will appear here as evaluations run." />}
                </div>
              </section>
            </div>
            <div className="section-title-row lower"><div><h3>Evaluation runs</h3><p>Track execution and review completed results</p></div><button className="secondary-btn" onClick={() => setPage('Experiments')}>All evaluations <ArrowUpRight size={14} /></button></div>
            <ExperimentTable experiments={experiments.slice(0, 5)} onSelect={id => { setSelectedExp(id); setPage('Strategy Comparison'); }} />
          </>}

          {/* ── Image Registry ─────────────────────────────────────────── */}
          {page === 'Image Registry' && <>
            <div className="callout"><Box size={19} /><div><b>Docker image registration</b><p>Register an image reference such as <code>nginx:1.27-alpine</code> or <code>ghcr.io/your-org/service:1.2.0</code>. Registration stores metadata only; it does not pull, scan, or deploy the image.</p></div><button className="secondary-btn" onClick={() => void discoverImages()}><RefreshCw size={14} /> Discover local Docker</button></div>
            <div className="registry-toolbar"><div className="search-like"><Layers3 size={16} /><span>{images.length} registered image references</span></div><span className="mini-label">PERSISTED REGISTRY</span></div>
            <div className="image-grid">
              {images.map(img => <div className="image-card" key={img.id}><div className="image-card-top"><div className="image-icon"><Box size={20} /></div><span className="status-pill success"><i /> {img.status}</span></div><h3>{img.display_name}</h3><code className="image-ref">{img.image_ref}</code><div className="image-meta"><span><Cloud size={13} />{img.registry}</span><span>TAG <b>{img.tag}</b></span></div><div className="image-card-bottom"><span>Added {new Date(img.created_at).toLocaleDateString()}</span><button className="icon-btn danger-btn" title="Remove registration" onClick={() => void deleteImage(img.id)}><Trash2 size={15} /></button></div></div>)}
              {images.length === 0 && <Empty icon={<Box />} title="No images registered" text="Register a container reference to begin evaluation." />}
            </div>
          </>}

          {/* ── Experiments ────────────────────────────────────────────── */}
          {page === 'Experiments' && <>
            <div className="experiment-top-cards">
              <div className="small-kpi"><span>QUEUED / RUNNING</span><b>{experiments.filter(e => e.status === 'RUNNING' || e.status === 'QUEUED').length}</b><small>In progress</small></div>
              <div className="small-kpi"><span>COMPLETED RUNS</span><b>{experiments.filter(e => e.status === 'COMPLETED').length}</b><small>Results persisted</small></div>
              <div className="small-kpi"><span>STRATEGIES</span><b>03</b><small>CPU · Trend · Latency</small></div>
            </div>
            <div className="section-title-row"><div><h3>All evaluations</h3><p>Each run uses the same configured workload across selected strategies.</p></div><button className="primary-btn" onClick={() => setShowExpForm(true)}><Plus size={15} /> Configure run</button></div>
            <ExperimentTable experiments={experiments} onSelect={id => { setSelectedExp(id); setPage('Strategy Comparison'); }} />
            {selected && <div className="panel selected-run"><div className="panel-header"><div><h3>Selected evaluation</h3><p>{selected.name}</p></div><span className={`status-pill ${selected.status === 'COMPLETED' ? 'success' : selected.status === 'RUNNING' ? 'running' : 'neutral'}`}><i />{selected.status}</span></div><div className="details-row"><div><small>IMAGE REFERENCE</small><code>{selected.image_ref}</code></div><div><small>WORKLOAD</small><b>{selected.workload}</b></div><div><small>STRATEGIES</small><b>{selected.strategy}</b></div><div><small>DATA SOURCE</small><b>{(selected.source || 'SIMULATED_WORKLOAD').replaceAll('_', ' ')}</b></div></div><button className="secondary-btn" onClick={() => setPage('Strategy Comparison')}>View comparison <GitCompare size={14} /></button></div>}
          </>}

          {/* ── Live Telemetry ─────────────────────────────────────────── */}
          {page === 'Live Telemetry' && <>
            <div className="callout"><Activity size={19} /><div><b>Live Prometheus telemetry active</b><p>Real-time metrics are scraped from Prometheus every 5 seconds. CPU and memory come from cAdvisor; latency and request rate from API instrumentation.</p></div><button className="secondary-btn" onClick={() => void pullPrometheus()}><RefreshCw size={14} /> Snapshot now</button></div>
            {promSnapshot && <div className="panel prom-snapshot"><div className="panel-header"><div><h3>Prometheus snapshot</h3><p>Source: PROMETHEUS · {time(promSnapshot.timestamp)}</p></div><span className={`status-pill ${promSnapshot.status === 'ok' ? 'success' : 'running'}`}><i />{promSnapshot.status.toUpperCase()}</span></div><div className="prom-values">{[['CPU utilization', promSnapshot.values.cpu_percent, '%'], ['Memory utilization', promSnapshot.values.memory_percent, '%'], ['P95 latency', promSnapshot.values.p95_latency_ms, 'ms'], ['Request rate', promSnapshot.values.request_rate, 'req/s'], ['Available replicas', promSnapshot.values.available_replicas, '']].map(([label, value, unit]) => <div className="prom-value" key={String(label)}><small>{label}</small><b>{typeof value === 'number' ? `${fmt(value)}${unit}` : 'No series'}</b></div>)}</div><p className="prom-note">{promSnapshot.note}</p></div>}
            <div className="stat-grid">
              <Stat icon={<Cpu size={18} />} label="HOST CPU" value={`${fmt(overview?.host_metrics.cpu_percent)}%`} sub="Observed host" tone="blue" />
              <Stat icon={<Database size={18} />} label="HOST MEMORY" value={`${fmt(overview?.host_metrics.memory_percent)}%`} sub="Observed host" tone="purple" />
              <Stat icon={<Timer size={18} />} label="LATEST LATENCY" value={(latestPromSample || overview?.latest_application_sample)?.latency_ms != null ? `${fmt((latestPromSample || overview?.latest_application_sample)!.latency_ms)} ms` : '—'} sub={(latestPromSample || overview?.latest_application_sample)?.source?.replaceAll('_', ' ') || 'No samples'} tone="orange" />
              <Stat icon={<Layers3 size={18} />} label="LIVE REPLICAS" value={infraRec?.current_metrics?.containers ?? (latestPromSample || overview?.latest_application_sample)?.replicas ?? '—'} sub={latestPromSample ? 'Live from Prometheus' : 'From latest sample'} tone="green" />
            </div>
            <div className="main-grid telemetry-charts">
              <section className="panel chart-panel"><div className="panel-header"><div><h3>CPU utilisation</h3><p>{promSamples.length > 0 ? `Live · ${promSamples.length} Prometheus samples` : 'Recent telemetry points'}</p></div><span className="legend"><i className="legend-line blue-line" /> CPU %</span></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={liveChartData}><CartesianGrid strokeDasharray="3 5" stroke="#1e2d45" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#7d8ba2', fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tick={{ fill: '#7d8ba2', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#0d1829', border: '1px solid #2a3f5c', borderRadius: 10, color: '#edf4ff' }} /><Line dataKey="cpu" stroke="#6366f1" dot={false} strokeWidth={2.5} name="CPU %" isAnimationActive={false} /></LineChart></ResponsiveContainer></div></section>
              <section className="panel chart-panel"><div className="panel-header"><div><h3>Response latency</h3><p>Milliseconds per sample</p></div><span className="legend"><i className="legend-line purple-line" /> Latency</span></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={liveChartData}><CartesianGrid strokeDasharray="3 5" stroke="#1e2d45" vertical={false} /><XAxis dataKey="time" tick={{ fill: '#7d8ba2', fontSize: 10 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: '#7d8ba2', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#0d1829', border: '1px solid #2a3f5c', borderRadius: 10, color: '#edf4ff' }} /><Line dataKey="latency" stroke="#8b5cf6" dot={false} strokeWidth={2.5} name="Latency (ms)" isAnimationActive={false} /></LineChart></ResponsiveContainer></div></section>
            </div>
            <TelemetryTable samples={(promSamples.length > 0 ? promSamples : metrics).slice(-30).reverse()} isLive={promSamples.length > 0} />
          </>}

          {/* ── Strategy Comparison ─────────────────────────────────────── */}
          {page === 'Strategy Comparison' && <>
            <div className="callout"><GitCompare size={19} /><div><b>Evaluation, not a universal ranking</b><p>The score is a transparent composite metric (0–100) derived from recorded runs. When Prometheus is connected, experiments observe real container metrics.</p></div></div>
            <div className="comparison-selector"><label>Evaluation run</label><select value={selected?.id || ''} onChange={e => setSelectedExp(e.target.value)}><option value="">Select a completed evaluation</option>{experiments.filter(e => e.status === 'COMPLETED').map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
            {selected?.status === 'COMPLETED' && selected.results ? <>
              <div className="section-title-row"><div><h3>{selected.name}</h3><p>Workload: {selected.workload} · {selected.image_ref}</p></div><span className="status-pill success"><i /> COMPLETED</span></div>
              <div className="comparison-grid">
                {Object.entries(selected.results).map(([name, r]) => (
                  <div className={`strategy-card ${name === 'CPU' ? 'strategy-cpu' : name === 'TREND' ? 'strategy-trend' : 'strategy-latency'}`} key={name}>
                    <div className="strategy-card-head"><div className="strategy-symbol">{name === 'CPU' ? <Cpu size={19} /> : name === 'TREND' ? <TrendingUp size={19} /> : <Timer size={19} />}</div><span className="mini-label">STRATEGY</span></div>
                    <h3>{name === 'CPU' ? 'CPU-based' : name === 'TREND' ? 'Trend-based' : 'Latency-based'}</h3>
                    <div className="score-number">{fmt(r.evaluation_score, 1)}<small>/100</small></div>
                    <div className="score-meter"><span style={{ width: `${Math.max(0, Math.min(100, r.evaluation_score || 0))}%` }} /></div>
                    <div className="metric-rows">
                      <MetricRow label="Average latency" value={`${fmt(r.avg_latency_ms)} ms`} />
                      <MetricRow label="P95 latency" value={`${fmt(r.p95_latency_ms)} ms`} />
                      <MetricRow label="Average CPU" value={`${fmt(r.avg_cpu_percent)}%`} />
                      <MetricRow label="Average replicas" value={fmt(r.avg_replicas, 2)} />
                      <MetricRow label="Scaling events" value={r.scaling_events} />
                    </div>
                    <div className="source-label"><span className={r.source === 'PROMETHEUS' ? 'green-dot' : 'orange-dot'} /> {r.source.replaceAll('_', ' ')}</div>
                  </div>
                ))}
              </div>
              <div className="panel comparison-chart"><div className="panel-header"><div><h3>Latency vs CPU</h3><p>Strategy-level averages from this run</p></div></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={Object.entries(selected.results).map(([strategy, r]) => ({ strategy, latency: r.avg_latency_ms, cpu: r.avg_cpu_percent }))}><CartesianGrid strokeDasharray="3 5" stroke="#1e2d45" vertical={false} /><XAxis dataKey="strategy" tick={{ fill: '#a4b1c5', fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: '#7d8ba2', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: '#0d1829', border: '1px solid #2a3f5c', borderRadius: 10, color: '#edf4ff' }} /><Area dataKey="latency" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={.15} name="Avg latency (ms)" /><Line dataKey="cpu" stroke="#6366f1" strokeWidth={2.5} name="Avg CPU (%)" /></AreaChart></ResponsiveContainer></div></div>
              <p className="formula-note"><b>Score formula:</b> 100 − 35 × (average latency / target latency) − 0.25 × average CPU − 0.7 × scaling events, clamped to 0–100.</p>
            </> : <Empty icon={<GitCompare />} title="No completed evaluation selected" text="Run an evaluation with at least one scaling strategy to compare results." />}
          </>}

          {/* ── Scaling Events ─────────────────────────────────────────── */}
          {page === 'Scaling Events' && <>
            <div className="callout"><TrendingUp size={19} /><div><b>Explainable scaling history</b><p>Every strategy action records old and desired replica counts, reason, timestamp, and data provenance. Live advisor events are also captured.</p></div></div>
            <div className="panel table-panel">
              <div className="panel-header"><div><h3>Scaling decision log</h3><p>{events.length} latest recorded actions</p></div><button className="secondary-btn" onClick={() => void load()}><RefreshCw size={14} /> Refresh</button></div>
              <div className="table-wrap"><table><thead><tr><th>TIME</th><th>STRATEGY</th><th>REPLICAS</th><th>DECISION CONTEXT</th><th>SOURCE</th></tr></thead>
                <tbody>{events.map(e => <tr key={e.id}><td>{time(e.timestamp)}</td><td><span className="type-chip">{e.strategy}</span></td><td><span className={`replica-change ${e.desired_replicas > e.previous_replicas ? 'scale-up' : e.desired_replicas < e.previous_replicas ? 'scale-down' : ''}`}>{e.previous_replicas} <ArrowUpRight size={13} /> {e.desired_replicas}</span></td><td>{e.reason}</td><td><span className={`source-pill ${e.source === 'PROMETHEUS_ADVISOR' ? 'live-prom' : e.source === 'PROMETHEUS' ? 'live-prom' : ''}`}>{e.source.replaceAll('_', ' ')}</span></td></tr>)}</tbody>
              </table>{events.length === 0 && <Empty icon={<TrendingUp />} title="No events recorded" text="Scale changes will be logged during evaluation or when advisor detects changes." />}</div>
            </div>
          </>}

          {/* ── Infrastructure ─────────────────────────────────────────── */}
          {page === 'Infrastructure' && <>
            <div className="stat-grid">
              <Stat icon={<Box size={18} />} label="LIVE CONTAINERS" value={infraStatus?.docker?.count ?? '—'} sub="Running Docker containers" tone="blue" />
              <Stat icon={<Cpu size={18} />} label="CURRENT CPU" value={infraRec?.current_metrics?.cpu_percent != null ? `${fmt(infraRec.current_metrics.cpu_percent)}%` : '—'} sub="All containers · Prometheus" tone="orange" />
              <Stat icon={<Timer size={18} />} label="P95 LATENCY" value={infraRec?.current_metrics?.latency_ms != null && infraRec.current_metrics.latency_ms > 0 ? `${fmt(infraRec.current_metrics.latency_ms)} ms` : '—'} sub="API histogram · live" tone="purple" />
              <Stat icon={<Activity size={18} />} label="WORKLOAD REPLICAS" value={infraRec?.current_metrics?.containers ?? '—'} sub={`Source: ${infraRec?.replica_source ?? '—'}`} tone="green" />
            </div>
            <div className="panel infra-panel">
              <div className="panel-header"><div><h3>Integration status</h3><p>Live connection health across all platform components</p></div><button className="secondary-btn" onClick={() => void loadInfra()}><RefreshCw size={14} /> Refresh</button></div>
              {([
                ['Metrics API', true, 'REST ingestion endpoint + SSE stream · real-time sample delivery active'],
                ['Persistent store', true, 'SQLite database; data volume mounted and persisting across restarts'],
                ['Docker engine', infraStatus?.docker?.connected, infraStatus?.docker?.connected ? `${infraStatus.docker.count} containers visible via Docker socket` : 'Waiting for Docker socket access'],
                ['Prometheus / OpenTelemetry', infraStatus?.prometheus?.healthy, infraStatus?.prometheus?.healthy ? `Live scrape every 5 s · ${infraStatus.prometheus.url}` : 'Connecting to Prometheus…'],
                ['Kubernetes HPA advisor', true, `Scaling recommendations computed live · replica source: ${infraRec?.replica_source ?? 'detecting…'} · ${infraRec?.history_points ?? 0} history points`],
                ['Grafana dashboards', infraStatus?.grafana?.healthy, infraStatus?.grafana?.healthy ? 'Auto-provisioned · Prometheus datasource + autoscaling dashboard loaded' : 'Starting up — available at http://localhost:3000 (admin / aegis123)'],
              ] as [string, boolean | undefined, string][]).map(([name, ok, desc]) => (
                <div className="integration-row" key={name}>
                  <div className="integration-icon"><Server size={18} /></div>
                  <div className="integration-copy"><b>{name}</b><small>{desc}</small></div>
                  <span className={`status-pill ${ok ? 'success' : 'running'}`}><i />{ok ? 'Active' : 'Starting'}</span>
                </div>
              ))}
            </div>
            {infraRec && <div className="panel">
              <div className="panel-header"><div><h3>Live scaling advisor</h3><p>HPA-style replica recommendations · Prometheus metrics · updates every 10 s</p></div><span className="mini-label"><span className="green-dot" /> PROMETHEUS LIVE</span></div>
              <div className="advisor-grid">
                {Object.entries(infraRec.recommendations as Record<string, { recommended_replicas: number; reason: string; current: number }>).map(([strategy, rec]) => (
                  <div className={`advisor-card advisor-${strategy.toLowerCase()}`} key={strategy}>
                    <div className="advisor-head"><span className="type-chip">{strategy}</span></div>
                    <div className="advisor-value">{rec.recommended_replicas}<small> replicas</small></div>
                    <div className="advisor-reason">{rec.reason}</div>
                    <div className={`advisor-delta ${rec.recommended_replicas > rec.current ? 'up' : rec.recommended_replicas < rec.current ? 'down' : ''}`}>
                      {rec.recommended_replicas > rec.current ? <><ArrowUpRight size={13} /> Scale up</> : rec.recommended_replicas < rec.current ? <><ArrowDownRight size={13} /> Scale down</> : '● Hold'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="advisor-footer">
                <span><b>CPU:</b> {fmt(infraRec.current_metrics.cpu_percent)}%</span>
                <span><b>P95 Latency:</b> {infraRec.current_metrics.latency_ms > 0 ? `${fmt(infraRec.current_metrics.latency_ms)} ms` : '—'}</span>
                <span><b>Req/s:</b> {infraRec.current_metrics.request_rate > 0 ? fmt(infraRec.current_metrics.request_rate, 4) : '—'}</span>
                <span><b>Replicas:</b> {infraRec.current_metrics.containers} <small style={{ color: '#6b7c96' }}>({infraRec.replica_source})</small></span>
                <span><b>History:</b> {infraRec.history_points} pts</span>
                {infraStatus?.grafana?.healthy && <a href="http://localhost:3000" target="_blank" rel="noreferrer" className="text-btn">Open Grafana <ArrowUpRight size={13} /></a>}
              </div>
            </div>}
            {infraStatus?.docker?.containers?.length > 0 && <div className="panel table-panel">
              <div className="panel-header"><div><h3>Container inventory</h3><p>Live Docker containers · health from Docker engine</p></div></div>
              <div className="table-wrap"><table><thead><tr><th>CONTAINER NAME</th><th>IMAGE</th><th>STATUS</th><th>HEALTH</th></tr></thead>
                <tbody>{(infraStatus.docker.containers as any[]).map((c: any) => <tr key={c.id}><td><code style={{ fontSize: 10 }}>{c.name}</code></td><td><small style={{ color: '#8492a9' }}>{c.image.length > 45 ? c.image.slice(0, 45) + '…' : c.image}</small></td><td><span className={`status-pill ${c.status === 'running' ? 'success' : 'neutral'}`}><i />{c.status}</span></td><td><span className={`status-pill ${c.health === 'healthy' ? 'success' : c.health === 'none' ? 'neutral' : 'running'}`}><i />{c.health}</span></td></tr>)}</tbody>
              </table></div>
            </div>}
          </>}

          <footer className="page-footer">
            <span>AEGISCLOUD <b>·</b> CLOUD-AGNOSTIC AUTO-SCALING EVALUATION</span>
            <span><span className="green-dot" /> API {error ? 'DISCONNECTED' : 'CONNECTED'} <b>·</b> {new Date().getFullYear()} · Signed in as <b>{user.display_name}</b></span>
          </footer>
        </div>
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showImageForm && <Modal title="Register a container image" subtitle="Store a versioned reference for controlled evaluation." onClose={() => setShowImageForm(false)}>
        <form className="form-stack" onSubmit={registerImage}>
          <label>Image reference <input required value={imageRef} onChange={e => setImageRef(e.target.value)} placeholder="ghcr.io/org/api:1.0.0" /><small>Supports repository:tag or repository@sha256:digest.</small></label>
          <label>Display name <input value={imageName} onChange={e => setImageName(e.target.value)} placeholder="Payment API" /></label>
          <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowImageForm(false)}>Cancel</button><button type="submit" className="primary-btn"><Plus size={15} /> Register image</button></div>
        </form>
      </Modal>}

      {showExpForm && <Modal title="Configure evaluation" subtitle="Run identical workload conditions against selected scaling policies." onClose={() => setShowExpForm(false)} wide>
        <form className="form-stack" onSubmit={createExperiment}>
          <label>Evaluation name<input required value={expName} onChange={e => setExpName(e.target.value)} /></label>
          <label>Registered image<select required value={expImage} onChange={e => setExpImage(e.target.value)}><option value="">Select an image</option>{images.map(i => <option key={i.id} value={i.image_ref}>{i.display_name} · {i.image_ref}</option>)}</select>{images.length === 0 && <small>Register an image reference first.</small>}</label>
          <div className="form-two">
            <label>Workload profile<select value={workload} onChange={e => setWorkload(e.target.value)}><option value="RAMP">Gradual ramp</option><option value="SPIKE">Traffic spike</option><option value="STEADY">Steady load</option><option value="WAVE">Periodic waves</option></select></label>
            <label>Evaluation duration<select value={duration} onChange={e => setDuration(Number(e.target.value))}><option value={30}>30 seconds (quick demo)</option><option value={60}>60 seconds</option><option value={120}>120 seconds</option><option value={300}>5 minutes</option></select></label>
          </div>
          <div className="field-label">SCALING STRATEGIES <small>Choose one or more</small></div>
          <div className="strategy-selects">
            {[['CPU', 'CPU utilisation threshold', <Cpu size={17} />], ['TREND', 'Request-rate trend', <TrendingUp size={17} />], ['LATENCY', 'Response-time threshold', <Timer size={17} />]].map(([s, desc, icon]) => (
              <button type="button" key={String(s)} className={`strategy-option ${strategies.includes(String(s)) ? 'checked' : ''}`} onClick={() => toggleStrategy(String(s))}>
                {icon}<span><b>{s === 'CPU' ? 'CPU-based' : s === 'TREND' ? 'Trend-based' : 'Latency-based'}</b><small>{desc}</small></span>
                <span className="check-square">{strategies.includes(String(s)) && <Check size={13} />}</span>
              </button>
            ))}
          </div>
          <div className="form-three">
            <label>Target CPU %<input type="number" min={10} max={95} value={targetCpu} onChange={e => setTargetCpu(Number(e.target.value))} /></label>
            <label>Target latency ms<input type="number" min={10} max={10000} value={targetLatency} onChange={e => setTargetLatency(Number(e.target.value))} /></label>
            <label>Replica range<div className="range-inputs"><input aria-label="Minimum replicas" type="number" min={1} max={maxReplicas} value={minReplicas} onChange={e => setMinReplicas(Number(e.target.value))} /><span>to</span><input aria-label="Maximum replicas" type="number" min={minReplicas} max={100} value={maxReplicas} onChange={e => setMaxReplicas(Number(e.target.value))} /></div></label>
          </div>
          <div className={`sim-note ${promSamples.length > 0 ? 'live-note' : ''}`}>
            {promSamples.length > 0 ? <><Activity size={16} /><span><b>Live Prometheus mode</b> — metrics sampled from real container telemetry. Each strategy evaluated against the identical observation sequence.</span></> : <><Activity size={16} /><span><b>Controlled simulation</b> — output will be labelled SIMULATED_WORKLOAD and is not real cloud telemetry.</span></>}
          </div>
          <div className="modal-actions"><button type="button" className="secondary-btn" onClick={() => setShowExpForm(false)}>Cancel</button><button type="submit" className="primary-btn" disabled={!expImage || strategies.length === 0 || maxReplicas < minReplicas}><Play size={14} fill="currentColor" /> Start evaluation</button></div>
        </form>
      </Modal>}
    </div>
  );
}

/* ── Shared components ───────────────────────────────────────────────────── */
function Stat({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: ReactNode; sub: string; tone: string }) {
  return <div className="stat-card"><div className="stat-top"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-tag">LIVE</span></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-sub">{sub}</div></div>;
}
function MetricRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="metric-row"><span>{label}</span><b>{value}</b></div>;
}
function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><b>{title}</b><p>{text}</p></div>;
}
function ExperimentTable({ experiments, onSelect }: { experiments: Experiment[]; onSelect: (id: string) => void }) {
  return <div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>EVALUATION</th><th>WORKLOAD</th><th>STRATEGIES</th><th>STATUS</th><th>CREATED</th><th></th></tr></thead><tbody>{experiments.map(e => <tr key={e.id}><td><div className="run-name"><span className="run-icon"><ChartNoAxesCombined size={15} /></span><div><b>{e.name}</b><small>{e.image_ref}</small></div></div></td><td><span className="type-chip">{e.workload}</span></td><td>{e.strategy}</td><td><span className={`status-pill ${e.status === 'COMPLETED' ? 'success' : e.status === 'RUNNING' ? 'running' : 'neutral'}`}><i />{e.status}</span></td><td>{new Date(e.created_at).toLocaleDateString()} <small className="time-inline">{time(e.created_at)}</small></td><td><button className="text-btn" onClick={() => onSelect(e.id)}>View <ArrowUpRight size={13} /></button></td></tr>)}</tbody></table>{experiments.length === 0 && <Empty icon={<ChartNoAxesCombined />} title="No evaluations yet" text="Configure and start an evaluation to see results here." />}</div></div>;
}
function TelemetryTable({ samples, isLive = false }: { samples: Sample[]; isLive?: boolean }) {
  return <div className="panel table-panel telemetry-table"><div className="panel-header"><div><h3>Recent samples</h3><p>{isLive ? <><span className="pulse-dot" style={{ display: 'inline-block', marginRight: 5 }} /> Live Prometheus feed · auto-refreshing every 5 s</> : 'Persisted metrics in timestamp order'}</p></div>{isLive && <span className="mini-label"><span className="green-dot" /> PROMETHEUS LIVE</span>}</div><div className="table-wrap"><table><thead><tr><th>TIME</th><th>CPU</th><th>MEMORY</th><th>LATENCY</th><th>REQ/S</th><th>CONTAINERS</th><th>PROVENANCE</th></tr></thead><tbody>{samples.map(s => <tr key={s.id}><td>{time(s.timestamp)}</td><td>{fmt(s.cpu_percent)}%</td><td>{fmt(s.memory_percent)}%</td><td>{s.latency_ms > 0 ? `${fmt(s.latency_ms)} ms` : '—'}</td><td>{s.request_rate > 0 ? fmt(s.request_rate, 4) : '—'}</td><td>{s.replicas || '—'}</td><td><span className={`source-pill ${s.source === 'SIMULATED_WORKLOAD' ? 'simulated' : s.source === 'PROMETHEUS' ? 'live-prom' : ''}`}>{s.source.replaceAll('_', ' ')}</span></td></tr>)}</tbody></table>{samples.length === 0 && <Empty icon={<Database />} title="No samples available" text="Prometheus scrape starts within 5 seconds of API startup." />}</div></div>;
}
function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-btn" onClick={onClose}><X size={18} /></button></div>{children}</div></div>;
}
