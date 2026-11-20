import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Mail,
  ArrowLeft,
  ArrowRight,
  Bell,
  BellRing,
  Cake,
  CheckCircle2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Edit3,
  Eye,
  EyeOff,
  Gift,
  House,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Plus,
  Search,
  Settings,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  ReceiptText,
  Filter,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  Camera,
  Image as ImageIcon,
  Cloud,
  Upload,
  FolderOpen,
  HeartPulse,
  Maximize2,
  ChevronLeft,
  BarChart3,
  CreditCard,
  PieChart,
  PackageCheck,
  Timer,
  FileText,
  Download,
  Save,
  ClipboardList,
  ShieldCheck,
  Building2,
  CalendarClock,
  Palette,
  LockKeyhole,
  MessageSquareText,
  SlidersHorizontal,
  Sun,
  Moon,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { SYMBOL_PATH, SYMBOL_VIEWBOX, SYMBOL_RATIO } from "./brand/symbol";

const demoAppointments = [
  { time: "08:00", name: "Maria Silva", procedure: "Limpeza de pele", status: "Confirmado" },
  { time: "09:30", name: "Ana Beatriz", procedure: "Microagulhamento", status: "Confirmado" },
  { time: "11:00", name: "Juliana Alves", procedure: "Peeling", status: "Confirmado" },
  { time: "14:00", name: "Carolina Mendes", procedure: "Avaliação facial", status: "Aguardando" },
  { time: "15:30", name: "Larissa Costa", procedure: "Drenagem linfática", status: "Confirmado" },
];

const DEFAULT_WHATSAPP_TEMPLATES = {
  confirmacao: "Olá, {nome_cliente}! 💚 Seu agendamento de {procedimento} está confirmado para o dia {data} às {horario}. Será um prazer receber você! Se precisar alterar o horário, é só me chamar por aqui.",
  lembrete: "Olá, {nome_cliente}! 🌿 Passando para lembrar do seu atendimento de {procedimento} no dia {data} às {horario}. Está tudo certo para você? Aguardo sua confirmação! 💚",
  pos_atendimento: "Olá, {nome_cliente}! 💚 Foi um prazer cuidar de você hoje. Não se esqueça de seguir as orientações e os cuidados recomendados para sua pele. Qualquer dúvida, estou à disposição!",
  retorno: "Olá, {nome_cliente}! 💚 Tudo bem? Estou passando para saber como está sua pele e verificar se já podemos programar seu próximo atendimento. Se quiser, podemos encontrar um horário que fique bom para você!",
  reagendamento: "Olá, {nome_cliente}! 💚 Sem problemas! Vamos encontrar outro horário para seu atendimento. Me diga qual dia e período ficam melhores para você, e verificamos a disponibilidade.",
  localizacao: "Olá, {nome_cliente}! 💚 Para facilitar sua chegada, estou enviando a localização do nosso espaço: {localizacao}. Qualquer dificuldade para encontrar o endereço, pode me chamar!",
};

function fillWhatsAppTemplate(template, values = {}) {
  return String(template || "").replace(/\{(nome_cliente|procedimento|data|horario|localizacao)\}/g, (_, key) => values[key] || "").replace(/[ \t]+([,.!?])/g, "$1").replace(/ {2,}/g, " ").trim();
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: House },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "lembretes", label: "Lembretes", icon: BellRing },
  { id: "clientes", label: "Clientes", icon: UsersRound },
  { id: "evolucao", label: "Evolução", icon: HeartPulse },
  { id: "procedimentos", label: "Procedimentos", icon: Sparkles },
  { id: "financeiro", label: "Financeiro", icon: CircleDollarSign },
  { id: "estoque", label: "Estoque", icon: Package },
  { id: "pacotes", label: "Pacotes", icon: Gift },
  { id: "relatorios", label: "Relatórios", icon: WalletCards },
  { id: "configuracoes", label: "Configurações", icon: Settings },
];

function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [accessStatus, setAccessStatus] = useState("checking");
  const [accessRole, setAccessRole] = useState("professional");
  const [theme, setThemeState] = useState(readStoredTheme);
  const themeTouched = useRef(false);
  const setTheme = useCallback((value) => setThemeState(value === "dark" ? "dark" : "light"), []);
  useEffect(() => { applyTheme(theme); }, [theme]);
  const toggleLocalTheme = () => { themeTouched.current = true; setTheme(theme === "dark" ? "light" : "dark"); };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const callback = params.get("google_drive_callback");
    if (!callback) return;

    const success = callback === "success";
    const message = params.get("message") || (success
      ? "Google Drive conectado com sucesso."
      : "Não foi possível conectar o Google Drive.");
    const email = params.get("email") || null;

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({
          source: "esteticpro-google-drive",
          success,
          message,
          email,
        }, window.location.origin);
      } catch (error) {
        console.error("Erro ao comunicar o retorno do Google Drive:", error);
      }

      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      window.setTimeout(() => window.close(), 500);
    } else {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoadingSession(false);
      return;
    }
    async function applySession(nextSession) {
      setSession(nextSession);
      if (!nextSession) {
        setAccessStatus("signed_out");
        setLoadingSession(false);
        return;
      }
      // Fail closed: a signed-in user must have an approved access record.
      // Allow an invited professional to activate access only after confirming their email.
      let { data: access, error } = await supabase
        .from("user_access")
        .select("status,role")
        .eq("user_id", nextSession.user.id)
        .maybeSingle();
      if (!error && access?.status === "pending" && nextSession.user.email_confirmed_at) {
        const inviteToken = new URLSearchParams(window.location.search).get("invite_token");
        const { data: accepted } = await supabase.functions.invoke("manage-access", {
          body: { action: "accept_invite", ...(inviteToken ? { token: inviteToken } : {}) },
        });
        if (accepted?.status === "approved") {
          const refreshed = await supabase.from("user_access").select("status,role").eq("user_id", nextSession.user.id).maybeSingle();
          access = refreshed.data;
          error = refreshed.error;
        }
      }
      if (error || !access) { setAccessStatus("unconfigured"); setAccessRole("professional"); }
      else { setAccessStatus(access.status); setAccessRole(access.role || "professional"); }
      setLoadingSession(false);
    }
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Defer the database query to avoid doing Supabase queries inside the auth callback.
      window.setTimeout(() => applySession(newSession), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loadingSession) return <SplashScreen />;
  if (!session) return <AuthScreen theme={theme} onToggleTheme={toggleLocalTheme} />;
  if (accessStatus !== "approved") {
    const text = accessStatus === "blocked"
      ? "O acesso a esta conta foi bloqueado. Entre em contato com o administrador."
      : accessStatus === "pending"
        ? "Sua conta ainda não foi autorizada. O acesso será liberado após aprovação do administrador."
        : "Não foi possível confirmar a autorização desta conta. O acesso permanece bloqueado por segurança.";
    return <AuthShell theme={theme} onToggleTheme={toggleLocalTheme}>
      <div className="auth-head"><h2>Acesso restrito</h2><p>{text}</p></div>
      <button className="auth-submit" onClick={() => supabase.auth.signOut()}>Sair da conta <LogOut size={18} /></button>
    </AuthShell>;
  }
  return <Dashboard session={session} isAdmin={accessRole === "admin"} theme={theme} setTheme={setTheme} themeTouched={themeTouched} />;
}

const THEME_KEY = "esteticpro-theme";

function readStoredTheme() {
  try { return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"; } catch { return "light"; }
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#04180F" : "#F5F0E3");
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* armazenamento indisponível */ }
}

/* Símbolo oficial EsteticPro (folha + perfil) com gradiente dourado da marca. */
function BrandSymbol({ size, className = "", title }) {
  const gid = `ep-gold-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const style = { aspectRatio: SYMBOL_RATIO };
  if (size) { style.height = size; style.width = Math.round(size * SYMBOL_RATIO * 100) / 100; }
  return (
    <svg className={`brand-symbol ${className}`} style={style} viewBox={SYMBOL_VIEWBOX} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.62" y2="1">
          <stop offset="0" style={{ stopColor: "var(--sym-1)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--sym-2)" }} />
          <stop offset="1" style={{ stopColor: "var(--sym-3)" }} />
        </linearGradient>
      </defs>
      <path d={SYMBOL_PATH} fill={`url(#${gid})`} />
    </svg>
  );
}

function BrandMark({ small = false }) {
  return <BrandSymbol size={small ? 34 : 72} className="brand-logo" title="EsteticPro" />;
}

function BrandLockup({ size = "md", className = "" }) {
  const symbolSize = size === "sm" ? 30 : size === "lg" ? 64 : 44;
  return (
    <span className={`lockup lockup-${size} ${className}`}>
      <BrandSymbol size={symbolSize} />
      <span className="lockup-word">Estetic<b>Pro</b></span>
    </span>
  );
}

function SplashScreen() {
  return (
    <div className="splash">
      <BrandMark />
      <div className="splash-brand">Estetic<span>Pro</span></div>
      <div className="spinner" />
    </div>
  );
}

function ThemeToggle({ theme, onToggle, className = "" }) {
  const dark = theme === "dark";
  return (
    <button type="button" className={`icon-btn theme-toggle ${className}`} onClick={onToggle} aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"} title={dark ? "Modo claro" : "Modo escuro"}>
      {dark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

function AuthShell({ theme, onToggleTheme, children }) {
  return (
    <main className="auth-split">
      <aside className="auth-art on-dark">
        <div className="auth-ring r1" /><div className="auth-ring r2" /><div className="auth-ring r3" />
        <BrandSymbol className="auth-art-mark" />
        <div className="auth-art-top"><BrandLockup size="lg" /></div>
        <div className="auth-art-copy">
          <span className="auth-kicker">Gestão para esteticistas</span>
          <h2>Sua estética,<br />mais <em>organizada</em>.</h2>
          <p>Agenda, clientes, evolução, estoque e financeiro reunidos em um só lugar, com a elegância que o seu trabalho merece.</p>
          <ul className="auth-points">
            <li><span className="ico"><CalendarDays size={18} /></span>Agenda com confirmações e lembretes por WhatsApp</li>
            <li><span className="ico"><HeartPulse size={18} /></span>Evolução e fotos de cada cliente, sempre privadas</li>
            <li><span className="ico"><CircleDollarSign size={18} /></span>Financeiro e estoque ligados ao atendimento</li>
          </ul>
        </div>
        <div className="auth-art-foot">© {new Date().getFullYear()} EsteticPro · Acesso privado</div>
      </aside>
      <section className="auth-panel">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} className="auth-theme" />
        <div className="auth-panel-inner">
          <div className="auth-mobile-brand"><BrandLockup size="md" /></div>
          {children}
        </div>
      </section>
    </main>
  );
}

function AuthScreen({ theme, onToggleTheme }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    if (!isSupabaseConfigured) return setMessage({ type: "error", text: "O Supabase ainda não foi configurado." });
    if (!email.trim()) return setMessage({ type: "error", text: "Informe seu e-mail." });
    if (!password) return setMessage({ type: "error", text: "Informe sua senha." });
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: "error", text: friendlyAuthError(error.message) });
    } finally { setBusy(false); }
  }

  async function handleForgotPassword() {
    setMessage(null);
    if (!email.trim()) return setMessage({ type: "error", text: "Digite seu e-mail antes de recuperar a senha." });
    if (!isSupabaseConfigured) return setMessage({ type: "error", text: "O Supabase ainda não foi configurado." });
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/` });
    setBusy(false);
    setMessage(error ? { type: "error", text: friendlyAuthError(error.message) } : { type: "success", text: "Se este e-mail estiver cadastrado, você receberá as instruções de recuperação." });
  }

  return (
    <AuthShell theme={theme} onToggleTheme={onToggleTheme}>
      <header className="auth-head">
        <span className="auth-eyebrow">Acesso privado</span>
        <h1>Bem-vindo de volta</h1>
        <p>Entre com o e-mail associado ao seu convite.</p>
      </header>
      {message && <div className={`auth-msg ${message.type}`} role="status">{message.text}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <AuthField icon={Mail} label="E-mail"><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" type="email" autoComplete="email" required /></AuthField>
        <AuthField icon={LockKeyhole} label="Senha" trailing={<button type="button" className="ghost-btn" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>}>
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
        </AuthField>
        <div className="auth-row"><button type="button" className="auth-link" onClick={handleForgotPassword} disabled={busy}>Esqueceu sua senha?</button></div>
        <button className="primary-button auth-submit" disabled={busy}>{busy ? <span className="button-spinner" /> : <>Entrar <ArrowRight size={18} /></>}</button>
      </form>
      <div className="auth-divider"><span>Somente por convite</span></div>
      <p className="auth-note"><ShieldCheck size={18} /><span>Novas contas são criadas exclusivamente por convite do administrador. Entre com o e-mail para o qual o convite foi enviado.</span></p>
      <footer className="auth-legal"><a href="/privacidade.html">Política de Privacidade</a><i>·</i><a href="/termos.html">Termos de Uso</a><i>·</i><a href="/google-drive-termos.html">Google Drive</a></footer>
    </AuthShell>
  );
}

function AuthField({ icon: Icon, label, trailing, children }) {
  return <label className="ofield"><span>{label}</span><div className="ofield-box">{Icon ? <Icon size={18} /> : null}{children}{trailing}</div></label>;
}

function friendlyAuthError(message = "") {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered")) return "Este e-mail já possui uma conta.";
  if (m.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  return message || "Não foi possível concluir a operação.";
}

const navGroups = [
  { label: "Principal", ids: ["dashboard", "agenda", "lembretes"] },
  { label: "Relacionamento", ids: ["clientes", "evolucao"] },
  { label: "Gestão", ids: ["procedimentos", "pacotes", "estoque", "financeiro", "relatorios"] },
  { label: "Sistema", ids: ["configuracoes", "access"] },
];

function Dashboard({ session, isAdmin = false, theme, setTheme, themeTouched }) {
  const visibleNavItems = isAdmin ? [...navItems, { id: "access", label: "Acessos", icon: ShieldCheck }] : navItems;
  const [active, setActive] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [intent, setIntent] = useState(null);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");

  async function loadProfile() {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, phone, instagram, professional_title, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar perfil:", error);
      setProfile({
        full_name: session.user.user_metadata?.full_name || "",
        email: session.user.email || "",
        phone: "",
        instagram: "",
        professional_title: "Profissional",
        avatar_url: null,
      });
      return;
    }

    setProfile(data || {
      full_name: session.user.user_metadata?.full_name || "",
      email: session.user.email || "",
      phone: "",
      instagram: "",
      professional_title: "Profissional",
      avatar_url: null,
    });
  }

  useEffect(() => {
    let mounted = true;
    loadProfile().finally(() => {
      if (!mounted) return;
    });
    return () => { mounted = false; };
  }, [session.user.id]);

  // O tema salvo na conta vale entre dispositivos; uma escolha feita nesta sessão tem prioridade.
  useEffect(() => {
    let mounted = true;
    async function loadTheme() {
      const { data } = await supabase
        .from("user_settings")
        .select("theme")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!mounted || !data?.theme || themeTouched?.current) return;
      setTheme(data.theme === "dark" ? "dark" : "light");
    }
    loadTheme();
    return () => { mounted = false; };
  }, [session.user.id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [active]);

  // Atalhos da busca global: Ctrl/⌘ + K e "/"
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target;
        const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
        if (!typing) { e.preventDefault(); setPaletteOpen(true); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const displayName = profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Profissional";
  const professionalTitle = profile?.professional_title || "Profissional";
  const go = (id, data) => { setActive(id); setMobileMenu(false); setIntent(data ? { ...data, module: id, nonce: Date.now() } : null); };
  const logout = async () => { await supabase.auth.signOut(); };
  const refreshProfile = async () => { await loadProfile(); };
  const modIntent = (id) => (intent && intent.module === id ? intent : null);
  const clearIntent = () => setIntent(null);

  const persistTheme = (value) => {
    supabase.from("user_settings").upsert({ user_id: session.user.id, theme: value, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .then(({ error }) => { if (error) console.warn("Não foi possível salvar o tema na conta:", error.message); });
  };
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    if (themeTouched) themeTouched.current = true;
    setTheme(next);
    persistTheme(next);
  };

  const itemById = Object.fromEntries(visibleNavItems.map((i) => [i.id, i]));
  const groups = navGroups.map((g) => ({ label: g.label, items: g.ids.map((id) => itemById[id]).filter(Boolean) })).filter((g) => g.items.length);

  const paletteActions = [
    { key: "act-client", icon: Plus, title: "Novo cliente", hint: "Criar", module: "clientes", intent: { type: "new" } },
    { key: "act-appointment", icon: CalendarDays, title: "Novo agendamento", hint: "Criar", module: "agenda", intent: { type: "new" } },
    { key: "act-income", icon: TrendingUp, title: "Novo lançamento financeiro", hint: "Criar", module: "financeiro", intent: { type: "new" } },
    { key: "act-expense", icon: TrendingDown, title: "Adicionar despesa", hint: "Criar", module: "financeiro", intent: { type: "new", kind: "despesa" } },
    { key: "act-procedure", icon: Sparkles, title: "Novo procedimento", hint: "Criar", module: "procedimentos", intent: { type: "new" } },
    { key: "act-theme", icon: theme === "dark" ? Sun : Moon, title: theme === "dark" ? "Mudar para o modo claro" : "Mudar para o modo escuro", hint: "Aparência", run: toggleTheme },
  ];
  const pickFromPalette = (item) => {
    setPaletteOpen(false);
    if (item.run) { item.run(); return; }
    go(item.module, item.intent);
  };

  const uid = session.user.id;
  let content;
  if (active === "dashboard") content = <DashboardHome displayName={displayName} onNavigate={go} userId={uid} />;
  else if (active === "clientes") content = <ClientsModule userId={uid} onNavigate={go} intent={modIntent("clientes")} onIntentDone={clearIntent} />;
  else if (active === "evolucao") content = <EvolutionModule userId={uid} onNavigate={go} />;
  else if (active === "agenda") content = <AgendaModule userId={uid} intent={modIntent("agenda")} onIntentDone={clearIntent} />;
  else if (active === "lembretes") content = <RemindersModule userId={uid} />;
  else if (active === "financeiro") content = <FinanceModule userId={uid} intent={modIntent("financeiro")} onIntentDone={clearIntent} />;
  else if (active === "procedimentos") content = <ProceduresModule userId={uid} intent={modIntent("procedimentos")} onIntentDone={clearIntent} />;
  else if (active === "estoque") content = <InventoryModule userId={uid} />;
  else if (active === "pacotes") content = <PackagesModule userId={uid} onNavigate={go} />;
  else if (active === "relatorios") content = <ReportsModule userId={uid} onNavigate={go} />;
  else if (active === "configuracoes") content = <SettingsModule userId={uid} profile={profile} theme={theme} onProfileOpen={() => setProfileOpen(true)} onThemeChange={(value) => { if (themeTouched) themeTouched.current = true; setTheme(value === "dark" ? "dark" : "light"); }} />;
  else if (active === "access" && isAdmin) content = <AdminAccessModule />;
  else content = <ComingSoon title={navItems.find((x) => x.id === active)?.label || "Módulo"} onBack={() => go("dashboard")} />;

  return <div className={`app-shell theme-${theme}`}>
    <aside className={`sidebar on-dark ${mobileMenu ? "open" : ""}`}>
      <div className="sidebar-brand"><BrandLockup size="md" /><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={20} /></button></div>
      <nav className="sidebar-nav" aria-label="Menu principal">
        {groups.map((group) => <div className="nav-group" key={group.label}>
          <span className="nav-group-label">{group.label}</span>
          {group.items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${active === id ? "active" : ""}`} aria-current={active === id ? "page" : undefined} onClick={() => go(id)}><Icon size={19} strokeWidth={1.7} /><span>{label}</span></button>)}
        </div>)}
      </nav>
      <div className="sidebar-foot">
        <button className="nav-item" onClick={logout}><LogOut size={19} strokeWidth={1.7} /><span>Sair da conta</span></button>
        <p className="sidebar-sign">Sua estética, mais organizada.</p>
      </div>
    </aside>
    {mobileMenu && <button className="sidebar-overlay" onClick={() => setMobileMenu(false)} aria-label="Fechar menu" />}
    <div className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={22} /></button>
        <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Buscar ou ir para" aria-haspopup="dialog"><Search size={18} /><span>Buscar clientes, agenda, estoque ou ir para…</span><kbd className="kbd">{isMac ? "⌘ K" : "Ctrl K"}</kbd></button>
        <div className="top-actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button className="icon-btn notification" onClick={() => go("lembretes")} title="Abrir lembretes" aria-label="Abrir lembretes"><Bell size={19} /><i className="dot" /></button>
          <button className="profile-chip" onClick={() => setProfileOpen(true)} title="Abrir meu perfil"><div className="avatar">{profile?.avatar_url ? <ProfileAvatar path={profile.avatar_url} name={displayName} /> : initials(displayName)}</div><div className="who"><strong>{displayName}</strong><span>{professionalTitle}</span></div><ChevronRight size={16} /></button>
        </div>
      </header>
      <main className="page-content">{content}</main>
      {profileOpen && <ProfileModal profile={profile} userId={uid} onClose={() => setProfileOpen(false)} onSaved={refreshProfile} />}
      {paletteOpen && <CommandPalette userId={uid} pages={visibleNavItems} actions={paletteActions} onClose={() => setPaletteOpen(false)} onPick={pickFromPalette} />}
      <nav className="mobile-bottom-nav" aria-label="Navegação principal"><button aria-label="Ir para início" className={active === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}><House size={20} /><span>Início</span></button><button aria-label="Abrir agenda" className={active === "agenda" ? "active" : ""} onClick={() => go("agenda")}><CalendarDays size={20} /><span>Agenda</span></button><button aria-label="Abrir clientes" className={active === "clientes" ? "active" : ""} onClick={() => go("clientes")}><UsersRound size={20} /><span>Clientes</span></button><button aria-label="Abrir mais opções" className={active !== "dashboard" && active !== "agenda" && active !== "clientes" ? "active" : ""} onClick={() => setMobileMenu(true)}><Menu size={20} /><span>Mais</span></button></nav>
    </div>
  </div>;
}

/* ---------- Busca global (Ctrl/⌘ + K) ---------- */
const foldChar = (ch) => (ch.normalize("NFD")[0] || ch).toLowerCase();
const fold = (text) => Array.from(String(text ?? "")).map(foldChar).join("");

function Highlight({ text, term }) {
  const value = String(text ?? "");
  const needle = fold(term.trim());
  if (!needle) return value;
  const chars = Array.from(value);
  const folded = chars.map(foldChar).join("");
  const at = folded.indexOf(needle);
  if (at < 0) return value;
  return <>{chars.slice(0, at).join("")}<mark>{chars.slice(at, at + needle.length).join("")}</mark>{chars.slice(at + needle.length).join("")}</>;
}

function CommandPalette({ userId, pages, actions, onClose, onPick }) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  // Busca de dados reais (clientes, agenda, procedimentos, estoque, pacotes e financeiro)
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setGroups([]); setLoading(false); setFailed(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const safe = term.replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim();
      if (!safe) { if (!cancelled) { setGroups([]); setLoading(false); } return; }
      const like = `%${safe}%`;
      try {
        const [cl, pr, po, pk, ap, tx] = await Promise.all([
          supabase.from("clients").select("id, full_name, phone, email, active").eq("user_id", userId).or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like},instagram.ilike.${like}`).order("full_name").limit(5),
          supabase.from("procedures").select("id, name, category, price").eq("user_id", userId).or(`name.ilike.${like},category.ilike.${like}`).limit(4),
          supabase.from("products").select("id, name, brand, category, stock_quantity, unit").eq("user_id", userId).or(`name.ilike.${like},brand.ilike.${like},category.ilike.${like}`).limit(4),
          supabase.from("service_packages").select("id, name, total_sessions, price").eq("user_id", userId).ilike("name", like).limit(3),
          supabase.from("appointments").select("id, appointment_date, start_time, procedure_name, status, clients(full_name)").eq("user_id", userId).ilike("procedure_name", like).order("appointment_date", { ascending: false }).limit(4),
          supabase.from("financial_transactions").select("id, description, amount, type, transaction_date, status").eq("user_id", userId).ilike("description", like).order("transaction_date", { ascending: false }).limit(4),
        ]);
        const clientIds = (cl.data || []).map((c) => c.id);
        let byClient = [];
        if (clientIds.length) {
          const r = await supabase.from("appointments").select("id, appointment_date, start_time, procedure_name, status, clients(full_name)").eq("user_id", userId).in("client_id", clientIds).order("appointment_date", { ascending: false }).limit(4);
          byClient = r.data || [];
        }
        if (cancelled) return;
        const allFailed = [cl, pr, po, pk, ap, tx].every((r) => r.error);
        const seen = new Set();
        const appointments = [...(ap.data || []), ...byClient].filter((a) => (seen.has(a.id) ? false : seen.add(a.id))).slice(0, 5);
        const next = [
          { label: "Clientes", items: (cl.data || []).map((c) => ({ key: `c-${c.id}`, icon: UsersRound, title: c.full_name, sub: [c.phone, c.email].filter(Boolean).join(" · ") || "Sem contato cadastrado", hint: c.active === false ? "Inativa" : "Cliente", module: "clientes", intent: { type: "open", id: c.id } })) },
          { label: "Agendamentos", items: appointments.map((a) => ({ key: `a-${a.id}`, icon: CalendarDays, title: `${a.procedure_name || "Atendimento"} · ${a.clients?.full_name || "Cliente"}`, sub: `${formatDate(a.appointment_date)} às ${formatTime(a.start_time)}${a.status ? ` · ${a.status}` : ""}`, hint: "Agenda", module: "agenda", intent: { type: "date", date: a.appointment_date } })) },
          { label: "Procedimentos", items: (pr.data || []).map((p) => ({ key: `p-${p.id}`, icon: Sparkles, title: p.name, sub: [p.category, p.price != null ? moneyValue(p.price) : null].filter(Boolean).join(" · "), hint: "Procedimento", module: "procedimentos" })) },
          { label: "Estoque", items: (po.data || []).map((p) => ({ key: `s-${p.id}`, icon: Package, title: p.name, sub: [p.brand, `${Number(p.stock_quantity ?? 0).toLocaleString("pt-BR")} ${p.unit || "un"} em estoque`].filter(Boolean).join(" · "), hint: "Produto", module: "estoque" })) },
          { label: "Pacotes", items: (pk.data || []).map((p) => ({ key: `k-${p.id}`, icon: Gift, title: p.name, sub: `${p.total_sessions || 0} sessões${p.price != null ? ` · ${moneyValue(p.price)}` : ""}`, hint: "Pacote", module: "pacotes" })) },
          { label: "Financeiro", items: (tx.data || []).map((t) => ({ key: `t-${t.id}`, icon: CircleDollarSign, title: t.description || "Lançamento", sub: `${formatDate(t.transaction_date)} · ${t.type === "despesa" ? "Despesa" : "Receita"} · ${moneyValue(t.amount)}`, hint: "Financeiro", module: "financeiro" })) },
        ].filter((g) => g.items.length);
        setGroups(next);
        setFailed(allFailed);
        setLoading(false);
      } catch (error) {
        if (!cancelled) { console.error("Erro na busca global:", error); setGroups([]); setFailed(true); setLoading(false); }
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, userId]);

  const needle = fold(query.trim());
  const pageItems = pages.map((p) => ({ key: `pg-${p.id}`, icon: p.icon, title: p.label, hint: "Ir para", module: p.id }));
  const matches = (item) => !needle || fold(item.title).includes(needle);
  const staticGroups = [
    { label: "Ir para", items: pageItems.filter(matches) },
    { label: "Ações", items: actions.filter(matches) },
  ].filter((g) => g.items.length);
  const allGroups = needle ? [...groups, ...staticGroups] : staticGroups;
  const flat = allGroups.flatMap((g) => g.items);

  useEffect(() => { setCursor(0); }, [query, groups]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function onKeyDown(e) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (flat.length) setCursor((c) => (c + 1) % flat.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (flat.length) setCursor((c) => (c - 1 + flat.length) % flat.length); }
    else if (e.key === "Home") { e.preventDefault(); setCursor(0); }
    else if (e.key === "End") { e.preventDefault(); setCursor(Math.max(flat.length - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (flat[cursor]) onPick(flat[cursor]); }
    else if (e.key === "Tab") { e.preventDefault(); }
  }

  let index = -1;
  const showEmpty = !loading && flat.length === 0;
  return (
    <div className="cmdk-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Busca global" onKeyDown={onKeyDown}>
        <div className="cmdk-head">
          <Search size={19} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar clientes, agenda, estoque, financeiro ou ir para…" role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={flat[cursor] ? `${listId}-${cursor}` : undefined} autoComplete="off" spellCheck="false" />
          {loading ? <span className="cmdk-spin" aria-label="Buscando" /> : null}
          <kbd className="kbd">Esc</kbd>
        </div>
        <div className="cmdk-list" id={listId} role="listbox" ref={listRef}>
          {allGroups.map((group) => <div key={group.label} role="group" aria-label={group.label}>
            <div className="cmdk-group">{group.label}</div>
            {group.items.map((item) => {
              index += 1;
              const i = index;
              const Icon = item.icon;
              return <button type="button" key={item.key} id={`${listId}-${i}`} data-idx={i} role="option" aria-selected={i === cursor} className={`cmdk-item ${i === cursor ? "active" : ""}`} onMouseMove={() => { if (cursor !== i) setCursor(i); }} onClick={() => onPick(item)}>
                <span className="cmdk-ico"><Icon size={18} /></span>
                <span className="cmdk-main"><span className="cmdk-title"><Highlight text={item.title} term={query} /></span>{item.sub ? <span className="cmdk-sub">{item.sub}</span> : null}</span>
                <span className="cmdk-hint">{item.hint}</span>
              </button>;
            })}
          </div>)}
          {showEmpty && <div className="cmdk-empty"><Search size={26} />{failed ? <><strong>Não foi possível buscar agora</strong><span>Verifique sua conexão e tente novamente.</span></> : <><strong>Nenhum resultado para “{query.trim()}”</strong><span>Tente outro nome, telefone, procedimento ou produto.</span></>}</div>}
        </div>
        <div className="cmdk-foot"><span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navegar</span><span><kbd className="kbd">Enter</kbd> abrir</span><span><kbd className="kbd">Esc</kbd> fechar</span></div>
      </div>
    </div>
  );
}

function AdminAccessModule() {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  async function callAdmin(action, extra = {}) {
    const { data, error } = await supabase.functions.invoke("manage-access", { body: { action, ...extra } });
    if (error) {
      // Preserve the actual SDK error for diagnosis instead of hiding every failure
      // behind the same generic CORS/deployment message.
      let detail = error.message || "Falha na chamada da função.";
      const causeMessage = error.cause?.message || error.context?.message;
      if (causeMessage && causeMessage !== detail) detail += ` (${causeMessage})`;
      try {
        // HTTP errors can carry a Response; network/fetch errors usually carry
        // a regular Error. Read response bodies only when a cloneable Response exists.
        const context = error.context;
        if (context && typeof context.clone === "function") {
          const body = await context.clone().text();
          if (body) detail += ` — ${body.slice(0, 500)}`;
        }
      } catch (_) {}
      console.error("EstetiPro manage-access — diagnóstico completo:", {
        name: error.name, message: error.message, cause: error.cause,
        context: error.context, error,
      });
      throw new Error(detail);
    }
    if (data?.error) throw new Error(data.error);
    if (data?.success === false) throw new Error(data.error || "A operação não foi concluída.");
    return data;
  }
  async function refresh() {
    setLoading(true);
    try {
      const d = await callAdmin("list");
      setInvites(d.invites || []);
      // Current Edge Function returns `accesses`; support `users` for older deployments.
      setUsers(d.accesses || d.users || []);
      setMessage(null);
    } catch (e) {
      setMessage({type:"error",text:e.message || "Não foi possível carregar os acessos."});
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  async function invite(e) { e.preventDefault(); setBusy(true); setMessage(null); try { await callAdmin("invite",{email}); setEmail(""); setMessage({type:"success",text:"Convite solicitado. O envio depende da configuração de e-mail do Supabase."}); await refresh(); } catch(e) { setMessage({type:"error",text:e.message}); } finally { setBusy(false); } }
  async function changeAccess(userId,status) {
    const nextStatus = status === "blocked" ? "approved" : "revoked";
    if (!window.confirm(nextStatus === "blocked" ? "Bloquear o acesso desta profissional?" : "Liberar o acesso desta profissional?")) return;
    setBusy(true);
    try {
      await callAdmin("set_status", { user_id: userId, status: nextStatus });
      await refresh();
    } catch(e) { setMessage({type:"error",text:e.message}); }
    finally { setBusy(false); }
  }
  async function revoke(id) { if(!window.confirm("Revogar este convite pendente?")) return; setBusy(true); try { await callAdmin("revoke",{invite_id:id}); await refresh(); } catch(e) { setMessage({type:"error",text:e.message}); } finally { setBusy(false); } }
  return <section className="module-page access-admin-page"><div className="module-heading"><div><span className="eyebrow">ADMINISTRAÇÃO</span><h1>Controle de acesso</h1><p>Convide profissionais e gerencie a autorização da plataforma.</p></div><button className="secondary-button" onClick={refresh} disabled={loading}>Atualizar</button></div>
    {message && <div className={message.type==="error"?"form-error":"auth-message success"}>{message.text}</div>}
    <div className="settings-card"><div className="settings-card-heading"><ShieldCheck size={21}/><div><h2>Convidar profissional</h2><p>Convite por e-mail, válido por 7 dias.</p></div></div><form className="access-invite-form" onSubmit={invite}><label className="form-input"><span>E-mail profissional</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="profissional@exemplo.com" autoComplete="off"/></label><button className="primary-button" disabled={busy||!email.trim()}>{busy?"Enviando…":"Enviar convite"}</button></form></div>
    <div className="settings-card"><div className="settings-card-heading"><UsersRound size={21}/><div><h2>Contas cadastradas</h2><p>Gerencie o acesso das profissionais.</p></div></div>{loading?"Carregando…":<div className="access-list">{users.map(u=><div className="access-row" key={u.user_id}><div className="access-row-main"><strong>{u.email}</strong><span>{u.role==="admin"?"Administrador":"Profissional"} · {u.status==="approved"?"Aprovada":(u.status==="blocked"||u.status==="revoked")?"Bloqueada":"Pendente"}</span></div>{u.role!=="admin"&&<button className="secondary-button" disabled={busy} onClick={()=>changeAccess(u.user_id,(u.status==="blocked"||u.status==="revoked")?"approved":"blocked")}>{(u.status==="blocked"||u.status==="revoked")?"Liberar":"Bloquear"}</button>}</div>)}</div>}</div>
    <div className="settings-card"><div className="settings-card-heading"><Mail size={21}/><div><h2>Convites enviados</h2><p>Convites pendentes podem ser revogados.</p></div></div>{loading?"Carregando…":invites.length===0?"Nenhum convite registrado.":<div className="access-list">{invites.map(i=><div className="access-row" key={i.id}><div className="access-row-main"><strong>{i.email}</strong><span>{i.status} · expira {new Date(i.expires_at).toLocaleDateString("pt-BR")}</span></div>{i.status==="pending"&&<button className="secondary-button" disabled={busy} onClick={()=>revoke(i.id)}>Revogar</button>}</div>)}</div>}</div>
  </section>;
}

function ProfileAvatar({ path, name, large = false }) {
  const [url, setUrl] = useState(path?.startsWith("http") ? path : null);

  useEffect(() => {
    let mounted = true;
    async function resolve() {
      if (!path) return;
      if (path.startsWith("http")) {
        if (mounted) setUrl(path);
        return;
      }
      const { data, error } = await supabase.storage.from("profile-avatars").createSignedUrl(path, 3600);
      if (!error && data?.signedUrl && mounted) setUrl(data.signedUrl);
    }
    resolve();
    return () => { mounted = false; };
  }, [path]);

  if (!url) return <>{initials(name)}</>;
  return <img className={large ? "profile-avatar-image large" : "profile-avatar-image"} src={url} alt={name} />;
}

function ProfileModal({ profile, userId, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    instagram: profile?.instagram || "",
    professional_title: profile?.professional_title || "Profissional",
  });
  const [avatarPath, setAvatarPath] = useState(profile?.avatar_url || null);
  const [preview, setPreview] = useState(profile?.avatar_url || null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!profile?.avatar_url) return;
    if (profile.avatar_url.startsWith("http")) setPreview(profile.avatar_url);
  }, [profile?.avatar_url]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleFile(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setError("");
    if (!selected.type.startsWith("image/")) return setError("Selecione uma imagem válida.");
    if (selected.size > 4 * 1024 * 1024) return setError("A foto deve ter no máximo 4 MB.");
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    if (!form.full_name.trim()) return setError("Informe seu nome.");
    setSaving(true);
    try {
      let nextAvatarPath = avatarPath;

      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("profile-avatars")
          .upload(path, file, { upsert: false, contentType: file.type, cacheControl: "3600" });
        if (uploadError) throw new Error(`Não foi possível enviar a foto. ${uploadError.message}`);

        nextAvatarPath = path;
        if (avatarPath && !avatarPath.startsWith("http") && avatarPath !== path) {
          await supabase.storage.from("profile-avatars").remove([avatarPath]);
        }
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          instagram: form.instagram.trim() || null,
          professional_title: form.professional_title.trim() || "Profissional",
          avatar_url: nextAvatarPath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (updateError) throw updateError;

      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: form.full_name.trim() } });
      if (authError) console.warn("Nome atualizado no perfil, mas não no metadata do Auth:", authError);

      await onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      setError(err?.message || "Não foi possível salvar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-card profile-modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <div className="modal-header">
        <div><span>MINHA CONTA</span><h2 id="profile-modal-title">Meu perfil</h2><p className="profile-modal-subtitle">Atualize seus dados profissionais e sua foto.</p></div>
        <button type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </div>
      <form onSubmit={save} className="profile-form">
        <div className="profile-photo-section">
          <div className="profile-photo-preview">{preview?.startsWith("blob:") || preview?.startsWith("http") ? <img src={preview} alt={form.full_name || "Foto de perfil"} /> : <ProfileAvatar path={preview} name={form.full_name} large />}</div>
          <div className="profile-photo-copy"><strong>Foto de perfil</strong><span>JPG, PNG ou WEBP · até 4 MB</span><button type="button" className="secondary-button profile-photo-button" onClick={() => inputRef.current?.click()}><Camera size={15} /> Alterar foto</button><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} hidden /></div>
        </div>
        <div className="form-grid">
          <label className="form-input"><span>Nome *</span><input value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} placeholder="Seu nome profissional" /></label>
          <label className="form-input"><span>Como deseja aparecer</span><input value={form.professional_title} onChange={(e) => setField("professional_title", e.target.value)} placeholder="Profissional" /></label>
          <label className="form-input"><span>E-mail</span><input value={form.email} readOnly disabled /></label>
          <label className="form-input"><span>Telefone</span><input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" /></label>
          <label className="form-input"><span>Instagram</span><input value={form.instagram} onChange={(e) => setField("instagram", e.target.value)} placeholder="@seuinstagram" /></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <span className="button-spinner" /> : <><Check size={16} /> Salvar alterações</>}</button></div>
      </form>
    </div>
  </div>;
}


function SettingsModule({ userId, profile, theme, onProfileOpen, onThemeChange }) {
  const [section, setSection] = useState("perfil");
  const [business, setBusiness] = useState({
    business_name: "",
    description: "",
    phone: "",
    whatsapp: "",
    instagram: "",
    address: "",
    city: "",
    state: "",
    logo_path: null,
    whatsapp_message_templates: DEFAULT_WHATSAPP_TEMPLATES,
  });
  const [preferences, setPreferences] = useState({
    week_start: 1,
    work_start: "08:00",
    work_end: "18:00",
    default_slot_minutes: 30,
    min_booking_hours: 2,
    show_weekends: true,
    auto_stock_consumption: true,
    require_payment_confirmation: true,
    allow_unpaid_completion: true,
    currency: "BRL",
    theme: "light",
    whatsapp_automation_enabled: true,
    whatsapp_auto_confirmation: true,
    whatsapp_auto_reminder: true,
    whatsapp_reminder_hours: 24,
    document_footer: "",
    anamnesis_consent_text: "Declaro que as informações fornecidas são verdadeiras e autorizo o registro e uso dos dados para fins de atendimento estético, conforme as condições apresentadas.",
  });
  const [activeSection, setActiveSection] = useState("perfil");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveSection(section);
  }, [section]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const [{ data: b }, { data: p }] = await Promise.all([
        supabase.from("business_settings").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      if (!mounted) return;
      if (b) setBusiness((v) => ({ ...v, ...b, whatsapp_message_templates: { ...DEFAULT_WHATSAPP_TEMPLATES, ...(b.whatsapp_message_templates || {}) } }));
      if (p) setPreferences((v) => ({ ...v, ...p }));
      if (b?.logo_path) {
        const { data } = await supabase.storage.from("business-assets").createSignedUrl(b.logo_path, 3600);
        if (mounted && data?.signedUrl) setLogoPreview(data.signedUrl);
      }
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [userId]);

  const sections = [
    ["perfil", UserRound, "Meu perfil"],
    ["espaco", Building2, "Meu espaço"],
    ["agenda", CalendarClock, "Agenda"],
    ["atendimento", SlidersHorizontal, "Atendimento"],
    ["whatsapp", MessageSquareText, "WhatsApp"],
    ["financeiro", CircleDollarSign, "Financeiro"],
    ["estoque", Package, "Estoque"],
    ["documentos", FileText, "Documentos"],
    ["aparencia", Palette, "Aparência"],
    ["seguranca", LockKeyhole, "Segurança"],
  ];

  useEffect(() => {
    if (theme) setPreferences((v) => (v.theme === theme ? v : { ...v, theme }));
  }, [theme]);

  function setPref(key, value) {
    setPreferences((v) => ({ ...v, [key]: value }));
    if (key === "theme") onThemeChange?.(value);
  }
  function setBiz(key, value) { setBusiness((v) => ({ ...v, [key]: value })); }

  async function handleLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setNotice({ type: "error", text: "Selecione uma imagem válida." });
    if (file.size > 4 * 1024 * 1024) return setNotice({ type: "error", text: "A logo deve ter no máximo 4 MB." });
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function save() {
    setSaving(true); setNotice(null);
    try {
      let logoPath = business.logo_path || null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${userId}/business-logo-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("business-assets").upload(path, logoFile, { upsert: false, contentType: logoFile.type, cacheControl: "3600" });
        if (error) throw error;
        if (business.logo_path) await supabase.storage.from("business-assets").remove([business.logo_path]);
        logoPath = path;
      }
      const { error: bError } = await supabase.from("business_settings").upsert({ ...business, user_id: userId, logo_path: logoPath, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (bError) throw bError;
      const { error: pError } = await supabase.from("user_settings").upsert({ ...preferences, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (pError) throw pError;
      setBusiness((v) => ({ ...v, logo_path: logoPath })); setLogoFile(null);
      setNotice({ type: "success", text: "Configurações salvas com sucesso." });
    } catch (err) {
      setNotice({ type: "error", text: err?.message || "Não foi possível salvar as configurações." });
    } finally { setSaving(false); }
  }

  const Field = ({ label, children, wide = false }) => <label className={`settings-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
  const Toggle = ({ label, checked, onChange, hint }) => <label className="settings-toggle"><div><strong>{label}</strong>{hint && <span>{hint}</span>}</div><input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} /><i /></label>;

  function renderSection() {
    if (loading) return <div className="settings-loading">Carregando suas configurações...</div>;
    if (section === "perfil") return <section className="settings-panel"><SettingsPanelTitle icon={UserRound} title="Meu perfil" subtitle="Seus dados profissionais já usados pelo EsteticPro." /><div className="settings-profile-card"><div className="settings-profile-avatar">{profile?.avatar_url ? <ProfileAvatar path={profile.avatar_url} name={profile?.full_name || "Profissional"} large /> : initials(profile?.full_name)}</div><div><strong>{profile?.full_name || "Profissional"}</strong><span>{profile?.professional_title || "Profissional"}</span><small>{profile?.email || ""}</small></div><button className="secondary-button" onClick={onProfileOpen}><Edit3 size={14}/> Editar perfil</button></div></section>;
    if (section === "espaco") return <section className="settings-panel"><SettingsPanelTitle icon={Building2} title="Meu espaço" subtitle="Informações que poderão aparecer em documentos e comunicações." /><div className="settings-logo-row"><div className="settings-logo-preview">{logoPreview ? <img src={logoPreview} alt="Logo do espaço"/> : <Building2 size={26}/>}</div><div><strong>Logo do espaço</strong><span>PNG, JPG ou WEBP · até 4 MB</span><label className="secondary-button settings-upload"><Upload size={14}/> Alterar logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} hidden /></label></div></div><div className="settings-grid"><Field label="Nome do espaço"><input value={business.business_name} onChange={e=>setBiz("business_name",e.target.value)} placeholder="Nome do estúdio ou clínica"/></Field><Field label="Telefone"><input value={business.phone} onChange={e=>setBiz("phone",e.target.value)} placeholder="(00) 00000-0000" inputMode="tel"/></Field><Field label="WhatsApp"><input value={business.whatsapp} onChange={e=>setBiz("whatsapp",e.target.value)} placeholder="(00) 00000-0000" inputMode="tel"/></Field><Field label="Instagram"><input value={business.instagram} onChange={e=>setBiz("instagram",e.target.value)} placeholder="@seuinstagram"/></Field><Field label="Endereço"><input value={business.address} onChange={e=>setBiz("address",e.target.value)} placeholder="Rua, número, complemento"/></Field><Field label="Cidade"><input value={business.city} onChange={e=>setBiz("city",e.target.value)} placeholder="Cidade"/></Field><Field label="UF"><input value={business.state} onChange={e=>setBiz("state",e.target.value)} placeholder="PE" maxLength={2}/></Field><Field label="Descrição" wide><textarea value={business.description} onChange={e=>setBiz("description",e.target.value)} placeholder="Breve descrição do seu espaço"/></Field></div></section>;
    if (section === "agenda") return <section className="settings-panel"><SettingsPanelTitle icon={CalendarClock} title="Agenda" subtitle="Defina o comportamento padrão da sua agenda." /><div className="settings-grid"><Field label="Início do expediente"><input type="time" value={preferences.work_start} onChange={e=>setPref("work_start",e.target.value)}/></Field><Field label="Fim do expediente"><input type="time" value={preferences.work_end} onChange={e=>setPref("work_end",e.target.value)}/></Field><Field label="Intervalo padrão"><select value={preferences.default_slot_minutes} onChange={e=>setPref("default_slot_minutes",Number(e.target.value))}><option value={15}>15 minutos</option><option value={30}>30 minutos</option><option value={45}>45 minutos</option><option value={60}>1 hora</option></select></Field><Field label="Antecedência mínima"><select value={preferences.min_booking_hours} onChange={e=>setPref("min_booking_hours",Number(e.target.value))}><option value={0}>Sem limite</option><option value={1}>1 hora</option><option value={2}>2 horas</option><option value={4}>4 horas</option><option value={24}>24 horas</option></select></Field><Field label="Primeiro dia da semana"><select value={preferences.week_start} onChange={e=>setPref("week_start",Number(e.target.value))}><option value={0}>Domingo</option><option value={1}>Segunda-feira</option></select></Field></div><div className="settings-toggles"><Toggle label="Exibir finais de semana" checked={preferences.show_weekends} onChange={v=>setPref("show_weekends",v)} hint="Mantém sábado e domingo disponíveis no calendário."/></div></section>;
    if (section === "atendimento") return <section className="settings-panel"><SettingsPanelTitle icon={SlidersHorizontal} title="Atendimento" subtitle="Preferências do fechamento e integração com estoque." /><div className="settings-toggles"><Toggle label="Registrar consumo de estoque automaticamente" checked={preferences.auto_stock_consumption} onChange={v=>setPref("auto_stock_consumption",v)} hint="Usa a composição cadastrada no procedimento ao concluir o atendimento."/><Toggle label="Exigir confirmação de pagamento" checked={preferences.require_payment_confirmation} onChange={v=>setPref("require_payment_confirmation",v)} hint="Mantém a etapa de pagamento antes de finalizar o atendimento."/><Toggle label="Permitir concluir sem pagamento" checked={preferences.allow_unpaid_completion} onChange={v=>setPref("allow_unpaid_completion",v)} hint="Permite registrar o atendimento e manter o valor pendente."/></div></section>;
    if (section === "whatsapp") return <section className="settings-panel"><SettingsPanelTitle icon={MessageSquareText} title="WhatsApp Business" subtitle="Cadastre o número profissional usado para atender suas clientes." /><div className="integration-card"><div className="integration-icon"><MessageCircle size={19}/></div><div><strong>WhatsApp Business pessoal</strong><span>O EsteticPro não precisa de API. Ao clicar em WhatsApp, ele abre a conversa da cliente com a mensagem pronta.</span></div><span className="settings-status">Sem API</span></div><div className="settings-grid"><Field label="Seu WhatsApp Business"><input value={business.whatsapp} onChange={e=>setBiz("whatsapp",e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" /></Field></div><div className="settings-info"><strong>Variáveis disponíveis</strong><br/><code>{"{nome_cliente}"}</code>, <code>{"{procedimento}"}</code>, <code>{"{data}"}</code>, <code>{"{horario}"}</code> e <code>{"{localizacao}"}</code>. O EsteticPro preenche esses campos ao abrir a mensagem.</div><div className="settings-grid whatsapp-templates-grid">{[["confirmacao","Confirmação de agendamento"],["lembrete","Lembrete de atendimento"],["pos_atendimento","Pós-atendimento"],["retorno","Retorno da cliente"],["reagendamento","Reagendamento"],["localizacao","Enviar localização"]].map(([key,label])=><Field key={key} label={label} wide><textarea rows={4} value={business.whatsapp_message_templates?.[key] ?? DEFAULT_WHATSAPP_TEMPLATES[key]} onChange={e=>setBiz("whatsapp_message_templates",{...DEFAULT_WHATSAPP_TEMPLATES,...(business.whatsapp_message_templates||{}),[key]:e.target.value})} /></Field>)}</div><div className="settings-info"><strong>Como funciona</strong><br/>Cada profissional cadastra seu próprio número neste acesso. O sistema salva essa informação separadamente por conta e usa o WhatsApp disponível no celular ou computador para abrir a conversa. A mensagem é apenas preparada — o envio continua sendo confirmado pelo profissional no WhatsApp.</div></section>;
    if (section === "financeiro") return <section className="settings-panel"><SettingsPanelTitle icon={CircleDollarSign} title="Financeiro" subtitle="Preferências gerais da gestão financeira." /><div className="settings-grid"><Field label="Moeda"><select value={preferences.currency} onChange={e=>setPref("currency",e.target.value)}><option value="BRL">Real brasileiro (R$)</option><option value="USD">Dólar americano (US$)</option></select></Field></div><div className="settings-info">Categorias, formas de pagamento e rateios continuam sendo administrados nos próprios módulos para preservar o histórico financeiro.</div></section>;
    if (section === "estoque") return <section className="settings-panel"><SettingsPanelTitle icon={Package} title="Estoque" subtitle="Preferências do controle de produtos." /><div className="settings-toggles"><Toggle label="Consumo automático ativo por padrão" checked={preferences.auto_stock_consumption} onChange={v=>setPref("auto_stock_consumption",v)} hint="O atendimento poderá desativar o consumo individualmente quando necessário."/></div><div className="settings-info">Produtos, estoque mínimo, fornecedores e movimentações continuam no módulo Estoque.</div></section>;
    if (section === "documentos") return <section className="settings-panel"><SettingsPanelTitle icon={FileText} title="Documentos e PDF" subtitle="Defina informações padrão para documentos do EsteticPro." /><div className="settings-grid"><Field label="Rodapé dos documentos" wide><textarea value={preferences.document_footer} onChange={e=>setPref("document_footer",e.target.value)} placeholder="Ex.: EsteticPro · atendimento personalizado"/></Field><Field label="Texto padrão de consentimento da anamnese" wide><textarea value={preferences.anamnesis_consent_text} onChange={e=>setPref("anamnesis_consent_text",e.target.value)}/></Field></div></section>;
    if (section === "aparencia") return <section className="settings-panel"><SettingsPanelTitle icon={Palette} title="Aparência" subtitle="Escolha o modo de exibição. Você também pode alternar a qualquer momento pelo botão no topo." /><div className="theme-options"><button className={preferences.theme !== "dark" ? "active" : ""} onClick={()=>setPref("theme","light")}><div className="theme-preview light"><span/></div><strong>Claro</strong><small>Creme e verde, para o dia</small></button><button className={preferences.theme === "dark" ? "active" : ""} onClick={()=>setPref("theme","dark")}><div className="theme-preview dark"><span/></div><strong>Escuro</strong><small>Verde profundo, mais confortável à noite</small></button></div><div className="settings-info">Nos dois modos a identidade EsteticPro é mantida: verde profundo, creme e detalhes dourados.</div></section>;
    return <section className="settings-panel"><SettingsPanelTitle icon={LockKeyhole} title="Segurança" subtitle="Acesso, conta e integrações protegidas." /><div className="security-list"><div><strong>Conta autenticada</strong><span>Seu acesso é protegido pelo Supabase Auth.</span></div><div><strong>Google Drive</strong><span>As fotos de evolução permanecem privadas na conta Google conectada.</span></div><div><strong>Dados sensíveis</strong><span>Credenciais e tokens de integrações não ficam expostos nesta tela.</span></div></div><div className="settings-info">Alteração de senha e exclusão definitiva da conta permanecem nas ferramentas de autenticação para evitar ações destrutivas acidentais.</div></section>;
  }

  return <div className="settings-page"><section className="module-header settings-header"><div><span>PERSONALIZAÇÃO & ADMINISTRAÇÃO</span><h1>Configurações</h1><p>Centralize as preferências que definem como o EsteticPro funciona para você.</p></div><button className="primary-button module-action" onClick={save} disabled={saving}>{saving ? <span className="button-spinner"/> : <><Save size={15}/> Salvar configurações</>}</button></section><div className="settings-layout"><aside className="settings-nav">{sections.map(([id,Icon,label])=><button key={id} className={section===id?"active":""} onClick={()=>setSection(id)}><Icon size={17}/><span>{label}</span><ChevronRight size={14}/></button>)}</aside><div className="settings-content">{notice && <div className={`settings-notice ${notice.type}`}>{notice.type === "success" ? <CheckCircle2 size={16}/> : <ShieldCheck size={16}/>}<span>{notice.text}</span></div>}{renderSection()}</div></div></div>;
}

function SettingsPanelTitle({ icon: Icon, title, subtitle }) { return <div className="settings-panel-title"><div className="settings-panel-icon"><Icon size={17}/></div><div><h2>{title}</h2><p>{subtitle}</p></div></div>; }

function countPaidRevenueEntries(items) {
  const seenAppointments = new Set();
  let count = 0;
  for (const item of items) {
    if (item.type !== "receita" || item.status !== "pago") continue;
    if (item.appointment_id) {
      if (seenAppointments.has(item.appointment_id)) continue;
      seenAppointments.add(item.appointment_id);
    }
    count += 1;
  }
  return count;
}

function Money({ value, className = "" }) {
  const n = Number(value || 0);
  const parts = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).formatToParts(Math.abs(n));
  const integer = parts.filter((p) => p.type === "integer" || p.type === "group").map((p) => p.value).join("");
  const fraction = parts.find((p) => p.type === "fraction")?.value || "00";
  return <span className={`money ${className}`} aria-label={moneyValue(n)}><span aria-hidden="true" className="money-cur">{n < 0 ? "−R$" : "R$"}</span><span aria-hidden="true">{integer}</span><span aria-hidden="true" className="money-dec">,{fraction}</span></span>;
}

function Sparkline({ values }) {
  const id = useId();
  const w = 320, h = 64, pad = 4;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2 - 6)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  const last = pts[pts.length - 1];
  return <svg className="dx-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Faturamento diário do mês">
    <defs><linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D0BC8F" stopOpacity=".38" /><stop offset="1" stopColor="#D0BC8F" stopOpacity="0" /></linearGradient></defs>
    <path d={area} fill={`url(#${id}a)`} />
    <path d={line} fill="none" stroke="#D0BC8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    <circle cx={last[0]} cy={last[1]} r="3.2" fill="#F5F0E3" stroke="#D0BC8F" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function Donut({ revenue, expense }) {
  const total = revenue + expense;
  const r = 52, c = 2 * Math.PI * r;
  const share = total ? revenue / total : 0;
  const gap = total && revenue && expense ? 4 : 0;
  const a = Math.max(share * c - gap, 0);
  const b = Math.max((1 - share) * c - gap, 0);
  return <svg viewBox="0 0 132 132" aria-hidden="true">
    <circle cx="66" cy="66" r={r} fill="none" stroke="rgb(var(--fg-rgb) / .08)" strokeWidth="13" />
    {total > 0 && revenue > 0 && <circle cx="66" cy="66" r={r} fill="none" stroke="var(--accent)" strokeWidth="13" strokeLinecap="butt" strokeDasharray={`${a} ${c}`} />}
    {total > 0 && expense > 0 && <circle cx="66" cy="66" r={r} fill="none" stroke="rgb(var(--gold-rgb))" strokeWidth="13" strokeLinecap="butt" strokeDasharray={`${b} ${c}`} strokeDashoffset={-(share * c)} />}
  </svg>;
}

const apptTone = (status) => (status === "Aguardando" || status === "Agendado" ? "wait" : status === "Concluído" ? "done" : status === "Cancelado" || status === "Faltou" ? "bad" : "");

function DashboardHome({ displayName, onNavigate, userId }) {
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(true);
  const [finance, setFinance] = useState({ receitas: 0, despesas: 0, resultado: 0, ticket: 0, daily: [] });
  const [newClients, setNewClients] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const today = toInputDate(new Date());
  const current = formatCurrentDate();
  const monthKey = today.slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${today}T12:00:00`)).replace(/^./, (ch) => ch.toUpperCase());
  const firstName = String(displayName || "").split(" ")[0] || "Profissional";
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(new Date())) % 24;
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  useEffect(() => {
    let mounted = true;
    setLoadingAgenda(true);
    supabase.from("appointments").select("id, start_time, procedure_name, status, client_id, clients(full_name)").eq("user_id", userId).eq("appointment_date", today).order("start_time", { ascending: true }).then(({ data, error }) => {
      if (!mounted) return;
      setTodayAppointments(error ? [] : (data || []).map((item) => ({ ...item, name: item.clients?.full_name || "Cliente", procedure: item.procedure_name || "Atendimento" })));
      setLoadingAgenda(false);
    });
    supabase.from("appointments").select("id, appointment_date, start_time, procedure_name, status, clients(full_name)").eq("user_id", userId).gt("appointment_date", today).order("appointment_date", { ascending: true }).order("start_time", { ascending: true }).limit(5).then(({ data, error }) => { if (mounted) setUpcoming(error ? [] : (data || [])); });
    return () => { mounted = false; };
  }, [userId, today]);

  useEffect(() => {
    let mounted = true;
    const start = `${monthKey}-01`;
    const last = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate();
    const end = `${monthKey}-${String(last).padStart(2, "0")}`;
    supabase.from("financial_transactions").select("type, amount, status, appointment_id, transaction_date").eq("user_id", userId).gte("transaction_date", start).lte("transaction_date", end).eq("status", "pago").then(({ data, error }) => {
      if (!mounted || error) return;
      const rows = data || [];
      const receitas = rows.filter((x) => x.type === "receita").reduce((s, x) => s + Number(x.amount || 0), 0);
      const despesas = rows.filter((x) => x.type === "despesa").reduce((s, x) => s + Number(x.amount || 0), 0);
      const qtd = countPaidRevenueEntries(rows);
      const dayNow = Number(today.slice(8, 10));
      const daily = Array.from({ length: dayNow }, () => 0);
      rows.filter((x) => x.type === "receita" && x.transaction_date).forEach((x) => { const d = Number(String(x.transaction_date).slice(8, 10)); if (d >= 1 && d <= dayNow) daily[d - 1] += Number(x.amount || 0); });
      setFinance({ receitas, despesas, resultado: receitas - despesas, ticket: qtd ? receitas / qtd : 0, daily });
    });
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", `${monthKey}-01T00:00:00-03:00`).then(({ count, error }) => { if (mounted && !error) setNewClients(count ?? 0); });
    return () => { mounted = false; };
  }, [userId, monthKey]);

  const nextAppt = todayAppointments.find((a) => a.status !== "Concluído" && a.status !== "Cancelado" && a.status !== "Faltou");
  const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL", maximumFractionDigits: 1 }).format(finance.resultado);
  const sparkValues = finance.daily.length > 1 ? finance.daily : [0, 0];

  return <>
    <header className="dx-head">
      <div><span className="dx-eyebrow">Visão geral</span><h1 className="dx-title">{greeting}, {firstName}</h1><p className="dx-sub">Seu dia, suas clientes e seus resultados em um só lugar.</p></div>
      <div className="dx-date"><div className="ico"><CalendarDays size={20} /></div><div><span>{current.weekday}</span><strong>{current.date}</strong></div></div>
    </header>
    <section className="dx-grid">
      <article className="dx-hero">
        <BrandSymbol className="dx-hero-bg" size={200} title="" />
        <div className="dx-hero-top"><span className="dx-chip"><CircleDollarSign size={15} />Faturamento do mês</span><span className="dx-period">{monthLabel}</span></div>
        <div className="dx-big" style={{ fontSize: "clamp(38px, 4.4vw, 54px)" }}><Money value={finance.receitas} /></div>
        <p className="dx-hero-note">Receitas com status pago neste mês</p>
        <Sparkline values={sparkValues} />
        <div className="dx-hero-stats">
          <div><span>Despesas</span><strong><Money value={finance.despesas} /></strong></div>
          <div><span>Resultado</span><strong className={finance.resultado >= 0 ? "pos" : "neg"}><Money value={finance.resultado} /></strong></div>
          <div><span>Ticket médio</span><strong><Money value={finance.ticket} /></strong></div>
        </div>
      </article>
      <div className="dx-kpis"><article className="dx-card dx-kpi"><div className="ico"><CalendarDays size={19} /></div><label>Atendimentos hoje</label><strong>{loadingAgenda ? "—" : todayAppointments.length}</strong><small>Agenda em tempo real</small></article>
      <article className="dx-card dx-kpi gold"><div className="ico"><UsersRound size={19} /></div><label>Novos clientes</label><strong>{newClients ?? "—"}</strong><small>Cadastradas neste mês</small></article>
      <article className="dx-card dx-kpi"><div className="ico"><Clock3 size={19} /></div><label>Próximo atendimento</label><strong className="sm">{nextAppt ? formatTime(nextAppt.start_time) : "—"}</strong><small>{nextAppt ? `${nextAppt.name} · ${nextAppt.procedure}` : "Nada pendente hoje"}</small></article></div>

      <section className="dx-card dx-agenda">
        <div className="dx-card-head"><h3><CalendarDays size={20} />Agenda de hoje</h3><button className="dx-link" onClick={() => onNavigate("agenda")}>Ver agenda completa <ArrowRight size={14} /></button></div>
        <div className="dx-timeline">
          {loadingAgenda ? <><div className="dx-skel" /><div className="dx-skel" /><div className="dx-skel" /></> : todayAppointments.map((item) => <button type="button" className="dx-appt" key={item.id} onClick={() => onNavigate("agenda", { type: "date", date: today })}>
            <time>{formatTime(item.start_time)}</time>
            <div className="dx-appt-who"><div className="dx-avatar">{initials(item.name)}</div><div style={{ minWidth: 0 }}><strong>{item.name}</strong><span>{item.procedure}</span></div></div>
            <span className={`dx-pill ${apptTone(item.status)}`}>{item.status}</span>
          </button>)}
          {!loadingAgenda && !todayAppointments.length && <div className="dx-empty"><CalendarDays size={26} /><span>Nenhum atendimento marcado para hoje.</span><button className="dx-link" onClick={() => onNavigate("agenda", { type: "new" })}>Novo agendamento <ArrowRight size={14} /></button></div>}
        </div>
      </section>

      <div className="dx-side">
        <section className="dx-card">
          <div className="dx-card-head"><h3><Sparkles size={19} />Ações rápidas</h3></div>
          <div className="dx-quick">
            <button className="dx-qa" onClick={() => onNavigate("clientes", { type: "new" })}><span className="ico"><UsersRound size={18} /></span>Novo cliente</button>
            <button className="dx-qa" onClick={() => onNavigate("agenda", { type: "new" })}><span className="ico"><CalendarDays size={18} /></span>Novo agendamento</button>
            <button className="dx-qa" onClick={() => onNavigate("financeiro", { type: "new" })}><span className="ico"><CircleDollarSign size={18} /></span>Novo lançamento</button>
            <button className="dx-qa" onClick={() => onNavigate("financeiro", { type: "new", kind: "despesa" })}><span className="ico"><WalletCards size={18} /></span>Adicionar despesa</button>
          </div>
        </section>
        <section className="dx-card">
          <div className="dx-card-head"><h3><CircleDollarSign size={19} />Financeiro</h3><button className="dx-link" onClick={() => onNavigate("financeiro")}>Abrir <ArrowRight size={14} /></button></div>
          <div className="dx-fin">
            <div className="dx-donut"><Donut revenue={finance.receitas} expense={finance.despesas} /><div className="dx-donut-c"><span>Resultado</span><strong>{compact}</strong></div></div>
            <div className="dx-legend">
              <div><i style={{ background: "var(--accent)" }} /><span>Receita</span><strong>{moneyValue(finance.receitas)}</strong></div>
              <div><i style={{ background: "rgb(var(--gold-rgb))" }} /><span>Despesas</span><strong>{moneyValue(finance.despesas)}</strong></div>
            </div>
          </div>
        </section>
      </div>

      <RecentClients userId={userId} onOpen={(id) => onNavigate("clientes", id ? { type: "open", id } : undefined)} />
      <section className="dx-card dx-half">
        <div className="dx-card-head"><h3><CalendarClock size={19} />Próximos atendimentos</h3><button className="dx-link" onClick={() => onNavigate("agenda")}>Agenda <ArrowRight size={14} /></button></div>
        {upcoming.length ? <div className="dx-list">{upcoming.map((a) => { const who = a.clients?.full_name || "Cliente"; return <div className="dx-row" key={a.id}><div className="dx-avatar">{initials(who)}</div><div style={{ minWidth: 0 }}><strong>{who}</strong><span className="sub">{a.procedure_name || "Atendimento"}</span></div><div className="when"><b>{formatTime(a.start_time)}</b>{formatDate(a.appointment_date)}</div></div>; })}</div>
          : <div className="dx-empty"><CalendarClock size={26} /><span>Os próximos atendimentos aparecerão aqui conforme a agenda for preenchida.</span></div>}
      </section>
    </section>
    <footer className="dx-foot"><BrandLockup size="sm" /><i /><small>Gestão inteligente para profissionais de estética</small></footer>
  </>;
}

function RecentClients({ userId, onOpen }) {
  const [clients, setClients] = useState(null);
  useEffect(() => {
    let mounted = true;
    supabase.from("clients").select("id, full_name, created_at, active").eq("user_id", userId).order("created_at", { ascending: false }).limit(5).then(({ data, error }) => { if (mounted) setClients(error ? [] : (data || [])); });
    return () => { mounted = false; };
  }, [userId]);
  return <section className="dx-card dx-half">
    <div className="dx-card-head"><h3><UsersRound size={19} />Clientes recentes</h3><button className="dx-link" onClick={() => onOpen()}>Ver todos <ArrowRight size={14} /></button></div>
    {clients === null ? <><div className="dx-skel" /><div className="dx-skel" /></> : clients.length ? <div className="dx-list">{clients.map((c) => <button type="button" className="dx-row" key={c.id} onClick={() => onOpen(c.id)} style={{ background: "transparent", border: 0, textAlign: "left", cursor: "pointer", font: "inherit", width: "100%", borderRadius: 10 }}><div className="dx-avatar">{initials(c.full_name)}</div><div style={{ minWidth: 0 }}><strong>{c.full_name}</strong><span className="sub">Cadastro em {formatDate(c.created_at)}</span></div><span className={`dx-pill ${c.active === false ? "done" : ""}`}>{c.active === false ? "Inativa" : "Ativa"}</span></button>)}</div>
      : <div className="dx-empty"><UsersRound size={26} /><span>Nenhuma cliente cadastrada ainda.</span><button className="dx-link" onClick={() => onOpen()}>Cadastrar primeira cliente <ArrowRight size={14} /></button></div>}
  </section>;
}

function ClientsModule({ userId, onNavigate, intent, onIntentDone }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);

  async function loadClients() {
    setLoading(true);
    const { data, error } = await supabase.from("clients").select("*").eq("user_id", userId).order("active", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    if (error) setNotice({ type: "error", text: error.message });
    setClients(data || []); setLoading(false);
  }
  useEffect(() => { loadClients(); }, [userId]);
  const pendingClientId = useRef(null);
  useEffect(() => {
    if (!intent) return;
    if (intent.type === "new") { setEditing(null); setSelected(null); setShowForm(true); }
    else if (intent.type === "open" && intent.id) { pendingClientId.current = intent.id; }
    onIntentDone?.();
  }, [intent]);
  useEffect(() => {
    if (loading || !pendingClientId.current) return;
    const found = clients.find((c) => c.id === pendingClientId.current);
    pendingClientId.current = null;
    if (found) { setShowForm(false); setSelected(found); }
  }, [loading, clients, intent]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => `${c.full_name} ${c.phone || ""} ${c.email || ""} ${c.instagram || ""}`.toLowerCase().includes(term));
  }, [clients, query]);

  async function toggleClient(client) {
    const { error } = await supabase.from("clients").update({ active: !client.active }).eq("id", client.id).eq("user_id", userId);
    if (error) setNotice({ type: "error", text: error.message });
    else { setNotice({ type: "success", text: client.active ? "Cliente inativada." : "Cliente ativada." }); loadClients(); }
  }

  async function removeClient(client) {
    if (!window.confirm(`Excluir ${client.full_name}? Essa ação não poderá ser desfeita.`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", client.id).eq("user_id", userId);
    if (error) setNotice({ type: "error", text: error.message }); else { setNotice({ type: "success", text: "Cliente excluída com sucesso." }); setSelected(null); loadClients(); }
  }

  function openNew() { setEditing(null); setShowForm(true); setSelected(null); }
  function openEdit(client) { setEditing(client); setShowForm(true); setSelected(null); }

  return <section className="clients-page">
    <div className="module-header"><div><span>GESTÃO DE RELACIONAMENTO</span><h1>Clientes</h1><p>Organize seus clientes, histórico e informações profissionais em um só lugar.</p></div><button className="primary-button module-action" onClick={openNew}><Plus size={18} /> Nova cliente</button></div>
    {notice && <div className={`module-notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}
    <div className="client-toolbar"><div className="client-search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, telefone ou e-mail..." /></div><div className="client-count">{filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}</div></div>
    {loading ? <div className="loading-panel"><span className="button-spinner dark" />Carregando clientes...</div> : filtered.length ? <div className="clients-grid">{filtered.map((client) => <ClientCard key={client.id} client={client} onView={() => setSelected(client)} onEdit={() => openEdit(client)} onToggle={() => toggleClient(client)} onDelete={() => removeClient(client)} />)}</div> : <EmptyClients onNew={openNew} hasQuery={Boolean(query)} />}
    {showForm && <ClientForm userId={userId} client={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setNotice({ type: "success", text: editing ? "Cliente atualizada com sucesso." : "Cliente cadastrada com sucesso." }); loadClients(); }} />}
    {selected && <ClientDetails client={selected} userId={userId} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} onDelete={() => removeClient(selected)} onNavigate={onNavigate} />}
  </section>;
}

function ClientCard({ client, onView, onEdit, onToggle, onDelete }) {
  return <article className={`client-card ${client.active === false ? "inactive" : ""}`}>
    <button className="client-card-main" onClick={onView}>
      <div className="large-avatar">{initials(client.full_name)}</div>
      <div className="client-card-info"><h3>{client.full_name}</h3><span>{client.phone || "Telefone não informado"}</span><small>{client.email || "E-mail não informado"}</small></div>
      <ChevronRight size={18} />
    </button>
    <div className="client-card-footer">
      <span className={`client-active-label ${client.active === false ? "inactive" : ""}`}>{client.active === false ? "Cliente inativa" : "Cliente ativa"}</span>
      <div><button onClick={onEdit} title="Editar"><Edit3 size={16} /></button><button onClick={onToggle} title={client.active === false ? "Ativar" : "Inativar"}>{client.active === false ? <Eye size={16} /> : <EyeOff size={16} />}</button><button className="danger-button" onClick={onDelete} title="Excluir"><Trash2 size={16} /></button></div>
    </div>
  </article>;
}

function EmptyClients({ onNew, hasQuery }) {
  return <div className="empty-clients"><div className="empty-icon"><UsersRound size={32} /></div><h2>{hasQuery ? "Nenhuma cliente encontrada" : "Comece sua base de clientes"}</h2><p>{hasQuery ? "Tente buscar por outro nome, telefone ou e-mail." : "Cadastre sua primeira cliente para começar a construir o histórico profissional."}</p>{!hasQuery && <button className="primary-button compact" onClick={onNew}><Plus size={17} /> Cadastrar primeira cliente</button>}</div>;
}

const emptyClient = { full_name: "", phone: "", email: "", birth_date: "", cpf: "", instagram: "", address: "", notes: "", active: true };

function ClientForm({ userId, client, onClose, onSaved }) {
  const [form, setForm] = useState(client ? { ...emptyClient, ...client } : { ...emptyClient });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function submit(e) {
    e.preventDefault(); setError("");
    if (!form.full_name.trim()) return setError("Informe o nome completo da cliente.");
    setSaving(true);
    const payload = { full_name: form.full_name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null, birth_date: form.birth_date || null, cpf: form.cpf.trim() || null, instagram: form.instagram.trim() || null, address: form.address.trim() || null, notes: form.notes.trim() || null, active: form.active !== false };
    const result = client ? await supabase.from("clients").update(payload).eq("id", client.id).eq("user_id", userId) : await supabase.from("clients").insert({ ...payload, user_id: userId });
    setSaving(false); if (result.error) setError(result.error.message); else onSaved();
  }
  return <div className="modal-backdrop"><div className="modal-card client-form-modal"><div className="modal-header"><div><span>CADASTRO DE CLIENTE</span><h2>{client ? "Editar cliente" : "Nova cliente"}</h2></div><button type="button" onClick={onClose}><X size={20}/></button></div><form onSubmit={submit} className="client-form"><FormInput label="Nome completo *" value={form.full_name} onChange={v=>set("full_name",v)} placeholder="Ex.: Maria Silva"/><div className="form-grid"><FormInput label="Telefone" value={form.phone} onChange={v=>set("phone",v)} placeholder="(00) 00000-0000"/><FormInput label="E-mail" value={form.email} onChange={v=>set("email",v)} placeholder="cliente@email.com" type="email"/><FormInput label="Data de nascimento" value={form.birth_date||""} onChange={v=>set("birth_date",v)} type="date"/><FormInput label="CPF" value={form.cpf} onChange={v=>set("cpf",v)} placeholder="000.000.000-00"/><FormInput label="Instagram" value={form.instagram} onChange={v=>set("instagram",v)} placeholder="@usuario"/></div><FormInput label="Endereço" value={form.address} onChange={v=>set("address",v)} placeholder="Rua, número, bairro..."/><label className="textarea-field"><span>Observações</span><textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Informações importantes sobre a cliente..." rows="4"/></label>{client && <label className="service-toggle"><input type="checkbox" checked={form.active !== false} onChange={e=>set("active",e.target.checked)}/><span>Cliente ativa</span></label>}{error&&<div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving?<span className="button-spinner"/>:<><Check size={17}/> {client?"Salvar alterações":"Cadastrar cliente"}</>}</button></div></form></div></div>;
}

function paymentMethodLabel(value) {
  return ({ pix: "Pix", cartao_credito: "Cartão de crédito", cartao_debito: "Cartão de débito", dinheiro: "Dinheiro", transferencia: "Transferência", outro: "Outro" }[value] || value || "Não informado");
}

function moneyBR(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalizeBrazilPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

function formatDateForWhatsApp(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return String(value);
  return `${day}/${month}/${year}`;
}

function AgendaModule({ userId, intent, onIntentDone }) {
  const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()));
  const [view, setView] = useState("day");
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [professionalWhatsApp, setProfessionalWhatsApp] = useState("");
  const [whatsappTemplates, setWhatsAppTemplates] = useState(DEFAULT_WHATSAPP_TEMPLATES);
  const [paymentAppointment, setPaymentAppointment] = useState(null);
  const [procedures, setProcedures] = useState([]);
  const [clientPackages, setClientPackages] = useState([]);
  const [servicePackages, setServicePackages] = useState([]);

  const monthRange = useMemo(() => getMonthRange(monthCursor), [monthCursor]);

  useEffect(() => {
    if (!intent) return;
    if (intent.type === "date" && intent.date) {
      const d = new Date(`${intent.date}T12:00:00`);
      setSelectedDate(intent.date);
      setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
      setView("day");
    } else if (intent.type === "new") {
      setEditing(null);
      setShowForm(true);
    }
    onIntentDone?.();
  }, [intent]);

  async function loadData() {
    setLoading(true);
    const appointmentQuery = view === "month"
      ? supabase
          .from("appointments")
          .select("*, clients(full_name, phone)")
          .eq("user_id", userId)
          .gte("appointment_date", monthRange.start)
          .lte("appointment_date", monthRange.end)
          .order("appointment_date", { ascending: true })
          .order("start_time", { ascending: true })
      : supabase
          .from("appointments")
          .select("*, clients(full_name, phone)")
          .eq("user_id", userId)
          .eq("appointment_date", selectedDate)
          .order("start_time", { ascending: true });

    const [{ data: appts, error: apptError }, { data: clientRows, error: clientError }, { data: procedureRows, error: procedureError }, { data: packageRows, error: packageError }, { data: servicePackageRows, error: servicePackageError }, { data: businessSettings, error: businessError }] = await Promise.all([
      appointmentQuery,
      supabase.from("clients").select("id, full_name, phone, email, active").eq("user_id", userId).eq("active", true).order("full_name", { ascending: true }),
      supabase.from("procedures").select("id, name, category, duration_minutes, price, active").eq("user_id", userId).order("active", { ascending: false }).order("name"),
      supabase.from("client_packages").select("id, client_id, total_sessions, used_sessions, amount, expires_at, status, package_id, service_packages(name, price, total_sessions, service_package_items(id, procedure_id, procedure_name, quantity))").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("service_packages").select("id, name, price, total_sessions, validity_days, active, service_package_items(id, procedure_id, procedure_name, quantity)").eq("user_id", userId).eq("active", true).order("name"),
      supabase.from("business_settings").select("whatsapp, whatsapp_message_templates, address, city, state").eq("user_id", userId).maybeSingle(),
    ]);

    if (apptError) setNotice({ type: "error", text: apptError.message });
    else if (clientError) setNotice({ type: "error", text: clientError.message });
    else if (procedureError) setNotice({ type: "error", text: procedureError.message });
    else if (packageError) setNotice({ type: "error", text: packageError.message });
    else if (servicePackageError) setNotice({ type: "error", text: servicePackageError.message });
    else if (businessError) setNotice({ type: "error", text: businessError.message });

    setProfessionalWhatsApp(businessSettings?.whatsapp || "");
    setWhatsAppTemplates({ ...DEFAULT_WHATSAPP_TEMPLATES, ...(businessSettings?.whatsapp_message_templates || {}) });

    const normalizedAppointments = (appts || []).map((appointment) => ({
      ...appointment,
      client_name: appointment.clients?.full_name || "Cliente não informado",
      client_phone: appointment.clients?.phone || "",
    }));

    setAppointments(normalizedAppointments);
    setClients(clientRows || []);
    setProcedures(procedureRows || []);
    setClientPackages(packageRows || []);
    setServicePackages(servicePackageRows || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [userId, selectedDate, view, monthRange.start, monthRange.end]);

  const dayLabel = formatLongDate(selectedDate);
  const monthLabel = formatMonthLabel(monthCursor);

  const changeDay = (delta) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + delta);
    const nextDate = toInputDate(d);
    setSelectedDate(nextDate);
    setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const changeMonth = (delta) => {
    const next = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + delta, 1);
    setMonthCursor(next);
  };

  const goToday = () => {
    const today = new Date();
    setSelectedDate(toInputDate(today));
    setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  function openMonthDay(date) {
    setSelectedDate(date);
    const d = new Date(`${date}T12:00:00`);
    setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setView("day");
  }

  function sendWhatsApp(appointment) {
    if (!appointment.client_id) {
      return setNotice({ type: "error", text: "Este agendamento não possui uma cliente vinculada." });
    }
    if (!professionalWhatsApp) {
      return setNotice({ type: "error", text: "Cadastre seu WhatsApp Business em Configurações → WhatsApp antes de iniciar uma conversa." });
    }
    if (!appointment.client_phone) {
      return setNotice({ type: "error", text: "A cliente não possui telefone cadastrado." });
    }

    const phone = normalizeBrazilPhone(appointment.client_phone);
    if (!phone) {
      return setNotice({ type: "error", text: "O telefone da cliente não parece ser um número brasileiro válido." });
    }

    const date = formatDateForWhatsApp(appointment.appointment_date);
    const time = formatTime(appointment.start_time);
    const procedure = appointment.procedure_name || "atendimento";
    const firstName = String(appointment.client_name || "Cliente").trim().split(/\s+/)[0] || "Olá";
    // Escolhe o modelo pelo status atual do agendamento.
    // Agendado/Confirmado -> confirmação; Aguardando -> lembrete;
    // Concluído -> pós-atendimento; Cancelado -> reagendamento.
    const templateKey = appointment.status === "Concluído"
      ? "pos_atendimento"
      : appointment.status === "Aguardando"
        ? "lembrete"
        : appointment.status === "Cancelado"
          ? "reagendamento"
          : "confirmacao";
    const template = whatsappTemplates[templateKey] || DEFAULT_WHATSAPP_TEMPLATES[templateKey];
    const message = fillWhatsAppTemplate(template, {
      nome_cliente: firstName,
      procedimento: procedure,
      data: date,
      horario: time,
      localizacao: "",
    });
    const encodedMessage = new URLSearchParams({ text: message }).toString();
    const url = `https://wa.me/${phone}?${encodedMessage}`;

    setSendingId(appointment.id);
    setNotice(null);
    window.open(url, "_blank", "noopener,noreferrer");
    setSendingId(null);
    setNotice({ type: "success", text: "WhatsApp aberto com a mensagem pronta para envio." });
  }

  async function updateStatus(appointment, status) {
    if (status === "Concluído" && appointment.status !== "Concluído") {
      setPaymentAppointment(appointment);
      return;
    }
    if (appointment.status === "Concluído" && status !== "Concluído") {
      const { error: restoreError } = await supabase.rpc("restore_inventory_for_appointment", { p_appointment_id: appointment.id });
      if (restoreError) return setNotice({ type: "error", text: restoreError.message });
    }
    const { error } = await supabase.from("appointments").update({ status }).eq("id", appointment.id).eq("user_id", userId);
    if (error) setNotice({ type: "error", text: error.message }); else loadData();
  }

  async function finalizeAppointmentPayment({ appointment, amount, paymentParts, paymentStatus, consumeStock = true }) {
    const isPackageSession = Boolean(appointment.client_package_id);
    const normalizedAmount = Number(String(amount).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    const parts = (paymentParts || []).map((part) => ({
      method: part.method,
      amount: Number(String(part.amount).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0
    })).filter((part) => part.method && part.amount > 0);
    const receivedAmount = parts.reduce((sum, part) => sum + part.amount, 0);
    const remaining = Math.max(normalizedAmount - receivedAmount, 0);
    const effectivePaymentStatus = receivedAmount + 0.01 >= normalizedAmount ? "pago" : "pendente";

    if (!isPackageSession && normalizedAmount <= 0) throw new Error("Informe o valor do atendimento.");
    if (!isPackageSession && paymentStatus === "pago" && Math.abs(receivedAmount - normalizedAmount) > 0.01) {
      throw new Error(`A soma das formas de pagamento deve ser igual a ${moneyBR(normalizedAmount)}.`);
    }
    if (!isPackageSession && receivedAmount - normalizedAmount > 0.01) {
      throw new Error("O valor recebido não pode ser maior que o valor do serviço.");
    }

    const methodLabel = Array.from(new Set(parts.map((part) => paymentMethodLabel(part.method)).filter(Boolean))).join(" + ") || null;
    const appointmentPatch = {
      status: "Concluído",
      payment_status: isPackageSession ? "pacote" : effectivePaymentStatus,
      payment_method: isPackageSession ? null : methodLabel,
      payment_amount: isPackageSession ? 0 : normalizedAmount,
      payment_received_amount: isPackageSession ? 0 : receivedAmount
    };
    const { error: appointmentError } = await supabase.from("appointments").update(appointmentPatch).eq("id", appointment.id).eq("user_id", userId);
    if (appointmentError) throw appointmentError;

    if (!isPackageSession) {
      const { error: deletePartsError } = await supabase.from("appointment_payment_parts").delete().eq("appointment_id", appointment.id).eq("user_id", userId);
      if (deletePartsError) {
        await supabase.from("appointments").update({ status: appointment.status || "Agendado", payment_status: null, payment_method: null, payment_amount: null, payment_received_amount: null }).eq("id", appointment.id).eq("user_id", userId);
        throw deletePartsError;
      }

      if (parts.length) {
        const { error: partsError } = await supabase.from("appointment_payment_parts").insert(parts.map((part) => ({ appointment_id: appointment.id, user_id: userId, payment_method: part.method, amount: part.amount })));
        if (partsError) {
          await supabase.from("appointments").update({ status: appointment.status || "Agendado", payment_status: null, payment_method: null, payment_amount: null, payment_received_amount: null }).eq("id", appointment.id).eq("user_id", userId);
          throw partsError;
        }
      }

      // Remove apenas os lançamentos automáticos desta finalização anterior.
      // Lançamentos manuais não são afetados.
      const { error: oldTxError } = await supabase
        .from("financial_transactions")
        .delete()
        .eq("appointment_id", appointment.id)
        .eq("user_id", userId)
        .eq("type", "receita")
        .like("notes", "EsteticPro: pagamento do atendimento%");
      if (oldTxError) {
        await supabase.from("appointments").update({ status: appointment.status || "Agendado", payment_status: null, payment_method: null, payment_amount: null, payment_received_amount: null }).eq("id", appointment.id).eq("user_id", userId);
        throw oldTxError;
      }

      // Um atendimento gera UM lançamento de receita paga, mesmo quando
      // o cliente divide o pagamento entre duas ou mais formas.
      // O detalhamento de cada forma permanece em appointment_payment_parts.
      // Isso evita que o ticket médio conte cada forma como uma receita distinta.
      const financialRows = [];
      if (receivedAmount > 0.01) {
        financialRows.push({
          user_id: userId,
          client_id: appointment.client_id || null,
          appointment_id: appointment.id,
          type: "receita",
          description: `${appointment.procedure_name || "Atendimento estético"} — pagamento recebido`,
          category: "Serviço",
          amount: receivedAmount,
          transaction_date: appointment.appointment_date || toInputDate(new Date()),
          payment_method: methodLabel,
          status: "pago",
          notes: `EsteticPro: pagamento do atendimento · ${methodLabel || "forma não informada"}.`
        });
      }
      if (remaining > 0.01) {
        financialRows.push({
          user_id: userId,
          client_id: appointment.client_id || null,
          appointment_id: appointment.id,
          type: "receita",
          description: `${appointment.procedure_name || "Atendimento estético"} — saldo pendente`,
          category: "Serviço",
          amount: remaining,
          transaction_date: appointment.appointment_date || toInputDate(new Date()),
          payment_method: null,
          status: "pendente",
          notes: "EsteticPro: pagamento do atendimento · saldo pendente."
        });
      }

      if (financialRows.length) {
        const txResult = await supabase.from("financial_transactions").insert(financialRows);
        if (txResult.error) {
          await supabase.from("appointments").update({ status: appointment.status || "Agendado", payment_status: null, payment_method: null, payment_amount: null, payment_received_amount: null }).eq("id", appointment.id).eq("user_id", userId);
          await supabase.from("appointment_payment_parts").delete().eq("appointment_id", appointment.id).eq("user_id", userId);
          throw txResult.error;
        }
      }
    }

    if (consumeStock) {
      const { error: stockError } = await supabase.rpc("consume_inventory_for_appointment", { p_appointment_id: appointment.id });
      if (stockError) {
        await supabase.from("appointments").update({ status: appointment.status || "Agendado", payment_status: null, payment_method: null, payment_amount: null, payment_received_amount: null }).eq("id", appointment.id).eq("user_id", userId);
        await supabase.from("appointment_payment_parts").delete().eq("appointment_id", appointment.id).eq("user_id", userId);
        await supabase.from("financial_transactions").delete().eq("appointment_id", appointment.id).eq("user_id", userId).eq("type", "receita").like("notes", "EsteticPro: pagamento do atendimento%");
        throw stockError;
      }
    }

    setPaymentAppointment(null);
    setNotice({ type: "success", text: isPackageSession ? "Atendimento concluído e sessão registrada no pacote." : `Atendimento concluído e ${paymentStatus === "pendente" ? "pagamento pendente" : "pagamento registrado"}.` });
    await loadData();
  }

  const openNew = (date = selectedDate) => {
    setSelectedDate(date);
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (a) => { setEditing(a); setShowForm(true); };

  return <section className="agenda-page">
    <div className="module-header agenda-header">
      <div><span>GESTÃO DE AGENDA</span><h1>Agenda</h1><p>Organize seus atendimentos e mantenha suas clientes informadas.</p></div>
      <button className="primary-button module-action" onClick={() => openNew()}><Plus size={18} /> Novo agendamento</button>
    </div>
    {notice && <div className={`module-notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}

    <div className="agenda-view-switcher" role="tablist" aria-label="Visualização da agenda">
      <button className={view === "day" ? "active" : ""} onClick={() => setView("day")}><Clock3 size={15} /> Dia</button>
      <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}><CalendarDays size={15} /> Mês</button>
    </div>

    {view === "day" ? <>
      <div className="agenda-toolbar">
        <button className="secondary-button" onClick={() => changeDay(-1)} aria-label="Dia anterior"><ArrowLeft size={16} /></button>
        <div className="agenda-date"><CalendarDays size={18} /><div><strong>{dayLabel.weekday}</strong><span>{dayLabel.full}</span></div></div>
        <button className="secondary-button" onClick={() => changeDay(1)} aria-label="Próximo dia"><ArrowRight size={16} /></button>
        <button className="secondary-button today-button" onClick={goToday}>Hoje</button>
      </div>
      {loading ? <div className="loading-panel"><span className="button-spinner dark" />Carregando agenda...</div> : appointments.length ? <div className="agenda-list">{appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} onEdit={() => openEdit(appointment)} onStatus={(status) => updateStatus(appointment, status)} onWhatsApp={() => sendWhatsApp(appointment)} sending={sendingId === appointment.id} />)}</div> : <div className="empty-clients agenda-empty"><div className="empty-icon"><CalendarDays size={32} /></div><h2>Agenda livre</h2><p>Não há atendimentos marcados para {dayLabel.full}. Crie um agendamento para começar.</p><button className="primary-button compact" onClick={() => openNew()}><Plus size={17} /> Novo agendamento</button></div>}
    </> : <>
      <div className="agenda-month-toolbar">
        <div className="agenda-month-navigation">
          <button className="secondary-button" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ArrowLeft size={16} /></button>
          <div className="agenda-month-title"><CalendarDays size={18} /><strong>{monthLabel}</strong></div>
          <button className="secondary-button" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ArrowRight size={16} /></button>
        </div>
        <button className="secondary-button today-button" onClick={goToday}>Hoje</button>
      </div>
      {loading ? <div className="loading-panel"><span className="button-spinner dark" />Carregando calendário...</div> : <MonthCalendar monthCursor={monthCursor} appointments={appointments} selectedDate={selectedDate} onSelectDay={openMonthDay} onNew={openNew} onEdit={openEdit} />}
    </>}

    {showForm && <AppointmentForm userId={userId} clients={clients} procedures={procedures} clientPackages={clientPackages} servicePackages={servicePackages} appointment={editing} defaultDate={selectedDate} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setNotice({ type: "success", text: editing ? "Agendamento atualizado." : "Agendamento criado com sucesso." }); loadData(); }} />}
    {paymentAppointment && <AppointmentPaymentModal appointment={paymentAppointment} procedures={procedures} onClose={() => setPaymentAppointment(null)} onConfirm={finalizeAppointmentPayment} />}
  </section>;
}

function MonthCalendar({ monthCursor, appointments, selectedDate, onSelectDay, onNew, onEdit }) {
  const cells = useMemo(() => getMonthCalendarCells(monthCursor), [monthCursor]);
  const today = toInputDate(new Date());
  const appointmentsByDate = useMemo(() => appointments.reduce((acc, appointment) => {
    if (!acc[appointment.appointment_date]) acc[appointment.appointment_date] = [];
    acc[appointment.appointment_date].push(appointment);
    return acc;
  }, {}), [appointments]);

  return <div className="month-calendar-wrap">
    <div className="month-calendar">
      <div className="month-weekdays">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <div key={day}>{day}</div>)}</div>
      <div className="month-grid">
        {cells.map((cell) => {
          const dayAppointments = appointmentsByDate[cell.date] || [];
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          return <div key={cell.date} className={`month-cell ${cell.inMonth ? "in-month" : "outside-month"} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}>
            <button className="month-day-number" onClick={() => onSelectDay(cell.date)}>{cell.day}</button>
            <div className="month-cell-actions"><button onClick={() => onNew(cell.date)} aria-label={`Novo agendamento em ${cell.date}`}><Plus size={12} /></button></div>
            <div className="month-events">
              {dayAppointments.slice(0, 3).map((appointment) => <button key={appointment.id} className={`month-event status-${slugify(appointment.status || "Agendado")}`} onClick={() => onEdit(appointment)} title={`${formatTime(appointment.start_time)} · ${appointment.client_name}`}>
                <span>{formatTime(appointment.start_time)}</span><strong>{appointment.client_name}</strong>
              </button>)}
              {dayAppointments.length > 3 && <button className="month-more" onClick={() => onSelectDay(cell.date)}>+ {dayAppointments.length - 3} atendimentos</button>}
            </div>
          </div>;
        })}
      </div>
    </div>
  </div>;
}

function AppointmentPaymentModal({ appointment, procedures, onClose, onConfirm }) {
  const isPackage = Boolean(appointment.client_package_id);
  const procedure = procedures.find((item) => item.id === appointment.procedure_id);
  const [amount, setAmount] = useState(String(procedure?.price ?? appointment.payment_amount ?? ""));
  const [paymentParts, setPaymentParts] = useState([{ id: crypto.randomUUID(), method: appointment.payment_method || "pix", amount: String(procedure?.price ?? appointment.payment_amount ?? "") }]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [consumeStock, setConsumeStock] = useState(true);
  const [loadingStock, setLoadingStock] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const normalizedAmount = Number(String(amount).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
  const receivedAmount = paymentParts.reduce((sum, part) => sum + (Number(String(part.amount).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0), 0);
  const remaining = Math.max(normalizedAmount - receivedAmount, 0);

  useEffect(() => {
    (async () => {
      if (!appointment.procedure_id) { setInventoryItems([]); setLoadingStock(false); return; }
      setLoadingStock(true);
      const { data, error: stockError } = await supabase
        .from("procedure_inventory_items")
        .select("id, quantity, product_id, products(id,name,unit,stock_quantity,active)")
        .eq("procedure_id", appointment.procedure_id);
      if (stockError) setError(stockError.message);
      setInventoryItems((data || []).filter(row => row.products));
      setLoadingStock(false);
    })();
  }, [appointment.procedure_id]);

  function updatePart(id, key, value) { setPaymentParts((current) => current.map((part) => part.id === id ? { ...part, [key]: value } : part)); }
  function addPart() { setPaymentParts((current) => [...current, { id: crypto.randomUUID(), method: "pix", amount: remaining.toFixed(2).replace('.', ',') }]); }
  function removePart(id) { setPaymentParts((current) => current.length <= 1 ? current : current.filter((part) => part.id !== id)); }

  async function submit(e) {
    e.preventDefault(); setError("");
    if (!isPackage && receivedAmount - normalizedAmount > 0.01) { setError("O valor recebido não pode ser maior que o valor do serviço."); return; }
    if (consumeStock && inventoryItems.some(item => Number(item.products?.stock_quantity || 0) < Number(item.quantity || 0))) {
      const item = inventoryItems.find(item => Number(item.products?.stock_quantity || 0) < Number(item.quantity || 0));
      setError(`Estoque insuficiente para ${item?.products?.name || "um dos produtos"}. Ajuste o estoque antes de concluir ou desative o consumo automático.`); return;
    }
    setSaving(true);
    try { await onConfirm({ appointment, amount, paymentParts, paymentStatus: receivedAmount + 0.01 >= normalizedAmount ? "pago" : "pendente", consumeStock }); }
    catch (err) { setError(err?.message || "Não foi possível concluir o atendimento."); }
    finally { setSaving(false); }
  }

  return <div className="modal-backdrop"><div className="modal-card appointment-payment-modal">
    <div className="modal-header"><div><span>FINALIZAÇÃO DO ATENDIMENTO</span><h2>Confirmar atendimento</h2><p className="client-profile-subtitle">{appointment.client_name || "Cliente"} · {appointment.procedure_name || "Atendimento"}</p></div><button type="button" onClick={onClose}><X size={20}/></button></div>
    {isPackage ? <div className="payment-package-note"><PackageCheck size={19}/><div><strong>Esta sessão pertence a um pacote</strong><span>A sessão será registrada no pacote e não haverá uma nova cobrança individual.</span></div></div> : <>
      <div className="payment-amount-card"><span>Valor do serviço</span><strong>{money(amount)}</strong></div>
      <label className="form-input"><span>Valor do serviço (R$)</span><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="100,00"/></label>
      <div className="payment-split-header"><div><strong>Formas de pagamento</strong><span>Você pode dividir o valor entre duas ou mais formas.</span></div><button type="button" className="secondary-button compact" onClick={addPart}><Plus size={14}/> Adicionar forma</button></div>
      <div className="payment-split-list">{paymentParts.map((part) => <div className="payment-split-row" key={part.id}><select className="form-input" value={part.method} onChange={e=>updatePart(part.id,"method",e.target.value)}><option value="pix">Pix</option><option value="cartao_credito">Cartão de crédito</option><option value="cartao_debito">Cartão de débito</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="outro">Outro</option></select><input className="form-input" inputMode="decimal" value={part.amount} onChange={e=>updatePart(part.id,"amount",e.target.value)} placeholder="Valor"/>{paymentParts.length>1&&<button type="button" className="icon-action danger" onClick={()=>removePart(part.id)} title="Remover"><Trash2 size={15}/></button>}</div>)}</div>
      <div className="payment-split-summary"><span>Recebido</span><strong>{money(receivedAmount)}</strong><span>Restante</span><strong className={remaining > 0.01 ? "payment-pending" : ""}>{money(remaining)}</strong><span>Situação</span><strong className={remaining > 0.01 ? "payment-pending" : "payment-paid"}>{remaining > 0.01 ? "Pendente" : "Pago"}</strong></div>
      {remaining > 0.01 && <div className="payment-pending-note"><Clock3 size={16}/><span>{money(remaining)} ficará registrado como <strong>pendente</strong> no Financeiro.</span></div>}
    </>}
    <div className="inventory-consumption-section">
      <div className="inventory-consumption-head"><div><span>ESTOQUE</span><strong>Produtos utilizados</strong><small>{loadingStock ? "Verificando composição..." : inventoryItems.length ? "A baixa será registrada ao concluir o atendimento." : "Nenhum produto vinculado a este procedimento."}</small></div>{inventoryItems.length>0&&<label className="service-toggle compact-toggle"><input type="checkbox" checked={consumeStock} onChange={e=>setConsumeStock(e.target.checked)}/><span>Registrar consumo</span></label>}</div>
      {inventoryItems.length>0&&<div className="inventory-consumption-list">{inventoryItems.map(item=><div className="inventory-consumption-row" key={item.id}><div><strong>{item.products.name}</strong><span>Estoque atual: {Number(item.products.stock_quantity||0).toLocaleString("pt-BR",{maximumFractionDigits:3})} {item.products.unit}</span></div><b>{Number(item.quantity).toLocaleString("pt-BR",{maximumFractionDigits:3})} {item.products.unit}</b></div>)}</div>}
    </div>
    {error && <div className="form-error">{error}</div>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Voltar</button><button className="primary-button" disabled={saving} onClick={submit}>{saving?<span className="button-spinner"/>:<><Check size={17}/> Confirmar conclusão</>}</button></div>
  </div></div>;
}

function AppointmentCard({ appointment, onEdit, onStatus, onWhatsApp, sending }) {
  const status = appointment.status || "Agendado";
  const whatsappAction = status === "Concluído" ? "Pós-atendimento" : status === "Aguardando" ? "Enviar lembrete" : status === "Cancelado" ? "Reagendar" : "Confirmação";
  return <article className="appointment-card">
    <div className="appointment-time"><strong>{formatTime(appointment.start_time)}</strong><span>{appointment.end_time ? `até ${formatTime(appointment.end_time)}` : ""}</span></div>
    <div className="appointment-main"><div className="appointment-client"><div className="large-avatar">{initials(appointment.client_name || "Cliente")}</div><div><h3>{appointment.client_name || "Cliente não informado"}</h3><p>{appointment.procedure_name || "Atendimento"}</p></div></div><span className={`status status-${slugify(status)}`}>{status}</span></div>
    <div className="appointment-actions">
      <button className="whatsapp-button" onClick={onWhatsApp} disabled={sending} title={`Enviar ${whatsappAction.toLowerCase()} pelo WhatsApp`}><MessageCircle size={15} />{sending ? "Abrindo..." : whatsappAction}</button>
      <select value={status} onChange={(e) => onStatus(e.target.value)} aria-label="Status do agendamento"><option>Agendado</option><option>Confirmado</option><option>Aguardando</option><option>Concluído</option><option>Cancelado</option><option>Faltou</option></select>
      <button className="icon-action" onClick={onEdit} title="Editar"><Edit3 size={15} /></button>
    </div>
    {appointment.notes && <div className="appointment-note"><span>Observação</span>{appointment.notes}</div>}
  </article>;
}

function AppointmentForm({ userId, clients, procedures, clientPackages, servicePackages, appointment, defaultDate, onClose, onSaved }) {
  const existingPackage = appointment?.client_package_id ? clientPackages.find((p) => p.id === appointment.client_package_id) : null;
  const [form, setForm] = useState({
    client_id: appointment?.client_id || "",
    appointment_date: appointment?.appointment_date || defaultDate,
    start_time: appointment?.start_time || "09:00",
    end_time: appointment?.end_time || "10:00",
    procedure_id: appointment?.procedure_id || "",
    client_package_id: appointment?.client_package_id || "",
    service_package_id: appointment?.service_package_id || existingPackage?.package_id || "",
    procedure_name: appointment?.procedure_name || "",
    service_type: (appointment?.client_package_id || appointment?.service_package_id) ? "package" : (appointment?.procedure_id ? "procedure" : "procedure"),
    status: appointment?.status || "Agendado",
    notes: appointment?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [showBatchSchedule, setShowBatchSchedule] = useState(false);
  const [batchRows, setBatchRows] = useState([]);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const availablePackages = clientPackages.filter((p) => p.client_id === form.client_id && p.status === "ativo" && Number(p.used_sessions || 0) < Number(p.total_sessions || 0));
  const linkedPackage = availablePackages.find((p) => p.package_id === form.service_package_id);
  const selectedCatalogPackage = servicePackages.find((p) => p.id === form.service_package_id);
  const selectedPackage = availablePackages.find((p) => p.id === form.client_package_id) || existingPackage || linkedPackage || (selectedCatalogPackage ? { id: null, package_id: selectedCatalogPackage.id, total_sessions: selectedCatalogPackage.total_sessions, used_sessions: 0, service_packages: selectedCatalogPackage } : null);
  const packageProcedures = selectedPackage?.service_packages?.service_package_items || selectedCatalogPackage?.service_package_items || [];
  const selectedProcedure = procedures.find((p) => p.id === form.procedure_id);

  useEffect(() => {
    if (form.service_type === "package" && form.client_package_id && packageProcedures.length) {
      const stillExists = packageProcedures.some((item) => item.procedure_id === form.procedure_id);
      if (!stillExists) setForm((current) => ({ ...current, procedure_id: packageProcedures[0].procedure_id || "", procedure_name: packageProcedures[0].procedure_name || "" }));
    }
  }, [form.service_type, form.client_package_id, packageProcedures.length]);

  function handleClientChange(clientId) {
    setForm((current) => ({ ...current, client_id: clientId, client_package_id: "", service_package_id: "", procedure_id: "", procedure_name: "" }));
  }

  function handleProcedureChange(procedureId) {
    const procedure = procedures.find((item) => item.id === procedureId);
    setForm((current) => ({
      ...current,
      procedure_id: procedureId,
      procedure_name: procedure?.name || "",
      end_time: procedure?.duration_minutes ? addMinutesToTime(current.start_time, procedure.duration_minutes) : current.end_time,
    }));
  }

  function handlePackageChange(packageId) {
    const catalog = servicePackages.find((item) => item.id === packageId);
    const linked = availablePackages.find((item) => item.package_id === packageId);
    const first = linked?.service_packages?.service_package_items?.find((item) => item.procedure_id)
      || linked?.service_packages?.service_package_items?.[0]
      || catalog?.service_package_items?.find((item) => item.procedure_id)
      || catalog?.service_package_items?.[0];
    const procedure = first?.procedure_id ? procedures.find((item) => item.id === first.procedure_id) : null;
    setForm((current) => ({
      ...current,
      service_package_id: packageId,
      client_package_id: linked?.id || "",
      procedure_id: first?.procedure_id || "",
      procedure_name: first?.procedure_name || procedure?.name || "",
      end_time: procedure?.duration_minutes ? addMinutesToTime(current.start_time, procedure.duration_minutes) : current.end_time,
    }));
  }

  function openBatchSchedule() {
    if (!form.client_package_id) return setError("Vincule o pacote à cliente antes de agendar todas as sessões.");
    const total = Math.max(0, Number(selectedPackage?.total_sessions || 0) - Number(selectedPackage?.used_sessions || 0));
    if (!total) return setError("Não há sessões disponíveis neste pacote.");
    const base = new Date(`${form.appointment_date || defaultDate}T12:00:00`);
    const rows = Array.from({ length: total }, (_, index) => {
      const d = new Date(base); d.setDate(d.getDate() + index * 30);
      return { date: toInputDate(d), time: form.start_time || "09:00" };
    });
    setBatchRows(rows); setShowBatchSchedule(true);
  }

  async function saveBatchSchedule() {
    setError("");
    if (!form.client_package_id || !form.service_package_id || !form.client_id) return setError("Selecione cliente e pacote da cliente.");
    if (!batchRows.length || batchRows.some((row) => !row.date || !row.time)) return setError("Informe a data e o horário de todas as sessões.");
    setSaving(true);
    const rows = batchRows.map((row) => ({
      user_id: userId,
      client_id: form.client_id,
      appointment_date: row.date,
      start_time: row.time,
      end_time: selectedProcedure?.duration_minutes ? addMinutesToTime(row.time, selectedProcedure.duration_minutes) : form.end_time || null,
      procedure_id: form.procedure_id || null,
      client_package_id: form.client_package_id,
      service_package_id: form.service_package_id,
      procedure_name: form.procedure_name.trim() || selectedProcedure?.name || null,
      status: "Agendado",
      notes: form.notes.trim() || null,
    }));
    const { data: insertedRows, error: insertError } = await supabase.from("appointments").insert(rows).select("id");
    if (insertError) { setSaving(false); return setError(insertError.message); }
    setSaving(false);
    setShowBatchSchedule(false); onSaved();
  }

  async function submit(e) {
    e.preventDefault(); setError("");
    if (!form.client_id) return setError("Selecione uma cliente.");
    if (!form.appointment_date || !form.start_time) return setError("Informe a data e o horário do atendimento.");
    if (form.service_type === "procedure" && !form.procedure_id && !form.procedure_name.trim()) return setError("Selecione um procedimento.");
    if (form.service_type === "package" && !form.service_package_id) return setError("Selecione um pacote.");
    setSaving(true);
    const payload = {
      client_id: form.client_id,
      appointment_date: form.appointment_date,
      start_time: form.start_time,
      end_time: form.end_time || null,
      procedure_id: form.procedure_id || null,
      client_package_id: form.service_type === "package" ? (form.client_package_id || null) : null,
      service_package_id: form.service_type === "package" ? (form.service_package_id || null) : null,
      procedure_name: form.procedure_name.trim() || selectedProcedure?.name || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const result = appointment
      ? await supabase.from("appointments").update(payload).eq("id", appointment.id).eq("user_id", userId)
      : await supabase.from("appointments").insert({ ...payload, user_id: userId }).select("id").single();
    if (result.error) { setSaving(false); setError(result.error.message); return; }
    setSaving(false); onSaved();
  }

  return <div className="modal-backdrop"><div className="modal-card appointment-modal"><div className="modal-header"><div><span>AGENDA PROFISSIONAL</span><h2>{appointment ? "Editar agendamento" : "Novo agendamento"}</h2></div><button onClick={onClose}><X size={20} /></button></div><form onSubmit={submit} className="client-form">
    <label className="form-input"><span>Cliente *</span><select value={form.client_id} onChange={(e) => handleClientChange(e.target.value)}><option value="">Selecione uma cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}{client.phone ? ` • ${client.phone}` : ""}</option>)}</select></label>
    <div className="appointment-service-type"><button type="button" className={form.service_type === "procedure" ? "active" : ""} onClick={() => set("service_type", "procedure")}><Sparkles size={15} /> Procedimento</button><button type="button" className={form.service_type === "package" ? "active" : ""} onClick={() => set("service_type", "package")}><Gift size={15} /> Pacote da cliente</button></div>
    {form.service_type === "procedure" ? <div className="form-grid"><label className="form-input full"><span>Procedimento</span><select value={form.procedure_id} onChange={(e) => handleProcedureChange(e.target.value)}><option value="">Selecione um procedimento</option>{procedures.filter((p) => p.active || p.id === form.procedure_id).map((p) => <option key={p.id} value={p.id}>{p.name}{p.price != null ? ` · ${moneyValue(p.price)}` : ""}{p.duration_minutes ? ` · ${p.duration_minutes} min` : ""}</option>)}</select></label></div> : <div className="package-selection-box"><label className="form-input"><span>Pacote disponível</span><select value={form.service_package_id} onChange={(e) => handlePackageChange(e.target.value)}><option value="">Selecione um pacote</option>{servicePackages.filter((pkg) => pkg.active || pkg.id === form.service_package_id).map((pkg) => { const linked = availablePackages.find((item) => item.package_id === pkg.id); const remaining = linked ? Math.max(0, Number(linked.total_sessions) - Number(linked.used_sessions || 0)) : null; return <option key={pkg.id} value={pkg.id}>{pkg.name}{remaining != null ? ` · ${remaining} sessões restantes` : " · pacote disponível"}</option>; })}</select></label>{selectedPackage && <><div className="package-balance"><div><strong>{selectedPackage.service_packages?.name}</strong><span>{selectedPackage.id ? `${Math.max(0, Number(selectedPackage.total_sessions) - Number(selectedPackage.used_sessions || 0))} de ${selectedPackage.total_sessions} sessões restantes` : "Pacote do catálogo · ainda não vinculado à cliente"}</span></div>{selectedPackage.id && !appointment && <button type="button" className="secondary-button compact" onClick={openBatchSchedule}><CalendarDays size={13}/> Agendar todas</button>}</div><label className="form-input"><span>Procedimento desta sessão</span><select value={form.procedure_id} onChange={(e) => { const item = packageProcedures.find((x) => x.procedure_id === e.target.value); const proc = procedures.find((x) => x.id === e.target.value); setForm((current) => ({ ...current, procedure_id: e.target.value, procedure_name: item?.procedure_name || proc?.name || "", end_time: proc?.duration_minutes ? addMinutesToTime(current.start_time, proc.duration_minutes) : current.end_time })); }}>{packageProcedures.map((item) => <option key={item.id} value={item.procedure_id || ""}>{item.procedure_name} · {item.quantity}x no pacote</option>)}</select></label></>}</div>}
    <div className="form-grid"><FormInput label="Data *" value={form.appointment_date} onChange={(v) => set("appointment_date", v)} type="date" /><FormInput label="Horário inicial *" value={form.start_time} onChange={(v) => { set("start_time", v); if (selectedProcedure?.duration_minutes) set("end_time", addMinutesToTime(v, selectedProcedure.duration_minutes)); }} type="time" /><FormInput label="Horário final" value={form.end_time} onChange={(v) => set("end_time", v)} type="time" /></div>
    {form.service_type === "procedure" && !form.procedure_id && <FormInput label="Procedimento personalizado" value={form.procedure_name} onChange={(v) => set("procedure_name", v)} placeholder="Ex.: Avaliação facial" />}
    <label className="form-input"><span>Status</span><select value={form.status} onChange={(e) => set("status", e.target.value)}><option>Agendado</option><option>Confirmado</option><option>Aguardando</option><option>Concluído</option><option>Cancelado</option><option>Faltou</option></select></label>
    {form.service_type === "package" && form.service_package_id && <div className="package-info-note"><PackageCheck size={17} /><span>{form.client_package_id ? <>A sessão será descontada do pacote da cliente quando o atendimento for marcado como <strong>Concluído</strong>.</> : <>Este pacote ainda não está vinculado à cliente. O agendamento será registrado sem descontar uma sessão.</>}</span></div>}
    <label className="textarea-field"><span>Observações</span><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ex.: cliente pediu atenção especial em determinada área..." rows="4" /></label>
    <div className="whatsapp-info"><MessageCircle size={18} /><div><strong>Confirmação por WhatsApp</strong><p>Depois de salvar, você poderá enviar a confirmação diretamente para o número cadastrado na ficha da cliente.</p></div></div>
    {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? <span className="button-spinner" /> : <><Check size={17} /> {appointment ? "Salvar alterações" : "Criar agendamento"}</>}</button></div>
  </form>{showBatchSchedule && <BatchScheduleModal rows={batchRows} setRows={setBatchRows} onClose={()=>setShowBatchSchedule(false)} onConfirm={saveBatchSchedule} saving={saving} packageName={selectedPackage?.service_packages?.name || "Pacote"} />}</div></div>;
}

function BatchScheduleModal({ rows, setRows, onClose, onConfirm, saving, packageName }) {
  function update(index, field, value) { setRows(current => current.map((row, i) => i === index ? { ...row, [field]: value } : row)); }
  return <div className="modal-backdrop batch-modal-layer"><div className="modal-card batch-schedule-modal">
    <div className="modal-header"><div><span>AGENDA DO PACOTE</span><h2>Agendar todas as sessões</h2><p className="client-profile-subtitle">{packageName} · {rows.length} {rows.length === 1 ? "sessão" : "sessões"}</p></div><button type="button" onClick={onClose}><X size={20}/></button></div>
    <div className="batch-schedule-list">{rows.map((row,index)=><div className="batch-schedule-row" key={index}><div className="batch-session-number">{index+1}</div><label className="form-input"><span>Data</span><input type="date" value={row.date} onChange={e=>update(index,"date",e.target.value)}/></label><label className="form-input"><span>Horário</span><input type="time" value={row.time} onChange={e=>update(index,"time",e.target.value)}/></label></div>)}</div>
    <div className="package-info-note"><CalendarDays size={17}/><span>As sessões serão criadas como <strong>Agendadas</strong>. Cada uma será descontada somente quando o atendimento for concluído.</span></div>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="button" className="primary-button" disabled={saving} onClick={onConfirm}>{saving?<span className="button-spinner"/>:<><Check size={17}/> Confirmar sessões</>}</button></div>
  </div></div>;
}

function addMinutesToTime(time, minutes) {
  if (!time || !minutes) return time;
  const [hours, mins] = String(time).slice(0, 5).split(":").map(Number);
  const total = (hours * 60 + mins + Number(minutes)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function ClientDetails({ client, userId, onClose, onEdit, onDelete, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ appointments: [], evolutions: [], transactions: [], packages: [] });
  const [error, setError] = useState("");
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [showAnamnesis, setShowAnamnesis] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadHistory() {
      setLoading(true);
      setError("");
      const [appointmentsResult, evolutionsResult, transactionsResult, packagesResult] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, appointment_date, start_time, end_time, procedure_id, client_package_id, procedure_name, status, notes")
          .eq("user_id", userId)
          .eq("client_id", client.id)
          .order("appointment_date", { ascending: false })
          .order("start_time", { ascending: false }),
        supabase
          .from("client_evolutions")
          .select("id, evolution_date, procedure_name, notes, products_used, recommendations, created_at")
          .eq("user_id", userId)
          .eq("client_id", client.id)
          .order("evolution_date", { ascending: false }),
        supabase
          .from("financial_transactions")
          .select("id, type, description, amount, transaction_date, status, payment_method, category")
          .eq("user_id", userId)
          .eq("client_id", client.id)
          .order("transaction_date", { ascending: false }),
        supabase
          .from("client_packages")
          .select("id, purchased_at, expires_at, total_sessions, used_sessions, amount, status, notes, service_packages(name, price)")
          .eq("user_id", userId)
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
      ]);

      if (!mounted) return;
      const firstError = appointmentsResult.error || evolutionsResult.error || transactionsResult.error || packagesResult.error;
      if (firstError) setError(firstError.message);
      setData({
        appointments: appointmentsResult.data || [],
        evolutions: evolutionsResult.data || [],
        transactions: transactionsResult.data || [],
        packages: packagesResult.data || [],
      });
      setLoading(false);
    }
    loadHistory();
    return () => { mounted = false; };
  }, [client.id, userId]);

  const nowKey = toInputDate(new Date());
  const upcoming = data.appointments.filter((item) => item.appointment_date >= nowKey && item.status !== "Cancelado" && item.status !== "Faltou").sort((a, b) => `${a.appointment_date} ${a.start_time || ""}`.localeCompare(`${b.appointment_date} ${b.start_time || ""}`));
  const completedAppointments = data.appointments.filter((item) => item.status === "Concluído").length;
  const paidRevenue = data.transactions.filter((item) => item.type === "receita" && item.status === "pago").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingRevenue = data.transactions.filter((item) => item.type === "receita" && item.status !== "pago").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = data.transactions.filter((item) => item.type === "despesa" && item.status === "pago").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const lastAppointment = data.appointments[0];
  const lastEvolution = data.evolutions[0];

  return <div className="modal-backdrop"><div className="modal-card details-modal client-profile-modal">
    <div className="modal-header"><div><span>FICHA PROFISSIONAL DA CLIENTE</span><h2>{client.full_name}</h2><p className="client-profile-subtitle">Histórico, atendimentos, evolução e financeiro em um só lugar.</p></div><button onClick={onClose}><X size={20} /></button></div>

    <div className="client-profile-hero">
      <div className="large-avatar">{initials(client.full_name)}</div>
      <div className="client-profile-identity"><strong>{client.full_name}</strong><span>{client.phone || "Telefone não informado"}</span><small>{client.email || "E-mail não informado"}</small></div>
      <div className="client-profile-actions">
        {client.phone && <a className="client-contact-button" href={`https://wa.me/${normalizeWhatsAppPhone(client.phone)}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>}
        {client.instagram && <span className="client-contact-chip">{client.instagram}</span>}
      </div>
    </div>

    <div className="client-quick-actions">
      <button onClick={() => onNavigate?.("agenda")}><CalendarDays size={16} /><span>Novo agendamento</span></button>
      <button onClick={() => setShowPackageForm(true)}><Gift size={16} /><span>Adicionar pacote</span></button>
      <button onClick={() => onNavigate?.("evolucao")}><HeartPulse size={16} /><span>Nova evolução</span></button>
      <button onClick={() => setShowAnamnesis(true)}><FileText size={16} /><span>Anamnese</span></button>
      <button onClick={onEdit}><Edit3 size={16} /><span>Editar ficha</span></button>
    </div>

    <div className="client-profile-metrics">
      <div><span>Atendimentos</span><strong>{completedAppointments}</strong></div>
      <div><span>Receitas pagas</span><strong>{moneyBR(paidRevenue)}</strong></div>
      <div><span>Em aberto</span><strong>{moneyBR(pendingRevenue)}</strong></div>
      <div><span>Despesas vinculadas</span><strong>{moneyBR(expenses)}</strong></div>
    </div>

    {error && <div className="form-error">Não foi possível carregar todo o histórico: {error}</div>}

    {loading ? <div className="loading-panel client-profile-loading"><span className="button-spinner dark" />Carregando ficha da cliente...</div> : <div className="client-profile-sections">
      <section className="client-profile-section"><div className="client-section-title"><div><CalendarDays size={17} /><h3>Próximo retorno</h3></div></div>{upcoming.length ? <div className="client-upcoming-card"><div><strong>{formatDate(upcoming[0].appointment_date)}</strong><span>{formatTime(upcoming[0].start_time)} · {upcoming[0].procedure_name || "Atendimento"}</span></div><em>{upcoming[0].status}</em></div> : <div className="client-empty-inline">Nenhum próximo agendamento registrado.</div>}</section>

      <section className="client-profile-section"><div className="client-section-title"><div><CalendarDays size={17} /><h3>Histórico de atendimentos</h3></div><span>{data.appointments.length} registros</span></div>{data.appointments.length ? <div className="client-history-list">{data.appointments.slice(0, 5).map((item) => <div className="client-history-row" key={item.id}><div><strong>{item.procedure_name || "Atendimento"}</strong><span>{formatDate(item.appointment_date)} · {formatTime(item.start_time)}{item.client_package_id ? " · Pacote" : " · Avulso"}</span></div><em className={`history-status ${String(item.status || "").toLowerCase().replace(/\s+/g, "-")}`}>{item.status}</em></div>)}</div> : <div className="client-empty-inline">Ainda não há atendimentos vinculados a esta cliente.</div>}</section>

      <section className="client-profile-section"><div className="client-section-title"><div><Gift size={17} /><h3>Pacotes da cliente</h3></div><button className="client-section-action" onClick={() => setShowPackageForm(true)}><Plus size={13} /> Adicionar</button></div>{data.packages.length ? <div className="client-package-list">{data.packages.map((item) => { const remaining = Math.max(0, Number(item.total_sessions || 0) - Number(item.used_sessions || 0)); return <div className="client-package-card" key={item.id}><div><strong>{item.service_packages?.name || "Pacote"}</strong><span>{item.total_sessions} sessões · {remaining} restantes{item.expires_at ? ` · validade ${formatDate(item.expires_at)}` : ""}</span></div><div><b>{moneyBR(item.amount)}</b><em className={`package-status ${item.status}`}>{item.status === "concluido" ? "Concluído" : item.status === "expirado" ? "Expirado" : item.status === "cancelado" ? "Cancelado" : "Ativo"}</em></div></div>; })}</div> : <div className="client-empty-inline">Nenhum pacote vinculado a esta cliente.</div>}</section>

      <section className="client-profile-section"><div className="client-section-title"><div><FileText size={17} /><h3>Anamnese</h3></div><button className="client-section-action" onClick={() => setShowAnamnesis(true)}><FileText size={13} /> Abrir ficha</button></div><div className="client-anamnesis-inline"><ShieldCheck size={17} /><div><strong>Ficha de anamnese digital</strong><span>Registre informações importantes do atendimento e mantenha o histórico por versões.</span></div></div></section>

      <section className="client-profile-section"><div className="client-section-title"><div><HeartPulse size={17} /><h3>Evolução</h3></div><span>{data.evolutions.length} registros</span></div>{data.evolutions.length ? <div className="client-history-list">{data.evolutions.slice(0, 4).map((item) => <div className="client-history-row" key={item.id}><div><strong>{item.procedure_name || "Evolução clínica"}</strong><span>{formatDate(item.evolution_date)}{item.notes ? ` · ${item.notes}` : ""}</span></div><ChevronRight size={15} /></div>)}</div> : <div className="client-empty-inline">Nenhuma evolução registrada para esta cliente.</div>}</section>

      <section className="client-profile-section"><div className="client-section-title"><div><CircleDollarSign size={17} /><h3>Financeiro</h3></div><span>{data.transactions.length} lançamentos</span></div>{data.transactions.length ? <div className="client-history-list">{data.transactions.slice(0, 5).map((item) => <div className="client-history-row" key={item.id}><div><strong>{item.description || item.category || "Lançamento"}</strong><span>{formatDate(item.transaction_date)} · {item.payment_method || "Forma de pagamento não informada"}</span></div><b className={item.type === "receita" ? "client-income" : "client-expense"}>{item.type === "receita" ? "+" : "−"} {moneyBR(item.amount)}</b></div>)}</div> : <div className="client-empty-inline">Nenhum lançamento financeiro vinculado a esta cliente.</div>}</section>

      <section className="client-profile-section client-contact-section"><div className="client-section-title"><div><UserRound size={17} /><h3>Dados da cliente</h3></div></div><div className="details-grid client-data-grid"><DetailItem label="Data de nascimento" value={formatDate(client.birth_date)} /><DetailItem label="CPF" value={client.cpf} /><DetailItem label="Instagram" value={client.instagram} /><DetailItem label="Endereço" value={client.address} /></div><div className="details-note"><span>Observações</span><p>{client.notes || "Nenhuma observação registrada."}</p></div><small className="client-profile-meta">Cliente desde {formatDate(client.created_at)}{lastAppointment ? ` · Último agendamento: ${formatDate(lastAppointment.appointment_date)}` : ""}{lastEvolution ? ` · Última evolução: ${formatDate(lastEvolution.evolution_date)}` : ""}</small></section>
    </div>}

    <div className="modal-actions"><button className="secondary-button danger-outline" onClick={onDelete}><Trash2 size={16} /> Excluir cliente</button><button className="primary-button" onClick={onEdit}><Edit3 size={16} /> Editar ficha</button></div>
    {showPackageForm && <ClientPackageForm userId={userId} client={client} onClose={() => setShowPackageForm(false)} onSaved={async () => { const { data: packages } = await supabase.from("client_packages").select("id, purchased_at, expires_at, total_sessions, used_sessions, amount, status, notes, service_packages(name, price)").eq("user_id", userId).eq("client_id", client.id).order("created_at", { ascending: false }); setData((current) => ({ ...current, packages: packages || [] })); setShowPackageForm(false); }} />}
    {showAnamnesis && <ClientAnamnesis userId={userId} client={client} onClose={() => setShowAnamnesis(false)} />}
  </div></div>;
}

const ANAMNESIS_DEFAULTS = {
  where_found: "", referral_name: "", about_you_work: "", skin_complaint: "", skincare_routine: "", previous_treatment: "", sun_exposure: "", sunscreen: "", contact_lenses: "Não informado", smoker: "Não informado", cigarettes_per_day: "", alcohol: "Não informado", alcohol_frequency: "", bowel_regular: "Não informado", sleep_quality: "Não informado", sleep_hours: "", water_intake: "", nutrition: "Não informado", food_intolerance: "", physical_activity: "Não informado", physical_activity_type: "", physical_activity_frequency: "", contraceptive: "Não informado", contraceptive_name_duration: "", menstruation_first_day: "", pregnant: "Não informado", pregnancies: "Não informado", pregnancies_count: "", pregnancy_duration: "", clinical_exams: "", medical_treatment: "Não informado", medical_treatment_name: "", medications: "Não informado", medications_name: "", healing_problems: "Não informado", healing_details: "", psychological: "Não informado", psychological_details: "", epilepsy: "Não informado", stress: "Não informado", oncology_history: "Não informado", oncology_details: "", health_problems: "", skin_type: "Não informado", skin_hydration: "Não informado", pores: "Não informado", acne_grade: "Não informado", acne_region: "", photoaging_glogau: "Não informado", wrinkles: "", flaccidity: "Não informado", vascular_changes: "", dark_circles_type: "Não informado", eyelid_edema: "Não informado", ecchymosis: "Não informado", ruby_hemangioma_nevus: "Não informado", erythema: "Não informado", pigmentation_changes: "", scars: "", skin_lesions: "", hair_changes: "", phototype: "Não informado", rosacea_subtype: "Não informado", poikiloderma: "Não informado", contraindications_care: "", recommended_procedure: "", products_recommendations: "", home_care: "", professional_notes: "", consent: false, signed_name: "",
};

const ANAMNESIS_SECTIONS = [
  {
    title: "Informações iniciais",
    fields: [
      ["where_found", "Onde conheceu o meu trabalho?", "select", ["Não informado", "Redes sociais", "Google", "Indicação"]],
      ["referral_name", "Se foi indicação, de quem?", "text", null, "Informe o nome de quem indicou, se aplicável."],
      ["about_you_work", "Conte um pouco sobre você, seu trabalho:", "textarea"],
      ["skin_complaint", "O que mais incomoda na sua pele?", "textarea"],
    ],
  },
  {
    title: "Hábitos diários",
    fields: [
      ["skincare_routine", "Como cuida da pele atualmente? Rotina de skin care:", "textarea"],
      ["previous_treatment", "Fez tratamento estético anterior? Qual?", "textarea"],
      ["sun_exposure", "Costuma tomar sol? Quantas horas por dia?", "text"],
      ["sunscreen", "Utiliza protetor solar? Qual marca?", "text"],
      ["contact_lenses", "Usa lentes de contato?", "select", ["Não informado", "Sim", "Não"]],
      ["smoker", "É fumante?", "select", ["Não informado", "Sim", "Não"]],
      ["cigarettes_per_day", "Quantidade de cigarros/dia:", "text"],
      ["alcohol", "Ingere bebidas alcoólicas?", "select", ["Não informado", "Sim", "Não"]],
      ["alcohol_frequency", "Com qual frequência?", "text"],
      ["bowel_regular", "Funcionamento intestinal regular?", "select", ["Não informado", "Sim", "Não"]],
      ["sleep_quality", "Qualidade do sono?", "select", ["Não informado", "Boa", "Ruim"]],
      ["sleep_hours", "Quantas horas de sono/noite?", "text"],
      ["water_intake", "Ingestão de água copo/dia?", "text"],
      ["nutrition", "Alimentação", "select", ["Não informado", "Boa", "Regular", "Péssima"]],
      ["food_intolerance", "Tem intolerância ao glúten, à lactose ou algum alimento específico?", "textarea"],
      ["physical_activity", "Pratica atividade física?", "select", ["Não informado", "Sim", "Não"]],
      ["physical_activity_type", "Qual tipo:", "text"],
      ["physical_activity_frequency", "Qual frequência:", "text"],
    ],
  },
  {
    title: "Histórico clínico",
    fields: [
      ["contraceptive", "Uso de anticoncepcional:", "select", ["Não informado", "Sim", "Não"]],
      ["contraceptive_name_duration", "Qual / Há quanto tempo:", "text"],
      ["menstruation_first_day", "Data do primeiro dia da menstruação:", "text"],
      ["pregnant", "Gestante?", "select", ["Não informado", "Sim", "Não"]],
      ["pregnancies", "Gestações:", "select", ["Não informado", "Sim", "Não"]],
      ["pregnancies_count", "Quantas?", "text"],
      ["pregnancy_duration", "Quanto tempo?", "text"],
      ["clinical_exams", "Como estão os exames clínicos? Vitamina D? Hormônios? Tireóide? Ovário Poliscístico?", "textarea"],
      ["medical_treatment", "Tratamento médico atual?", "select", ["Não informado", "Sim", "Não"]],
      ["medical_treatment_name", "Qual:", "text"],
      ["medications", "Uso de medicamentos?", "select", ["Não informado", "Sim", "Não"]],
      ["medications_name", "Qual:", "text"],
      ["healing_problems", "Problemas de cicatrização?", "select", ["Não informado", "Sim", "Não"]],
      ["healing_details", "Qual:", "text"],
      ["psychological", "Alterações psicológicas/psiquiátricas", "select", ["Não informado", "Sim", "Não"]],
      ["psychological_details", "Quais:", "text"],
      ["epilepsy", "Epilepsia / convulsões?", "select", ["Não informado", "Sim", "Não"]],
      ["stress", "Estresse?", "select", ["Não informado", "Sim", "Não"]],
      ["oncology_history", "Antecedentes oncológicos?", "select", ["Não informado", "Sim", "Não"]],
      ["oncology_details", "Qual:", "text"],
      ["health_problems", "Problemas de saúde, pressão alta, pressão baixa, diabetes, problemas cardíacos, distúrbio hormonal?", "textarea"],
    ],
  },
  {
    title: "Avaliação facial",
    fields: [
      ["skin_type", "Biotipo Cutâneo", "select", ["Não informado", "Normal", "Mista", "Oleosa", "Seca"]],
      ["skin_hydration", "Grau de Hidratação", "select", ["Não informado", "Hidratada", "Desidratada"]],
      ["pores", "Poros", "select", ["Não informado", "Esgarçado na zona T", "Esgarçado em toda face", "Normal"]],
      ["acne_grade", "Acne", "select", ["Não informado", "Grau I", "Grau II", "Grau III", "Grau IV", "Grau V"]],
      ["acne_region", "Região acometida:", "text"],
      ["photoaging_glogau", "Fotoenvelhecimento (Goglau)", "select", ["Não informado", "Grau I", "Grau II", "Grau III", "Grau IV"]],
      ["wrinkles", "Rugas", "textarea"],
      ["flaccidity", "Flacidez", "select", ["Não informado", "Grau I", "Grau II", "Grau III"]],
      ["vascular_changes", "Alterações vasculares", "textarea"],
      ["dark_circles_type", "Tipo de olheiras", "select", ["Não informado", "Melânica", "Estrutural", "Vascular", "Mista"]],
      ["eyelid_edema", "Edema Palpebral", "select", ["Não informado", "Sim", "Não"]],
      ["ecchymosis", "Esquimose", "select", ["Não informado", "Sim", "Não"]],
      ["ruby_hemangioma_nevus", "Hemangioma Rubi/Nevo", "select", ["Não informado", "Sim", "Não"]],
      ["erythema", "Eritema", "select", ["Não informado", "Sim", "Não"]],
      ["pigmentation_changes", "Alterações pigmentares", "textarea"],
      ["scars", "Cicatrizes", "textarea"],
      ["skin_lesions", "Lesões na pele", "textarea"],
      ["hair_changes", "Pelos", "textarea"],
      ["phototype", "Fototipo cutâneo", "select", ["Não informado", "I", "II", "III", "IV", "V", "VI"]],
      ["rosacea_subtype", "Rosacea", "select", ["Não informado", "Subtipo 1", "Subtipo 2", "Subtipo 3", "Subtipo 4"]],
      ["poikiloderma", "Poiquilodermina", "select", ["Não informado", "Sim", "Não"]],
    ],
    notes: [
      "Fotoenvelhecimento (Goglau): Grau I — Discretas alterações na pigmentação sem ceratose, rugas mínimas, idade cronológica de 20 a 30 anos. Grau II — Moderado, lentigosos sem precoces visíveis, ceratoses palpáveis, não visíveis, rugas ao movimento, idade cronológica 30 a 40 anos. Grau III — Avançada, discromia, ceratoses visíveis, rugas presentes em repouso, aspecto cansado, idade cronológica 50 ou mais. Grau IV — Grave, predominância de rugas por toda a face, maquiagem não pode ser utilizada pois endurece e quebra, idade cronológica 60 a 70 anos.",
      "Tipo de olheiras: MELANICA — têm tom marrom ou acastanhado; ESTRUTURAL — criam uma sombra funda abaixo do olho; VASCULAR — têm tom azulado ou arroxeado; ou MISTA.",
      "Fototipo I: pele extremamente clara, geralmente com sardas; queima com facilidade e nunca bronzeia. Fototipo II: pele clara; queima com facilidade e bronzeia muito pouco. Fototipo III: pele morena clara; queima moderadamente e bronzeia moderadamente. Fototipo IV: pele morena; queima pouco e bronzeia com facilidade. Fototipo V: pele morena escura; queima raramente e bronzeia bastante. Fototipo VI: pele negra; nunca queima e é totalmente.",
      "Rosacea — Subtipo 1: eritemato-telangiectásica, vermelhidão persistente no centro do rosto e pequenos vasos sanguíneos visíveis, com episódios de rubor intenso. Subtipo 2: pápulo-pustulosa, presença de pápulas e pústulas semelhantes à acne, mas sem cravos. Subtipo 3: fimatosa, espessamento da pele e aumento das glândulas sebáceas, frequentemente no nariz. Subtipo 4: ocular, acomete os olhos, podendo causar ressecamento, ardência, sensação de corpo estranho, vermelhidão nas pálpebras e sensibilidade à luz.",
      "Poiquilodermina: condição de pele crônica e benigna que causa manchas vermelhas ou amarronzadas, pequenos vasos sanguíneos aparentes e afinamento da pele. Aparece principalmente nas laterais do pescoço e no colo, poupando a área embaixo do queixo. O documento relaciona a condição à exposição solar acumulada, envelhecimento natural e fatores genéticos ou hormonais.",
    ],
  },
  {
    title: "Cuidados e conduta profissional",
    fields: [
      ["contraindications_care", "Contraindicações e cuidados", "textarea"],
      ["recommended_procedure", "Procedimento ou conduta indicada", "textarea"],
      ["products_recommendations", "Produtos e recomendações", "textarea"],
      ["home_care", "Cuidados domiciliares", "textarea"],
      ["professional_notes", "Observações profissionais", "textarea"],
    ],
  },
];

function anamnesisDisplayValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  return String(value ?? "").trim() || "Não informado";
}

function ClientAnamnesis({ userId, client, onClose }) {
  const [form, setForm] = useState({ ...ANAMNESIS_DEFAULTS }); const [history, setHistory] = useState([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [downloading, setDownloading] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [version, setVersion] = useState(0);
  async function load() { setLoading(true); setError(""); const { data, error: loadError } = await supabase.from("client_anamneses").select("*").eq("user_id", userId).eq("client_id", client.id).order("version", { ascending: false }); if (loadError) setError(loadError.message); const rows = data || []; setHistory(rows); if (rows[0]) { setForm({ ...ANAMNESIS_DEFAULTS, ...(rows[0].answers || {}), consent: Boolean(rows[0].consent), signed_name: rows[0].signed_name || "" }); setVersion(Number(rows[0].version || 1)); } else { setForm({ ...ANAMNESIS_DEFAULTS }); setVersion(0); } setLoading(false); }
  useEffect(() => { load(); }, [client.id, userId]);
  function setField(key, value) { setForm((current) => ({ ...current, [key]: value })); setNotice(""); }
  async function save() { if (!form.skin_complaint.trim() && !form.about_you_work.trim()) { setError("Preencha pelo menos o que mais incomoda na pele ou conte um pouco sobre você."); return; } if (!form.consent) { setError("É necessário registrar a ciência da cliente antes de salvar a anamnese."); return; } setSaving(true); setError(""); const nextVersion = (history[0]?.version || 0) + 1; const payload = { user_id: userId, client_id: client.id, version: nextVersion, answers: Object.fromEntries(Object.entries(form).filter(([key]) => !["consent", "signed_name"].includes(key))), consent: true, consent_text: "Declaro que as informações fornecidas nesta ficha são verdadeiras conforme meu conhecimento e que fui orientada sobre os cuidados relacionados ao atendimento.", signed_name: form.signed_name.trim() || client.full_name, signed_at: new Date().toISOString() }; const { error: saveError } = await supabase.from("client_anamneses").insert(payload); if (saveError) setError(saveError.message); else { setNotice(`Anamnese salva como versão ${nextVersion}.`); await load(); } setSaving(false); }
  async function downloadPdf() { setDownloading(true); setError(""); try { const { jsPDF } = await import("jspdf"); const doc = new jsPDF({ unit: "mm", format: "a4" }); const margin = 17; const width = 210 - margin * 2; let y = 18; const pageHeight = 297; const answers = form; const addPage = () => { doc.addPage(); y = 18; }; const ensure = (needed = 10) => { if (y + needed > pageHeight - 17) addPage(); }; const text = (value) => anamnesisDisplayValue(value); const line = (value, size = 9, bold = false) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(45, 57, 50); const lines = doc.splitTextToSize(text(value), width); ensure(lines.length * 4.5 + 5); doc.text(lines, margin, y); y += lines.length * 4.5 + 2; }; const labelLine = (label, value) => { ensure(10); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(91, 105, 97); const labelLines = doc.splitTextToSize(label, width); doc.text(labelLines, margin, y); y += labelLines.length * 3.8 + 1; line(value, 8.5); }; const section = (title) => { ensure(13); doc.setFillColor(235, 242, 237); doc.roundedRect(margin, y - 5, width, 9, 2, 2, "F"); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(43, 83, 57); doc.text(title, margin + 3, y + 1); y += 9; }; doc.setFont("helvetica", "bold"); doc.setFontSize(19); doc.setTextColor(36, 67, 47); doc.text("ESTETICPRO", margin, y); y += 7; doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(45, 57, 50); doc.text("FICHA DE ANAMNESE ESTÉTICA", margin, y); y += 6; doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(105, 119, 110); doc.text(`Cliente: ${client.full_name}   |   Data: ${formatDate(toInputDate(new Date()))}`, margin, y); y += 8; section("Identificação"); labelLine("Nome completo:", client.full_name); labelLine("Data de nascimento:", client.birth_date ? formatDate(client.birth_date) : "Não informado"); labelLine("Telefone:", client.phone || "Não informado"); labelLine("E-mail:", client.email || "Não informado"); labelLine("CPF:", client.cpf || "Não informado"); ANAMNESIS_SECTIONS.forEach((group) => { section(group.title); group.fields.forEach(([key, label]) => labelLine(label, answers[key])); if (group.notes) group.notes.forEach((note) => { ensure(8); doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(105, 119, 110); const lines = doc.splitTextToSize(note, width); doc.text(lines, margin, y); y += lines.length * 3.5 + 3; }); }); section("Declaração e ciência"); line("Declaro que as informações fornecidas nesta ficha são verdadeiras conforme meu conhecimento e que fui orientada sobre os cuidados relacionados ao atendimento.", 8.5); line(`Ciência registrada: ${answers.consent ? "Sim" : "Não"}`); line(`Nome informado para assinatura: ${answers.signed_name || client.full_name}`); y += 8; ensure(24); doc.setDrawColor(120, 130, 123); doc.line(margin, y, margin + 75, y); doc.line(margin + 100, y, margin + 175, y); y += 4; doc.setFontSize(7); doc.setTextColor(105, 119, 110); doc.text("Assinatura da cliente", margin, y); doc.text("Assinatura da profissional", margin + 100, y); y += 7; doc.text(`Documento gerado pelo EsteticPro · Versão ${version || "não salva"}`, margin, y); const pages = doc.internal.getNumberOfPages(); for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(130, 140, 134); doc.text(`Página ${i} de ${pages}`, 210 - margin, 289, { align: "right" }); } doc.save(`Anamnese-${slugify(client.full_name)}-${toInputDate(new Date())}.pdf`); setNotice("PDF gerado com sucesso."); } catch (pdfError) { setError(`Não foi possível gerar o PDF: ${pdfError.message}`); } setDownloading(false); }
  return <div className="modal-backdrop anamnesis-layer"><div className="modal-card anamnesis-modal"><div className="modal-header"><div><span>DOCUMENTO PROFISSIONAL</span><h2>Ficha de Anamnese</h2><p className="client-profile-subtitle">{client.full_name} · histórico digital por versões e PDF para impressão.</p></div><button onClick={onClose}><X size={20} /></button></div>{notice && <div className="module-notice success"><span>{notice}</span><button onClick={() => setNotice("")}><X size={16} /></button></div>}{error && <div className="form-error anamnesis-error">{error}</div>}{loading ? <div className="loading-panel"><span className="button-spinner dark" />Carregando anamnese...</div> : <><div className="anamnesis-document-head"><div><FileText size={20}/><div><strong>{client.full_name}</strong><span>Versão atual: {version || "Ainda não salva"}</span></div></div><div className="anamnesis-head-actions"><button className="secondary-button" onClick={downloadPdf} disabled={downloading}><Download size={15}/> {downloading ? "Gerando..." : "Baixar PDF"}</button><button className="primary-button" onClick={save} disabled={saving}><Save size={15}/> {saving ? "Salvando..." : "Salvar anamnese"}</button></div></div><div className="anamnesis-form-scroll">{ANAMNESIS_SECTIONS.map((group) => <section className="anamnesis-section" key={group.title}><div className="anamnesis-section-title"><ClipboardList size={16}/><div><h3>{group.title}</h3><span>Preencha somente o que for pertinente ao atendimento.</span></div></div><div className="anamnesis-fields">{group.fields.map(([key, label, type, options, help]) => type === "select" ? <label className="anamnesis-field" key={key}><span>{label}</span><select value={form[key]} onChange={(e) => setField(key, e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select>{help && <small className="anamnesis-help">{help}</small>}</label> : type === "textarea" ? <label className="anamnesis-field" key={key}><span>{label}</span><textarea rows="3" value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder="Registre as informações relevantes..." />{help && <small className="anamnesis-help">{help}</small>}</label> : <label className="anamnesis-field" key={key}><span>{label}</span><input value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder={help || "Registre a informação relevante..."} />{help && <small className="anamnesis-help">{help}</small>}</label>)}</div>{group.notes && <div className="anamnesis-reference-notes">{group.notes.map((note, index) => <p key={index}>{note}</p>)}</div>}</section>)}<section className="anamnesis-section"><div className="anamnesis-section-title"><ShieldCheck size={16}/><div><h3>Declaração e ciência</h3><span>Registro da ciência da cliente sobre as informações fornecidas.</span></div></div><label className="anamnesis-consent"><input type="checkbox" checked={Boolean(form.consent)} onChange={(e) => setField("consent", e.target.checked)}/><span>Declaro que as informações fornecidas nesta ficha são verdadeiras conforme meu conhecimento e que fui orientada sobre os cuidados relacionados ao atendimento.</span></label><label className="form-input anamnesis-sign-field"><span>Nome para assinatura digital</span><input value={form.signed_name} onChange={(e) => setField("signed_name", e.target.value)} placeholder={client.full_name}/></label><div className="anamnesis-signature-preview"><span>Assinatura da cliente</span><div>{form.signed_name || client.full_name}</div></div></section></div>{history.length > 0 && <section className="anamnesis-history"><div><strong>Histórico de versões</strong><span>Cada salvamento preserva a versão anterior.</span></div><div>{history.slice(0, 6).map((item) => <button key={item.id} onClick={() => { setForm({ ...ANAMNESIS_DEFAULTS, ...(item.answers || {}), consent: Boolean(item.consent), signed_name: item.signed_name || "" }); setVersion(Number(item.version || 1)); setNotice(`Versão ${item.version} carregada para visualização.`); }}><span>V{item.version}</span><small>{formatDate(item.created_at)}</small></button>)}</div></section>}</>}{!loading && <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Fechar</button><button className="secondary-button" onClick={downloadPdf} disabled={downloading}><Download size={15}/> Baixar PDF</button><button className="primary-button" onClick={save} disabled={saving}><Save size={15}/> Salvar versão</button></div>}</div></div>;
}

function ClientPackageForm({ userId, client, onClose, onSaved }) {
  const [packages, setPackages] = useState([]);
  const [packageId, setPackageId] = useState("");
  const [purchasedAt, setPurchasedAt] = useState(toInputDate(new Date()));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    setLoadingPackages(true);
    supabase.from("service_packages").select("id,name,price,total_sessions,validity_days,active").eq("user_id", userId).order("active", { ascending: false, nullsFirst: false }).order("name").then(({ data, error: loadError }) => {
      setLoadingPackages(false);
      if (loadError) { setError(`Não foi possível carregar os pacotes: ${loadError.message}`); return; }
      setPackages((data || []).filter(pkg => pkg.active !== false));
    });
  }, [userId]);

  const selected = packages.find((item) => item.id === packageId);
  const setPackage = (id) => {
    setPackageId(id);
    const pkg = packages.find((item) => item.id === id);
    setAmount(pkg?.price ?? "");
  };

  async function submit(e) {
    e.preventDefault(); setError("");
    if (!packageId) return setError("Selecione um pacote.");
    setSaving(true);
    const purchased = new Date(`${purchasedAt}T12:00:00`);
    let expires = null;
    if (selected?.validity_days) { purchased.setDate(purchased.getDate() + Number(selected.validity_days)); expires = toInputDate(purchased); }
    const result = await supabase.from("client_packages").insert({
      user_id: userId,
      client_id: client.id,
      package_id: packageId,
      purchased_at: purchasedAt,
      expires_at: expires,
      total_sessions: selected.total_sessions,
      used_sessions: 0,
      amount: Number(String(amount).replace(",", ".")) || 0,
      status: "ativo",
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (result.error) setError(result.error.message); else onSaved();
  }

  return <div className="modal-backdrop"><div className="modal-card package-modal client-package-modal"><div className="modal-header"><div><span>CLIENTE · PACOTES</span><h2>Adicionar pacote</h2><p className="client-profile-subtitle">Vincule um pacote existente à cliente para liberar suas sessões na Agenda.</p></div><button onClick={onClose}><X size={20} /></button></div><form className="client-form" onSubmit={submit}><label className="form-input"><span>Pacote *</span><select value={packageId} onChange={(e) => setPackage(e.target.value)}><option value="">{loadingPackages ? "Carregando pacotes..." : packages.length ? "Selecione um pacote" : "Nenhum pacote ativo cadastrado"}</option>{packages.map((pkg) => <option key={pkg.id} value={pkg.id}>{pkg.name} · {pkg.total_sessions} sessões · {moneyValue(pkg.price)}</option>)}</select></label>{selected && <div className="package-preview"><div><Gift size={17}/><div><strong>{selected.name}</strong><span>{selected.total_sessions} sessões{selected.validity_days ? ` · validade ${selected.validity_days} dias` : " · sem validade definida"}</span></div></div><b>{moneyValue(selected.price)}</b></div>}<div className="form-grid"><FormInput label="Data da compra" value={purchasedAt} onChange={setPurchasedAt} type="date" /><FormInput label="Valor pago (R$)" value={amount} onChange={setAmount} inputMode="decimal" placeholder="450,00" /></div><label className="textarea-field"><span>Observações</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" placeholder="Observações sobre a venda do pacote..." /></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? <span className="button-spinner"/> : <><Check size={16}/> Vincular pacote</>}</button></div></form></div></div>;
}

function normalizeWhatsAppPhone(value = "") { const digits = String(value).replace(/\D/g, ""); return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits; }

function DetailItem({ label, value }) { return <div><span>{label}</span><strong>{value || "Não informado"}</strong></div>; }

function Metric({ icon: Icon, value, label, trend }) { return <article className="metric-card"><div className="metric-icon"><Icon size={19} /></div><strong>{value}</strong><span>{label}</span><small>↑ &nbsp;{trend}</small></article>; }
function PanelTitle({ icon: Icon, title, action, onAction }) { return <div className="panel-title"><div><Icon size={18} /><h3>{title}</h3></div>{action && <button onClick={onAction}>{action} <ArrowRight size={14} /></button>}</div>; }
function LegendDot({ label, value }) { return <div className="legend-item"><i /><span>{label}</span><strong>{value}</strong></div>; }
function QuickAction({ icon: Icon, label, onClick }) { return <button className="quick-action" onClick={onClick}><Icon size={21} /><span>{label}</span></button>; }

function FinanceModule({ userId, intent, onIntentDone }) {
  const [month, setMonth] = useState(new Date());
  const [transactions, setTransactions] = useState([]);
  const [previousTransactions, setPreviousTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [presetType, setPresetType] = useState(null);
  const [filter, setFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!intent) return;
    if (intent.type === "new") { setEditing(null); setPresetType(intent.kind === "despesa" ? "despesa" : null); setShowForm(true); }
    onIntentDone?.();
  }, [intent]);

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month).replace(/^./, c => c.toUpperCase());
  const start = `${monthKey}-01`;
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const end = `${monthKey}-${String(endDate.getDate()).padStart(2, "0")}`;
  const previousMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const previousKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;
  const previousEndDate = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);
  const previousStart = `${previousKey}-01`;
  const previousEnd = `${previousKey}-${String(previousEndDate.getDate()).padStart(2, "0")}`;

  const selectFields = "id, type, description, category, amount, transaction_date, payment_method, status, client_id, notes, clients(full_name)";

  const loadTransactions = async () => {
    setLoading(true);
    const [current, previous] = await Promise.all([
      supabase.from("financial_transactions").select(selectFields).eq("user_id", userId).gte("transaction_date", start).lte("transaction_date", end).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("financial_transactions").select(selectFields).eq("user_id", userId).gte("transaction_date", previousStart).lte("transaction_date", previousEnd).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    const currentItems = current.data || [];
    const previousItems = previous.data || [];
    const ids = [...currentItems, ...previousItems].map(item => item.id);
    let splitRows = [];
    if (ids.length) {
      const splitQuery = await supabase.from("financial_transaction_categories").select("id, transaction_id, category, amount, percentage").eq("user_id", userId).in("transaction_id", ids);
      if (!splitQuery.error) splitRows = splitQuery.data || [];
      else console.warn("Categorias rateadas indisponíveis; usando categoria principal.", splitQuery.error.message);
    }
    const splitMap = splitRows.reduce((acc, row) => {
      (acc[row.transaction_id] ||= []).push(row);
      return acc;
    }, {});
    const attachSplits = items => items.map(item => ({ ...item, category_splits: splitMap[item.id] || [] }));
    if (!current.error) setTransactions(attachSplits(currentItems)); else console.error(current.error);
    if (!previous.error) setPreviousTransactions(attachSplits(previousItems)); else console.error(previous.error);
    setLoading(false);
  };

  useEffect(() => { loadTransactions(); }, [userId, monthKey]);

  const calculateTotals = (items) => {
    const paid = items.filter(t => t.status === "pago");
    const receitas = paid.filter(t => t.type === "receita").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const despesas = paid.filter(t => t.type === "despesa").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const aReceber = items.filter(t => t.type === "receita" && t.status === "pendente").reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const qtdReceitas = countPaidRevenueEntries(paid);
    return { receitas, despesas, resultado: receitas - despesas, aReceber, qtdReceitas, ticket: qtdReceitas ? receitas / qtdReceitas : 0 };
  };

  const totals = useMemo(() => calculateTotals(transactions), [transactions]);
  const previousTotals = useMemo(() => calculateTotals(previousTransactions), [previousTransactions]);

  const percentChange = (current, previous) => {
    if (!previous && !current) return null;
    if (!previous) return 100;
    return ((current - previous) / previous) * 100;
  };
  const revenueChange = percentChange(totals.receitas, previousTotals.receitas);
  const expenseChange = percentChange(totals.despesas, previousTotals.despesas);
  const resultChange = percentChange(totals.resultado, previousTotals.resultado);

  const categories = useMemo(() => {
    const values = [];
    transactions.forEach(t => {
      if (t.category) values.push(t.category);
      (t.category_splits || []).forEach(split => split.category && values.push(split.category));
    });
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [transactions]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return transactions.filter(t => {
      const matchesType = filter === "todos" || t.type === filter;
      const matchesStatus = statusFilter === "todos" || t.status === statusFilter;
      const matchesCategory = categoryFilter === "todas" || t.category === categoryFilter || (t.category_splits || []).some(split => split.category === categoryFilter);
      const haystack = `${t.description || ""} ${t.category || ""} ${t.payment_method || ""} ${t.clients?.full_name || ""}`.toLowerCase();
      return matchesType && matchesStatus && matchesCategory && (!term || haystack.includes(term));
    });
  }, [transactions, filter, statusFilter, categoryFilter, query]);

  const paymentData = useMemo(() => {
    const map = {};
    transactions.filter(t => t.status === "pago" && t.type === "receita").forEach(t => {
      const key = t.payment_method || "Não informado";
      map[key] = (map[key] || 0) + Number(t.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const expenseData = useMemo(() => {
    const map = {};
    transactions.filter(t => t.status === "pago" && t.type === "despesa").forEach(t => {
      const splits = t.category_splits || [];
      if (splits.length) splits.forEach(split => { map[split.category] = (map[split.category] || 0) + Number(split.amount || 0); });
      else { const key = t.category || "Sem categoria"; map[key] = (map[key] || 0) + Number(t.amount || 0); }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const revenueByClient = useMemo(() => {
    const map = {};
    transactions.filter(t => t.status === "pago" && t.type === "receita" && t.clients?.full_name).forEach(t => {
      const key = t.clients.full_name;
      map[key] = (map[key] || 0) + Number(t.amount || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions]);

  const chartData = useMemo(() => {
    const days = Array.from({ length: endDate.getDate() }, (_, i) => ({ day: i + 1, receita: 0, despesa: 0 }));
    transactions.filter(t => t.status === "pago").forEach(t => {
      const day = Number(String(t.transaction_date).slice(-2));
      if (!days[day - 1]) return;
      if (t.type === "receita") days[day - 1].receita += Number(t.amount || 0);
      if (t.type === "despesa") days[day - 1].despesa += Number(t.amount || 0);
    });
    const max = Math.max(...days.map(d => Math.max(d.receita, d.despesa)), 1);
    return days.map(d => ({ ...d, receitaPct: (d.receita / max) * 100, despesaPct: (d.despesa / max) * 100 }));
  }, [transactions, endDate]);

  const pendingReceivables = useMemo(() => transactions.filter(t => t.type === "receita" && t.status === "pendente").sort((a, b) => String(a.transaction_date).localeCompare(String(b.transaction_date))), [transactions]);

  const changeMonth = (delta) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const date = value => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));
  const changeLabel = value => value === null ? "Sem comparação" : `${value >= 0 ? "↑" : "↓"} ${Math.abs(value).toFixed(1).replace(".", ",")}% vs. mês anterior`;

  const saveTransaction = async (payload) => {
    const { category_splits = [], ...transactionPayload } = payload;
    const clean = { ...transactionPayload, user_id: userId, amount: Number(String(transactionPayload.amount).replace(",", ".")), client_id: transactionPayload.client_id || null, category: category_splits.length ? category_splits[0].category : (transactionPayload.category || null), payment_method: transactionPayload.payment_method || null, notes: transactionPayload.notes || null };
    let savedId = editing?.id || null;
    if (editing) {
      const { error } = await supabase.from("financial_transactions").update(clean).eq("id", editing.id).eq("user_id", userId);
      if (error) { alert(error.message); return false; }
      const { error: deleteSplitsError } = await supabase.from("financial_transaction_categories").delete().eq("transaction_id", editing.id).eq("user_id", userId);
      if (deleteSplitsError) { alert(deleteSplitsError.message); return false; }
    } else {
      const { data, error } = await supabase.from("financial_transactions").insert(clean).select("id").single();
      if (error) { alert(error.message); return false; }
      savedId = data.id;
    }
    if (category_splits.length) {
      const rows = category_splits.map(split => ({ transaction_id: savedId, user_id: userId, category: split.category, amount: Number(split.amount), percentage: Number(split.percentage) }));
      const { error } = await supabase.from("financial_transaction_categories").insert(rows);
      if (error) { alert(error.message); return false; }
    }
    setShowForm(false); setEditing(null); await loadTransactions(); return true;
  };

  const removeTransaction = async (id) => {
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id).eq("user_id", userId);
    if (error) alert(error.message); else loadTransactions();
  };

  const markAsPaid = async (id) => {
    const { error } = await supabase.from("financial_transactions").update({ status: "pago" }).eq("id", id).eq("user_id", userId);
    if (error) alert(error.message); else loadTransactions();
  };

  const clearFilters = () => { setFilter("todos"); setStatusFilter("todos"); setCategoryFilter("todas"); setQuery(""); };
  const hasFilters = filter !== "todos" || statusFilter !== "todos" || categoryFilter !== "todas" || query.trim();

  return <main className="page-content finance-page">
    <div className="module-header">
      <div><span className="eyebrow">GESTÃO FINANCEIRA</span><h1>Financeiro</h1><p>Transforme seus lançamentos em uma visão clara do seu negócio.</p></div>
      <button className="primary-button module-action" onClick={() => { setEditing(null); setPresetType(null); setShowForm(true); }}><Plus size={17} /> Novo lançamento</button>
    </div>

    <div className="finance-month-toolbar">
      <button className="secondary-button" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ArrowLeft size={16} /></button>
      <div className="finance-month"><span>{monthLabel}</span></div>
      <button className="secondary-button" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ArrowRight size={16} /></button>
      <button className="secondary-button finance-today" onClick={() => setMonth(new Date())}>Hoje</button>
    </div>

    <section className="finance-metrics finance-metrics-v2">
      <div className="finance-metric"><div className="finance-metric-icon income"><TrendingUp size={19} /></div><span>Receitas pagas</span><strong>{money(totals.receitas)}</strong><small>{changeLabel(revenueChange)}</small></div>
      <div className="finance-metric"><div className="finance-metric-icon expense"><TrendingDown size={19} /></div><span>Despesas pagas</span><strong>{money(totals.despesas)}</strong><small>{changeLabel(expenseChange)}</small></div>
      <div className="finance-metric highlight"><div className="finance-metric-icon result"><Wallet size={19} /></div><span>Resultado</span><strong>{money(totals.resultado)}</strong><small>{changeLabel(resultChange)}</small></div>
      <div className="finance-metric pending"><div className="finance-metric-icon pending"><Clock3 size={19} /></div><span>A receber</span><strong>{money(totals.aReceber)}</strong><small>{pendingReceivables.length} {pendingReceivables.length === 1 ? "pendência" : "pendências"}</small></div>
    </section>

    <section className="finance-v2-top-grid">
      <div className="panel finance-chart-panel">
        <div className="panel-title"><div><BarChart3 size={18} /><h3>Evolução do mês</h3></div><span className="finance-chart-legend"><i className="income-dot" /> Receitas <i className="expense-dot" /> Despesas</span></div>
        <div className="finance-chart"><div className="chart-y-labels"><span>{money(Math.max(...chartData.map(d => Math.max(d.receita, d.despesa)), 1)).replace(",00", "")}</span><span>R$ 0</span></div><div className="chart-bars">{chartData.map(d => <div className="chart-day" key={d.day} title={`${String(d.day).padStart(2, "0")}/${String(month.getMonth() + 1).padStart(2, "0")}: ${money(d.receita)} receitas · ${money(d.despesa)} despesas`}><div className="chart-columns"><span className="chart-bar receita" style={{ height: `${Math.max(d.receitaPct, d.receita ? 4 : 0)}%` }} /><span className="chart-bar despesa" style={{ height: `${Math.max(d.despesaPct, d.despesa ? 4 : 0)}%` }} /></div><small>{d.day % 5 === 1 || d.day === 1 ? d.day : ""}</small></div>)}</div></div>
      </div>
      <div className="panel finance-ticket-panel"><div className="panel-title"><div><CircleDollarSign size={18} /><h3>Indicadores</h3></div></div><div className="finance-indicator"><span>Ticket médio</span><strong>{money(totals.ticket)}</strong><small>{totals.qtdReceitas} receitas pagas no mês</small></div><div className="finance-indicator"><span>Receita pendente</span><strong>{money(totals.aReceber)}</strong><small>Valores ainda não recebidos</small></div><div className="finance-indicator"><span>Margem operacional</span><strong>{totals.receitas ? `${((totals.resultado / totals.receitas) * 100).toFixed(1).replace(".", ",")}%` : "0,0%"}</strong><small>Resultado ÷ receitas pagas</small></div></div>
    </section>

    <section className="finance-v2-insights">
      <div className="panel finance-insight-panel"><div className="panel-title"><div><CreditCard size={18} /><h3>Formas de pagamento</h3></div></div>{paymentData.length ? <div className="finance-bars-list">{paymentData.map(([name, value]) => <div className="finance-bar-row" key={name}><div><span>{name}</span><strong>{money(value)}</strong></div><div className="finance-progress"><i style={{ width: `${Math.min((value / Math.max(paymentData[0][1], 1)) * 100, 100)}%` }} /></div></div>)}</div> : <div className="finance-mini-empty">Nenhuma receita paga neste mês.</div>}</div>
      <div className="panel finance-insight-panel"><div className="panel-title"><div><PieChart size={18} /><h3>Despesas por categoria</h3></div></div>{expenseData.length ? <div className="finance-bars-list">{expenseData.map(([name, value]) => <div className="finance-bar-row" key={name}><div><span>{name}</span><strong>{money(value)}</strong></div><div className="finance-progress expense-progress"><i style={{ width: `${Math.min((value / Math.max(expenseData[0][1], 1)) * 100, 100)}%` }} /></div></div>)}</div> : <div className="finance-mini-empty">Nenhuma despesa paga neste mês.</div>}</div>
      <div className="panel finance-insight-panel"><div className="panel-title"><div><UserRound size={18} /><h3>Clientes que mais geraram receita</h3></div></div>{revenueByClient.length ? <div className="finance-client-list">{revenueByClient.map(([name, value], index) => <div className="finance-client-row" key={name}><span>{index + 1}</span><div><strong>{name}</strong><small>Receitas pagas</small></div><b>{money(value)}</b></div>)}</div> : <div className="finance-mini-empty">Vincule clientes às receitas para visualizar este indicador.</div>}</div>
    </section>

    <section className="panel finance-receivables-panel">
      <div className="panel-title"><div><Clock3 size={18} /><h3>Contas a receber</h3></div><span className="finance-count">{pendingReceivables.length} {pendingReceivables.length === 1 ? "pendência" : "pendências"}</span></div>
      {pendingReceivables.length ? <div className="receivable-list">{pendingReceivables.map(t => <div className="receivable-row" key={t.id}><div className="receivable-main"><strong>{t.description}</strong><span>{t.clients?.full_name || "Cliente não informado"} · {t.category || "Sem categoria"}</span></div><div className="receivable-date">{date(t.transaction_date)}</div><strong className="receivable-value">{money(t.amount)}</strong><button className="outline-button receivable-paid" onClick={() => markAsPaid(t.id)}><Check size={14} /> Marcar recebido</button></div>)}</div> : <div className="finance-mini-empty large">Nenhuma conta a receber neste mês.</div>}
    </section>

    <section className="panel finance-transactions-panel">
      <div className="panel-title finance-list-header"><div><ReceiptText size={18} /><h3>Lançamentos</h3></div><div className="finance-count">{filtered.length} {filtered.length === 1 ? "lançamento" : "lançamentos"}</div></div>
      <div className="finance-toolbar-v1"><div className="finance-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar lançamento, cliente ou categoria..." /></div><div className="finance-filters-v1"><div className="finance-segmented"><button className={filter === "todos" ? "active" : ""} onClick={() => setFilter("todos")}>Todos</button><button className={filter === "receita" ? "active" : ""} onClick={() => setFilter("receita")}>Receitas</button><button className={filter === "despesa" ? "active" : ""} onClick={() => setFilter("despesa")}>Despesas</button></div><select className="finance-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filtrar por status"><option value="todos">Todos os status</option><option value="pago">Pagos</option><option value="pendente">Pendentes</option><option value="cancelado">Cancelados</option></select><select className="finance-filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Filtrar por categoria"><option value="todas">Todas as categorias</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select>{hasFilters && <button className="finance-clear-filter" onClick={clearFilters}>Limpar</button>}</div></div>
      {loading ? <div className="finance-empty">Carregando lançamentos...</div> : filtered.length === 0 ? <div className="finance-empty"><Wallet size={28} /><strong>{hasFilters ? "Nenhum lançamento encontrado" : "Nenhum lançamento neste mês"}</strong><span>{hasFilters ? "Ajuste os filtros ou a busca para visualizar outros lançamentos." : "Registre uma receita ou despesa para começar a acompanhar o resultado."}</span><button className="outline-button" onClick={() => setShowForm(true)}><Plus size={15} /> Adicionar lançamento</button></div> : <div className="transaction-list">{filtered.map(t => <div className="transaction-row" key={t.id}><div className={`transaction-icon ${t.type}`}>{t.status === "pendente" ? <Clock3 size={17} /> : t.status === "cancelado" ? <X size={17} /> : <CheckCircle2 size={17} />}</div><div className="transaction-main"><strong>{t.description}</strong><span>{t.category_splits?.length ? t.category_splits.map(split => split.category).join(" · ") : (t.category || "Sem categoria")}{t.clients?.full_name ? ` · ${t.clients.full_name}` : ""}</span></div><div className="transaction-date">{date(t.transaction_date)}</div><div className="transaction-method">{t.payment_method || "—"}</div><div className={`transaction-status ${t.status}`}><i />{t.status === "pago" ? "Pago" : t.status === "pendente" ? "Pendente" : "Cancelado"}</div><strong className={`transaction-amount ${t.type} ${t.status}`}>{t.type === "receita" ? "+" : "−"} {money(t.amount)}</strong><div className="transaction-actions"><button className="icon-action" title="Editar" onClick={() => { setEditing(t); setShowForm(true); }}><Edit3 size={15} /></button><button className="icon-action danger" title="Excluir" onClick={() => removeTransaction(t.id)}><Trash2 size={15} /></button></div></div>)}</div>}
    </section>

    {showForm && <TransactionModal transaction={editing} presetType={presetType} userId={userId} onClose={() => { setShowForm(false); setEditing(null); setPresetType(null); }} onSave={saveTransaction} />}
  </main>;
}
function TransactionModal({ transaction, presetType, userId, onClose, onSave }) {
  const [clients, setClients] = useState([]);
  const [categorySplits, setCategorySplits] = useState([]);
  const [splitCategories, setSplitCategories] = useState(false);
  const [form, setForm] = useState({
    type: transaction?.type || presetType || "receita",
    description: transaction?.description || "",
    category: transaction?.category || "",
    amount: transaction?.amount ?? "",
    transaction_date: transaction?.transaction_date || toInputDate(new Date()),
    payment_method: transaction?.payment_method || "",
    status: transaction?.status || "pago",
    client_id: transaction?.client_id || "",
    notes: transaction?.notes || ""
  });
  const [saving, setSaving] = useState(false);

  const revenueCategories = ["Procedimento", "Pacote", "Produto", "Avaliação", "Outros"];
  const expenseCategories = ["Produtos", "Materiais descartáveis", "Equipamentos", "Aluguel", "Energia", "Água", "Internet", "Marketing", "Contabilidade", "Impostos", "Taxas", "Outros"];
  const categories = form.type === "receita" ? revenueCategories : expenseCategories;

  useEffect(() => {
    supabase.from("clients").select("id, full_name").eq("user_id", userId).order("full_name").then(({ data }) => setClients(data || []));
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSplits() {
      if (!transaction?.id) return;
      const { data, error } = await supabase.from("financial_transaction_categories").select("category, amount, percentage").eq("transaction_id", transaction.id).eq("user_id", userId).order("created_at");
      if (!cancelled && !error && data?.length) { setCategorySplits(data); setSplitCategories(true); }
    }
    loadSplits();
    return () => { cancelled = true; };
  }, [transaction?.id, userId]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const changeType = type => { setForm(prev => ({ ...prev, type, category: "", client_id: type === "despesa" ? "" : prev.client_id })); setCategorySplits([]); setSplitCategories(false); };
  const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const totalAmount = Number(String(form.amount).replace(",", ".")) || 0;
  const splitTotal = categorySplits.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const splitRemaining = totalAmount - splitTotal;
  const splitValid = !splitCategories || (categorySplits.length >= 2 && Math.abs(splitRemaining) < 0.01);
  const addCategorySplit = () => setCategorySplits(prev => [...prev, { category: "", amount: "", percentage: 0 }]);
  const updateCategorySplit = (index, key, value) => setCategorySplits(prev => prev.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const removeCategorySplit = index => setCategorySplits(prev => prev.filter((_, i) => i !== index));

  const submit = async e => {
    e.preventDefault();
    if (!form.description.trim()) return alert("Informe uma descrição para o lançamento.");
    const amount = Number(String(form.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return alert("Informe um valor válido maior que zero.");
    if (!form.transaction_date) return alert("Informe a data do lançamento.");
    if (splitCategories) {
      const cleanedSplits = categorySplits.map(item => ({ ...item, category: String(item.category || "").trim(), amount: Number(item.amount) || 0 })).filter(item => item.category && item.amount > 0);
      if (cleanedSplits.length < 2) return alert("Adicione pelo menos duas categorias para dividir o lançamento.");
      const splitSum = cleanedSplits.reduce((sum, item) => sum + item.amount, 0);
      if (Math.abs(splitSum - amount) > 0.01) return alert(`A divisão das categorias precisa totalizar ${amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
      const used = new Set();
      if (cleanedSplits.some(item => { const key = item.category.trim().toLowerCase(); if (used.has(key)) return true; used.add(key); return false; })) return alert("Não repita a mesma categoria no rateio.");
      cleanedSplits.forEach(item => { item.percentage = amount ? (item.amount / amount) * 100 : 0; });
      setSaving(true);
      await onSave({ ...form, amount, client_id: form.client_id || null, category_splits: cleanedSplits });
    } else {
      setSaving(true);
      await onSave({ ...form, amount, client_id: form.client_id || null, category_splits: [] });
    }
    setSaving(false);
  };

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal-card finance-modal finance-modal-v1">
    <div className="modal-header"><div><span className="eyebrow">GESTÃO FINANCEIRA</span><h2>{transaction ? "Editar lançamento" : "Novo lançamento"}</h2><p className="finance-modal-subtitle">Registre uma entrada ou saída de forma organizada.</p></div><button className="icon-action" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <form onSubmit={submit}>
      <div className="finance-type-toggle"><button type="button" className={form.type === "receita" ? "active receita" : ""} onClick={() => changeType("receita")}><TrendingUp size={16} /> Receita</button><button type="button" className={form.type === "despesa" ? "active despesa" : ""} onClick={() => changeType("despesa")}><TrendingDown size={16} /> Despesa</button></div>
      <div className="form-grid">
        <label className="form-field"><span>Descrição *</span><input className="form-input" value={form.description} onChange={e => set("description", e.target.value)} placeholder={form.type === "receita" ? "Ex.: Limpeza de pele" : "Ex.: Compra de produtos"} autoFocus /></label>
        <label className="form-field"><span>Valor *</span><input className="form-input" type="number" step="0.01" min="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0,00" /></label>
        <label className="form-field"><span>Data *</span><input className="form-input" type="date" value={form.transaction_date} onChange={e => set("transaction_date", e.target.value)} /></label>
        {!splitCategories ? <label className="form-field"><span>Categoria</span><select className="form-input" value={form.category} onChange={e => set("category", e.target.value)}><option value="">Selecione</option>{categories.map(x => <option key={x} value={x}>{x}</option>)}</select><button type="button" className="finance-split-toggle" onClick={() => { setSplitCategories(true); setCategorySplits([{ category: form.category || "", amount: form.amount || "", percentage: 100 }, { category: "", amount: "", percentage: 0 }]); }}>+ Dividir em categorias</button></label> : <div className="form-field full finance-split-field"><div className="finance-split-heading"><span>Divisão por categorias</span><button type="button" className="finance-split-toggle" onClick={() => { setSplitCategories(false); setCategorySplits([]); }}>Usar uma categoria</button></div><div className="finance-split-list">{categorySplits.map((item, index) => <div className="finance-split-row" key={index}><select className="form-input" value={item.category} onChange={e => updateCategorySplit(index, "category", e.target.value)}><option value="">Categoria</option>{categories.map(x => <option key={x} value={x}>{x}</option>)}</select><input className="form-input" type="number" min="0.01" step="0.01" value={item.amount} onChange={e => updateCategorySplit(index, "amount", e.target.value)} placeholder="Valor" /><button type="button" className="icon-action danger" onClick={() => removeCategorySplit(index)} disabled={categorySplits.length <= 2}><Trash2 size={14} /></button></div>)}</div><button type="button" className="finance-add-split" onClick={addCategorySplit}><Plus size={14} /> Adicionar categoria</button><div className={`finance-split-summary ${Math.abs(splitRemaining) < 0.01 ? "valid" : "invalid"}`}><span>Distribuído: {money(splitTotal)}</span><strong>{Math.abs(splitRemaining) < 0.01 ? "Valor completo" : `Falta distribuir ${money(Math.max(splitRemaining, 0))}`}</strong></div></div>}
        <label className="form-field"><span>Status</span><select className="form-input" value={form.status} onChange={e => set("status", e.target.value)}><option value="pago">Pago</option><option value="pendente">Pendente</option><option value="cancelado">Cancelado</option></select></label>
        <label className="form-field"><span>Forma de pagamento</span><select className="form-input" value={form.payment_method} onChange={e => set("payment_method", e.target.value)}><option value="">Não informado</option>{["Pix","Dinheiro","Cartão de crédito","Cartão de débito","Transferência","Outro"].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
        {form.type === "receita" && <label className="form-field"><span>Cliente</span><select className="form-input" value={form.client_id} onChange={e => set("client_id", e.target.value)}><option value="">Nenhuma</option>{clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>}
        <label className="form-field full"><span>Observações</span><textarea className="form-input" rows="3" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observações do lançamento..." /></label>
      </div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving || !splitValid}>{saving ? <><span className="button-spinner" /> Salvando...</> : transaction ? <><Check size={16} /> Salvar alterações</> : <><Plus size={16} /> Registrar lançamento</>}</button></div>
    </form>
  </div></div>;
}


function EvolutionModule({ userId, onNavigate }) {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [evolutions, setEvolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState("");
  const [drive, setDrive] = useState({ connected: false, email: null });
  const [showForm, setShowForm] = useState(false);
  const [editingEvolution, setEditingEvolution] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    procedure_name: "",
    evolution_date: toInputDate(new Date()),
    notes: "",
    products_used: "",
    recommendations: "",
  });
  const [files, setFiles] = useState({ antes: [], depois: [], adicional: [] });

  async function getAuthenticatedUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const authenticatedUserId = data?.user?.id;
    if (!authenticatedUserId) throw new Error("Sua sessão expirou. Faça login novamente.");
    return authenticatedUserId;
  }

  async function loadClients() {
    setClientsLoading(true);
    setClientsError("");
    try {
      // A RLS do Supabase já restringe os resultados ao profissional autenticado.
      // Não dependemos do userId recebido pelo componente para evitar divergência de sessão.
      await getAuthenticatedUserId();
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, photo_url, created_at")
        .order("full_name", { ascending: true });

      if (error) throw error;

      const rows = data || [];
      setClients(rows);
      setSelectedClientId((current) => {
        if (current && rows.some((client) => client.id === current)) return current;
        return rows[0]?.id || "";
      });

      if (!rows.length) {
        setClientsError("Nenhuma cliente cadastrada. Cadastre uma cliente em Clientes para registrar uma evolução.");
      }
    } catch (error) {
      console.error("Erro ao carregar clientes para Evolução:", error);
      setClients([]);
      setSelectedClientId("");
      setClientsError(error?.message || "Não foi possível carregar suas clientes.");
    } finally {
      setClientsLoading(false);
    }
  }

  async function loadDriveStatus() {
    try {
      const authenticatedUserId = await getAuthenticatedUserId();
      const { data, error } = await supabase
        .from("google_drive_connections")
        .select("google_account_email, root_folder_id")
        .eq("user_id", authenticatedUserId)
        .maybeSingle();

      if (error) throw error;

      setDrive({
        connected: Boolean(data),
        email: data?.google_account_email || null,
      });
    } catch (error) {
      console.error("Erro ao carregar conexão Google Drive:", error);
      // Se a tabela ainda não estiver acessível, não bloqueamos a tela de evolução.
      setDrive({ connected: false, email: null });
    }
  }

  async function loadEvolutions(clientId = selectedClientId) {
    if (!clientId) {
      setEvolutions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("client_evolutions")
        .select("*, evolution_photos(*)")
        .eq("client_id", clientId)
        .order("evolution_date", { ascending: false });

      if (error) throw error;
      setEvolutions(data || []);
    } catch (error) {
      console.error("Erro ao carregar evoluções:", error);
      setEvolutions([]);
      setNotice({ type: "error", text: error?.message || "Não foi possível carregar as evoluções." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClients();
    loadDriveStatus();

    const handleFocus = () => {
      loadClients();
      loadDriveStatus();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [userId]);

  useEffect(() => {
    loadEvolutions(selectedClientId);
  }, [selectedClientId]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  function openNew() {
    if (!selectedClientId) {
      setNotice({
        type: "error",
        text: clients.length
          ? "Selecione uma cliente antes de iniciar uma evolução."
          : "Nenhuma cliente cadastrada. Cadastre uma cliente em Clientes primeiro.",
      });
      return;
    }

    setEditingEvolution(null);
    setForm({
      procedure_name: "",
      evolution_date: toInputDate(new Date()),
      notes: "",
      products_used: "",
      recommendations: "",
    });
    setFiles({ antes: [], depois: [], adicional: [] });
    setShowForm(true);
  }

  function openEdit(evolution) {
    setEditingEvolution(evolution);
    setSelectedClientId(evolution.client_id);
    setForm({
      procedure_name: evolution.procedure_name || "",
      evolution_date: evolution.evolution_date || toInputDate(new Date()),
      notes: evolution.notes || "",
      products_used: evolution.products_used || "",
      recommendations: evolution.recommendations || "",
    });
    setFiles({ antes: [], depois: [], adicional: [] });
    setShowForm(true);
    setNotice(null);
  }

  async function connectDrive() {
    let popup = null;
    let timeoutId = null;
    let pollId = null;

    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      if (pollId) window.clearInterval(pollId);
      window.removeEventListener("message", handleMessage);
    };

    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "esteticpro-google-drive") return;

      cleanup();

      if (event.data.success) {
        setDrive({
          connected: true,
          email: event.data.email || null,
        });
        setNotice({
          type: "success",
          text: event.data.message || "Google Drive conectado com sucesso.",
        });
        loadDriveStatus();
      } else {
        setNotice({
          type: "error",
          text: event.data.message || "Não foi possível conectar o Google Drive.",
        });
      }
    };

    try {
      setNotice(null);
      popup = window.open(
        "about:blank",
        "esteticpro-google-drive",
        "width=620,height=760,left=180,top=70,resizable=yes,scrollbars=yes"
      );

      if (!popup) {
        throw new Error("O navegador bloqueou a janela de autorização. Permita pop-ups para o EsteticPro e tente novamente.");
      }

      popup.document.write(`
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>EsteticPro · Google Drive</title>
        <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#07110d;color:#f7f1e5;font-family:Arial,sans-serif;text-align:center}.box{padding:32px;max-width:360px}.spinner{width:34px;height:34px;margin:0 auto 20px;border:3px solid rgba(216,181,106,.2);border-top-color:#d8b56a;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}h2{margin:0 0 8px;font-family:Georgia,serif;font-weight:500}p{margin:0;color:#aebbb3;line-height:1.5}</style></head>
        <body><div class="box"><div class="spinner"></div><h2>Conectando Google Drive</h2><p>Preparando a autorização segura...</p></div></body></html>
      `);
      popup.document.close();

      window.addEventListener("message", handleMessage);

      const { data, error } = await supabase.functions.invoke("google-drive-auth", {
        body: { action: "start" },
      });

      if (error) {
        let message = error.message || "Não foi possível iniciar a conexão com o Google Drive.";
        try {
          if (error.context?.body) {
            const body = await error.context.json();
            if (body?.error) message = body.error;
          }
        } catch (_) {}
        throw new Error(message);
      }

      const authorizationUrl = data?.authorization_url || data?.url;
      if (!authorizationUrl) throw new Error("A função do Google Drive respondeu sem uma URL de autorização.");

      popup.location.href = authorizationUrl;
      popup.focus();

      pollId = window.setInterval(() => {
        if (popup?.closed) cleanup();
      }, 1000);

      timeoutId = window.setTimeout(() => {
        cleanup();
        if (popup && !popup.closed) popup.close();
        setNotice({ type: "error", text: "A conexão com o Google Drive demorou mais que o esperado. Tente novamente." });
      }, 5 * 60 * 1000);
    } catch (e) {
      cleanup();
      if (popup && !popup.closed) popup.close();
      setNotice({ type: "error", text: e?.message || "Não foi possível conectar o Google Drive." });
    }
  }

  function pickFiles(type, event) {
    const selected = Array.from(event.target.files || []);
    setFiles((prev) => ({ ...prev, [type]: [...prev[type], ...selected] }));
    event.target.value = "";
  }

  function removePicked(type, index) {
    setFiles((prev) => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  }

  async function saveEvolution(e) {
    e.preventDefault();
    if (!selectedClientId) return setNotice({ type: "error", text: "Selecione uma cliente." });
    if (!form.procedure_name.trim()) return setNotice({ type: "error", text: "Informe o procedimento." });

    const uploads = Object.entries(files).flatMap(([type, list]) => list.map((file) => ({ type, file })));

    if (!drive.connected && uploads.length) {
      return setNotice({ type: "error", text: "Conecte o Google Drive antes de enviar as fotos." });
    }

    const invalidFile = uploads.find(({ file }) => !["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (invalidFile) return setNotice({ type: "error", text: "Use apenas imagens JPG, PNG ou WEBP." });

    const oversized = uploads.find(({ file }) => file.size > 15 * 1024 * 1024);
    if (oversized) return setNotice({ type: "error", text: "Cada imagem deve ter no máximo 15 MB." });

    setSaving(true);
    setNotice(null);

    try {
      const authenticatedUserId = await getAuthenticatedUserId();

      const clean = {
        user_id: authenticatedUserId,
        client_id: selectedClientId,
        procedure_name: form.procedure_name.trim(),
        evolution_date: form.evolution_date,
        notes: form.notes.trim() || null,
        products_used: form.products_used.trim() || null,
        recommendations: form.recommendations.trim() || null,
      };

      let evolution = editingEvolution;

      if (editingEvolution) {
        const { data, error } = await supabase
          .from("client_evolutions")
          .update(clean)
          .eq("id", editingEvolution.id)
          .eq("user_id", authenticatedUserId)
          .select()
          .single();

        if (error) throw error;
        evolution = data;
      } else {
        const { data, error } = await supabase
          .from("client_evolutions")
          .insert(clean)
          .select()
          .single();

        if (error) throw error;
        evolution = data;
      }

      for (const item of uploads) {
        const body = new FormData();
        body.append("evolution_id", evolution.id);
        body.append("photo_type", item.type);
        body.append("file", item.file, item.file.name);

        const { data: uploadData, error: uploadError } =
          await supabase.functions.invoke("google-drive-upload", { body });

        if (uploadError) {
          let message = uploadError.message || "Não foi possível enviar uma das fotos.";
          try {
            if (uploadError.context?.body) {
              const raw = await uploadError.context.text();
              try {
                const responseBody = JSON.parse(raw);
                if (responseBody?.error) message = responseBody.error;
              } catch {
                if (raw) message = raw;
              }
            }
          } catch (_) {}
          throw new Error(message);
        }

        if (uploadData?.error) throw new Error(uploadData.error);
      }

      setShowForm(false);
      setEditingEvolution(null);
      setFiles({ antes: [], depois: [], adicional: [] });
      setNotice({
        type: "success",
        text: editingEvolution
          ? (uploads.length ? "Evolução atualizada e novas fotos salvas com sucesso." : "Evolução atualizada com sucesso.")
          : (uploads.length ? "Evolução e fotos salvas com sucesso." : "Evolução salva com sucesso.")
      });
      await loadEvolutions(selectedClientId);
    } catch (e) {
      console.error("Erro ao salvar evolução:", e);
      setNotice({ type: "error", text: e?.message || "Não foi possível salvar a evolução." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvolution(evolution) {
    const clientName = selectedClient?.full_name || "esta cliente";
    const procedure = evolution.procedure_name || "esta evolução";
    const photoCount = (evolution.evolution_photos || []).length;

    const confirmed = window.confirm(
      `Excluir a evolução de ${clientName}\n\nProcedimento: ${procedure}\nData: ${formatDate(evolution.evolution_date)}\nFotos vinculadas: ${photoCount}\n\nAs fotos correspondentes também serão removidas do Google Drive. Essa ação não poderá ser desfeita.`
    );
    if (!confirmed) return;

    setNotice(null);
    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "google-drive-delete-evolution",
        { body: { evolution_id: evolution.id } }
      );

      if (error) {
        let message = error.message || "Não foi possível excluir a evolução.";
        try {
          if (error.context?.body) {
            const raw = await error.context.text();
            try {
              const body = JSON.parse(raw);
              if (body?.error) message = body.error;
            } catch {
              if (raw) message = raw;
            }
          }
        } catch (_) {}
        throw new Error(message);
      }

      if (data?.error) throw new Error(data.error);

      setNotice({ type: "success", text: "Evolução e fotos removidas com sucesso." });
      await loadEvolutions(selectedClientId);
    } catch (error) {
      console.error("Erro ao excluir evolução:", error);
      setNotice({
        type: "error",
        text: error?.message || "Não foi possível excluir a evolução.",
      });
    } finally {
      setSaving(false);
    }
  }

  return <section className="evolution-page">
    <div className="module-header">
      <div><span>HISTÓRICO ESTÉTICO</span><h1>Evolução</h1><p>Registre procedimentos e acompanhe a evolução visual das suas clientes.</p></div>
      <button className="primary-button module-action" onClick={openNew}><Plus size={18} /> Nova evolução</button>
    </div>

    {notice && <div className={`module-notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}

    <section className="drive-connect-card">
      <div className="drive-connect-icon"><Cloud size={22} /></div>
      <div className="drive-connect-copy"><strong>Google Drive</strong><span>{drive.connected ? `Conectado: ${drive.email || "sua conta Google"}` : "As fotos de evolução serão armazenadas no seu Google Drive privado."}</span></div>
      <button className={drive.connected ? "secondary-button" : "primary-button"} onClick={connectDrive}><Cloud size={16} /> {drive.connected ? "Reconectar" : "Conectar Google Drive"}</button>
    </section>

    <div className="evolution-client-toolbar">
      <div className="evolution-client-select">
        <UsersRound size={17} />
        <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} disabled={clientsLoading}>
          <option value="">{clientsLoading ? "Carregando clientes..." : clients.length ? "Selecione uma cliente" : "Nenhuma cliente cadastrada"}</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}
        </select>
      </div>
      {clients.length > 0 && <div className="evolution-client-quick-list">
        {clients.slice(0, 8).map((client) => <button key={client.id} type="button" className={selectedClientId === client.id ? "active" : ""} onClick={() => setSelectedClientId(client.id)}>{initials(client.full_name)}<span>{client.full_name}</span></button>)}
      </div>}
      {clientsError && <button type="button" className="secondary-button" onClick={loadClients}>Recarregar clientes</button>}
      {selectedClient && <div className="evolution-client-pill"><div className="avatar client-avatar">{initials(selectedClient.full_name)}</div><div><strong>{selectedClient.full_name}</strong><span>{evolutions.length} {evolutions.length === 1 ? "evolução registrada" : "evoluções registradas"}</span></div></div>}
    </div>

    {clientsError && <div className="module-notice error"><span>{clientsError}</span><button onClick={() => setClientsError("")}><X size={16} /></button></div>}

    {loading ? <div className="loading-panel"><span className="button-spinner dark" />Carregando evoluções...</div> : !selectedClientId ? <div className="evolution-empty"><HeartPulse size={30} /><strong>{clients.length ? "Selecione uma cliente" : "Sua base de clientes está vazia"}</strong><span>{clients.length ? "Escolha uma cliente para visualizar ou registrar sua evolução." : "Cadastre uma cliente para começar a registrar evoluções."}</span>{!clients.length && onNavigate && <button className="outline-button" onClick={() => onNavigate("clientes")}><UsersRound size={15} /> Ir para Clientes</button>}</div> : evolutions.length === 0 ? <div className="evolution-empty"><Camera size={30} /><strong>Nenhuma evolução registrada</strong><span>Comece registrando o primeiro procedimento e suas fotos Antes e Depois.</span><button className="outline-button" onClick={openNew}><Plus size={15} /> Registrar primeira evolução</button></div> : <div className="evolution-timeline">{evolutions.map((evolution) => <EvolutionCard key={evolution.id} evolution={evolution} clientName={selectedClient?.full_name} onEdit={openEdit} onDelete={deleteEvolution}
        onPhotoDeleted={(evolutionId, photoId) => setEvolutions((prev) => prev.map((item) => item.id === evolutionId ? { ...item, evolution_photos: (item.evolution_photos || []).filter((photo) => photo.id !== photoId) } : item))}
        onPhotoTypeChanged={(evolutionId, photoId, type) => setEvolutions((prev) => prev.map((item) => item.id === evolutionId ? { ...item, evolution_photos: (item.evolution_photos || []).map((photo) => photo.id === photoId ? { ...photo, photo_type: type } : photo) } : item))} />)}</div>}

    {showForm && <EvolutionFormModal form={form} setForm={setForm} files={files} onPick={pickFiles} onRemove={removePicked} onClose={() => { setShowForm(false); setEditingEvolution(null); }} onSubmit={saveEvolution} saving={saving} driveConnected={drive.connected} clientName={selectedClient?.full_name} editing={Boolean(editingEvolution)} existingPhotos={editingEvolution?.evolution_photos || []} />}
  </section>;
}

function EvolutionCard({ evolution, clientName, onEdit, onDelete, onPhotoDeleted, onPhotoTypeChanged }) {
  const photos = evolution.evolution_photos || [];
  return <article className="evolution-card">
    <div className="evolution-card-head">
      <div>
        <span>{formatDate(evolution.evolution_date)}</span>
        <h3>{evolution.procedure_name || "Evolução estética"}</h3>
        <small className="evolution-client-name">{clientName || "Cliente"}</small>
      </div>
      <div className="evolution-card-head-actions">
        <div className="evolution-badge"><HeartPulse size={13} /> Evolução</div>
        <button type="button" className="icon-action" title="Editar evolução" onClick={() => onEdit(evolution)}><Edit3 size={15} /></button>
        <button type="button" className="icon-action danger-outline" title="Excluir evolução" onClick={() => onDelete(evolution)}><Trash2 size={15} /></button>
      </div>
    </div>
    <PhotoGallery
      photos={photos}
      evolution={evolution}
      onPhotoDeleted={onPhotoDeleted}
      onPhotoTypeChanged={onPhotoTypeChanged}
    />
    {(evolution.notes || evolution.products_used || evolution.recommendations) && <div className="evolution-notes">
      {evolution.notes && <div><strong>Observações</strong><p>{evolution.notes}</p></div>}
      {evolution.products_used && <div><strong>Produtos utilizados</strong><p>{evolution.products_used}</p></div>}
      {evolution.recommendations && <div><strong>Recomendações / retorno</strong><p>{evolution.recommendations}</p></div>}
    </div>}
  </article>;
}

async function invokeDriveMedia(fileId) {
  const { data, error } = await supabase.functions.invoke("google-drive-media", { body: { file_id: fileId } });
  if (error) {
    let message = error.message || "Não foi possível carregar a imagem.";
    try {
      if (error.context?.json) {
        const body = await error.context.json();
        if (body?.error) message = body.error;
      }
    } catch (_) {}
    throw new Error(message);
  }
  if (!(data instanceof Blob)) throw new Error("A imagem foi recebida em um formato inesperado.");
  return URL.createObjectURL(data);
}

function PhotoGallery({ photos, evolution, onPhotoDeleted, onPhotoTypeChanged }) {
  const [sources, setSources] = useState({});
  const [errors, setErrors] = useState({});
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [deletingId, setDeletingId] = useState("");
  const [changingTypeId, setChangingTypeId] = useState("");
  const touchStart = React.useRef(null);

  useEffect(() => {
    let cancelled = false;
    const created = [];
    async function loadAll() {
      const next = {};
      const nextErrors = {};
      await Promise.all((photos || []).map(async (photo) => {
        if (!photo.drive_file_id) return;
        try {
          const url = await invokeDriveMedia(photo.drive_file_id);
          created.push(url);
          next[photo.id] = url;
        } catch (e) {
          nextErrors[photo.id] = e?.message || "Imagem indisponível.";
        }
      }));
      if (!cancelled) {
        setSources(next);
        setErrors(nextErrors);
      } else created.forEach((url) => URL.revokeObjectURL(url));
    }
    setSources({});
    setErrors({});
    loadAll();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos.map((p) => `${p.id}:${p.drive_file_id}`).join("|")]);

  useEffect(() => {
    function onKeyDown(event) {
      if (lightboxIndex < 0) return;
      if (event.key === "Escape") setLightboxIndex(-1);
      if (event.key === "ArrowLeft") setLightboxIndex((i) => (i <= 0 ? photos.length - 1 : i - 1));
      if (event.key === "ArrowRight") setLightboxIndex((i) => (i >= photos.length - 1 ? 0 : i + 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, photos.length]);

  const groups = [
    { type: "antes", title: "Antes", items: photos.filter((p) => p.photo_type === "antes") },
    { type: "depois", title: "Depois", items: photos.filter((p) => p.photo_type === "depois") },
    { type: "adicional", title: "Adicionais", items: photos.filter((p) => p.photo_type === "adicional") },
  ];

  async function deletePhoto(photo) {
    const confirmed = window.confirm(`Excluir esta foto da evolução?\n\nEla também será removida do Google Drive. Essa ação não poderá ser desfeita.`);
    if (!confirmed) return;
    setDeletingId(photo.id);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-delete-photo", { body: { photo_id: photo.id } });
      if (error) {
        let message = error.message || "Não foi possível excluir a foto.";
        try {
          if (error.context?.body) {
            const raw = await error.context.text();
            try { const body = JSON.parse(raw); if (body?.error) message = body.error; } catch { if (raw) message = raw; }
          }
        } catch (_) {}
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      onPhotoDeleted?.(evolution.id, photo.id);
    } catch (e) {
      window.alert(e?.message || "Não foi possível excluir a foto.");
    } finally {
      setDeletingId("");
    }
  }

  async function changeType(photo, type) {
    if (type === photo.photo_type) return;
    setChangingTypeId(photo.id);
    try {
      const { error } = await supabase.from("evolution_photos").update({ photo_type: type }).eq("id", photo.id);
      if (error) throw error;
      onPhotoTypeChanged?.(evolution.id, photo.id, type);
    } catch (e) {
      window.alert(e?.message || "Não foi possível alterar o tipo da foto.");
    } finally {
      setChangingTypeId("");
    }
  }

  function openPhoto(photo) {
    const index = photos.findIndex((item) => item.id === photo.id);
    if (index >= 0) setLightboxIndex(index);
  }

  function swipeStart(e) { touchStart.current = e.changedTouches?.[0]?.clientX ?? null; }
  function swipeEnd(e) {
    if (touchStart.current == null || lightboxIndex < 0) return;
    const end = e.changedTouches?.[0]?.clientX ?? touchStart.current;
    const delta = end - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 45) return;
    setLightboxIndex((i) => delta > 0 ? (i <= 0 ? photos.length - 1 : i - 1) : (i >= photos.length - 1 ? 0 : i + 1));
  }

  if (!photos.length) return <div className="evolution-no-photos"><Camera size={18} /><span>Nenhuma foto registrada nesta evolução.</span></div>;

  return <>
    <div className="photo-gallery">
      {groups.map((group) => group.items.length > 0 && <section className="photo-gallery-group" key={group.type}>
        <div className="photo-gallery-group-head"><div><span className="photo-gallery-eyebrow">REGISTRO VISUAL</span><h4>{group.title}</h4></div><span className="photo-count">{group.items.length} {group.items.length === 1 ? "foto" : "fotos"}</span></div>
        <div className="photo-gallery-grid">
          {group.items.map((photo) => <div className="gallery-photo-card" key={photo.id}>
            <button type="button" className="gallery-photo-open" onClick={() => openPhoto(photo)} aria-label={`Abrir ${group.title.toLowerCase()}`}>
              {sources[photo.id] ? <img src={sources[photo.id]} alt={`${group.title} - ${evolution.procedure_name || "evolução"}`} loading="lazy" /> : <div className="gallery-photo-placeholder">{errors[photo.id] ? <FolderOpen size={22} /> : <ImageIcon size={22} />}<small>{errors[photo.id] ? "Indisponível" : "Carregando..."}</small></div>}
              {sources[photo.id] && <span className="gallery-photo-expand"><Maximize2 size={15} /></span>}
            </button>
            <div className="gallery-photo-footer">
              <select aria-label="Tipo da foto" value={photo.photo_type} disabled={changingTypeId === photo.id} onChange={(e) => changeType(photo, e.target.value)}>
                <option value="antes">Antes</option><option value="depois">Depois</option><option value="adicional">Adicional</option>
              </select>
              <button type="button" className="gallery-photo-delete" title="Excluir foto" onClick={() => deletePhoto(photo)} disabled={deletingId === photo.id}>{deletingId === photo.id ? <span className="button-spinner dark" /> : <Trash2 size={14} />}</button>
            </div>
          </div>)}
        </div>
      </section>)}
    </div>

    {lightboxIndex >= 0 && photos[lightboxIndex] && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Visualização da foto" onMouseDown={(e) => e.target === e.currentTarget && setLightboxIndex(-1)} onTouchStart={swipeStart} onTouchEnd={swipeEnd}>
      <button type="button" className="photo-lightbox-close" onClick={() => setLightboxIndex(-1)} aria-label="Fechar"><X size={22} /></button>
      <button type="button" className="photo-lightbox-nav prev" onClick={() => setLightboxIndex((i) => (i <= 0 ? photos.length - 1 : i - 1))} aria-label="Foto anterior"><ChevronLeft size={30} /></button>
      <div className="photo-lightbox-content">
        {sources[photos[lightboxIndex].id] ? <img src={sources[photos[lightboxIndex].id]} alt="Foto ampliada" /> : <div className="photo-lightbox-loading"><ImageIcon size={28} />Carregando...</div>}
        <div className="photo-lightbox-caption"><strong>{photos[lightboxIndex].photo_type === "antes" ? "Antes" : photos[lightboxIndex].photo_type === "depois" ? "Depois" : "Adicional"}</strong><span>{evolution.procedure_name || "Evolução estética"} · {formatDate(evolution.evolution_date)}</span><small>{lightboxIndex + 1} de {photos.length}</small></div>
      </div>
      <button type="button" className="photo-lightbox-nav next" onClick={() => setLightboxIndex((i) => (i >= photos.length - 1 ? 0 : i + 1))} aria-label="Próxima foto"><ChevronRight size={30} /></button>
    </div>}
  </>;
}

function EvolutionFormModal({ form, setForm, files, onPick, onRemove, onClose, onSubmit, saving, driveConnected, clientName, editing, existingPhotos }) {
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const fileBlock = (type, title, icon) => <div className="photo-upload-block"><div className="photo-upload-head"><div><strong>{title}</strong><span>{type === "adicional" ? "Opcional" : "Recomendado"}</span></div>{icon}</div><label className="photo-dropzone"><Upload size={20} /><strong>Adicionar fotos</strong><small>JPG, PNG ou WEBP</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => onPick(type, e)} /></label>{files[type].length > 0 && <div className="picked-files">{files[type].map((file, i) => <div key={`${file.name}-${i}`}><span>{file.name}</span><button type="button" onClick={() => onRemove(type, i)}><X size={13} /></button></div>)}</div>}</div>;
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal-card evolution-modal">
    <div className="modal-header"><div><span className="eyebrow">EVOLUÇÃO · {clientName || "CLIENTE"}</span><h2>{editing ? "Editar evolução" : "Novo registro"}</h2></div><button className="icon-action" onClick={onClose}><X size={18} /></button></div>{editing && existingPhotos?.length > 0 && <div className="form-info">As fotos já salvas permanecem no Google Drive. Você pode adicionar novas fotos abaixo.</div>}
    {!driveConnected && <div className="drive-warning"><Cloud size={18} /><span>O Google Drive ainda não está conectado. Você pode salvar o registro sem fotos, mas precisará conectar o Drive para enviar imagens.</span></div>}
    <form onSubmit={onSubmit}>
      <div className="form-grid"><label className="form-field"><span>Procedimento *</span><input className="form-input" value={form.procedure_name} onChange={e => set("procedure_name", e.target.value)} placeholder="Ex.: Limpeza de pele" /></label><label className="form-field"><span>Data *</span><input className="form-input" type="date" value={form.evolution_date} onChange={e => set("evolution_date", e.target.value)} /></label><label className="form-field full"><span>Observações</span><textarea className="form-input" rows="3" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Descreva o procedimento e observações da evolução..." /></label><label className="form-field full"><span>Produtos utilizados</span><textarea className="form-input" rows="2" value={form.products_used} onChange={e => set("products_used", e.target.value)} placeholder="Produtos, ativos ou protocolos utilizados..." /></label><label className="form-field full"><span>Recomendações / retorno</span><textarea className="form-input" rows="2" value={form.recommendations} onChange={e => set("recommendations", e.target.value)} placeholder="Cuidados, orientações e data sugerida para retorno..." /></label></div>
      <div className="photo-upload-grid">{fileBlock("antes", "Foto Antes", <Camera size={17} />)}{fileBlock("depois", "Foto Depois", <Camera size={17} />)}{fileBlock("adicional", "Fotos adicionais", <ImageIcon size={17} />)}</div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <span className="button-spinner" /> : <><Check size={16} /> Salvar evolução</>}</button></div>
    </form>
  </div></div>;
}


function ProceduresModule({ userId, intent, onIntentDone }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!intent) return;
    if (intent.type === "new") { setEditing(null); setShowForm(true); }
    onIntentDone?.();
  }, [intent]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("procedures").select("*").eq("user_id", userId).order("active", { ascending: false }).order("name");
    if (error) setNotice({ type: "error", text: error.message });
    setItems(data || []); setLoading(false);
  }
  useEffect(() => { load(); }, [userId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(x => `${x.name} ${x.category || ""} ${x.description || ""}`.toLowerCase().includes(q)) : items;
  }, [items, query]);
  async function remove(item) {
    const { error } = await supabase.from("procedures").delete().eq("id", item.id).eq("user_id", userId);
    if (error) setNotice({ type: "error", text: error.message }); else { setNotice({ type: "success", text: "Procedimento excluído." }); load(); }
  }
  async function toggle(item) {
    const { error } = await supabase.from("procedures").update({ active: !item.active }).eq("id", item.id).eq("user_id", userId);
    if (error) setNotice({ type: "error", text: error.message }); else load();
  }
  return <section className="service-page">
    <div className="module-header"><div><span>CATÁLOGO PROFISSIONAL</span><h1>Procedimentos</h1><p>Cadastre seus serviços, valores e duração para usar em toda a operação.</p></div><button className="primary-button module-action" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={18} /> Novo procedimento</button></div>
    {notice && <div className={`module-notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}
    <div className="service-toolbar"><div className="client-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar procedimento..."/></div><span className="client-count">{filtered.length} {filtered.length === 1 ? "procedimento" : "procedimentos"}</span></div>
    {loading ? <div className="loading-panel"><span className="button-spinner dark"/>Carregando...</div> : filtered.length ? <div className="service-grid">{filtered.map(item => <article className={`service-card ${!item.active ? "inactive" : ""}`} key={item.id}><div className="service-card-top"><div className="service-icon"><Sparkles size={18}/></div><span className={`service-status ${item.active ? "active" : "inactive"}`}>{item.active ? "Ativo" : "Inativo"}</span></div><h3>{item.name}</h3><span className="service-category">{item.category || "Sem categoria"}</span><div className="service-meta"><span><Timer size={14}/> {item.duration_minutes ? `${item.duration_minutes} min` : "Duração não definida"}</span><strong>{moneyValue(item.price)}</strong></div><p>{item.description || "Sem descrição cadastrada."}</p><div className="service-card-actions"><button onClick={()=>{setEditing(item);setShowForm(true)}}><Edit3 size={14}/> Editar</button><button onClick={()=>toggle(item)}>{item.active ? "Desativar" : "Ativar"}</button><button className="danger-button" onClick={()=>remove(item)}><Trash2 size={14}/></button></div></article>)}</div> : <div className="empty-clients"><div className="empty-icon"><Sparkles size={32}/></div><h2>Nenhum procedimento cadastrado</h2><p>Cadastre seus procedimentos para começar a montar seu catálogo profissional.</p><button className="primary-button compact" onClick={()=>{setEditing(null);setShowForm(true)}}><Plus size={17}/> Cadastrar procedimento</button></div>}
    {showForm && <ProcedureForm userId={userId} item={editing} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);setNotice({type:"success",text:editing?"Procedimento atualizado.":"Procedimento cadastrado."});load()}}/>}
  </section>;
}

function ProcedureForm({ userId, item, onClose, onSaved }) {
  const [form,setForm]=useState({name:item?.name||"",category:item?.category||"",duration_minutes:item?.duration_minutes||"",price:item?.price??"",description:item?.description||"",active:item?.active??true});
  const [products,setProducts]=useState([]);
  const [composition,setComposition]=useState([]);
  const [loadingProducts,setLoadingProducts]=useState(true);
  const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));

  useEffect(()=>{
    (async()=>{
      setLoadingProducts(true);
      const [{data:productRows},{data:itemRows}] = await Promise.all([
        supabase.from("products").select("id,name,unit,stock_quantity,active").eq("user_id",userId).order("name"),
        item?.id ? supabase.from("procedure_inventory_items").select("id,product_id,quantity").eq("user_id",userId).eq("procedure_id",item.id) : Promise.resolve({data:[]})
      ]);
      setProducts(productRows || []);
      setComposition((itemRows || []).map(row=>({product_id:row.product_id,quantity:Number(row.quantity)||1})));
      setLoadingProducts(false);
    })();
  },[userId,item?.id]);

  function addProduct(){
    const product=(products||[]).find(p=>p.active!==false && !composition.some(i=>i.product_id===p.id));
    if(product)setComposition(v=>[...v,{product_id:product.id,quantity:1}]);
  }
  function updateProduct(index,key,value){setComposition(v=>v.map((row,i)=>i===index?{...row,[key]:value}:row));}

  async function submit(e){
    e.preventDefault();setError("");
    if(!form.name.trim())return setError("Informe o nome do procedimento.");
    if(composition.some(row=>!row.product_id || Number(row.quantity)<=0))return setError("Revise os produtos e as quantidades da composição.");
    setSaving(true);
    const payload={...form,name:form.name.trim(),duration_minutes:form.duration_minutes?Number(form.duration_minutes):null,price:Number(String(form.price).replace(",","."))||0};
    const result=item?await supabase.from("procedures").update(payload).eq("id",item.id).eq("user_id",userId):await supabase.from("procedures").insert({...payload,user_id:userId}).select().single();
    if(result.error){setSaving(false);return setError(result.error.message)}
    const procedureId=item?.id || result.data.id;
    const {error:deleteError}=await supabase.from("procedure_inventory_items").delete().eq("procedure_id",procedureId).eq("user_id",userId);
    if(deleteError){setSaving(false);return setError(deleteError.message)}
    if(composition.length){
      const {error:insertError}=await supabase.from("procedure_inventory_items").insert(composition.map(row=>({user_id:userId,procedure_id:procedureId,product_id:row.product_id,quantity:Number(row.quantity)})));
      if(insertError){setSaving(false);return setError(insertError.message)}
    }
    setSaving(false);onSaved()
  }

  return <div className="modal-backdrop"><div className="modal-card procedure-modal">
    <div className="modal-header"><div><span>CATÁLOGO PROFISSIONAL</span><h2>{item?"Editar procedimento":"Novo procedimento"}</h2></div><button onClick={onClose}><X size={20}/></button></div>
    <form className="client-form" onSubmit={submit}>
      <div className="form-grid"><label className="form-input"><span>Nome *</span><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ex.: Limpeza de pele"/></label><label className="form-input"><span>Categoria</span><input value={form.category} onChange={e=>set("category",e.target.value)} placeholder="Facial, corporal..."/></label><label className="form-input"><span>Duração (min)</span><input type="number" min="0" value={form.duration_minutes} onChange={e=>set("duration_minutes",e.target.value)} placeholder="60"/></label><label className="form-input"><span>Valor (R$)</span><input inputMode="decimal" value={form.price} onChange={e=>set("price",e.target.value)} placeholder="150,00"/></label></div>
      <label className="textarea-field"><span>Descrição</span><textarea value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Descreva o procedimento..." rows="3"/></label>
      <div className="procedure-stock-section">
        <div className="procedure-stock-head"><div><span>CONSUMO DE ESTOQUE</span><h3>Produtos utilizados neste procedimento</h3><p>Ao concluir o atendimento, estas quantidades poderão ser baixadas automaticamente do estoque.</p></div><button type="button" className="secondary-button compact" onClick={addProduct} disabled={loadingProducts || !(products||[]).some(p=>p.active!==false && !composition.some(i=>i.product_id===p.id))}><Plus size={14}/> Adicionar produto</button></div>
        {loadingProducts ? <div className="procedure-stock-empty">Carregando produtos...</div> : composition.length ? <div className="procedure-stock-list">{composition.map((row,index)=>{const product=products.find(p=>p.id===row.product_id);return <div className="procedure-stock-row" key={`${row.product_id}-${index}`}><select value={row.product_id} onChange={e=>updateProduct(index,"product_id",e.target.value)}><option value="">Selecione o produto</option>{products.filter(p=>p.active!==false||p.id===row.product_id).map(p=><option key={p.id} value={p.id}>{p.name} · {p.unit}</option>)}</select><input type="number" min="0.001" step="0.001" value={row.quantity} onChange={e=>updateProduct(index,"quantity",e.target.value)} placeholder="Qtd."/><span>{product?.unit||"un"}</span><button type="button" className="danger-button" onClick={()=>setComposition(v=>v.filter((_,i)=>i!==index))}><Trash2 size={14}/></button></div>})}</div> : <div className="procedure-stock-empty"><Package size={17}/><span>Nenhum produto vinculado. Este procedimento não fará baixa automática de estoque.</span></div>}
      </div>
      {item&&<label className="service-toggle"><input type="checkbox" checked={form.active} onChange={e=>set("active",e.target.checked)}/><span>Procedimento ativo</span></label>}
      {error&&<div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving?<span className="button-spinner"/>:<><Check size={16}/> Salvar procedimento</>}</button></div>
    </form>
  </div></div>;
}

function PackagesModule({ userId }) {
  const [packages,setPackages]=useState([]);
  const [procedures,setProcedures]=useState([]);
  const [clients,setClients]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [showLink,setShowLink]=useState(false);
  const [editing,setEditing]=useState(null);
  const [linkingPackage,setLinkingPackage]=useState(null);
  const [notice,setNotice]=useState(null);
  const [query,setQuery]=useState("");

  async function load(){
    setLoading(true);
    const [{data:p,error:pe},{data:procs,error:pr},{data:cls,error:ce}]=await Promise.all([
      supabase.from("service_packages").select("*, service_package_items(*)").eq("user_id",userId).order("created_at",{ascending:false}),
      supabase.from("procedures").select("id,name,price,active").eq("user_id",userId).order("name"),
      supabase.from("clients").select("id,full_name,active").eq("user_id",userId).order("full_name")
    ]);
    if(pe)setNotice({type:"error",text:pe.message});
    if(pr)setNotice({type:"error",text:pr.message});
    if(ce)setNotice({type:"error",text:ce.message});
    setPackages(p||[]);setProcedures(procs||[]);setClients(cls||[]);setLoading(false);
  }

  useEffect(()=>{load()},[userId]);
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?packages.filter(x=>`${x.name} ${x.description||""}`.toLowerCase().includes(q)):packages},[packages,query]);

  async function togglePackage(pkg){
    const {error}=await supabase.from("service_packages").update({active: !pkg.active}).eq("id",pkg.id).eq("user_id",userId);
    if(error)setNotice({type:"error",text:error.message});
    else{setNotice({type:"success",text:pkg.active?"Pacote desativado.":"Pacote ativado."});load()}
  }

  async function remove(pkg){
    const {error}=await supabase.from("service_packages").delete().eq("id",pkg.id).eq("user_id",userId);
    if(error)setNotice({type:"error",text:error.message});
    else{setNotice({type:"success",text:"Pacote excluído."});load()}
  }

  function openLink(pkg){
    setLinkingPackage(pkg);
    setShowLink(true);
  }

  return <section className="service-page">
    <div className="module-header"><div><span>RELACIONAMENTO E FIDELIZAÇÃO</span><h1>Pacotes</h1><p>Monte combos de procedimentos e acompanhe sessões e validade por cliente.</p></div><button className="primary-button module-action" onClick={()=>{setEditing(null);setShowForm(true)}}><Plus size={18}/> Novo pacote</button></div>
    {notice&&<div className={`module-notice ${notice.type}`}><span>{notice.text}</span><button onClick={()=>setNotice(null)}><X size={16}/></button></div>}
    <div className="service-toolbar"><div className="client-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar pacote..."/></div><span className="client-count">{filtered.length} {filtered.length===1?"pacote":"pacotes"}</span></div>
    {loading?<div className="loading-panel"><span className="button-spinner dark"/>Carregando...</div>:filtered.length?<div className="service-grid">{filtered.map(pkg=><article className="service-card package-card" key={pkg.id}>
      <div className="service-card-top"><div className="service-icon"><Gift size={18}/></div><span className={`service-status ${pkg.active?"active":"inactive"}`}>{pkg.active?"Ativo":"Inativo"}</span></div>
      <h3>{pkg.name}</h3>
      <span className="service-category">{pkg.total_sessions} {pkg.total_sessions===1?"sessão":"sessões"}{pkg.validity_days?` · ${pkg.validity_days} dias de validade`:""}</span>
      <div className="package-items">{(pkg.service_package_items||[]).slice(0,4).map(i=><span key={i.id}>{i.quantity}× {i.procedure_name}</span>)}</div>
      <div className="service-meta"><span><PackageCheck size={14}/> Pacote</span><strong>{moneyValue(pkg.price)}</strong></div>
      <p>{pkg.description||"Sem descrição cadastrada."}</p>
      <div className="service-card-actions"><button onClick={()=>{setEditing(pkg);setShowForm(true)}}><Edit3 size={14}/> Editar</button><button onClick={()=>openLink(pkg)} disabled={!pkg.active}><UsersRound size={14}/> Vincular cliente</button><button onClick={()=>togglePackage(pkg)}>{pkg.active ? "Desativar" : "Ativar"}</button><button className="danger-button" onClick={()=>remove(pkg)}><Trash2 size={14}/></button></div>
    </article>)}</div>:<div className="empty-clients"><div className="empty-icon"><Gift size={32}/></div><h2>Nenhum pacote cadastrado</h2><p>Crie pacotes para combinar procedimentos e facilitar a venda de sessões.</p><button className="primary-button compact" onClick={()=>{setEditing(null);setShowForm(true)}}><Plus size={17}/> Criar primeiro pacote</button></div>}
    {showForm&&<PackageForm userId={userId} pkg={editing} procedures={procedures} onClose={()=>setShowForm(false)} onSaved={()=>{setShowForm(false);setNotice({type:"success",text:editing?"Pacote atualizado.":"Pacote criado."});load()}}/>}
    {showLink&&linkingPackage&&<PackageLinkModal userId={userId} pkg={linkingPackage} clients={clients} onClose={()=>{setShowLink(false);setLinkingPackage(null)}} onSaved={(message)=>{setShowLink(false);setLinkingPackage(null);setNotice({type:"success",text:message});load()}}/>}
  </section>;
}

function PackageForm({userId,pkg,procedures,onClose,onSaved}){
  const initialItems=(pkg?.service_package_items||[]).map(i=>({procedure_id:i.procedure_id||"",procedure_name:i.procedure_name,quantity:Number(i.quantity)||1}));
  const [form,setForm]=useState({name:pkg?.name||"",description:pkg?.description||"",price:pkg?.price??"",validity_days:pkg?.validity_days||"",active:pkg?.active??true});
  const [items,setItems]=useState(initialItems);
  const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const totalSessions=items.reduce((sum,item)=>sum+(Number(item.quantity)||0),0);

  useEffect(()=>{
    if(!items.length&&procedures.length){
      const p=procedures.find(x=>x.active)||procedures[0];
      if(p)setItems([{procedure_id:p.id,procedure_name:p.name,quantity:pkg?.total_sessions||1}]);
    }
  },[procedures]);

  function addItem(){
    const p=procedures.find(x=>x.active&&!items.some(i=>i.procedure_id===x.id))||procedures.find(x=>x.active)||procedures[0];
    if(p)setItems(v=>[...v,{procedure_id:p.id,procedure_name:p.name,quantity:1}]);
  }

  function updateItem(index,key,value){
    setItems(v=>v.map((i,n)=>n===index?{...i,[key]:value,...(key==="procedure_id"?{procedure_name:procedures.find(p=>p.id===value)?.name||"Procedimento"}: {})}:i));
  }

  async function submit(e){
    e.preventDefault();setError("");
    if(!form.name.trim())return setError("Informe o nome do pacote.");
    if(!items.length)return setError("Adicione pelo menos um procedimento.");
    if(items.some(i=>!i.procedure_id))return setError("Selecione o procedimento de cada item.");
    if(totalSessions<1)return setError("O pacote precisa ter pelo menos 1 sessão.");
    setSaving(true);
    const payload={name:form.name.trim(),description:form.description.trim(),total_sessions:totalSessions,price:Number(String(form.price).replace(",","."))||0,validity_days:form.validity_days?Number(form.validity_days):null,active:form.active};
    let result=pkg?await supabase.from("service_packages").update(payload).eq("id",pkg.id).eq("user_id",userId).select().single():await supabase.from("service_packages").insert({...payload,user_id:userId}).select().single();
    if(result.error){setSaving(false);return setError(result.error.message)}
    const packageId=result.data.id;
    if(pkg)await supabase.from("service_package_items").delete().eq("package_id",packageId).eq("user_id",userId);
    const rows=items.map(i=>({package_id:packageId,user_id:userId,procedure_id:i.procedure_id,procedure_name:i.procedure_name,quantity:Number(i.quantity)||1}));
    const ir=await supabase.from("service_package_items").insert(rows);
    setSaving(false);
    if(ir.error)setError(ir.error.message);else onSaved();
  }

  return <div className="modal-backdrop"><div className="modal-card package-modal">
    <div className="modal-header"><div><span>RELACIONAMENTO E FIDELIZAÇÃO</span><h2>{pkg?"Editar pacote":"Novo pacote"}</h2></div><button onClick={onClose}><X size={20}/></button></div>
    <form className="client-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="form-input"><span>Nome *</span><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ex.: Ritual Facial"/></label>
        <label className="form-input"><span>Valor do pacote (R$)</span><input inputMode="decimal" value={form.price} onChange={e=>set("price",e.target.value)} placeholder="450,00"/></label>
        <div className="package-session-summary"><span>SESSÕES DO PACOTE</span><strong>{totalSessions}</strong><small>O total é calculado pela composição abaixo.</small></div>
        <label className="form-input"><span>Validade (dias)</span><input type="number" min="1" value={form.validity_days} onChange={e=>set("validity_days",e.target.value)} placeholder="90"/></label>
      </div>
      <div className="package-items-editor">
        <div className="package-editor-title"><div><span>COMPOSIÇÃO</span><h3>O que a cliente vai realizar</h3><p>Quantidade = número de sessões daquele procedimento.</p></div><button type="button" className="secondary-button compact" onClick={addItem}><Plus size={14}/> Adicionar</button></div>
        <div className="package-item-head"><span>Procedimento</span><span>Sessões</span><span></span></div>
        {items.map((item,index)=><div className="package-item-row" key={`${item.procedure_id}-${index}`}>
          <select value={item.procedure_id} onChange={e=>updateItem(index,"procedure_id",e.target.value)}><option value="">Selecione</option>{procedures.filter(p=>p.active||p.id===item.procedure_id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input aria-label="Quantidade de sessões" type="number" min="1" value={item.quantity} onChange={e=>updateItem(index,"quantity",e.target.value)}/>
          <button type="button" className="danger-button" onClick={()=>setItems(v=>v.filter((_,n)=>n!==index))}><Trash2 size={14}/></button>
        </div>)}
        <div className="package-composition-total"><span>Total de sessões</span><strong>{totalSessions}</strong></div>
      </div>
      <label className="textarea-field"><span>Descrição</span><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows="3" placeholder="O que este pacote oferece?"/></label>
      <label className="service-toggle"><input type="checkbox" checked={form.active} onChange={e=>set("active",e.target.checked)}/><span>Pacote ativo</span></label>
      {error&&<div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving?<span className="button-spinner"/>:<><Check size={16}/> Salvar pacote</>}</button></div>
    </form>
  </div></div>;
}

function PackageLinkModal({userId,pkg,clients,onClose,onSaved}){
  const [clientId,setClientId]=useState("");
  const [purchasedAt,setPurchasedAt]=useState(toInputDate(new Date()));
  const [amount,setAmount]=useState(String(pkg?.price??""));
  const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [existing,setExisting]=useState(false);

  const activeClients=(clients||[]).filter(c=>c.active!==false);

  async function checkExisting(client){
    setClientId(client);
    setError("");
    if(!client){setExisting(false);return;}
    const {data,error:checkError}=await supabase.from("client_packages").select("id,status,used_sessions,total_sessions").eq("user_id",userId).eq("client_id",client).eq("package_id",pkg.id).in("status",["ativo"]);
    if(checkError){setExisting(false);setError(checkError.message);return}
    setExisting(Boolean(data?.length));
  }

  async function submit(e){
    e.preventDefault();setError("");
    if(!clientId)return setError("Selecione uma cliente.");
    if(!pkg?.id)return setError("Pacote inválido.");
    if(pkg.active===false)return setError("Este pacote está inativo e não pode ser vinculado a uma nova cliente.");
    setSaving(true);
    const purchased=new Date(`${purchasedAt}T12:00:00`);
    let expires=null;
    if(pkg.validity_days){purchased.setDate(purchased.getDate()+Number(pkg.validity_days));expires=toInputDate(purchased)}
    const parsedAmount=Number(String(amount).replace(".","").replace(",","."));
    const result=await supabase.from("client_packages").insert({
      user_id:userId,client_id:clientId,package_id:pkg.id,purchased_at:purchasedAt,expires_at:expires,
      total_sessions:Number(pkg.total_sessions)||1,used_sessions:0,amount:Number.isFinite(parsedAmount)?parsedAmount:0,status:"ativo",notes:notes.trim()||null
    }).select("id").single();
    setSaving(false);
    if(result.error){setError(result.error.message);return}
    onSaved(`Pacote ${pkg.name} vinculado à cliente com sucesso.`);
  }

  return <div className="modal-backdrop package-link-modal-layer"><div className="modal-card package-link-modal">
    <div className="modal-header"><div><span>RELACIONAMENTO E FIDELIZAÇÃO</span><h2>Vincular pacote</h2><p className="client-profile-subtitle">{pkg.name} · {pkg.total_sessions} {pkg.total_sessions===1?"sessão":"sessões"}</p></div><button onClick={onClose}><X size={20}/></button></div>
    <div className="package-link-explainer"><Gift size={18}/><div><strong>Contratar pacote para uma cliente</strong><span>Isso libera as sessões para serem usadas e agendadas na Agenda.</span></div></div>
    <form className="client-form" onSubmit={submit}>
      <label className="form-input"><span>Cliente *</span><select value={clientId} onChange={e=>checkExisting(e.target.value)}><option value="">Selecione uma cliente</option>{activeClients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>
      {existing&&<div className="form-warning"><span>Esta cliente já possui um pacote ativo deste tipo. Você pode contratar outro se for uma nova compra.</span></div>}
      <div className="form-grid"><FormInput label="Data da contratação" value={purchasedAt} onChange={setPurchasedAt} type="date"/><FormInput label="Valor pago (R$)" value={amount} onChange={setAmount} inputMode="decimal" placeholder="450,00"/></div>
      <label className="textarea-field"><span>Observações</span><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows="3" placeholder="Ex.: pagamento integral, condições especiais..."/></label>
      {error&&<div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving?<span className="button-spinner"/>:<><Check size={16}/> Confirmar vínculo</>}</button></div>
    </form>
  </div></div>;
}

function FormInput({ label, value, onChange, type = "text", placeholder, inputMode }) {
  return <label className="form-input"><span>{label}</span><input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode} /></label>;
}

function moneyValue(value) { return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }


function InventoryModule({ userId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [showForm, setShowForm] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(null);
  const [movementProduct, setMovementProduct] = useState(null);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [notice, setNotice] = useState(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", userId)
      .order("active", { ascending: false })
      .order("name");
    if (error) setNotice({ type: "error", text: error.message });
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQuery = !q || `${p.name} ${p.category || ""} ${p.brand || ""} ${p.supplier || ""}`.toLowerCase().includes(q);
      const low = Number(p.stock_quantity || 0) <= Number(p.minimum_stock || 0);
      const matchesFilter = filter === "todos" || (filter === "baixo" && low && Number(p.stock_quantity || 0) > 0) || (filter === "zerado" && Number(p.stock_quantity || 0) <= 0) || (filter === "inativos" && p.active === false);
      return matchesQuery && matchesFilter;
    });
  }, [products, query, filter]);

  const stats = useMemo(() => {
    const active = products.filter(p => p.active !== false);
    const low = active.filter(p => Number(p.stock_quantity || 0) > 0 && Number(p.stock_quantity || 0) <= Number(p.minimum_stock || 0)).length;
    const zero = active.filter(p => Number(p.stock_quantity || 0) <= 0).length;
    return { total: active.length, low, zero };
  }, [products]);

  async function toggleActive(product) {
    const { error } = await supabase.from("products").update({ active: !product.active }).eq("id", product.id).eq("user_id", userId);
    if (error) setNotice({ type: "error", text: error.message });
    else { setNotice({ type: "success", text: product.active ? "Produto desativado." : "Produto ativado." }); load(); }
  }

  function stockState(product) {
    const qty = Number(product.stock_quantity || 0);
    const min = Number(product.minimum_stock || 0);
    if (qty <= 0) return { label: "Sem estoque", cls: "zero" };
    if (qty <= min) return { label: "Estoque baixo", cls: "low" };
    return { label: "Normal", cls: "ok" };
  }

  return <section className="inventory-page">
    <div className="module-header"><div><span>CONTROLE OPERACIONAL</span><h1>Estoque</h1><p>Controle produtos, entradas, saídas e níveis de reposição.</p></div><button className="primary-button module-action" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={18} /> Novo produto</button></div>
    {notice && <div className={`module-notice ${notice.type}`}><span>{notice.text}</span><button onClick={() => setNotice(null)}><X size={16} /></button></div>}

    <div className="inventory-metrics">
      <button className="inventory-metric" onClick={() => setFilter("todos")}><Package size={18}/><div><strong>{stats.total}</strong><span>Produtos ativos</span></div></button>
      <button className="inventory-metric low" onClick={() => setFilter("baixo")}><TrendingDown size={18}/><div><strong>{stats.low}</strong><span>Estoque baixo</span></div></button>
      <button className="inventory-metric zero" onClick={() => setFilter("zerado")}><PackageCheck size={18}/><div><strong>{stats.zero}</strong><span>Sem estoque</span></div></button>
    </div>

    <div className="service-toolbar inventory-toolbar"><div className="client-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar produto, marca ou fornecedor..." /></div><select value={filter} onChange={e => setFilter(e.target.value)}><option value="todos">Todos</option><option value="baixo">Estoque baixo</option><option value="zerado">Sem estoque</option><option value="inativos">Inativos</option></select><span className="client-count">{filtered.length} {filtered.length === 1 ? "produto" : "produtos"}</span></div>

    {loading ? <div className="loading-panel"><span className="button-spinner dark"/>Carregando estoque...</div> : filtered.length ? <div className="inventory-grid">{filtered.map(product => {
      const state = stockState(product);
      return <article className={`inventory-card ${product.active === false ? "inactive" : ""}`} key={product.id}>
        <div className="inventory-card-top"><div className="inventory-icon"><Package size={18}/></div><span className={`inventory-status ${state.cls}`}>{state.label}</span></div>
        <div className="inventory-title-row"><div><h3>{product.name}</h3><span>{[product.brand, product.category].filter(Boolean).join(" · ") || "Sem categoria"}</span></div><strong>{Number(product.stock_quantity || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} <small>{product.unit || "un"}</small></strong></div>
        <div className="inventory-level"><div><span>Estoque</span><b>{Number(product.stock_quantity || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {product.unit || "un"}</b></div><div><span>Mínimo</span><b>{Number(product.minimum_stock || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {product.unit || "un"}</b></div></div>
        <div className="inventory-meta"><span>Custo {moneyValue(product.cost_price)}</span>{product.expiry_date ? <span>Validade {formatDate(product.expiry_date)}</span> : <span>Sem validade</span>}</div>
        <div className="inventory-actions"><button onClick={() => { setMovementProduct(product); setShowMovement(true); }}><ArrowRight size={14}/> Movimentar</button><button onClick={() => { sethistoryProductSafe(setHistoryProduct, product); setShowHistory(true); }}><Eye size={14}/> Histórico</button><button onClick={() => { setEditing(product); setShowForm(true); }}><Edit3 size={14}/> Editar</button><button onClick={() => toggleActive(product)}>{product.active ? "Desativar" : "Ativar"}</button></div>
      </article>;
    })}</div> : <div className="empty-clients"><div className="empty-icon"><Package size={32}/></div><h2>{products.length ? "Nenhum produto encontrado" : "Seu estoque está vazio"}</h2><p>{products.length ? "Ajuste os filtros ou pesquise outro produto." : "Cadastre seus produtos para começar a controlar entradas e saídas."}</p><button className="primary-button compact" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={17}/> Cadastrar produto</button></div>}

    {showForm && <ProductForm userId={userId} product={editing} onClose={() => setShowForm(false)} onSaved={(message) => { setShowForm(false); setNotice({ type: "success", text: message }); load(); }} />}
    {showMovement && movementProduct && <InventoryMovementModal userId={userId} product={movementProduct} onClose={() => { setShowMovement(false); setMovementProduct(null); }} onSaved={(message) => { setShowMovement(false); setMovementProduct(null); setNotice({ type: "success", text: message }); load(); }} />}
    {showHistory && historyProduct && <InventoryHistoryModal userId={userId} product={historyProduct} onClose={() => { setShowHistory(false); setHistoryProduct(null); }} />}
  </section>;
}

function sethistoryProductSafe(setter, product) { setter(product); }

function ProductForm({ userId, product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product?.name || "", category: product?.category || "", brand: product?.brand || "", unit: product?.unit || "un",
    minimum_stock: product?.minimum_stock ?? 0, initial_stock: product ? "" : "0", cost_price: product?.cost_price ?? "", reference_price: product?.reference_price ?? "",
    supplier: product?.supplier || "", lot: product?.lot || "", expiry_date: product?.expiry_date || "", notes: product?.notes || "", active: product?.active ?? true
  });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  async function submit(e) {
    e.preventDefault(); setError("");
    if (!form.name.trim()) return setError("Informe o nome do produto.");
    const min = Number(String(form.minimum_stock).replace(",", ".")) || 0;
    const cost = Number(String(form.cost_price).replace(",", ".")) || 0;
    const ref = Number(String(form.reference_price).replace(",", ".")) || 0;
    const initial = Number(String(form.initial_stock).replace(",", ".")) || 0;
    if (min < 0 || initial < 0 || cost < 0 || ref < 0) return setError("Os valores não podem ser negativos.");
    setSaving(true);
    const payload = { name: form.name.trim(), category: form.category.trim() || null, brand: form.brand.trim() || null, unit: form.unit, minimum_stock: min, cost_price: cost, reference_price: ref, supplier: form.supplier.trim() || null, lot: form.lot.trim() || null, expiry_date: form.expiry_date || null, notes: form.notes.trim() || null, active: form.active };
    if (product) {
      const result = await supabase.from("products").update(payload).eq("id", product.id).eq("user_id", userId);
      setSaving(false); if (result.error) setError(result.error.message); else onSaved("Produto atualizado."); return;
    }
    const result = await supabase.from("products").insert({ ...payload, user_id: userId, stock_quantity: 0 }).select("id").single();
    if (result.error) { setSaving(false); setError(result.error.message); return; }
    if (initial > 0) {
      const movement = await supabase.from("inventory_movements").insert({ user_id: userId, product_id: result.data.id, movement_type: "entrada", quantity: initial, reason: "Estoque inicial" });
      if (movement.error) { setSaving(false); setError(movement.error.message); return; }
    }
    setSaving(false); onSaved("Produto cadastrado.");
  }
  return <div className="modal-backdrop"><div className="modal-card inventory-modal">
    <div className="modal-header"><div><span>CONTROLE OPERACIONAL</span><h2>{product ? "Editar produto" : "Novo produto"}</h2></div><button onClick={onClose}><X size={20}/></button></div>
    <form className="client-form" onSubmit={submit}>
      <div className="form-grid"><FormInput label="Nome *" value={form.name} onChange={v => set("name", v)} placeholder="Ex.: Sérum facial"/><FormInput label="Categoria" value={form.category} onChange={v => set("category", v)} placeholder="Facial, corporal..."/><FormInput label="Marca" value={form.brand} onChange={v => set("brand", v)} placeholder="Marca do produto"/><label className="form-input"><span>Unidade *</span><select value={form.unit} onChange={e => set("unit", e.target.value)}><option value="un">Unidade</option><option value="ml">Mililitro (ml)</option><option value="l">Litro (l)</option><option value="g">Grama (g)</option><option value="kg">Quilograma (kg)</option><option value="cx">Caixa</option><option value="kit">Kit</option></select></label><FormInput label="Estoque mínimo" value={form.minimum_stock} onChange={v => set("minimum_stock", v)} type="number" inputMode="decimal" placeholder="0"/><FormInput label={product ? "Estoque atual" : "Estoque inicial"} value={product ? Number(product.stock_quantity || 0) : form.initial_stock} onChange={v => set("initial_stock", v)} type="number" inputMode="decimal" placeholder="0"/><FormInput label="Custo de aquisição (R$)" value={form.cost_price} onChange={v => set("cost_price", v)} inputMode="decimal" placeholder="0,00"/><FormInput label="Preço de referência (R$)" value={form.reference_price} onChange={v => set("reference_price", v)} inputMode="decimal" placeholder="0,00"/></div>
      {product && <div className="form-warning">O estoque atual é alterado em <strong>Movimentar</strong>, mantendo o histórico de entradas e saídas.</div>}
      <div className="form-grid"><FormInput label="Fornecedor" value={form.supplier} onChange={v => set("supplier", v)} placeholder="Nome do fornecedor"/><FormInput label="Lote" value={form.lot} onChange={v => set("lot", v)} placeholder="Número do lote"/><FormInput label="Validade" value={form.expiry_date} onChange={v => set("expiry_date", v)} type="date"/></div>
      <label className="textarea-field"><span>Observações</span><textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows="3" placeholder="Informações adicionais..."/></label>
      <label className="service-toggle"><input type="checkbox" checked={form.active} onChange={e => set("active", e.target.checked)}/><span>Produto ativo</span></label>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? <span className="button-spinner"/> : <><Check size={16}/> Salvar produto</>}</button></div>
    </form>
  </div></div>;
}

function InventoryMovementModal({ userId, product, onClose, onSaved }) {
  const [type, setType] = useState("entrada"); const [quantity, setQuantity] = useState(""); const [unitCost, setUnitCost] = useState(product?.cost_price ?? ""); const [reason, setReason] = useState(""); const [notes, setNotes] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const qty = Number(String(quantity).replace(",", ".")) || 0; const current = Number(product?.stock_quantity || 0); const projected = type === "entrada" ? current + qty : current - qty;
  async function submit(e) {
    e.preventDefault(); setError("");
    if (qty <= 0) return setError("Informe uma quantidade maior que zero.");
    if (type === "saida" && qty > current) return setError("A quantidade de saída é maior que o estoque disponível.");
    setSaving(true);
    const { error: movementError } = await supabase.from("inventory_movements").insert({ user_id: userId, product_id: product.id, movement_type: type, quantity: qty, unit_cost: Number(String(unitCost).replace(",", ".")) || 0, reason: reason.trim() || null, notes: notes.trim() || null });
    setSaving(false); if (movementError) setError(movementError.message); else onSaved(type === "entrada" ? "Entrada registrada." : "Saída registrada.");
  }
  return <div className="modal-backdrop"><div className="modal-card inventory-movement-modal"><div className="modal-header"><div><span>MOVIMENTAÇÃO DE ESTOQUE</span><h2>{product.name}</h2><p className="client-profile-subtitle">Atual: {current.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {product.unit || "un"}</p></div><button onClick={onClose}><X size={20}/></button></div>
    <form className="client-form" onSubmit={submit}><div className="movement-type-grid"><button type="button" className={type === "entrada" ? "active" : ""} onClick={() => setType("entrada")}><ArrowDownIcon/><span>Entrada</span><small>Adicionar ao estoque</small></button><button type="button" className={type === "saida" ? "active" : ""} onClick={() => setType("saida")}><TrendingDown size={18}/><span>Saída</span><small>Retirar do estoque</small></button></div><div className="form-grid"><FormInput label={`Quantidade (${product.unit || "un"}) *`} value={quantity} onChange={setQuantity} type="number" inputMode="decimal" placeholder="0"/><FormInput label="Custo unitário (R$)" value={unitCost} onChange={setUnitCost} inputMode="decimal" placeholder="0,00"/></div><div className="movement-projection"><span>Estoque após movimentação</span><strong className={projected < 0 ? "negative" : ""}>{projected.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {product.unit || "un"}</strong></div><FormInput label="Motivo" value={reason} onChange={setReason} placeholder={type === "entrada" ? "Compra, reposição..." : "Uso, perda, vencimento..."}/><label className="textarea-field"><span>Observações</span><textarea value={notes} onChange={e => setNotes(e.target.value)} rows="3" placeholder="Detalhes da movimentação..."/></label>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={saving}>{saving ? <span className="button-spinner"/> : <><Check size={16}/> Confirmar movimentação</>}</button></div></form>
  </div></div>;
}
function ArrowDownIcon(){ return <TrendingUp size={18}/>; }

function InventoryHistoryModal({ userId, product, onClose }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { (async () => { const { data, error } = await supabase.from("inventory_movements").select("*").eq("user_id", userId).eq("product_id", product.id).order("created_at", { ascending: false }).limit(80); if (error) setError(error.message); setItems(data || []); setLoading(false); })(); }, [userId, product.id]);
  return <div className="modal-backdrop"><div className="modal-card inventory-history-modal"><div className="modal-header"><div><span>HISTÓRICO DO ESTOQUE</span><h2>{product.name}</h2></div><button onClick={onClose}><X size={20}/></button></div>{loading ? <div className="loading-panel">Carregando histórico...</div> : error ? <div className="form-error">{error}</div> : items.length ? <div className="inventory-history-list">{items.map(item => <div className="inventory-history-row" key={item.id}><div className={`inventory-history-icon ${item.movement_type}`}><Package size={15}/></div><div><strong>{item.movement_type === "entrada" ? "Entrada" : "Saída"}</strong><span>{item.reason || "Movimentação"} · {formatDate(item.created_at)}</span></div><b className={item.movement_type === "entrada" ? "entry" : "exit"}>{item.movement_type === "entrada" ? "+" : "−"}{Number(item.quantity).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {product.unit || "un"}</b></div>)}</div> : <div className="client-empty-inline">Nenhuma movimentação registrada.</div>}<div className="modal-actions"><button className="secondary-button" onClick={onClose}>Fechar</button></div></div></div>;
}


function ReportsModule({ userId, onNavigate }) {
  const today = toInputDate(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const [preset, setPreset] = useState("30");
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const end = new Date(`${today}T12:00:00`);
    let start = new Date(end);
    if (preset === "7") start.setDate(start.getDate() - 6);
    else if (preset === "30") start.setDate(start.getDate() - 29);
    else if (preset === "90") start.setDate(start.getDate() - 89);
    else if (preset === "year") start = new Date(end.getFullYear(), 0, 1, 12);
    if (preset !== "custom") {
      setStartDate(toInputDate(start));
      setEndDate(today);
    }
  }, [preset, today]);

  useEffect(() => {
    if (!startDate || !endDate || startDate > endDate) return;
    let mounted = true;
    async function load() {
      setLoading(true); setError("");
      const [financeRes, appointmentsRes, clientsRes, productsRes, movementsRes] = await Promise.all([
        supabase.from("financial_transactions").select("id,type,amount,status,transaction_date,category,client_id,appointment_id,description").eq("user_id", userId).gte("transaction_date", startDate).lte("transaction_date", endDate).order("transaction_date", { ascending: false }),
        supabase.from("appointments").select("id,client_id,appointment_date,status,procedure_name,procedure_id").eq("user_id", userId).gte("appointment_date", startDate).lte("appointment_date", endDate).order("appointment_date", { ascending: false }),
        supabase.from("clients").select("id,full_name,created_at").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("products").select("id,name,unit,stock_quantity,minimum_stock,cost_price,active").eq("user_id", userId).order("name"),
        supabase.from("inventory_movements").select("id,product_id,movement_type,quantity,created_at,reason,appointment_id").eq("user_id", userId).gte("created_at", `${startDate}T00:00:00`).lte("created_at", `${endDate}T23:59:59`).order("created_at", { ascending: false }),
      ]);
      const failed = [financeRes, appointmentsRes, clientsRes, productsRes, movementsRes].find((r) => r.error);
      if (!mounted) return;
      if (failed) { setError(failed.error.message); setLoading(false); return; }

      const finance = financeRes.data || [];
      const appointments = appointmentsRes.data || [];
      const clients = clientsRes.data || [];
      const products = productsRes.data || [];
      const movements = movementsRes.data || [];
      const paidFinance = finance.filter((x) => x.status === "pago");
      const receitas = paidFinance.filter((x) => x.type === "receita").reduce((s, x) => s + Number(x.amount || 0), 0);
      const despesas = paidFinance.filter((x) => x.type === "despesa").reduce((s, x) => s + Number(x.amount || 0), 0);
      const pendentes = finance.filter((x) => x.status === "pendente").reduce((s, x) => s + Number(x.amount || 0), 0);
      const receitaCount = paidFinance.filter((x) => x.type === "receita").length;
      const completed = appointments.filter((x) => x.status === "Concluído");
      const canceled = appointments.filter((x) => x.status === "Cancelado").length;
      const missed = appointments.filter((x) => x.status === "Faltou").length;
      const newClients = clients.filter((x) => String(x.created_at || "").slice(0, 10) >= startDate && String(x.created_at || "").slice(0, 10) <= endDate).length;
      const clientMap = new Map(clients.map((x) => [x.id, x.full_name]));
      const appointmentMap = new Map(appointments.map((x) => [x.id, x]));
      const procedureMap = new Map();
      completed.forEach((a) => {
        const name = a.procedure_name || "Sem procedimento";
        const item = procedureMap.get(name) || { name, count: 0, revenue: 0 };
        item.count += 1; procedureMap.set(name, item);
      });
      paidFinance.filter((x) => x.type === "receita" && x.appointment_id).forEach((tx) => {
        const appt = appointmentMap.get(tx.appointment_id);
        const name = appt?.procedure_name || tx.description || "Outras receitas";
        const item = procedureMap.get(name) || { name, count: 0, revenue: 0 };
        item.revenue += Number(tx.amount || 0); procedureMap.set(name, item);
      });
      const procedures = [...procedureMap.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count).slice(0, 8);
      const lowStock = products.filter((p) => p.active && Number(p.stock_quantity || 0) <= Number(p.minimum_stock || 0));
      const zeroStock = products.filter((p) => p.active && Number(p.stock_quantity || 0) <= 0);
      const stockEntries = movements.filter((x) => x.movement_type === "entrada").reduce((s, x) => s + Number(x.quantity || 0), 0);
      const stockExits = movements.filter((x) => x.movement_type === "saida").reduce((s, x) => s + Number(x.quantity || 0), 0);
      const consumptionMap = new Map();
      movements.filter((x) => x.movement_type === "saida").forEach((m) => consumptionMap.set(m.product_id, (consumptionMap.get(m.product_id) || 0) + Number(m.quantity || 0)));
      const mostConsumed = [...consumptionMap.entries()].map(([id, quantity]) => ({ name: products.find((p) => p.id === id)?.name || "Produto", quantity, unit: products.find((p) => p.id === id)?.unit || "un" })).sort((a, b) => b.quantity - a.quantity).slice(0, 6);

      const completedByClient = new Map();
      completed.forEach((a) => {
        if (!a.client_id) return;
        const current = completedByClient.get(a.client_id);
        if (!current || a.appointment_date > current) completedByClient.set(a.client_id, a.appointment_date);
      });
      const endTs = new Date(`${endDate}T23:59:59`).getTime();
      const retention = clients.map((client) => ({ id: client.id, name: client.full_name, last: completedByClient.get(client.id) || null })).filter((client) => client.last && endTs - new Date(`${client.last}T12:00:00`).getTime() >= 45 * 86400000).sort((a, b) => a.last.localeCompare(b.last)).slice(0, 8);

      setData({ receitas, despesas, resultado: receitas - despesas, pendentes, ticket: receitaCount ? receitas / receitaCount : 0, appointments: appointments.length, completed: completed.length, canceled, missed, newClients, procedures, lowStock, zeroStock, stockEntries, stockExits, mostConsumed, retention, clientMap });
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [userId, startDate, endDate, today]);

  const money = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const number = (value) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const periodLabel = startDate && endDate ? `${formatDate(startDate)} — ${formatDate(endDate)}` : "Período";

  return <div className="reports-page">
    <section className="module-header reports-header"><div><span>GESTÃO & INTELIGÊNCIA</span><h1>Relatórios</h1><p>Uma visão consolidada da operação, clientes, procedimentos e estoque.</p></div><div className="reports-period"><CalendarDays size={16}/><strong>{periodLabel}</strong></div></section>
    <div className="reports-toolbar panel">
      <div className="reports-presets">{[["7","7 dias"],["30","30 dias"],["90","90 dias"],["year","Este ano"],["custom","Personalizado"]].map(([value,label]) => <button key={value} className={preset === value ? "active" : ""} onClick={() => setPreset(value)}>{label}</button>)}</div>
      {preset === "custom" && <div className="reports-custom-dates"><label><span>Início</span><input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)}/></label><span>até</span><label><span>Fim</span><input type="date" value={endDate} min={startDate} max={today} onChange={(e) => setEndDate(e.target.value)}/></label></div>}
    </div>
    {error && <div className="form-error reports-error">Não foi possível carregar os relatórios: {error}</div>}
    {loading ? <div className="loading-panel">Consolidando seus dados...</div> : data && <>
      <section className="reports-metrics">
        <ReportMetric icon={CircleDollarSign} label="Receitas pagas" value={money(data.receitas)} detail={`${data.completed} atendimentos concluídos`} />
        <ReportMetric icon={TrendingDown} label="Despesas pagas" value={money(data.despesas)} detail="No período selecionado" />
        <ReportMetric icon={Wallet} label="Resultado" value={money(data.resultado)} detail="Receitas menos despesas" tone={data.resultado < 0 ? "negative" : "positive"} />
        <ReportMetric icon={ReceiptText} label="Ticket médio" value={money(data.ticket)} detail="Por receita paga" />
        <ReportMetric icon={UsersRound} label="Novos clientes" value={data.newClients} detail="Cadastros no período" />
        <ReportMetric icon={CalendarDays} label="Atendimentos" value={data.appointments} detail={`${data.canceled} cancelados · ${data.missed} faltas`} />
      </section>
      <section className="reports-grid">
        <div className="panel report-panel report-procedures"><ReportPanelTitle icon={Sparkles} title="Procedimentos" subtitle="Volume e receita gerada" />{data.procedures.length ? <div className="report-list">{data.procedures.map((item) => <div className="report-row" key={item.name}><div className="report-row-main"><strong>{item.name}</strong><span>{item.count} atendimento{item.count === 1 ? "" : "s"}</span></div><div className="report-row-value"><b>{money(item.revenue)}</b><small>{data.completed ? Math.round((item.count / data.completed) * 100) : 0}%</small></div></div>)}</div> : <ReportEmpty text="Ainda não há atendimentos concluídos no período."/>}</div>
        <div className="panel report-panel"><ReportPanelTitle icon={PackageCheck} title="Estoque" subtitle="Movimentações e alertas atuais" /><div className="report-stock-summary"><div><span>Entradas</span><strong>+{number(data.stockEntries)}</strong></div><div><span>Saídas</span><strong>−{number(data.stockExits)}</strong></div><div className="warning"><span>Estoque baixo</span><strong>{data.lowStock.length}</strong></div><div className="danger"><span>Sem estoque</span><strong>{data.zeroStock.length}</strong></div></div>{data.mostConsumed.length ? <><div className="report-subtitle">Mais consumidos</div><div className="report-list">{data.mostConsumed.map((item) => <div className="report-row" key={item.name}><div className="report-row-main"><strong>{item.name}</strong><span>Consumo no período</span></div><div className="report-row-value"><b>{number(item.quantity)} {item.unit}</b></div></div>)}</div></> : <ReportEmpty text="Nenhuma saída de estoque no período."/>}</div>
        <div className="panel report-panel"><ReportPanelTitle icon={UsersRound} title="Clientes" subtitle="Aquisição e retorno" /><div className="report-client-stats"><div><strong>{data.newClients}</strong><span>novos</span></div><div><strong>{data.completed}</strong><span>atendimentos</span></div><div><strong>{data.retention.length}</strong><span>sem retorno 45d+</span></div></div><div className="report-subtitle">Clientes para acompanhar</div>{data.retention.length ? <div className="report-list">{data.retention.map((item) => <div className="report-row" key={item.id}><div className="report-row-main"><strong>{item.name}</strong><span>Último atendimento: {formatDate(item.last)}</span></div><div className="report-row-value"><small>45d+</small></div></div>)}</div> : <ReportEmpty text="Nenhum cliente com retorno pendente há 45 dias ou mais."/>}</div>
        <div className="panel report-panel"><ReportPanelTitle icon={CircleDollarSign} title="Financeiro" subtitle="Resumo do período" /><div className="report-finance-list"><div><span>Receitas</span><strong className="positive">{money(data.receitas)}</strong></div><div><span>Despesas</span><strong>{money(data.despesas)}</strong></div><div><span>Resultado</span><strong className={data.resultado < 0 ? "negative" : "positive"}>{money(data.resultado)}</strong></div><div><span>Valores pendentes</span><strong className="pending">{money(data.pendentes)}</strong></div></div><button className="outline-button" onClick={() => onNavigate("financeiro")}>Abrir Financeiro <ArrowRight size={15}/></button></div>
      </section>
    </>}
  </div>;
}

function ReportMetric({ icon: Icon, label, value, detail, tone = "" }) { return <div className={`report-metric ${tone}`}><div className="report-metric-icon"><Icon size={17}/></div><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>; }
function ReportPanelTitle({ icon: Icon, title, subtitle }) { return <div className="report-panel-title"><div><Icon size={17}/><div><h3>{title}</h3><span>{subtitle}</span></div></div></div>; }
function ReportEmpty({ text }) { return <div className="report-empty"><BarChart3 size={20}/><span>{text}</span></div>; }


function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function RemindersModule({ userId }) {
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [business, setBusiness] = useState({ whatsapp: "", whatsapp_birthday_template: "" });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [permission, setPermission] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const [birthdayTemplate, setBirthdayTemplate] = useState("Olá, {nome_cliente}! 💚🎂 Hoje é um dia especial! Desejo a você muita saúde, alegria e realizações neste novo ciclo. Obrigada pela confiança no meu trabalho. Será sempre um prazer cuidar de você! 🌿 Com carinho, {nome_profissional}.");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const today = toInputDate(new Date());
  const addDays = (value, days) => { const d = new Date(`${value}T12:00:00`); d.setDate(d.getDate() + days); return toInputDate(d); };
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, 7);
  const dateLabel = (value) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));

  async function load() {
    setLoading(true);
    const [a, c, b] = await Promise.all([
      supabase.from("appointments").select("id, appointment_date, start_time, procedure_name, status, client_id, clients(full_name, phone)").eq("user_id", userId).gte("appointment_date", today).lte("appointment_date", tomorrow).order("appointment_date", { ascending: true }).order("start_time", { ascending: true }),
      supabase.from("clients").select("id, full_name, phone, birth_date, active").eq("user_id", userId).not("birth_date", "is", null).order("full_name", { ascending: true }),
      supabase.from("business_settings").select("whatsapp, whatsapp_birthday_template, business_name").eq("user_id", userId).maybeSingle(),
    ]);
    if (a.error) setNotice({ type: "error", text: `Não foi possível carregar a agenda: ${a.error.message}` });
    if (c.error) setNotice({ type: "error", text: `Não foi possível carregar os aniversários: ${c.error.message}` });
    setAppointments(a.data || []); setClients(c.data || []);
    setBusiness(b.data || { whatsapp: "", whatsapp_birthday_template: "" });
    if (b.data?.whatsapp_birthday_template) setBirthdayTemplate(b.data.whatsapp_birthday_template);
    setLoading(false);
  }
  useEffect(() => { load(); }, [userId]);

  const birthdays = useMemo(() => {
    const start = new Date(`${today}T12:00:00`);
    const days = [];
    for (let i = 0; i <= 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      days.push({ key: `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`, date: toInputDate(d), offset: i });
    }
    return clients.filter(c => c.birth_date && c.active !== false).map(c => {
      const birth = String(c.birth_date).slice(5, 10);
      const match = days.find(d => d.key === birth);
      return match ? { ...c, birthdayDate: match.date, offset: match.offset } : null;
    }).filter(Boolean).sort((a,b) => a.offset-b.offset || a.full_name.localeCompare(b.full_name, "pt-BR"));
  }, [clients, today]);
  const todaysAppointments = appointments.filter(a => a.appointment_date === today && !["Cancelado", "Faltou"].includes(a.status));
  const tomorrowsAppointments = appointments.filter(a => a.appointment_date === tomorrow && !["Cancelado", "Faltou"].includes(a.status));
  const birthdayCount = birthdays.filter(c => c.offset === 0).length;

  async function enableNotifications() {
    if (!("Notification" in window)) { setNotice({ type: "error", text: "Este navegador não oferece notificações do dispositivo." }); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setNotice({ type: "error", text: "Este navegador não oferece Web Push. Atualize o navegador ou instale o EsteticPro na tela inicial do celular." }); return; }
    try {
      const result = await Notification.requestPermission(); setPermission(result);
      if (result !== "granted") { setNotice({ type: "error", text: "Permissão não concedida. Libere as notificações nas configurações do navegador e tente novamente." }); return; }
      const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!publicKey) { setNotice({ type: "error", text: "Falta configurar VITE_VAPID_PUBLIC_KEY na Vercel. A permissão foi concedida, mas a inscrição Push não foi criada." }); return; }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("O navegador não retornou os dados necessários para a inscrição Push.");
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth_secret: json.keys.auth,
        user_agent: navigator.userAgent, updated_at: new Date().toISOString()
      }, { onConflict: "user_id,endpoint" });
      if (error) throw error;
      await registration.showNotification("EsteticPro ativado 💚", { body: "Este dispositivo está inscrito para receber lembretes automáticos.", icon: "/icon-192.png", badge: "/icon-192.png", tag: "esteticpro-push-enabled" });
      setNotice({ type: "success", text: "Dispositivo inscrito no Push. A entrega automática depende também da Edge Function e do agendador estarem configurados no Supabase." });
    } catch (e) { setNotice({ type: "error", text: e.message || "Não foi possível ativar as notificações neste dispositivo." }); }
  }
  function openBirthdayWhatsApp(client) {
    if (!client.phone) { setNotice({ type: "error", text: `Cadastre o telefone de ${client.full_name} para abrir o WhatsApp.` }); return; }
    const firstName = String(client.full_name || "Cliente").trim().split(/\s+/)[0];
    const professional = business.business_name || "sua esteticista";
    const message = String(birthdayTemplate).replace(/\{nome_cliente\}/g, firstName).replace(/\{nome_profissional\}/g, professional).replace(/\{data\}/g, dateLabel(client.birthdayDate));
    const phone = normalizeBrazilPhone(client.phone);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }
  async function saveBirthdayTemplate() {
    setSavingTemplate(true); setNotice(null);
    const { error } = await supabase.from("business_settings").upsert({ user_id: userId, whatsapp: business.whatsapp || null, whatsapp_birthday_template: birthdayTemplate, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSavingTemplate(false);
    setNotice(error ? { type: "error", text: `Não foi possível salvar o modelo: ${error.message}` } : { type: "success", text: "Mensagem de aniversário salva para esta conta." });
  }

  return <div className="module-page reminders-page">
    <div className="module-header"><div><span>ROTINA PROFISSIONAL</span><h1>Lembretes</h1><p>Seus atendimentos e aniversários organizados em um só lugar.</p></div><button className="secondary-button" onClick={load}><ArrowRight size={16}/> Atualizar</button></div>
    {notice && <div className={`settings-notice ${notice.type}`}>{notice.text}</div>}
    <section className="reminder-permission panel"><div className="reminder-permission-copy"><div className="reminder-icon"><BellRing size={22}/></div><div><h3>Notificações deste dispositivo</h3><p>{permission === "granted" ? "Permissão concedida neste navegador." : permission === "denied" ? "Bloqueadas pelo navegador. Altere a permissão nas configurações do site." : "Ative as notificações para receber avisos quando estiver usando o EsteticPro."}</p></div></div>{permission !== "granted" && permission !== "denied" && permission !== "unsupported" && <button className="primary-button compact" onClick={enableNotifications}>Ativar notificações</button>}{permission === "granted" && <button className="secondary-button" onClick={enableNotifications}>Testar notificação</button>}</section>
    <div className="reminder-stats"><article className="metric-card"><div className="metric-icon"><CalendarDays size={18}/></div><strong>{todaysAppointments.length}</strong><span>Atendimentos hoje</span></article><article className="metric-card"><div className="metric-icon"><CalendarClock size={18}/></div><strong>{tomorrowsAppointments.length}</strong><span>Atendimentos amanhã</span></article><article className="metric-card"><div className="metric-icon"><Cake size={18}/></div><strong>{birthdayCount}</strong><span>Aniversários hoje</span></article></div>
    <div className="reminder-columns"><section className="panel"><div className="panel-title"><div><CalendarClock size={19}/><h3>Agenda de hoje e amanhã</h3></div><button onClick={() => window.scrollTo({top:0,behavior:"smooth"})}>Atualizado</button></div>{loading ? <div className="empty-state">Carregando...</div> : [...todaysAppointments, ...tomorrowsAppointments].map(a => <div className="reminder-row" key={a.id}><time>{a.appointment_date === today ? "Hoje" : "Amanhã"}<strong>{formatTime(a.start_time)}</strong></time><div><strong>{a.clients?.full_name || "Cliente"}</strong><span>{a.procedure_name || "Atendimento"} · {dateLabel(a.appointment_date)}</span></div><span className="status">{a.status}</span></div>)}{!loading && !todaysAppointments.length && !tomorrowsAppointments.length && <div className="empty-state">Nenhum atendimento previsto para hoje ou amanhã.</div>}<p className="reminder-note">O resumo do dia anterior e do próprio dia fica disponível aqui. Os avisos automáticos fora do app dependem da configuração do serviço Push.</p></section>
    <section className="panel"><div className="panel-title"><div><Cake size={19}/><h3>Aniversários próximos</h3></div><span className="reminder-pill">Próximos 7 dias</span></div>{loading ? <div className="empty-state">Carregando...</div> : birthdays.map(c => <div className="reminder-row birthday-row" key={c.id}><div className="birthday-avatar"><Cake size={17}/></div><div className="birthday-person"><strong>{c.full_name}</strong><span>{c.offset === 0 ? "Aniversário hoje" : c.offset === 1 ? "Amanhã" : dateLabel(c.birthdayDate)}</span></div><button className="secondary-button compact" onClick={() => openBirthdayWhatsApp(c)}><MessageCircle size={15}/> WhatsApp</button></div>)}{!loading && !birthdays.length && <div className="empty-state">Nenhum aniversário nos próximos 7 dias.</div>}</section></div>
    <section className="panel birthday-template-panel"><div className="panel-title"><div><MessageCircle size={19}/><h3>Mensagem de aniversário</h3></div><span className="reminder-pill">Padrão editável</span></div><p className="reminder-note">Cada profissional tem seu próprio modelo. O envio é manual e abre o WhatsApp com a mensagem preenchida.</p><textarea className="form-input birthday-template" value={birthdayTemplate} onChange={e => setBirthdayTemplate(e.target.value)} rows={5}/><div className="template-tokens"><span>{"{nome_cliente}"}</span><span>{"{nome_profissional}"}</span><span>{"{data}"}</span></div><div className="modal-actions"><button className="secondary-button" onClick={() => setBirthdayTemplate("Olá, {nome_cliente}! 💚🎂 Hoje é um dia especial! Desejo a você muita saúde, alegria e realizações neste novo ciclo. Obrigada pela confiança no meu trabalho. Será sempre um prazer cuidar de você! 🌿 Com carinho, {nome_profissional}.")}>Restaurar padrão</button><button className="primary-button" onClick={saveBirthdayTemplate} disabled={savingTemplate}>{savingTemplate ? "Salvando..." : <><Save size={16}/> Salvar mensagem</>}</button></div></section>
  </div>;
}

function ComingSoon({ title, onBack }) { return <div className="coming-soon"><BrandMark /><span>Módulo</span><h1>{title}</h1><p>Esta área está preparada na navegação. A próxima etapa será conectar este módulo aos fluxos reais do EsteticPro.</p><button className="primary-button compact" onClick={onBack}><ArrowLeft size={17} /> Voltar ao Dashboard</button></div>; }
function getMonthRange(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1, 12);
  const end = new Date(year, month + 1, 0, 12);
  return { start: toInputDate(start), end: toInputDate(end) };
}
function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date).replace(/^./, (c) => c.toUpperCase());
}
function getMonthCalendarCells(date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  const mondayIndex = (first.getDay() + 6) % 7;
  const totalCells = Math.ceil((mondayIndex + last.getDate()) / 7) * 7;
  return Array.from({ length: totalCells }, (_, index) => {
    const cellDate = new Date(date.getFullYear(), date.getMonth(), 1 + index - mondayIndex, 12);
    return {
      date: toInputDate(cellDate),
      day: cellDate.getDate(),
      inMonth: cellDate.getMonth() === date.getMonth(),
    };
  });
}
function toInputDate(date) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {}); return `${parts.year}-${parts.month}-${parts.day}`; }
function formatLongDate(value) { const date = new Date(`${value}T12:00:00`); return { weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date).replace(/^./, (c) => c.toUpperCase()), full: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date) }; }
function formatTime(value) { return value ? String(value).slice(0, 5) : "--:--"; }
function slugify(value = "") { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"); }

function formatCurrentDate() { const now = new Date(); return { weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(now).replace(/^./, (c) => c.toUpperCase()), date: new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(now) }; }
function formatDate(value) { if (!value) return "Não informado"; const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value); if (Number.isNaN(date.getTime())) return value; return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date); }
function initials(name = "") { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "EP"; }

export default App;
