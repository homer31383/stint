import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ============================================================
// FREELANCE MANAGER v2
// Light theme · Service-based rates · Day-level invoicing
// ============================================================

const uid = () => crypto.randomUUID().slice(0, 8);
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtWhole = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDateShort = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDateFull = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const toISO = (d) => new Date(d).toISOString().split("T")[0];
const todayISO = () => toISO(new Date());
const fmtTimer = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
};
const daysBetween = (a, b) => {
  const d1 = new Date(a + "T12:00:00"), d2 = new Date(b + "T12:00:00");
  return Math.round((d2 - d1) / 86400000) + 1;
};
const getDatesInRange = (start, end) => {
  const dates = [];
  let d = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  while (d <= e) { dates.push(toISO(d)); d.setDate(d.getDate() + 1); }
  return dates;
};

// ============================================================
// THEME — Clean light mode
// ============================================================
const t = {
  bg: "#f8f7f4",
  surface: "#ffffff",
  surfaceAlt: "#f2f1ee",
  border: "#e5e3de",
  borderLight: "#eeece8",
  text: "#1a1a1a",
  textSecondary: "#5c5b57",
  textTertiary: "#9c9a94",
  accent: "#1a1a1a",
  accentSoft: "rgba(26,26,26,0.06)",
  white: "#ffffff",
  black: "#1a1a1a",
  green: "#2d8a4e",
  greenBg: "rgba(45,138,78,0.08)",
  greenBorder: "rgba(45,138,78,0.18)",
  red: "#c53030",
  redBg: "rgba(197,48,48,0.06)",
  yellow: "#b7791f",
  yellowBg: "rgba(183,121,31,0.08)",
  blue: "#2b6cb0",
  blueBg: "rgba(43,108,176,0.06)",
};

const SERVICE_TYPES = [
  { id: "day_rate", label: "Day Rate", defaultRate: 1200 },
  { id: "shoot_attend", label: "Shoot Attend", defaultRate: 1500 },
  { id: "hourly", label: "Hourly", defaultRate: 150 },
  { id: "overtime", label: "Overtime", defaultRate: 187.5 },
  { id: "expense", label: "Expense", defaultRate: 0 },
];

const PENCIL_PRIORITY = {
  0: { label: "Booked", color: t.blue, bg: t.blueBg, border: "rgba(43,108,176,0.2)" },
  1: { label: "1st Pencil", color: t.green, bg: t.greenBg, border: t.greenBorder },
  2: { label: "2nd Pencil", color: t.yellow, bg: t.yellowBg, border: `rgba(183,121,31,0.18)` },
  3: { label: "3rd Pencil", color: t.red, bg: t.redBg, border: `rgba(197,48,48,0.15)` },
};

const INVOICE_STATUS = {
  draft: { label: "Draft", color: t.textTertiary, bg: t.surfaceAlt },
  sent: { label: "Sent", color: t.blue, bg: t.blueBg },
  paid: { label: "Paid", color: t.green, bg: t.greenBg },
  overdue: { label: "Overdue", color: t.red, bg: t.redBg },
};

const DEFAULT_SETTINGS = {
  businessName: "Chris Bernier",
  businessEmail: "chris@chrisbernier.com",
  businessPhone: "413-219-9595",
  businessAddress: "162 Adelphi St Apt 2D\nBrooklyn NY 11205",
  bankName: "Santander Bank",
  routing: "231372691",
  accountNumber: "0116041492",
  invoicePrefix: "CB",
  nextInvoiceNumber: 2,
  paymentTerms: 30,
  hideDollars: true,
  serviceRates: {
    day_rate: 1200,
    shoot_attend: 1500,
    hourly: 150,
    overtime: 187.5,
    expense: 0,
  },
};

const PERSONAL_PROJECT_ID = "__personal__";
const PROJECT_STATUS = {
  active: { label: "Active", color: "#2d8a4e", bg: "#dbeee2" },
  on_hold: { label: "On Hold", color: "#b7791f", bg: "#f5ead6" },
  complete: { label: "Complete", color: "#9c9a94", bg: "#f2f1ee" },
};
const PERSONAL_CLIENT_ID = "__personal_client__";

// ============================================================
// STORAGE
// ============================================================
const load = (k, fb) => { try { const d = localStorage.getItem("fm2-" + k); return d ? JSON.parse(d) : fb; } catch { return fb; } };
const save = (k, d) => localStorage.setItem("fm2-" + k, JSON.stringify(d));

// ============================================================
// COMPONENTS
// ============================================================
function Btn({ children, onClick, v = "default", size = "md", disabled = false, style = {} }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: "5px",
    border: "none", cursor: disabled ? "default" : "pointer",
    fontFamily: "'Instrument Sans', sans-serif", fontWeight: 550,
    borderRadius: "7px", whiteSpace: "nowrap", opacity: disabled ? 0.4 : 1,
    transition: "all 0.12s ease", letterSpacing: "-0.01em",
  };
  const sizes = { sm: { padding: "5px 9px", fontSize: "12px" }, md: { padding: "7px 13px", fontSize: "13px" }, lg: { padding: "9px 17px", fontSize: "14px" } };
  const variants = {
    default: { background: t.white, color: t.text, border: `1px solid ${t.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
    primary: { background: t.black, color: t.white, border: `1px solid ${t.black}` },
    ghost: { background: "transparent", color: t.textSecondary, border: "none", padding: sizes[size].padding },
    danger: { background: t.redBg, color: t.red, border: `1px solid rgba(197,48,48,0.15)` },
    green: { background: t.greenBg, color: t.green, border: `1px solid ${t.greenBorder}` },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[v], ...style }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.8"; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = disabled ? "0.4" : "1"; }}
    >{children}</button>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, style = {}, min, max, step, readOnly }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", ...style }}>
      {label && <label style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSecondary, letterSpacing: "0.01em" }}>{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} readOnly={readOnly}
        placeholder={placeholder} min={min} max={max} step={step}
        style={{
          background: t.white, border: `1px solid ${t.border}`, borderRadius: "7px",
          padding: "8px 11px", color: t.text, fontSize: "13px",
          fontFamily: "'Instrument Sans', sans-serif", outline: "none",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)", transition: "border 0.12s",
        }}
        onFocus={e => e.target.style.borderColor = t.textTertiary}
        onBlur={e => e.target.style.borderColor = t.border}
      />
    </div>
  );
}

function Sel({ label, value, onChange, options, style = {} }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", ...style }}>
      {label && <label style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSecondary, letterSpacing: "0.01em" }}>{label}</label>}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          background: t.white, border: `1px solid ${t.border}`, borderRadius: "7px",
          padding: "8px 11px", color: t.text, fontSize: "13px",
          fontFamily: "'Instrument Sans', sans-serif", outline: "none",
          appearance: "none", cursor: "pointer", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239c9a94' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center",
        }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      {label && <label style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSecondary, letterSpacing: "0.01em" }}>{label}</label>}
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        style={{
          background: t.white, border: `1px solid ${t.border}`, borderRadius: "7px",
          padding: "8px 11px", color: t.text, fontSize: "13px",
          fontFamily: "'Instrument Sans', sans-serif", outline: "none", resize: "vertical",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
        }}
        onFocus={e => e.target.style.borderColor = t.textTertiary}
        onBlur={e => e.target.style.borderColor = t.border}
      />
    </div>
  );
}

function Tag({ children, color = t.textSecondary, bg, border }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "2px 8px",
      borderRadius: "5px", fontSize: "11px", fontWeight: 600,
      color, background: bg || `${color}10`,
      border: border ? `1px solid ${border}` : "none",
      letterSpacing: "0.01em",
    }}>{children}</span>
  );
}

function Modal({ title, onClose, children, width = 500 }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.2)", backdropFilter: "blur(3px)",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.white, border: `1px solid ${t.border}`,
        borderRadius: "14px", width: `min(${width}px, 94vw)`,
        maxHeight: "88vh", overflow: "auto", padding: "24px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: t.text, letterSpacing: "-0.02em" }}>{title}</h3>
          <button onClick={onClose} style={{ background: t.surfaceAlt, border: "none", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", color: t.textTertiary, cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Empty({ title, sub, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 20px", color: t.textTertiary }}>
      <div style={{ fontSize: "14px", fontWeight: 600, color: t.textSecondary, marginBottom: "5px" }}>{title}</div>
      <div style={{ fontSize: "13px", marginBottom: "18px" }}>{sub}</div>
      {action}
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{
      background: t.white, border: `1px solid ${t.border}`,
      borderRadius: "10px", padding: "16px 18px", flex: 1, minWidth: "140px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
    }}>
      <div style={{ fontSize: "11px", fontWeight: 650, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "7px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 750, color: color || t.text, letterSpacing: "-0.02em", fontFamily: "'Instrument Sans', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: t.textTertiary, marginTop: "3px" }}>{sub}</div>}
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [clients, setClients] = useState(() => load("clients", []));
  const [projects, setProjects] = useState(() => load("projects", []));
  const [pencils, setPencils] = useState(() => load("pencils", []));
  const [timeEntries, setTimeEntries] = useState(() => load("time", []));
  const [invoices, setInvoices] = useState(() => load("invoices", []));
  const [settings, setSettings] = useState(() => load("settings", DEFAULT_SETTINGS));
  const [activeTimer, setActiveTimer] = useState(() => load("timer", null));
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => { save("clients", clients); }, [clients]);
  useEffect(() => { save("projects", projects); }, [projects]);
  useEffect(() => { save("pencils", pencils); }, [pencils]);
  useEffect(() => { save("time", timeEntries); }, [timeEntries]);
  useEffect(() => { save("invoices", invoices); }, [invoices]);
  useEffect(() => { save("settings", settings); }, [settings]);
  useEffect(() => { save("timer", activeTimer); }, [activeTimer]);

  // Ensure Personal project always exists
  useEffect(() => {
    if (!projects.find(p => p.id === PERSONAL_PROJECT_ID)) {
      setProjects(prev => [...prev, { id: PERSONAL_PROJECT_ID, clientId: PERSONAL_CLIENT_ID, name: "Personal", notes: "", createdAt: Date.now() }]);
    }
  }, []);

  // Ensure every client has an Internal Meeting project
  useEffect(() => {
    const missing = clients.filter(c => c.id !== PERSONAL_CLIENT_ID && !projects.some(p => p.clientId === c.id && p.name === "Internal Meeting"));
    if (missing.length > 0) {
      const newProjects = missing.map(c => ({ id: uid(), clientId: c.id, name: "Internal Meeting", notes: "", createdAt: Date.now() }));
      setProjects(prev => [...prev, ...newProjects]);
    }
  }, [clients]);

  useEffect(() => {
    if (!activeTimer) return;
    const tick = () => setElapsed(Math.floor((Date.now() - activeTimer.startTime) / 1000));
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [activeTimer]);

  const startTimer = (projectId, serviceType = "day_rate") => setActiveTimer({ projectId, serviceType, startTime: Date.now() });
  const stopTimer = () => {
    if (!activeTimer) return;
    const hours = Math.round(((Date.now() - activeTimer.startTime) / 3600000) * 100) / 100;
    const proj = projects.find(p => p.id === activeTimer.projectId);
    const client = proj ? clients.find(c => c.id === proj.clientId) : null;
    const rate = getRate(client, activeTimer.serviceType);
    const amount = activeTimer.serviceType === "hourly" || activeTimer.serviceType === "overtime"
      ? Math.round(hours * rate * 100) / 100
      : rate; // day rate / shoot attend = flat
    setTimeEntries(prev => [{
      id: uid(), projectId: activeTimer.projectId, date: todayISO(),
      serviceType: activeTimer.serviceType, hours, rate, amount,
      notes: "", createdAt: Date.now(),
    }, ...prev]);
    setActiveTimer(null);
    setElapsed(0);
  };

  const getRate = (client, serviceType) => {
    if (client?.serviceRates?.[serviceType] !== undefined && client.serviceRates[serviceType] !== null) {
      return client.serviceRates[serviceType];
    }
    return settings.serviceRates?.[serviceType] ?? SERVICE_TYPES.find(s => s.id === serviceType)?.defaultRate ?? 0;
  };

  const getClient = (id) => clients.find(c => c.id === id);
  const getProject = (id) => projects.find(p => p.id === id);

  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "time", label: "Time" },
    { id: "pencils", label: "Bookings" },
    { id: "invoices", label: "Invoices" },
    { id: "clients", label: "Clients" },
    { id: "reports", label: "Reports" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div style={{ fontFamily: "'Instrument Sans', sans-serif", background: t.bg, color: t.text, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;550;600;700&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <header style={{
        background: t.white, borderBottom: `1px solid ${t.border}`,
        padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "52px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{ fontSize: "15px", fontWeight: 750, color: t.text, letterSpacing: "-0.03em" }}>Freelance Manager</span>
          <nav style={{ display: "flex", gap: "2px" }}>
            {navItems.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)} style={{
                padding: "6px 12px", border: "none", borderRadius: "6px", cursor: "pointer",
                fontFamily: "'Instrument Sans', sans-serif", fontSize: "13px",
                fontWeight: tab === n.id ? 650 : 450,
                color: tab === n.id ? t.text : t.textTertiary,
                background: tab === n.id ? t.surfaceAlt : "transparent",
                transition: "all 0.12s",
              }}
                onMouseEnter={e => { if (tab !== n.id) e.currentTarget.style.color = t.textSecondary; }}
                onMouseLeave={e => { if (tab !== n.id) e.currentTarget.style.color = t.textTertiary; }}
              >{n.label}</button>
            ))}
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: "auto", padding: "28px 32px", maxWidth: "1100px", width: "100%", margin: "0 auto" }}>
        {tab === "dashboard" && <Dashboard {...{clients, projects, pencils, timeEntries, setTimeEntries, invoices, settings, setTab, getClient, getProject, getRate}} />}
        {tab === "time" && <Time {...{timeEntries, setTimeEntries, projects, clients, settings, activeTimer, startTimer, stopTimer, elapsed, getClient, getProject, getRate}} />}
        {tab === "pencils" && <Pencils {...{pencils, setPencils, projects, setProjects, clients, setClients, getClient, getProject, settings}} />}
        {tab === "invoices" && <Invoices {...{invoices, setInvoices, timeEntries, projects, clients, settings, setSettings, getClient, getProject}} />}
        {tab === "clients" && <Clients {...{clients, setClients, projects, setProjects, settings, timeEntries, pencils, invoices, getClient, getProject, getRate}} />}
        {tab === "reports" && <Reports {...{timeEntries, projects, clients, invoices, settings, getClient, getProject}} />}
        {tab === "settings" && <Settings {...{settings, setSettings, clients, projects, pencils, timeEntries, invoices}} />}
      </main>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
        select option { background: ${t.white}; color: ${t.text}; }
      `}</style>
    </div>
  );
}

// ============================================================
// DASHBOARD
// ============================================================
function Dashboard({ clients, projects, pencils, timeEntries, setTimeEntries, invoices, settings, setTab, getClient, getProject, getRate }) {
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthEntries = timeEntries.filter(e => e.date.startsWith(thisMonth));
  const monthRevenue = monthEntries.reduce((s, e) => s + (e.amount || 0), 0);
  const monthDays = monthEntries.filter(e => e.serviceType !== "hourly" && e.serviceType !== "overtime" && e.serviceType !== "expense").length;
  const unpaid = invoices.filter(i => i.status === "sent" || i.status === "overdue");
  const outstanding = unpaid.reduce((s, i) => s + i.total, 0);
  const upcoming = pencils.filter(p => p.endDate >= todayISO()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const booked = upcoming.filter(p => p.priority === 0);
  const hide = settings.hideDollars;

  // Quick-add: log a full day for a project
  const [quickProj, setQuickProj] = useState("");
  const activeProjects = projects.filter(p => p.id !== PERSONAL_PROJECT_ID && p.status !== "complete");

  const quickLogDay = () => {
    if (!quickProj) return;
    const proj = getProject(quickProj);
    const client = proj ? getClient(proj.clientId) : null;
    const rate = getRate(client, "day_rate");
    const amountPerHour = rate / 8;
    const entries = [];
    for (let h = 9; h < 17; h++) {
      entries.push({
        id: uid(), projectId: quickProj, date: todayISO(), hour: h,
        serviceType: "day_rate", hours: 1, rate,
        amount: Math.round(amountPerHour * 100) / 100,
        notes: "", createdAt: Date.now(),
      });
    }
    setTimeEntries(prev => [...entries, ...prev]);
    setQuickProj("");
  };

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 750, letterSpacing: "-0.03em", marginBottom: "22px" }}>Dashboard</h2>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
        <Stat label="This Month" value={hide ? `${monthDays} days` : fmt(monthRevenue)} sub={hide ? "" : `${monthDays} days worked`} color={t.green} />
        <Stat label="Outstanding" value={hide ? `${unpaid.length} invoices` : fmt(outstanding)} sub={hide ? "" : `${unpaid.length} unpaid`} color={outstanding > 0 ? t.yellow : t.textTertiary} />
        <Stat label="Upcoming" value={upcoming.length} sub={`${booked.length} booked`} />
        <Stat label="Clients" value={clients.length} sub={`${projects.length} projects`} />
      </div>

      {/* Quick log */}
      {activeProjects.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px",
          padding: "12px 16px", background: t.white, border: `1px solid ${t.border}`,
          borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        }}>
          <span style={{ fontSize: "12px", fontWeight: 650, color: t.textTertiary, whiteSpace: "nowrap" }}>Quick log today:</span>
          <select value={quickProj} onChange={ev => setQuickProj(ev.target.value)}
            style={{
              flex: 1, padding: "7px 10px", borderRadius: "6px", border: `1px solid ${t.border}`,
              fontSize: "13px", fontFamily: "'Instrument Sans', sans-serif", color: t.text,
              background: t.white, outline: "none",
            }}>
            <option value="">Select project...</option>
            {activeProjects.map(p => {
              const c = getClient(p.clientId);
              return <option key={p.id} value={p.id}>{c?.name} — {p.name}</option>;
            })}
          </select>
          <Btn v="primary" size="sm" onClick={quickLogDay} disabled={!quickProj}>Log Full Day</Btn>
          <Btn v="ghost" size="sm" onClick={() => setTab("time")}>Open Timesheet</Btn>
        </div>
      )}

      <Section title="Upcoming Bookings & Pencils" action={<Btn v="ghost" size="sm" onClick={() => setTab("pencils")}>View all &rarr;</Btn>}>
        {upcoming.length === 0 ? <Muted>No upcoming bookings</Muted> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {upcoming.slice(0, 5).map(p => {
              const proj = getProject(p.projectId);
              const client = proj ? getClient(proj.clientId) : null;
              const pri = PENCIL_PRIORITY[p.priority];
              const days = daysBetween(p.startDate, p.endDate);
              return (
                <Row key={p.id}>
                  <Tag color={pri.color} bg={pri.bg} border={pri.border}>{pri.label}</Tag>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: t.text }}>{client?.name}</span>
                  <span style={{ fontSize: "13px", color: t.textSecondary }}>· {proj?.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: "12px", color: t.textTertiary, fontFamily: "monospace" }}>
                    {fmtDateShort(p.startDate)} – {fmtDateShort(p.endDate)} ({days}d)
                  </span>
                </Row>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Recent Time" collapsible defaultOpen={false} action={<Btn v="ghost" size="sm" onClick={() => setTab("time")}>View all →</Btn>}>
        {timeEntries.length === 0 ? <Muted>No time logged yet</Muted> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {timeEntries.slice(0, 6).map(e => {
              const proj = getProject(e.projectId);
              const client = proj ? getClient(proj.clientId) : null;
              const svc = SERVICE_TYPES.find(s => s.id === e.serviceType);
              return (
                <Row key={e.id}>
                  <span style={{ fontSize: "12px", color: t.textTertiary, fontFamily: "monospace", minWidth: "65px" }}>{fmtDateShort(e.date)}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: t.text }}>{client?.name || "—"}</span>
                  <span style={{ fontSize: "13px", color: t.textSecondary }}>· {proj?.name || "—"}</span>
                  <Tag color={t.textSecondary}>{svc?.label || e.serviceType}</Tag>
                  {!hide && <span style={{ marginLeft: "auto", fontSize: "13px", fontFamily: "monospace", fontWeight: 650, color: t.green }}>{fmt(e.amount)}</span>}
                </Row>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, action, children, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: "26px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: open ? "10px" : "0" }}>
        <h3
          onClick={collapsible ? () => setOpen(o => !o) : undefined}
          style={{
            fontSize: "12px", fontWeight: 700, color: t.textTertiary, textTransform: "uppercase",
            letterSpacing: "0.04em", cursor: collapsible ? "pointer" : "default",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
          {collapsible && <span style={{ fontSize: "10px", transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>&#9654;</span>}
          {title}
        </h3>
        {action}
      </div>
      {open && children}
    </div>
  );
}

function Row({ children, onClick, style = {} }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "11px 15px", background: t.white,
      border: `1px solid ${t.border}`, borderRadius: "8px",
      cursor: onClick ? "pointer" : "default",
      transition: "border-color 0.12s", ...style,
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = t.textTertiary; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = t.border; }}
    >{children}</div>
  );
}

function Muted({ children }) {
  return <div style={{ fontSize: "13px", color: t.textTertiary, padding: "16px 0" }}>{children}</div>;
}

// ============================================================
// TIME TRACKING
// ============================================================
function Time({ timeEntries, setTimeEntries, projects, clients, settings, activeTimer, startTimer, stopTimer, elapsed, getClient, getProject, getRate }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [activeProject, setActiveProject] = useState(null); // { projectId, serviceType }
  const [selectedClient, setSelectedClient] = useState(""); // filter projects by client
  const [noteModal, setNoteModal] = useState(null); // { entryIds, date, startHour, endHour, projectId }
  const [noteText, setNoteText] = useState("");
  const [undoStack, setUndoStack] = useState([]); // previous timeEntries snapshots

  const pushUndo = () => setUndoStack(prev => [...prev.slice(-19), timeEntries]);
  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setTimeEntries(prev);
  };

  // Cmd+Z / Ctrl+Z undo
  useEffect(() => {
    const handler = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); undo(); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Week (Mon-Sun)
  const weekDates = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() + weekOffset * 7);
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((day + 6) % 7));
    const dates = [];
    for (let i = 0; i < 7; i++) { const d = new Date(mon); d.setDate(mon.getDate() + i); dates.push(toISO(d)); }
    return dates;
  }, [weekOffset]);

  const weekLabel = useMemo(() => {
    const s = new Date(weekDates[0] + "T12:00:00"), e = new Date(weekDates[6] + "T12:00:00");
    const sM = s.toLocaleDateString("en-US", { month: "short" }), eM = e.toLocaleDateString("en-US", { month: "short" });
    return sM === eM ? `${sM} ${s.getDate()} - ${e.getDate()}, ${s.getFullYear()}` : `${sM} ${s.getDate()} - ${eM} ${e.getDate()}, ${s.getFullYear()}`;
  }, [weekDates]);

  const isThisWeek = weekOffset === 0;
  const isTodayDate = (d) => d === todayISO();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
  const fmtHour = (h) => { const p = h >= 12 ? "p" : "a"; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12}${p}`; };
  const fmtHourLong = (h) => { const p = h >= 12 ? "pm" : "am"; const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h; return `${h12} ${p}`; };

  const weekEntries = useMemo(() => timeEntries.filter(e => weekDates.includes(e.date)), [timeEntries, weekDates]);
  const weekHours = weekEntries.length;

  const hourMap = useMemo(() => {
    const m = {};
    weekEntries.forEach(e => { m[`${e.date}::${e.hour}`] = e; });
    return m;
  }, [weekEntries]);

  const getEntry = (date, hour) => hourMap[`${date}::${hour}`] || null;
  const dayTotalHrs = (d) => weekEntries.filter(e => e.date === d).length;

  // Filtered projects by selected client
  const filteredProjects = useMemo(() => {
    const filtered = selectedClient
      ? projects.filter(p => p.clientId === selectedClient && p.status !== "complete")
      : projects.filter(p => p.id !== PERSONAL_PROJECT_ID && p.status !== "complete");
    return filtered;
  }, [projects, selectedClient]);

  // Colors per project
  const PERSONAL_COLOR = { bg: "#e8e5f0", border: "#c4bdd9", text: "#5b4a7a", dot: "#7c6c9a" };
  const projectColors = useMemo(() => {
    const colors = [
      { bg: "#dbeee2", border: "#a3d9b5", text: "#1a6b35", dot: "#2d8a4e" },
      { bg: "#dbe8f5", border: "#a3c4e0", text: "#1d5a99", dot: "#2b6cb0" },
      { bg: "#f5ead6", border: "#e0c99a", text: "#8a5c0f", dot: "#b7791f" },
      { bg: "#ece0f7", border: "#cdb0e8", text: "#6b21a8", dot: "#8b5cf6" },
      { bg: "#fce0ec", border: "#f0a8c8", text: "#9d174d", dot: "#ec4899" },
      { bg: "#d5f0ed", border: "#9ae0d8", text: "#0d7377", dot: "#14b8a6" },
      { bg: "#fde5d3", border: "#f5b88a", text: "#c2410c", dot: "#f97316" },
    ];
    const m = {}; let idx = 0;
    m[PERSONAL_PROJECT_ID] = PERSONAL_COLOR;
    projects.filter(p => p.id !== PERSONAL_PROJECT_ID).forEach(p => { m[p.id] = colors[idx % colors.length]; idx++; });
    return m;
  }, [projects]);

  const clickCell = (date, hour) => {
    const existing = getEntry(date, hour);
    if (existing) {
      deleteEntry(existing.id);
      return;
    }
    if (!activeProject) return;
    fillCell(date, hour, activeProject.projectId, activeProject.serviceType);
  };

  const fillCell = (date, hour, projectId, serviceType) => {
    pushUndo();
    const proj = getProject(projectId);
    const client = proj ? getClient(proj.clientId) : null;
    const rate = getRate(client, serviceType);
    const isHourBased = serviceType === "hourly" || serviceType === "overtime";
    const amount = isHourBased ? rate : rate / 8;
    setTimeEntries(prev => [{
      id: uid(), projectId, date, hour,
      serviceType, hours: 1, rate,
      amount: Math.round(amount * 100) / 100,
      notes: "", createdAt: Date.now(),
    }, ...prev]);
  };

  const deleteEntry = (id) => { pushUndo(); setTimeEntries(prev => prev.filter(e => e.id !== id)); };

  // Batch fill
  const [showBatch, setShowBatch] = useState(false);
  const [batchForm, setBatchForm] = useState({ projectId: "", serviceType: "day_rate", date: todayISO(), startHour: 9, endHour: 17 });

  const fillBatch = () => {
    if (!batchForm.projectId) return;
    pushUndo();
    const proj = getProject(batchForm.projectId);
    const client = proj ? getClient(proj.clientId) : null;
    const rate = getRate(client, batchForm.serviceType);
    const isHourBased = batchForm.serviceType === "hourly" || batchForm.serviceType === "overtime";
    const amountPerHour = isHourBased ? rate : rate / 8;
    const entries = [];
    for (let h = batchForm.startHour; h < batchForm.endHour; h++) {
      if (!getEntry(batchForm.date, h)) {
        entries.push({
          id: uid(), projectId: batchForm.projectId, date: batchForm.date, hour: h,
          serviceType: batchForm.serviceType, hours: 1, rate,
          amount: Math.round(amountPerHour * 100) / 100,
          notes: "", createdAt: Date.now(),
        });
      }
    }
    setTimeEntries(prev => [...entries, ...prev]);
    setShowBatch(false);
  };

  const copyLastWeek = () => {
    // Get last week's dates
    const lastWeekDates = weekDates.map(d => {
      const dt = new Date(d + "T12:00:00");
      dt.setDate(dt.getDate() - 7);
      return toISO(dt);
    });
    const lastWeekEntries = timeEntries.filter(e => lastWeekDates.includes(e.date));
    if (lastWeekEntries.length === 0) return;
    pushUndo();
    const newEntries = lastWeekEntries.map(e => {
      const oldIdx = lastWeekDates.indexOf(e.date);
      const newDate = weekDates[oldIdx];
      // Skip if this cell is already filled
      if (getEntry(newDate, e.hour)) return null;
      return { ...e, id: uid(), date: newDate, createdAt: Date.now(), notes: "" };
    }).filter(Boolean);
    if (newEntries.length > 0) setTimeEntries(prev => [...newEntries, ...prev]);
  };

  // Group consecutive same-project hours
  const weekSummary = useMemo(() => {
    const byDate = {};
    weekEntries.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });
    const groups = [];
    Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).forEach(([date, entries]) => {
      entries.sort((a, b) => (a.hour || 0) - (b.hour || 0));
      let current = null;
      entries.forEach(e => {
        if (current && current.projectId === e.projectId && current.serviceType === e.serviceType && e.hour === current.endHour) {
          current.endHour = e.hour + 1;
          current.totalHours++;
          current.totalAmount += e.amount;
          current.entryIds.push(e.id);
          if (e.notes && !current.notes) current.notes = e.notes;
        } else {
          if (current) groups.push(current);
          current = {
            date, projectId: e.projectId, serviceType: e.serviceType,
            startHour: e.hour, endHour: e.hour + 1,
            totalHours: 1, totalAmount: e.amount, rate: e.rate,
            entryIds: [e.id], notes: e.notes || "",
          };
        }
      });
      if (current) groups.push(current);
    });
    return groups;
  }, [weekEntries]);

  // Block info for merged rendering
  const getBlockInfo = (date, hour) => {
    const entry = getEntry(date, hour);
    if (!entry) return null;
    const prev = getEntry(date, hour - 1);
    if (prev && prev.projectId === entry.projectId && prev.serviceType === entry.serviceType) {
      return { entry, isStart: false };
    }
    let span = 1;
    let nextH = hour + 1;
    while (nextH <= 22) {
      const next = getEntry(date, nextH);
      if (next && next.projectId === entry.projectId && next.serviceType === entry.serviceType) { span++; nextH++; }
      else break;
    }
    return { entry, isStart: true, span };
  };

  // Open notes modal for a block
  const openNotes = (date, startHour, span, projectId, serviceType) => {
    const entryIds = [];
    let existingNote = "";
    for (let h = startHour; h < startHour + span; h++) {
      const e = getEntry(date, h);
      if (e) {
        entryIds.push(e.id);
        if (e.notes && !existingNote) existingNote = e.notes;
      }
    }
    setNoteText(existingNote);
    setNoteModal({ entryIds, date, startHour, endHour: startHour + span, projectId });
  };

  const saveNotes = () => {
    if (!noteModal) return;
    pushUndo();
    setTimeEntries(prev => prev.map(e =>
      noteModal.entryIds.includes(e.id) ? { ...e, notes: noteText } : e
    ));
    setNoteModal(null);
    setNoteText("");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 750, letterSpacing: "-0.03em" }}>Timesheet</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Btn v="ghost" size="sm" onClick={() => setWeekOffset(w => w - 1)}>&#8592;</Btn>
          <Btn v={isThisWeek ? "primary" : "default"} size="sm" onClick={() => setWeekOffset(0)}>This Week</Btn>
          <Btn v="ghost" size="sm" onClick={() => setWeekOffset(w => w + 1)}>&#8594;</Btn>
        </div>
      </div>

      {/* Project selector bar */}
      <div style={{
        background: t.white, border: `1px solid ${t.border}`, borderRadius: "10px",
        padding: "12px 16px", marginBottom: "14px",
        display: "flex", flexDirection: "column", gap: "10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.04em", minWidth: "48px" }}>Project</span>
          {clients.length === 0 && projects.length <= 1 ? (
            <span style={{ fontSize: "12px", color: t.textTertiary }}>Add a client &amp; project first</span>
          ) : (
            <>
              {/* Personal button — always visible */}
              {(() => {
                const isActive = activeProject?.projectId === PERSONAL_PROJECT_ID;
                return (
                  <button
                    onClick={() => setActiveProject(isActive ? null : { projectId: PERSONAL_PROJECT_ID, serviceType: "day_rate" })}
                    style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      padding: "5px 10px", borderRadius: "6px", cursor: "pointer",
                      background: isActive ? PERSONAL_COLOR.bg : t.surfaceAlt,
                      border: `1.5px solid ${isActive ? PERSONAL_COLOR.border : t.borderLight}`,
                      color: isActive ? PERSONAL_COLOR.text : t.textSecondary,
                      fontSize: "12px", fontWeight: isActive ? 700 : 500,
                      fontFamily: "'Instrument Sans', sans-serif",
                      transition: "all 0.1s",
                      boxShadow: isActive ? `0 0 0 2px ${PERSONAL_COLOR.border}` : "none",
                    }}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: PERSONAL_COLOR.dot, flexShrink: 0 }} />
                    Personal
                  </button>
                );
              })()}

              <div style={{ width: "1px", height: "20px", background: t.border, flexShrink: 0 }} />

              <Sel value={selectedClient}
                onChange={v => { setSelectedClient(v); setActiveProject(null); }}
                options={[{value: "", label: "All clients"}, ...clients.map(c => ({value: c.id, label: c.name}))]}
                style={{ minWidth: "140px" }}
              />
              {filteredProjects.map(p => {
                const client = getClient(p.clientId);
                const pc = projectColors[p.id];
                if (!pc) return null;
                const isActive = activeProject?.projectId === p.id;
                return (
                  <button key={p.id}
                    onClick={() => setActiveProject(isActive ? null : { projectId: p.id, serviceType: "day_rate" })}
                    style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      padding: "5px 10px", borderRadius: "6px", cursor: "pointer",
                      background: isActive ? pc.bg : t.surfaceAlt,
                      border: `1.5px solid ${isActive ? pc.border : t.borderLight}`,
                      color: isActive ? pc.text : t.textSecondary,
                      fontSize: "12px", fontWeight: isActive ? 700 : 500,
                      fontFamily: "'Instrument Sans', sans-serif",
                      transition: "all 0.1s",
                      boxShadow: isActive ? `0 0 0 2px ${pc.border}` : "none",
                    }}
                  >
                    <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: pc.dot, flexShrink: 0 }} />
                    {!selectedClient && <span style={{ opacity: 0.6 }}>{client?.name} &middot;</span>}
                    {p.name}
                  </button>
                );
              })}
            </>
          )}
        </div>
        {activeProject && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingLeft: "56px" }}>
            <Sel value={activeProject.serviceType}
              onChange={v => setActiveProject({...activeProject, serviceType: v})}
              options={SERVICE_TYPES.filter(s => s.id !== "expense").map(s => ({value: s.id, label: s.label}))}
              style={{ minWidth: "130px" }}
            />
            <Btn size="sm" onClick={() => setShowBatch(true)}>Fill Range</Btn>
            <Btn size="sm" onClick={copyLastWeek}>Copy Last Week</Btn>
            {undoStack.length > 0 && (
              <Btn v="ghost" size="sm" onClick={undo} style={{ fontSize: "11px" }}>&#8617; Undo</Btn>
            )}
            <span style={{ fontSize: "12px", color: t.textTertiary, marginLeft: "auto" }}>{weekHours}h this week</span>
          </div>
        )}
      </div>

      {!activeProject && projects.length > 0 && (
        <div style={{ fontSize: "12px", color: t.textTertiary, marginBottom: "10px", padding: "0 2px" }}>
          Select a project above, then click hour cells to fill them. Click filled cells to clear.
        </div>
      )}

      {/* HOUR GRID */}
      <div style={{ background: t.white, border: `1px solid ${t.border}`, borderRadius: "12px", overflow: "auto", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", minWidth: "660px" }}>
          <div style={{ padding: "6px", borderBottom: `1px solid ${t.border}`, borderRight: `1px solid ${t.borderLight}`, background: t.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: t.textSecondary, textTransform: "uppercase", letterSpacing: "0.02em" }}>
              {new Date(weekDates[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
            </span>
          </div>
          {weekDates.map((d, i) => {
            const dateObj = new Date(d + "T12:00:00");
            const isWknd = i >= 5;
            const dh = dayTotalHrs(d);
            return (
              <div key={d} style={{
                padding: "7px 4px", textAlign: "center",
                borderBottom: `1px solid ${t.border}`,
                borderRight: i < 6 ? `1px solid ${t.borderLight}` : "none",
                background: isTodayDate(d) ? t.greenBg : isWknd ? t.surfaceAlt : "transparent",
              }}>
                <div style={{ fontSize: "10px", fontWeight: 600, color: isTodayDate(d) ? t.green : isWknd ? t.textTertiary : t.textSecondary }}>{dayNames[i]}</div>
                <div style={{ fontSize: "14px", fontWeight: isTodayDate(d) ? 750 : 650, color: isTodayDate(d) ? t.green : t.text }}>{dateObj.getDate()}</div>
                {dh > 0 && <div style={{ fontSize: "9px", color: t.textTertiary, marginTop: "1px" }}>{dh}h</div>}
              </div>
            );
          })}

          {HOURS.map(hour => {
            const rowCells = [];
            rowCells.push(
              <div key={`label-${hour}`} style={{
                padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center",
                borderRight: `1px solid ${t.borderLight}`, borderBottom: `1px solid ${t.borderLight}`,
                background: t.surfaceAlt, height: "34px",
              }}>
                <span style={{ fontSize: "10px", fontWeight: 600, color: t.textTertiary, fontFamily: "monospace" }}>{fmtHour(hour)}</span>
              </div>
            );

            weekDates.forEach((d, di) => {
              const blockInfo = getBlockInfo(d, hour);
              const isWknd = di >= 5;

              if (blockInfo && !blockInfo.isStart) return;

              if (blockInfo && blockInfo.isStart) {
                const e = blockInfo.entry;
                const proj = getProject(e.projectId);
                const client = proj ? getClient(proj.clientId) : null;
                const svc = SERVICE_TYPES.find(s => s.id === e.serviceType);
                const pc = projectColors[e.projectId] || { bg: t.surfaceAlt, border: t.border, text: t.textSecondary, dot: t.textTertiary };
                const span = blockInfo.span;
                // Check if block has notes
                let blockNote = "";
                for (let bh = hour; bh < hour + span; bh++) {
                  const be = getEntry(d, bh);
                  if (be?.notes) { blockNote = be.notes; break; }
                }
                rowCells.push(
                  <div key={`${d}-${hour}`} style={{
                    gridRow: `span ${span}`,
                    borderRight: di < 6 ? `1px solid ${t.borderLight}` : "none",
                    borderBottom: `1px solid ${t.borderLight}`,
                    padding: "1px",
                    background: isTodayDate(d) ? "rgba(45,138,78,0.02)" : "transparent",
                  }}>
                    <div
                      onClick={() => openNotes(d, hour, span, e.projectId, e.serviceType)}
                      style={{
                        background: pc.bg, border: `1px solid ${pc.border}`,
                        borderRadius: "4px", height: "100%",
                        padding: span >= 2 ? "3px 6px" : "1px 6px",
                        display: "flex", flexDirection: "column", justifyContent: "center",
                        overflow: "hidden", cursor: "pointer",
                        transition: "opacity 0.1s", position: "relative",
                      }}
                      onMouseEnter={ev => { ev.currentTarget.style.opacity = "0.85"; const x = ev.currentTarget.querySelector('.block-x'); if (x) x.style.opacity = '0.7'; }}
                      onMouseLeave={ev => { ev.currentTarget.style.opacity = "1"; const x = ev.currentTarget.querySelector('.block-x'); if (x) x.style.opacity = '0'; }}
                      title={blockNote || "Click to edit notes"}
                    >
                      <div style={{ fontSize: "10.5px", fontWeight: 700, color: pc.text, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {client?.name || proj?.name}
                      </div>
                      {span >= 2 && client && (
                        <div style={{ fontSize: "9.5px", color: pc.text, opacity: 0.7, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {proj?.name} &middot; {svc?.label}
                        </div>
                      )}
                      {span >= 2 && blockNote && (
                        <div style={{ fontSize: "9px", color: pc.text, opacity: 0.5, marginTop: "1px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontStyle: "italic" }}>
                          &#9998; {blockNote}
                        </div>
                      )}
                      {span >= 3 && !blockNote && (
                        <div style={{ fontSize: "9px", color: pc.text, opacity: 0.35, marginTop: "1px" }}>
                          {span}h &middot; click to add note
                        </div>
                      )}
                      {/* Delete button on hover */}
                      <button className="block-x"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          for (let bh = hour; bh < hour + span; bh++) {
                            const be = getEntry(d, bh);
                            if (be) deleteEntry(be.id);
                          }
                        }}
                        style={{
                          position: "absolute", top: "2px", right: "2px",
                          width: "15px", height: "15px", borderRadius: "50%",
                          background: "rgba(255,255,255,0.8)", border: "none",
                          fontSize: "10px", cursor: "pointer", color: pc.text,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: 0, transition: "opacity 0.12s", lineHeight: 1,
                        }}
                      >&times;</button>
                    </div>
                  </div>
                );
                return;
              }

              rowCells.push(
                <div key={`${d}-${hour}`}
                  onClick={() => clickCell(d, hour)}
                  style={{
                    borderRight: di < 6 ? `1px solid ${t.borderLight}` : "none",
                    borderBottom: `1px solid ${t.borderLight}`,
                    height: "34px", cursor: activeProject ? "pointer" : "default",
                    transition: "background 0.06s",
                    background: isTodayDate(d) ? "rgba(45,138,78,0.02)" : isWknd ? "rgba(0,0,0,0.012)" : "transparent",
                  }}
                  onMouseEnter={ev => { if (activeProject) ev.currentTarget.style.background = projectColors[activeProject.projectId]?.bg || t.accentSoft; }}
                  onMouseLeave={ev => ev.currentTarget.style.background = isTodayDate(d) ? "rgba(45,138,78,0.02)" : isWknd ? "rgba(0,0,0,0.012)" : "transparent"}
                />
              );
            });

            return rowCells;
          })}
        </div>
      </div>

      {/* Summary list */}
      {weekSummary.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3 style={{ fontSize: "12px", fontWeight: 700, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>This Week</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {weekSummary.map((g, i) => {
              const proj = getProject(g.projectId);
              const client = proj ? getClient(proj.clientId) : null;
              const svc = SERVICE_TYPES.find(s => s.id === g.serviceType);
              const pc = projectColors[g.projectId];
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 14px", background: t.white,
                  border: `1px solid ${t.border}`, borderRadius: "8px",
                  borderLeft: `3px solid ${pc?.dot || t.textTertiary}`,
                }}>
                  <span style={{ fontSize: "12px", color: t.textTertiary, fontFamily: "monospace", minWidth: "55px" }}>{fmtDateShort(g.date)}</span>
                  <span style={{ fontSize: "12px", color: t.textTertiary, fontFamily: "monospace", minWidth: "70px" }}>{fmtHourLong(g.startHour)}-{fmtHourLong(g.endHour)}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: t.text }}>{client?.name || proj?.name || "-"}</span>
                  {client && <span style={{ fontSize: "13px", color: t.textSecondary }}>&middot; {proj?.name || "-"}</span>}
                  <Tag color={t.textSecondary}>{svc?.label}</Tag>
                  <span style={{ fontSize: "12px", color: t.textTertiary }}>{g.totalHours}h</span>
                  {g.notes && <span style={{ fontSize: "11px", color: t.textTertiary, fontStyle: "italic", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.notes}</span>}
                  <button onClick={() => openNotes(g.date, g.startHour, g.totalHours, g.projectId, g.serviceType)}
                    style={{ background: "none", border: "none", color: t.textTertiary, cursor: "pointer", fontSize: "11px", padding: "2px 6px", borderRadius: "4px", marginLeft: g.notes ? "0" : "auto" }}
                    onMouseEnter={ev => ev.currentTarget.style.background = t.surfaceAlt}
                    onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}
                  >{g.notes ? "edit" : "+ note"}</button>
                  <button onClick={() => g.entryIds.forEach(id => deleteEntry(id))}
                    style={{ background: "none", border: "none", color: t.textTertiary, cursor: "pointer", fontSize: "14px", padding: "2px 4px" }}>&#215;</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch fill modal */}
      {showBatch && (
        <Modal title="Fill Hour Range" onClose={() => setShowBatch(false)} width={460}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Sel label="Project" value={batchForm.projectId} onChange={v => setBatchForm({...batchForm, projectId: v})}
              options={[{value:"",label:"Select..."}, ...projects.map(p => ({value:p.id, label:`${getClient(p.clientId)?.name} - ${p.name}`}))]} />
            <Sel label="Service Type" value={batchForm.serviceType} onChange={v => setBatchForm({...batchForm, serviceType: v})}
              options={SERVICE_TYPES.filter(s => s.id !== "expense").map(s => ({value:s.id, label:s.label}))} />
            <Sel label="Day" value={batchForm.date} onChange={v => setBatchForm({...batchForm, date: v})}
              options={weekDates.map((d, i) => ({value: d, label: `${dayNames[i]} ${fmtDateShort(d)}`}))} />
            <div style={{ display: "flex", gap: "10px" }}>
              <Sel label="From" value={String(batchForm.startHour)} onChange={v => setBatchForm({...batchForm, startHour: parseInt(v)})}
                options={HOURS.map(h => ({value: String(h), label: fmtHourLong(h)}))} style={{flex:1}} />
              <Sel label="To" value={String(batchForm.endHour)} onChange={v => setBatchForm({...batchForm, endHour: parseInt(v)})}
                options={HOURS.filter(h => h > batchForm.startHour).concat([22]).map(h => ({value: String(h), label: fmtHourLong(h)}))} style={{flex:1}} />
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
              <Btn onClick={() => setShowBatch(false)}>Cancel</Btn>
              <Btn v="primary" onClick={fillBatch} disabled={!batchForm.projectId}>Fill</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Notes modal */}
      {noteModal && (() => {
        const proj = getProject(noteModal.projectId);
        const client = proj ? getClient(proj.clientId) : null;
        const pc = projectColors[noteModal.projectId] || { bg: t.surfaceAlt, border: t.border, text: t.textSecondary, dot: t.textTertiary };
        const hours = noteModal.endHour - noteModal.startHour;
        return (
          <Modal title="Edit Time Block" onClose={() => { setNoteModal(null); setNoteText(""); }} width={420}>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Block info */}
              <div style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 14px", borderRadius: "8px",
                background: pc.bg, border: `1px solid ${pc.border}`,
              }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: pc.dot, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 650, color: pc.text }}>{client?.name || proj?.name}</div>
                  {client && <div style={{ fontSize: "11px", color: pc.text, opacity: 0.7 }}>{proj?.name}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: pc.text }}>{fmtDateShort(noteModal.date)}</div>
                  <div style={{ fontSize: "11px", color: pc.text, opacity: 0.7 }}>{fmtHourLong(noteModal.startHour)}&ndash;{fmtHourLong(noteModal.endHour)} ({hours}h)</div>
                </div>
              </div>

              {/* Notes input */}
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSecondary, display: "block", marginBottom: "5px" }}>Notes</label>
                <textarea
                  ref={el => { if (el && !el.dataset.focused) { el.focus(); el.dataset.focused = "1"; } }}
                  value={noteText}
                  onChange={ev => setNoteText(ev.target.value)}
                  placeholder="What did you work on? e.g. Revised hero comp, client feedback round 2..."
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "8px",
                    border: `1px solid ${t.border}`, background: t.white,
                    fontSize: "13px", fontFamily: "'Instrument Sans', sans-serif",
                    color: t.text, resize: "vertical", outline: "none",
                    boxSizing: "border-box",
                  }}
                  onFocus={ev => ev.currentTarget.style.borderColor = t.text}
                  onBlur={ev => ev.currentTarget.style.borderColor = t.border}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={() => {
                    noteModal.entryIds.forEach(id => deleteEntry(id));
                    setNoteModal(null); setNoteText("");
                  }}
                  style={{
                    background: "none", border: "none", fontSize: "12px",
                    color: t.red, cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
                    fontWeight: 600, padding: "4px 0",
                  }}
                >Delete block</button>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Btn onClick={() => { setNoteModal(null); setNoteText(""); }}>Cancel</Btn>
                  <Btn v="primary" onClick={saveNotes}>Save</Btn>
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
// ============================================================
// PENCILS
// ============================================================
function Pencils({ pencils, setPencils, projects, setProjects, clients, setClients, getClient, getProject, settings }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("pencil"); // "pencil" or "booking"
  const [form, setForm] = useState({ projectId: "", startDate: todayISO(), endDate: todayISO(), priority: "1", notes: "" });
  const [newClient, setNewClient] = useState("");
  const [newProj, setNewProj] = useState({ name: "", clientId: "" });
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewProj, setShowNewProj] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  const addEntry = () => {
    const priority = addType === "booking" ? 0 : parseInt(form.priority);
    setPencils(prev => [{ id: uid(), projectId: form.projectId, startDate: form.startDate, endDate: form.endDate, priority, notes: form.notes, createdAt: Date.now() }, ...prev]);
    setShowAdd(false);
    setForm({ projectId: "", startDate: todayISO(), endDate: todayISO(), priority: "1", notes: "" });
  };

  const openAdd = (type) => {
    setAddType(type);
    setForm({ projectId: "", startDate: todayISO(), endDate: todayISO(), priority: type === "booking" ? "0" : "1", notes: "" });
    setShowAdd(true);
  };

  const addClient = () => {
    if (!newClient.trim()) return;
    const clientId = uid();
    setClients(prev => [{ id: clientId, name: newClient.trim(), email: "", serviceRates: {}, notes: "", createdAt: Date.now() }, ...prev]);
    setProjects(prev => [{ id: uid(), clientId, name: "Internal Meeting", notes: "", createdAt: Date.now() }, ...prev]);
    setNewClient(""); setShowNewClient(false);
  };

  const addProject = () => {
    if (!newProj.name.trim() || !newProj.clientId) return;
    const p = { id: uid(), clientId: newProj.clientId, name: newProj.name.trim(), notes: "", createdAt: Date.now() };
    setProjects(prev => [p, ...prev]);
    setForm({ ...form, projectId: p.id });
    setNewProj({ name: "", clientId: "" }); setShowNewProj(false);
  };

  const toggleBooking = (id) => {
    setPencils(prev => prev.map(p => p.id === id ? { ...p, priority: p.priority === 0 ? 1 : 0 } : p));
  };

  const allUpcoming = pencils.filter(p => p.endDate >= todayISO()).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const bookings = allUpcoming.filter(p => p.priority === 0);
  const pencilsOnly = allUpcoming.filter(p => p.priority > 0);
  const past = pencils.filter(p => p.endDate < todayISO()).sort((a, b) => b.startDate.localeCompare(a.startDate));

  const getConflicts = (pencil) => allUpcoming.filter(p =>
    p.id !== pencil.id && (p.priority === 0 || p.priority === 1) && (pencil.priority === 0 || pencil.priority === 1) &&
    p.startDate <= pencil.endDate && p.endDate >= pencil.startDate
  );

  // Calendar helpers
  const calDays = useMemo(() => {
    const { year, month } = calMonth;
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDay = (first.getDay() + 6) % 7; // Monday = 0
    const days = [];
    // Fill leading empty days
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(iso);
    }
    return days;
  }, [calMonth]);

  const calLabel = new Date(calMonth.year, calMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  const goToday = () => { const d = new Date(); setCalMonth({ year: d.getFullYear(), month: d.getMonth() }); };

  const getEntriesForDate = (iso) => pencils.filter(p => p.startDate <= iso && p.endDate >= iso);
  const isTodayCal = (iso) => iso === todayISO();

  // Render a single pencil/booking row
  const renderEntry = (p, showToggle = true) => {
    const proj = getProject(p.projectId);
    const client = proj ? getClient(proj.clientId) : null;
    const pri = PENCIL_PRIORITY[p.priority];
    const conflicts = getConflicts(p);
    const days = daysBetween(p.startDate, p.endDate);
    return (
      <div key={p.id} style={{
        padding: "12px 14px", background: t.white,
        border: `1px solid ${conflicts.length > 0 && p.priority <= 1 ? "rgba(197,48,48,0.3)" : t.border}`,
        borderRadius: "8px", borderLeft: `3px solid ${pri?.color || t.textTertiary}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Tag color={pri?.color} bg={pri?.bg} border={pri?.border}>{pri?.label}</Tag>
          <span style={{ fontSize: "13px", fontWeight: 650, color: t.text }}>{client?.name}</span>
          <span style={{ fontSize: "13px", color: t.textSecondary }}>&middot; {proj?.name}</span>
          <span style={{ marginLeft: "auto", fontSize: "12px", fontFamily: "monospace", color: t.textTertiary }}>
            {fmtDateShort(p.startDate)} &ndash; {fmtDateShort(p.endDate)} ({days}d)
          </span>
          {showToggle && (
            <>
              {p.priority > 0 ? (
                <Btn v="green" size="sm" onClick={() => toggleBooking(p.id)}>Confirm</Btn>
              ) : (
                <Btn size="sm" onClick={() => toggleBooking(p.id)}>Unbook</Btn>
              )}
              {p.priority > 0 && (
                <div style={{ display: "flex", gap: "2px" }}>
                  {[1,2,3].map(n => (
                    <button key={n} onClick={() => setPencils(prev => prev.map(x => x.id === p.id ? {...x, priority:n} : x))}
                      style={{
                        width: "22px", height: "22px", borderRadius: "4px", border: "none", cursor: "pointer",
                        fontSize: "11px", fontWeight: 700, fontFamily: "'Instrument Sans', sans-serif",
                        background: p.priority === n ? PENCIL_PRIORITY[n].bg : "transparent",
                        color: p.priority === n ? PENCIL_PRIORITY[n].color : t.textTertiary,
                      }}>{n}</button>
                  ))}
                </div>
              )}
              <button onClick={() => setPencils(prev => prev.filter(x => x.id !== p.id))}
                style={{ background: "none", border: "none", color: t.textTertiary, cursor: "pointer", fontSize: "16px" }}>&times;</button>
            </>
          )}
        </div>
        {conflicts.length > 0 && p.priority <= 1 && <div style={{ fontSize: "11px", color: t.red, marginTop: "4px", fontWeight: 600 }}>&laquo; Conflicts with {conflicts.map(c => getProject(c.projectId)?.name).join(", ")}</div>}
        {p.notes && <div style={{ fontSize: "12px", color: t.textTertiary, marginTop: "3px" }}>{p.notes}</div>}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 750, letterSpacing: "-0.03em" }}>Pencils &amp; Bookings</h2>
        <div style={{ display: "flex", gap: "6px" }}>
          <Btn onClick={() => openAdd("pencil")}>+ Pencil</Btn>
          <Btn v="primary" onClick={() => openAdd("booking")}>+ Booking</Btn>
        </div>
      </div>

      {allUpcoming.length === 0 && past.length === 0 ? (
        <Empty title="No pencils or bookings" sub="Add your first entry" action={
          <div style={{ display: "flex", gap: "6px" }}>
            <Btn onClick={() => openAdd("pencil")}>+ Pencil</Btn>
            <Btn v="primary" onClick={() => openAdd("booking")}>+ Booking</Btn>
          </div>
        } />
      ) : (
        <>
          {bookings.length > 0 && (
            <Section title="Confirmed Bookings">
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {bookings.map(p => renderEntry(p))}
              </div>
            </Section>
          )}
          {pencilsOnly.length > 0 && (
            <Section title="Pencils">
              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {pencilsOnly.map(p => renderEntry(p))}
              </div>
            </Section>
          )}
          {past.length > 0 && (
            <Section title="Past">
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {past.slice(0, 8).map(p => {
                  const proj = getProject(p.projectId);
                  const client = proj ? getClient(proj.clientId) : null;
                  const pri = PENCIL_PRIORITY[p.priority];
                  return (
                    <Row key={p.id} style={{ opacity: 0.5 }}>
                      <Tag color={pri?.color || t.textTertiary} bg={pri?.bg}>{pri?.label}</Tag>
                      <span style={{ fontSize: "13px", color: t.textSecondary }}>{client?.name} &middot; {proj?.name}</span>
                      <span style={{ marginLeft: "auto", fontSize: "12px", fontFamily: "monospace", color: t.textTertiary }}>{fmtDateShort(p.startDate)} &ndash; {fmtDateShort(p.endDate)}</span>
                    </Row>
                  );
                })}
              </div>
            </Section>
          )}
        </>
      )}

      {/* CALENDAR VIEW */}
      <div style={{ marginTop: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ fontSize: "12px", fontWeight: 700, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.04em" }}>Calendar</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Btn v="ghost" size="sm" onClick={prevMonth}>&#8592;</Btn>
            <span style={{ fontSize: "14px", fontWeight: 650, color: t.text, minWidth: "140px", textAlign: "center" }}>{calLabel}</span>
            <Btn v="ghost" size="sm" onClick={nextMonth}>&#8594;</Btn>
            <Btn size="sm" onClick={goToday}>Today</Btn>
          </div>
        </div>
        <div style={{
          background: t.white, border: `1px solid ${t.border}`, borderRadius: "12px",
          overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${t.border}` }}>
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} style={{ padding: "8px 4px", textAlign: "center", fontSize: "11px", fontWeight: 650, color: t.textTertiary, background: t.surfaceAlt }}>
                {d}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {calDays.map((iso, i) => {
              if (!iso) return <div key={`empty-${i}`} style={{ minHeight: "70px", background: t.surfaceAlt, borderBottom: `1px solid ${t.borderLight}`, borderRight: (i % 7 < 6) ? `1px solid ${t.borderLight}` : "none" }} />;
              const entries = getEntriesForDate(iso);
              const dateObj = new Date(iso + "T12:00:00");
              const dayNum = dateObj.getDate();
              const isWknd = dateObj.getDay() === 0 || dateObj.getDay() === 6;
              return (
                <div key={iso} style={{
                  minHeight: "70px", padding: "3px",
                  borderBottom: `1px solid ${t.borderLight}`,
                  borderRight: (i % 7 < 6) ? `1px solid ${t.borderLight}` : "none",
                  background: isTodayCal(iso) ? "rgba(45,138,78,0.04)" : isWknd ? "rgba(0,0,0,0.01)" : "transparent",
                }}>
                  <div style={{
                    fontSize: "11px", fontWeight: isTodayCal(iso) ? 750 : 500,
                    color: isTodayCal(iso) ? t.green : isWknd ? t.textTertiary : t.textSecondary,
                    padding: "2px 4px", marginBottom: "2px",
                  }}>{dayNum}</div>
                  {entries.slice(0, 3).map(e => {
                    const proj = getProject(e.projectId);
                    const client = proj ? getClient(proj.clientId) : null;
                    const pri = PENCIL_PRIORITY[e.priority];
                    return (
                      <div key={e.id} style={{
                        padding: "1px 4px", marginBottom: "1px",
                        borderRadius: "3px", fontSize: "9px", fontWeight: 600,
                        background: pri?.bg || t.surfaceAlt,
                        color: pri?.color || t.textSecondary,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        borderLeft: `2px solid ${pri?.color || t.textTertiary}`,
                      }}>
                        {client?.name} &middot; {proj?.name}
                      </div>
                    );
                  })}
                  {entries.length > 3 && (
                    <div style={{ fontSize: "8px", color: t.textTertiary, padding: "0 4px" }}>+{entries.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <Modal title={addType === "booking" ? "New Booking" : "New Pencil"} onClose={() => { setShowAdd(false); setShowNewClient(false); setShowNewProj(false); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Sel label="Project" value={form.projectId} onChange={v => setForm({...form, projectId: v})}
              options={[{value:"",label:"Select..."}, ...projects.filter(p => p.id !== PERSONAL_PROJECT_ID).map(p => ({value:p.id, label:`${getClient(p.clientId)?.name} - ${p.name}`}))]} />
            <div style={{ display: "flex", gap: "6px" }}>
              <Btn v="ghost" size="sm" onClick={() => setShowNewClient(true)}>+ Client</Btn>
              <Btn v="ghost" size="sm" onClick={() => setShowNewProj(true)}>+ Project</Btn>
            </div>
            {showNewClient && (
              <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", background: t.surfaceAlt, padding: "10px", borderRadius: "8px" }}>
                <Field label="Client Name" value={newClient} onChange={setNewClient} style={{flex:1}} />
                <Btn v="primary" size="sm" onClick={addClient}>Add</Btn>
                <Btn v="ghost" size="sm" onClick={() => setShowNewClient(false)}>&times;</Btn>
              </div>
            )}
            {showNewProj && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", background: t.surfaceAlt, padding: "10px", borderRadius: "8px" }}>
                <Sel label="Client" value={newProj.clientId} onChange={v => setNewProj({...newProj, clientId:v})}
                  options={[{value:"",label:"Select..."}, ...clients.map(c => ({value:c.id, label:c.name}))]} />
                <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                  <Field label="Project Name" value={newProj.name} onChange={v => setNewProj({...newProj, name:v})} style={{flex:1}} />
                  <Btn v="primary" size="sm" onClick={addProject}>Add</Btn>
                  <Btn v="ghost" size="sm" onClick={() => setShowNewProj(false)}>&times;</Btn>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <Field label="Start" type="date" value={form.startDate} onChange={v => setForm({...form, startDate:v})} style={{flex:1}} />
              <Field label="End" type="date" value={form.endDate} onChange={v => setForm({...form, endDate:v})} style={{flex:1}} />
            </div>
            {addType === "pencil" && (
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSecondary, display: "block", marginBottom: "6px" }}>Priority</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[1,2,3].map(n => (
                    <button key={n} onClick={() => setForm({...form, priority:String(n)})}
                      style={{
                        flex: 1, padding: "9px", borderRadius: "7px", cursor: "pointer",
                        fontSize: "13px", fontWeight: 650, fontFamily: "'Instrument Sans', sans-serif",
                        border: `1px solid ${form.priority === String(n) ? PENCIL_PRIORITY[n].color : t.border}`,
                        background: form.priority === String(n) ? PENCIL_PRIORITY[n].bg : t.white,
                        color: form.priority === String(n) ? PENCIL_PRIORITY[n].color : t.textTertiary,
                      }}>{PENCIL_PRIORITY[n].label}</button>
                  ))}
                </div>
              </div>
            )}
            <TextArea label="Notes" value={form.notes} onChange={v => setForm({...form, notes:v})} rows={2} />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "6px" }}>
              <Btn onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn v="primary" onClick={addEntry} disabled={!form.projectId}>
                {addType === "booking" ? "Add Booking" : "Add Pencil"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
// ============================================================
// INVOICES
// ============================================================
// PDF Download — generates clean HTML invoice in a print window
function downloadInvoicePDF(inv, settings) {
  const fmtMoney = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const fmtD = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const rows = (inv.lineItems || []).map(li => `
    <tr${li.type === "expense" ? ' style="background:rgba(183,121,31,0.04)"' : ""}>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e3de;font-size:12px;color:#5c5b57;white-space:nowrap;">${li.date ? fmtD(li.date) : ""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e3de;font-size:13px;color:#1a1a1a;">${li.type === "expense" ? "<span style='font-size:10px;font-weight:600;color:#b7791f;margin-right:6px;'>EXPENSE</span>" : ""}${li.note || ""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e3de;font-size:12px;color:#5c5b57;text-align:center;">${li.hours || ""}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e3de;font-size:13px;font-family:monospace;font-weight:700;text-align:right;">${fmtMoney(li.amount)}</td>
    </tr>
  `).join("");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Invoice ${inv.number}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #1a1a1a; padding: 48px; max-width: 800px; margin: 0 auto; }
  @media print {
    body { padding: 24px; }
    .no-print { display: none !important; }
    @page { margin: 0.6in; }
  }
</style>
</head><body>

<div class="no-print" style="margin-bottom:24px;text-align:center;">
  <button onclick="window.print()" style="padding:10px 28px;font-size:14px;font-weight:600;background:#1a1a1a;color:#fff;border:none;border-radius:6px;cursor:pointer;">
    Print / Save as PDF
  </button>
  <p style="margin-top:8px;font-size:12px;color:#9c9a94;">Use "Save as PDF" in the print dialog to download</p>
</div>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;">
  <div>
    <div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;">${settings.businessName} Invoice</div>
    <div style="font-size:32px;font-weight:700;color:#9c9a94;letter-spacing:-0.02em;">#${inv.number}</div>
  </div>
  <div style="text-align:right;font-size:13px;color:#5c5b57;">
    <div>Issue Date: ${fmtD(inv.issueDate)}</div>
    ${inv.dueDate ? `<div>Due Date: ${fmtD(inv.dueDate)}</div>` : ""}
  </div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px;font-size:13px;">
  <div>
    <div style="font-size:11px;font-weight:600;color:#9c9a94;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Billed To</div>
    <div style="font-weight:600;">${inv.clientName || ""}</div>
  </div>
  <div>
    <div style="font-size:11px;font-weight:600;color:#9c9a94;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Dates Worked</div>
    <div>${inv.dateRange || ""}</div>
  </div>
  ${inv.invoiceCode ? `
  <div>
    <div style="font-size:11px;font-weight:600;color:#9c9a94;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Invoice Code</div>
    <div>${inv.invoiceCode}</div>
  </div>` : ""}
  <div>
    <div style="font-size:11px;font-weight:600;color:#9c9a94;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px;">Pay To</div>
    <div style="white-space:pre-line;">${settings.businessName}${settings.businessAddress ? "\n" + settings.businessAddress : ""}</div>
  </div>
</div>

<table style="width:100%;border-collapse:collapse;border:1px solid #e5e3de;border-radius:8px;margin-bottom:20px;">
  <thead>
    <tr style="background:#f2f1ee;">
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#9c9a94;text-transform:uppercase;letter-spacing:0.03em;width:90px;">Date</th>
      <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#9c9a94;text-transform:uppercase;letter-spacing:0.03em;">Description</th>
      <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:700;color:#9c9a94;text-transform:uppercase;letter-spacing:0.03em;width:50px;">Hours</th>
      <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:700;color:#9c9a94;text-transform:uppercase;letter-spacing:0.03em;width:90px;">Amount</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr style="background:#f2f1ee;">
      <td colspan="3" style="padding:12px;font-size:14px;font-weight:700;">Total</td>
      <td style="padding:12px;text-align:right;font-size:18px;font-family:monospace;font-weight:700;color:#2d8a4e;">${fmtMoney(inv.total)}</td>
    </tr>
  </tfoot>
</table>

${settings.bankName ? `
<div style="font-size:12px;color:#5c5b57;margin-bottom:16px;line-height:1.7;">
  <strong>Payment Details:</strong> ${settings.bankName} &middot; Routing: ${settings.routing} &middot; Account: ${settings.accountNumber}
</div>` : ""}

${inv.notes ? `<div style="font-size:13px;color:#5c5b57;margin-bottom:16px;">${inv.notes}</div>` : ""}

<div style="font-size:12px;color:#9c9a94;">
  Payment required within ${settings.paymentTerms} days. Thank you for your business.
</div>

${settings.businessEmail ? `<div style="font-size:12px;color:#9c9a94;margin-top:4px;">${settings.businessEmail}${settings.businessPhone ? " &middot; " + settings.businessPhone : ""}</div>` : ""}

</body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function Invoices({ invoices, setInvoices, timeEntries, projects, clients, settings, setSettings, getClient, getProject }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selClient, setSelClient] = useState("");
  const [selDays, setSelDays] = useState([]); // array of ISO date strings
  const [dayNotes, setDayNotes] = useState({}); // { "2025-03-01": "note..." }
  const [dueDate, setDueDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return toISO(d); });
  const [notes, setNotes] = useState("");
  const [invoiceCode, setInvoiceCode] = useState("");
  const [viewInv, setViewInv] = useState(null);
  const [expenses, setExpenses] = useState([]); // [{id, description, amount}]
  const [expForm, setExpForm] = useState({ description: "", amount: "" });

  const addExpense = () => {
    if (!expForm.description.trim() || !expForm.amount) return;
    setExpenses(prev => [...prev, { id: uid(), description: expForm.description.trim(), amount: parseFloat(expForm.amount) }]);
    setExpForm({ description: "", amount: "" });
  };
  const removeExpense = (id) => setExpenses(prev => prev.filter(e => e.id !== id));
  const expenseTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Track which entry IDs are already invoiced
  const invoicedIds = useMemo(() => new Set(invoices.flatMap(i => i.entryIds || [])), [invoices]);

  // Get uninvoiced entries for the selected client, grouped by day
  const clientDays = useMemo(() => {
    if (!selClient) return [];
    const entries = timeEntries.filter(e => {
      if (invoicedIds.has(e.id)) return false;
      if (e.projectId === PERSONAL_PROJECT_ID) return false;
      const p = getProject(e.projectId);
      return p && p.clientId === selClient;
    });
    // Group by date
    const byDate = {};
    entries.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });
    return Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, dayEntries]) => {
        const totalHours = dayEntries.length;
        const totalAmount = dayEntries.reduce((s, e) => s + (e.amount || 0), 0);
        // Build project breakdown from the entries
        const projMap = {};
        dayEntries.forEach(e => {
          const proj = getProject(e.projectId);
          const key = e.projectId;
          if (!projMap[key]) projMap[key] = { name: proj?.name || "?", hours: 0 };
          projMap[key].hours++;
        });
        const breakdown = Object.values(projMap).map(p => `${p.name} ${p.hours}h`).join(", ");
        // Get notes from time entries if any
        const entryNotes = dayEntries.filter(e => e.notes).map(e => e.notes);
        const existingNote = entryNotes.length > 0 ? [...new Set(entryNotes)].join("; ") : "";
        return { date, entries: dayEntries, totalHours, totalAmount, breakdown, existingNote, entryIds: dayEntries.map(e => e.id) };
      });
  }, [selClient, timeEntries, invoicedIds, getProject]);

  const toggleDay = (date) => {
    setSelDays(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date);
      return [...prev, date];
    });
    // Always ensure note is populated
    const day = clientDays.find(d => d.date === date);
    if (day && !dayNotes[date]) {
      setDayNotes(prev => ({ ...prev, [date]: day.existingNote || day.breakdown }));
    }
  };

  const selectAllDays = () => {
    if (selDays.length === clientDays.length) {
      setSelDays([]);
    } else {
      const allDates = clientDays.map(d => d.date);
      setSelDays(allDates);
      // Pre-fill notes for all days
      const newNotes = { ...dayNotes };
      clientDays.forEach(d => {
        if (!newNotes[d.date]) newNotes[d.date] = d.existingNote || d.breakdown;
      });
      setDayNotes(newNotes);
    }
  };

  const selTotal = useMemo(() => {
    const dayTotal = clientDays.filter(d => selDays.includes(d.date)).reduce((s, d) => s + d.totalAmount, 0);
    return dayTotal + expenseTotal;
  }, [selDays, clientDays, expenseTotal]);

  const selHours = useMemo(() => {
    return clientDays.filter(d => selDays.includes(d.date)).reduce((s, d) => s + d.totalHours, 0);
  }, [selDays, clientDays]);

  const createInvoice = () => {
    const selectedDayData = clientDays.filter(d => selDays.includes(d.date));
    const allEntryIds = selectedDayData.flatMap(d => d.entryIds);
    const client = getClient(selClient);
    const allDates = selectedDayData.map(d => d.date).sort();

    // Day line items
    const dayItems = selectedDayData.map(d => ({
      type: "day", date: d.date, hours: d.totalHours, amount: d.totalAmount, note: d.breakdown,
    }));
    // Expense line items
    const expItems = expenses.map(e => ({
      type: "expense", date: null, hours: null, amount: e.amount, note: e.description,
    }));
    const lineItems = [...dayItems, ...expItems];

    const total = selectedDayData.reduce((s, d) => s + d.totalAmount, 0) + expenseTotal;

    const inv = {
      id: uid(),
      number: `${settings.invoicePrefix}-${String(settings.nextInvoiceNumber).padStart(4, "0")}`,
      clientId: selClient,
      clientName: client?.name,
      clientEmail: client?.email,
      entryIds: allEntryIds,
      lineItems,
      total,
      status: "draft",
      issueDate: todayISO(),
      dueDate: dueDate || null,
      invoiceCode,
      notes,
      dateRange: allDates.length > 0 ? `${fmtDate(allDates[0])} - ${fmtDate(allDates[allDates.length - 1])}` : "",
      datesWorked: allDates,
      createdAt: Date.now(),
    };
    setInvoices(prev => [inv, ...prev]);
    setSettings(prev => ({ ...prev, nextInvoiceNumber: prev.nextInvoiceNumber + 1 }));
    setShowCreate(false);
    setSelClient(""); setSelDays([]); setDayNotes({}); setNotes(""); setDueDate(() => { const d = new Date(); d.setDate(d.getDate() + 30); return toISO(d); }); setInvoiceCode(""); setExpenses([]);
  };

  const dayNameShort = (iso) => {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 750, letterSpacing: "-0.03em" }}>Invoices</h2>
        <Btn v="primary" onClick={() => setShowCreate(true)}>+ Create Invoice</Btn>
      </div>

      {invoices.length === 0 ? (
        <Empty title="No invoices" sub="Create from tracked time" action={<Btn v="primary" onClick={() => setShowCreate(true)}>+ Create Invoice</Btn>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {invoices.map(inv => {
            const st = INVOICE_STATUS[inv.status];
            return (
              <Row key={inv.id} onClick={() => setViewInv(inv)}>
                <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 700, color: t.text, minWidth: "80px" }}>{inv.number}</span>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{inv.clientName}</span>
                <Tag color={st.color} bg={st.bg}>{st.label}</Tag>
                <span style={{ fontSize: "12px", color: t.textTertiary }}>{inv.lineItems?.length || 0} days</span>
                <span style={{ fontSize: "12px", color: t.textTertiary }}>{fmtDate(inv.issueDate)}</span>
                <span style={{ marginLeft: "auto", fontSize: "16px", fontFamily: "monospace", fontWeight: 750, color: t.text }}>{fmt(inv.total)}</span>
              </Row>
            );
          })}
        </div>
      )}

      {/* Create Invoice */}
      {showCreate && (
        <Modal title="Create Invoice" onClose={() => setShowCreate(false)} width={680}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Sel label="Client" value={selClient} onChange={v => { setSelClient(v); setSelDays([]); setDayNotes({}); }}
              options={[{value:"",label:"Select client..."}, ...clients.map(c => ({value:c.id, label:c.name}))]} />

            {selClient && clientDays.length === 0 && <Muted>No uninvoiced days for this client.</Muted>}

            {clientDays.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSecondary }}>Select Days</label>
                  <Btn v="ghost" size="sm" onClick={selectAllDays}>{selDays.length === clientDays.length ? "Deselect all" : "Select all"}</Btn>
                </div>
                <div style={{ maxHeight: "400px", overflow: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {clientDays.map(day => {
                    const on = selDays.includes(day.date);
                    return (
                      <div key={day.date} style={{
                        background: on ? t.greenBg : t.surfaceAlt,
                        border: `1px solid ${on ? t.greenBorder : t.borderLight}`,
                        borderRadius: "8px", overflow: "hidden",
                        transition: "all 0.1s",
                      }}>
                        {/* Day row — click to toggle */}
                        <div onClick={() => toggleDay(day.date)} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "10px 12px", cursor: "pointer",
                        }}>
                          <div style={{
                            width: "16px", height: "16px", borderRadius: "3px",
                            border: `1.5px solid ${on ? t.green : t.textTertiary}`,
                            background: on ? t.green : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "10px", color: t.white, flexShrink: 0,
                          }}>{on && "\u2713"}</div>
                          <span style={{ fontSize: "12px", fontFamily: "monospace", color: t.textTertiary, minWidth: "32px" }}>{dayNameShort(day.date)}</span>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: t.text, minWidth: "65px" }}>{fmtDateShort(day.date)}</span>
                          <span style={{ fontSize: "12px", color: t.textSecondary, flex: 1 }}>{day.breakdown}</span>
                          <span style={{ fontSize: "12px", color: t.textTertiary }}>{day.totalHours}h</span>
                          <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 650, color: t.text, minWidth: "70px", textAlign: "right" }}>{fmt(day.totalAmount)}</span>
                        </div>
                        {/* Show breakdown when selected */}
                        {on && (
                          <div style={{ padding: "0 12px 10px 46px" }}>
                            <div style={{ fontSize: "12px", color: t.textSecondary, fontStyle: "italic" }}>{day.breakdown}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selClient && (selDays.length > 0 || expenses.length > 0) && (
              <>
                {/* Expenses */}
                <div>
                  <label style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSecondary, display: "block", marginBottom: "6px" }}>Expenses</label>
                  {expenses.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "8px" }}>
                      {expenses.map(exp => (
                        <div key={exp.id} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "7px 12px", background: t.surfaceAlt,
                          border: `1px solid ${t.borderLight}`, borderRadius: "6px",
                        }}>
                          <span style={{ fontSize: "13px", color: t.text, flex: 1 }}>{exp.description}</span>
                          <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: 650 }}>{fmt(exp.amount)}</span>
                          <button onClick={() => removeExpense(exp.id)}
                            style={{ background: "none", border: "none", color: t.textTertiary, cursor: "pointer", fontSize: "14px" }}>&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                    <Field label="" value={expForm.description} onChange={v => setExpForm({...expForm, description: v})} placeholder="e.g. Uber to studio, Software license" style={{flex: 1}} />
                    <Field label="" type="number" value={expForm.amount} onChange={v => setExpForm({...expForm, amount: v})} placeholder="$" style={{width: "100px"}} min="0" step="0.01" />
                    <Btn size="sm" onClick={addExpense} disabled={!expForm.description.trim() || !expForm.amount}>Add</Btn>
                  </div>
                </div>

                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", background: t.greenBg, border: `1px solid ${t.greenBorder}`, borderRadius: "8px",
                }}>
                  <span style={{ fontSize: "13px", color: t.textSecondary }}>
                    {selDays.length} days &middot; {selHours}h{expenses.length > 0 ? ` + ${expenses.length} expense${expenses.length > 1 ? "s" : ""}` : ""}
                  </span>
                  <span style={{ fontSize: "20px", fontFamily: "monospace", fontWeight: 750, color: t.green }}>{fmt(selTotal)}</span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Field label="Due Date" type="date" value={dueDate} onChange={setDueDate} style={{flex:1}} />
                  <Field label="Invoice Code" value={invoiceCode} onChange={setInvoiceCode} placeholder="e.g. 358 - Other: Freelancer" style={{flex:1}} />
                </div>
                <TextArea label="Notes" value={notes} onChange={setNotes} rows={2} placeholder="Payment terms, PO#..." />
              </>
            )}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
              <Btn onClick={() => setShowCreate(false)}>Cancel</Btn>
              <Btn v="primary" onClick={createInvoice} disabled={selDays.length === 0 && expenses.length === 0}>Create Invoice</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* View Invoice */}
      {viewInv && (
        <Modal title="" onClose={() => setViewInv(null)} width={680}>
          <div style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 750, letterSpacing: "-0.03em", marginBottom: "2px" }}>{settings.businessName} Invoice</div>
                <div style={{ fontSize: "28px", fontWeight: 750, color: t.textTertiary, letterSpacing: "-0.02em" }}>#{viewInv.number}</div>
              </div>
              <Tag color={INVOICE_STATUS[viewInv.status]?.color} bg={INVOICE_STATUS[viewInv.status]?.bg}>
                {INVOICE_STATUS[viewInv.status]?.label}
              </Tag>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "24px", fontSize: "13px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 650, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px" }}>Billed To</div>
                <div style={{ fontWeight: 600, color: t.text }}>{viewInv.clientName}</div>
              </div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 650, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px" }}>Dates Worked</div>
                <div style={{ color: t.text }}>{viewInv.dateRange}</div>
              </div>
              {viewInv.invoiceCode && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 650, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px" }}>Invoice Code</div>
                  <div style={{ color: t.text }}>{viewInv.invoiceCode}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: "11px", fontWeight: 650, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "4px" }}>Pay To</div>
                <div style={{ color: t.text, whiteSpace: "pre-line" }}>{settings.businessName}{settings.businessAddress ? "\n" + settings.businessAddress : ""}</div>
              </div>
            </div>

            {/* Day-based line items */}
            <div style={{ borderRadius: "8px", overflow: "hidden", border: `1px solid ${t.border}`, marginBottom: "16px" }}>
              <div style={{
                display: "grid", gridTemplateColumns: "90px 1fr 50px 90px",
                padding: "8px 14px", background: t.surfaceAlt, fontSize: "11px", fontWeight: 700,
                color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.03em",
              }}>
                <span>Date</span><span>Description</span><span>Hours</span><span style={{ textAlign: "right" }}>Amount</span>
              </div>
              {(viewInv.lineItems || []).map((li, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "90px 1fr 50px 90px",
                  padding: "10px 14px", borderTop: `1px solid ${t.borderLight}`, fontSize: "13px",
                  alignItems: "center",
                  background: li.type === "expense" ? "rgba(183,121,31,0.03)" : "transparent",
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: t.textSecondary }}>{li.date ? fmtDateShort(li.date) : ""}</span>
                  <span style={{ color: t.text }}>
                    {li.type === "expense" && <span style={{ fontSize: "10px", fontWeight: 600, color: t.yellow, marginRight: "6px" }}>EXPENSE</span>}
                    {li.note || "-"}
                  </span>
                  <span style={{ color: t.textSecondary, fontSize: "12px" }}>{li.hours || ""}</span>
                  <span style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: t.text }}>{fmt(li.amount)}</span>
                </div>
              ))}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 90px",
                padding: "14px", borderTop: `1px solid ${t.border}`, background: t.surfaceAlt,
              }}>
                <span style={{ fontSize: "14px", fontWeight: 750 }}>Total</span>
                <span style={{ textAlign: "right", fontSize: "20px", fontFamily: "monospace", fontWeight: 750, color: t.green }}>{fmt(viewInv.total)}</span>
              </div>
            </div>

            {settings.bankName && (
              <div style={{ fontSize: "12px", color: t.textTertiary, marginBottom: "16px", lineHeight: 1.6 }}>
                <strong style={{ color: t.textSecondary }}>Payment Details:</strong> {settings.bankName} &middot; Routing: {settings.routing} &middot; Account: {settings.accountNumber}
              </div>
            )}

            {viewInv.notes && <div style={{ fontSize: "13px", color: t.textSecondary, marginBottom: "16px" }}>{viewInv.notes}</div>}

            <div style={{ fontSize: "12px", color: t.textTertiary, marginBottom: "20px" }}>
              Payment required within {settings.paymentTerms} days. Thank you for your business.
            </div>

            <div style={{ display: "flex", gap: "6px", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                {["draft","sent","paid","overdue"].map(s => (
                  <Btn key={s} v={viewInv.status === s ? "primary" : "default"} size="sm"
                    onClick={() => { setInvoices(prev => prev.map(i => i.id === viewInv.id ? {...i, status:s} : i)); setViewInv({...viewInv, status:s}); }}>
                    {INVOICE_STATUS[s].label}
                  </Btn>
                ))}
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <Btn v="green" size="sm" onClick={() => downloadInvoicePDF(viewInv, settings)}>&#8595; Download PDF</Btn>
                <Btn v="danger" size="sm" onClick={() => { setInvoices(prev => prev.filter(i => i.id !== viewInv.id)); setViewInv(null); }}>Delete</Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
// ============================================================
// CLIENTS
// ============================================================
function Clients({ clients, setClients, projects, setProjects, settings, timeEntries, pencils, invoices, getClient, getProject, getRate }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", notes: "", serviceRates: {} });
  const [showAddProj, setShowAddProj] = useState(false);
  const [editProjId, setEditProjId] = useState(null);
  const [expandedClients, setExpandedClients] = useState({}); // { clientId: true/false }
  const [confirmDelete, setConfirmDelete] = useState(null); // clientId to confirm
  const [projForm, setProjForm] = useState({
    name: "", clientId: "", director: "", productionCompany: "", producer: "",
    creativeDirector: "", lead3d: "", lead2d: "", myRole: "", dueDate: "", notes: "",
  });

  const emptyProjForm = (clientId = "") => ({
    name: "", clientId, director: "", directorEmail: "", productionCompany: "", producer: "", producerEmail: "",
    creativeDirector: "", lead3d: "", lead2d: "", myRole: "", dueDate: "", notes: "", status: "active",
  });

  const startAdd = () => { setForm({ name: "", email: "", notes: "", serviceRates: {} }); setEditId(null); setShowAdd(true); };
  const startEdit = (c) => { setForm({ name: c.name, email: c.email || "", notes: c.notes || "", serviceRates: c.serviceRates || {} }); setEditId(c.id); setShowAdd(true); };

  const saveClient = () => {
    const data = { name: form.name.trim(), email: form.email.trim(), notes: form.notes, serviceRates: form.serviceRates };
    if (editId) {
      setClients(prev => prev.map(c => c.id === editId ? { ...c, ...data } : c));
    } else {
      const clientId = uid();
      setClients(prev => [{ id: clientId, ...data, createdAt: Date.now() }, ...prev]);
      setProjects(prev => [{ id: uid(), clientId, name: "Internal Meeting", notes: "", createdAt: Date.now() }, ...prev]);
    }
    setShowAdd(false);
  };

  const setServiceRate = (svcId, val) => {
    setForm(prev => ({ ...prev, serviceRates: { ...prev.serviceRates, [svcId]: val === "" ? null : parseFloat(val) } }));
  };

  const openAddProj = (clientId = "") => {
    setProjForm(emptyProjForm(clientId));
    setEditProjId(null);
    setShowAddProj(true);
  };

  const openEditProj = (p) => {
    setProjForm({
      name: p.name || "", clientId: p.clientId || "", director: p.director || "",
      directorEmail: p.directorEmail || "",
      productionCompany: p.productionCompany || "", producer: p.producer || "",
      producerEmail: p.producerEmail || "",
      creativeDirector: p.creativeDirector || "", lead3d: p.lead3d || "",
      lead2d: p.lead2d || "", myRole: p.myRole || "", dueDate: p.dueDate || "", notes: p.notes || "",
      status: p.status || "active",
    });
    setEditProjId(p.id);
    setShowAddProj(true);
  };

  const saveProj = () => {
    if (!projForm.name.trim() || !projForm.clientId) return;
    const data = {
      name: projForm.name.trim(), clientId: projForm.clientId,
      director: projForm.director.trim(), directorEmail: projForm.directorEmail.trim(),
      productionCompany: projForm.productionCompany.trim(),
      producer: projForm.producer.trim(), producerEmail: projForm.producerEmail.trim(),
      creativeDirector: projForm.creativeDirector.trim(),
      lead3d: projForm.lead3d.trim(), lead2d: projForm.lead2d.trim(),
      myRole: projForm.myRole.trim(), dueDate: projForm.dueDate, notes: projForm.notes.trim(),
      status: projForm.status || "active",
    };
    if (editProjId) {
      setProjects(prev => prev.map(p => p.id === editProjId ? { ...p, ...data } : p));
    } else {
      setProjects(prev => [{ id: uid(), ...data, createdAt: Date.now() }, ...prev]);
    }
    setShowAddProj(false); setEditProjId(null);
  };

  const pf = (k, v) => setProjForm(prev => ({ ...prev, [k]: v }));

  // Helper to show project detail pills
  const projDetails = (p) => {
    const details = [];
    if (p.director) details.push(`Dir: ${p.director}`);
    if (p.producer) details.push(`Prod: ${p.producer}`);
    if (p.productionCompany) details.push(p.productionCompany);
    if (p.creativeDirector) details.push(`CD: ${p.creativeDirector}`);
    if (p.lead3d) details.push(`3D: ${p.lead3d}`);
    if (p.lead2d) details.push(`2D: ${p.lead2d}`);
    if (p.myRole) details.push(`Role: ${p.myRole}`);
    if (p.dueDate) details.push(`Due: ${fmtDateShort(p.dueDate)}`);
    return details;
  };

  const toggleExpand = (id) => setExpandedClients(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 750, letterSpacing: "-0.03em" }}>Clients & Projects</h2>
        <Btn v="primary" onClick={startAdd}>+ Client</Btn>
      </div>

      {clients.length === 0 ? (
        <Empty title="No clients" sub="Add your first client" action={<Btn v="primary" onClick={startAdd}>+ Add Client</Btn>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {clients.map(c => {
            const cProjects = projects.filter(p => p.clientId === c.id);
            const cEntries = timeEntries.filter(e => { const p = projects.find(pr => pr.id === e.projectId); return p && p.clientId === c.id; });
            const expanded = !!expandedClients[c.id];
            const activeCount = cProjects.filter(p => (p.status || "active") === "active").length;
            return (
              <div key={c.id} style={{
                background: t.white, border: `1px solid ${t.border}`, borderRadius: "10px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)", overflow: "hidden",
              }}>
                {/* Client header — click to expand */}
                <div
                  onClick={() => toggleExpand(c.id)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 18px", cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{
                      fontSize: "11px", color: t.textTertiary, transition: "transform 0.15s",
                      transform: expanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block",
                    }}>&#9654;</span>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: t.text }}>{c.name}</div>
                      <div style={{ fontSize: "12px", color: t.textTertiary, marginTop: "2px" }}>
                        {activeCount} active project{activeCount !== 1 ? "s" : ""} &middot; {cEntries.length} entries
                        {c.email && <span> &middot; {c.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "4px" }} onClick={ev => ev.stopPropagation()}>
                    <Btn v="ghost" size="sm" onClick={() => startEdit(c)}>Edit</Btn>
                  </div>
                </div>

                {/* Expanded content */}
                {expanded && (
                  <div style={{ padding: "0 18px 14px", borderTop: `1px solid ${t.borderLight}` }}>
                    {cProjects.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "12px" }}>
                        {[...cProjects].sort((a, b) => {
                          const order = { active: 0, on_hold: 1, complete: 2 };
                          return (order[a.status || "active"] || 0) - (order[b.status || "active"] || 0);
                        }).map(p => {
                          const details = projDetails(p);
                          const ps = PROJECT_STATUS[p.status || "active"];
                          const dimmed = p.status === "complete" || p.status === "on_hold";
                          return (
                            <div key={p.id}
                              onClick={() => openEditProj(p)}
                              style={{
                                padding: "8px 12px", borderRadius: "6px", cursor: "pointer",
                                background: t.surfaceAlt, border: `1px solid ${t.borderLight}`,
                                transition: "border-color 0.1s",
                                opacity: dimmed ? 0.55 : 1,
                              }}
                              onMouseEnter={ev => ev.currentTarget.style.borderColor = t.border}
                              onMouseLeave={ev => ev.currentTarget.style.borderColor = t.borderLight}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "13px", fontWeight: 600, color: t.text }}>{p.name}</span>
                                <Tag color={ps.color} bg={ps.bg}>{ps.label}</Tag>
                                {p.dueDate && (
                                  <span style={{ fontSize: "11px", color: p.dueDate < todayISO() ? t.red : t.textTertiary, fontFamily: "monospace" }}>
                                    Due {fmtDateShort(p.dueDate)}
                                  </span>
                                )}
                              </div>
                              {details.length > 0 && (
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                                  {details.map((d, i) => (
                                    <span key={i} style={{ fontSize: "11px", color: t.textTertiary }}>{d}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                      <Btn v="ghost" size="sm" onClick={() => openAddProj(c.id)}>+ Add Project</Btn>
                      {confirmDelete === c.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "12px", color: t.red, fontWeight: 600 }}>Delete {c.name} and all projects?</span>
                          <Btn v="danger" size="sm" onClick={() => {
                            setClients(prev => prev.filter(x => x.id !== c.id));
                            setProjects(prev => prev.filter(p => p.clientId !== c.id));
                            setConfirmDelete(null);
                          }}>Yes, delete</Btn>
                          <Btn size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Btn>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(c.id)}
                          style={{
                            background: "none", border: "none", fontSize: "12px", color: t.textTertiary,
                            cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
                          }}
                          onMouseEnter={ev => ev.currentTarget.style.color = t.red}
                          onMouseLeave={ev => ev.currentTarget.style.color = t.textTertiary}
                        >Delete client</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Client modal */}
      {showAdd && (
        <Modal title={editId ? "Edit Client" : "New Client"} onClose={() => setShowAdd(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Field label="Name" value={form.name} onChange={v => setForm({...form, name:v})} placeholder="e.g. Coffee and TV" />
            <Field label="Email" value={form.email} onChange={v => setForm({...form, email:v})} placeholder="producer@agency.com" />
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSecondary, display: "block", marginBottom: "8px" }}>Negotiated Rates (leave blank for defaults)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {SERVICE_TYPES.filter(s => s.id !== "expense").map(s => (
                  <Field key={s.id} label={`${s.label} (default: ${fmt(settings.serviceRates?.[s.id] ?? s.defaultRate)})`}
                    type="number" value={form.serviceRates?.[s.id] ?? ""}
                    onChange={v => setServiceRate(s.id, v)}
                    placeholder={String(settings.serviceRates?.[s.id] ?? s.defaultRate)} />
                ))}
              </div>
            </div>
            <TextArea label="Notes" value={form.notes} onChange={v => setForm({...form, notes:v})} rows={2} />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "6px" }}>
              <Btn onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn v="primary" onClick={saveClient} disabled={!form.name.trim()}>{editId ? "Save" : "Add Client"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Project modal */}
      {showAddProj && (
        <Modal title={editProjId ? "Edit Project" : "New Project"} onClose={() => { setShowAddProj(false); setEditProjId(null); }} width={540}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Sel label="Client" value={projForm.clientId} onChange={v => pf("clientId", v)}
              options={[{value:"",label:"Select..."}, ...clients.map(c => ({value:c.id, label:c.name}))]} />
            <Field label="Project Name" value={projForm.name} onChange={v => pf("name", v)} placeholder="e.g. Nike Spring Campaign" />
            <Field label="Production Company" value={projForm.productionCompany} onChange={v => pf("productionCompany", v)} placeholder="e.g. MPC, The Mill" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <Field label="Director" value={projForm.director} onChange={v => pf("director", v)} />
              <Field label="Director Email" value={projForm.directorEmail} onChange={v => pf("directorEmail", v)} placeholder="email" />
              <Field label="Producer" value={projForm.producer} onChange={v => pf("producer", v)} />
              <Field label="Producer Email" value={projForm.producerEmail} onChange={v => pf("producerEmail", v)} placeholder="email" />
              <Field label="Creative Director" value={projForm.creativeDirector} onChange={v => pf("creativeDirector", v)} />
              <Field label="3D Lead" value={projForm.lead3d} onChange={v => pf("lead3d", v)} />
              <Field label="2D Lead" value={projForm.lead2d} onChange={v => pf("lead2d", v)} />
              <Field label="My Role" value={projForm.myRole} onChange={v => pf("myRole", v)} placeholder="e.g. Creative Director, 3D Lead" />
              <Field label="Due Date" type="date" value={projForm.dueDate} onChange={v => pf("dueDate", v)} />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", fontWeight: 600, color: t.textSecondary, display: "block", marginBottom: "6px" }}>Status</label>
              <div style={{ display: "flex", gap: "6px" }}>
                {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                  <button key={k} onClick={() => pf("status", k)}
                    style={{
                      flex: 1, padding: "8px", borderRadius: "6px", cursor: "pointer",
                      fontSize: "12px", fontWeight: 650, fontFamily: "'Instrument Sans', sans-serif",
                      border: `1px solid ${projForm.status === k ? v.color : t.border}`,
                      background: projForm.status === k ? v.bg : t.white,
                      color: projForm.status === k ? v.color : t.textTertiary,
                      transition: "all 0.15s",
                    }}>{v.label}</button>
                ))}
              </div>
            </div>
            <TextArea label="Notes" value={projForm.notes} onChange={v => pf("notes", v)} rows={2} placeholder="Brief, shot list link, special requirements..." />
            <div style={{ display: "flex", gap: "8px", justifyContent: "space-between", alignItems: "center", marginTop: "6px" }}>
              {editProjId ? (
                <button onClick={() => { setProjects(prev => prev.filter(p => p.id !== editProjId)); setShowAddProj(false); setEditProjId(null); }}
                  style={{ background: "none", border: "none", fontSize: "12px", color: t.red, cursor: "pointer", fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif" }}>
                  Delete project
                </button>
              ) : <div />}
              <div style={{ display: "flex", gap: "8px" }}>
                <Btn onClick={() => { setShowAddProj(false); setEditProjId(null); }}>Cancel</Btn>
                <Btn v="primary" onClick={saveProj} disabled={!projForm.name.trim() || !projForm.clientId}>{editProjId ? "Save" : "Add Project"}</Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================
// REPORTS
// ============================================================
function Reports({ timeEntries, projects, clients, invoices, settings, getClient, getProject }) {
  const [period, setPeriod] = useState("month"); // week, month, quarter, year
  const [offset, setOffset] = useState(0);

  const { label, startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (period === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() + offset * 7);
      const day = d.getDay();
      const mon = new Date(d);
      mon.setDate(d.getDate() - ((day + 6) % 7));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { label: `Week of ${mon.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, startDate: toISO(mon), endDate: toISO(sun) };
    }
    if (period === "month") {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), startDate: toISO(d), endDate: toISO(end) };
    }
    if (period === "quarter") {
      const q = Math.floor(now.getMonth() / 3) + offset;
      const year = now.getFullYear() + Math.floor(q / 4);
      const qMod = ((q % 4) + 4) % 4;
      const start = new Date(year, qMod * 3, 1);
      const end = new Date(year, qMod * 3 + 3, 0);
      return { label: `Q${qMod + 1} ${year}`, startDate: toISO(start), endDate: toISO(end) };
    }
    // year
    const y = now.getFullYear() + offset;
    return { label: String(y), startDate: `${y}-01-01`, endDate: `${y}-12-31` };
  }, [period, offset]);

  const periodEntries = useMemo(() =>
    timeEntries.filter(e => e.date >= startDate && e.date <= endDate && e.projectId !== PERSONAL_PROJECT_ID),
    [timeEntries, startDate, endDate]
  );

  const totalRevenue = periodEntries.reduce((s, e) => s + (e.amount || 0), 0);
  const totalHours = periodEntries.length;
  const uniqueDays = new Set(periodEntries.map(e => e.date)).size;

  // By client
  const byClient = useMemo(() => {
    const m = {};
    periodEntries.forEach(e => {
      const proj = getProject(e.projectId);
      const clientId = proj?.clientId || "unknown";
      const clientName = getClient(clientId)?.name || "Unknown";
      if (!m[clientId]) m[clientId] = { name: clientName, hours: 0, revenue: 0, days: new Set(), projects: {} };
      m[clientId].hours++;
      m[clientId].revenue += e.amount || 0;
      m[clientId].days.add(e.date);
      const pName = proj?.name || "?";
      if (!m[clientId].projects[pName]) m[clientId].projects[pName] = { hours: 0, revenue: 0 };
      m[clientId].projects[pName].hours++;
      m[clientId].projects[pName].revenue += e.amount || 0;
    });
    return Object.values(m).sort((a, b) => b.revenue - a.revenue);
  }, [periodEntries, getProject, getClient]);

  // Utilization
  const workdaysInPeriod = useMemo(() => {
    let count = 0;
    const s = new Date(startDate + "T12:00:00"), e = new Date(endDate + "T12:00:00");
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }, [startDate, endDate]);
  const utilization = workdaysInPeriod > 0 ? Math.round((uniqueDays / workdaysInPeriod) * 100) : 0;

  // Invoiced in period
  const periodInvoiced = useMemo(() => {
    return invoices
      .filter(i => i.issueDate >= startDate && i.issueDate <= endDate)
      .reduce((s, i) => s + i.total, 0);
  }, [invoices, startDate, endDate]);

  const hide = settings.hideDollars;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 750, letterSpacing: "-0.03em" }}>Reports</h2>
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {[{ id: "week", l: "Week" }, { id: "month", l: "Month" }, { id: "quarter", l: "Quarter" }, { id: "year", l: "Year" }].map(p => (
            <button key={p.id} onClick={() => { setPeriod(p.id); setOffset(0); }}
              style={{
                padding: "6px 14px", borderRadius: "6px", border: `1px solid ${period === p.id ? t.text : t.border}`,
                background: period === p.id ? t.text : t.white, color: period === p.id ? t.white : t.textSecondary,
                fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
              }}>{p.l}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Btn size="sm" onClick={() => setOffset(o => o - 1)}>&larr;</Btn>
          <span style={{ fontSize: "14px", fontWeight: 650, minWidth: "160px", textAlign: "center" }}>{label}</span>
          <Btn size="sm" onClick={() => setOffset(o => o + 1)}>&rarr;</Btn>
          {offset !== 0 && <Btn v="ghost" size="sm" onClick={() => setOffset(0)}>Today</Btn>}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
        <Stat label="Hours" value={totalHours} sub={`${uniqueDays} days worked`} color={t.green} />
        {!hide && <Stat label="Revenue" value={fmt(totalRevenue)} sub={totalHours > 0 ? `${fmt(totalRevenue / totalHours)}/hr effective` : ""} color={t.green} />}
        <Stat label="Utilization" value={`${utilization}%`} sub={`${uniqueDays} of ${workdaysInPeriod} workdays`} color={utilization >= 50 ? t.green : t.yellow} />
        {!hide && <Stat label="Invoiced" value={fmt(periodInvoiced)} sub={`${invoices.filter(i => i.issueDate >= startDate && i.issueDate <= endDate).length} invoices`} />}
      </div>

      {/* By client breakdown */}
      {byClient.length === 0 ? (
        <Muted>No time logged in this period.</Muted>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {byClient.map(c => {
            const pct = totalHours > 0 ? Math.round((c.hours / totalHours) * 100) : 0;
            return (
              <div key={c.name} style={{
                background: t.white, border: `1px solid ${t.border}`, borderRadius: "10px",
                padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: t.text }}>{c.name}</span>
                    <span style={{ fontSize: "12px", color: t.textTertiary }}>{c.hours}h &middot; {c.days.size} days &middot; {pct}%</span>
                  </div>
                  {!hide && <span style={{ fontSize: "16px", fontFamily: "monospace", fontWeight: 750, color: t.green }}>{fmt(c.revenue)}</span>}
                </div>
                {/* Bar */}
                <div style={{ height: "6px", background: t.surfaceAlt, borderRadius: "3px", marginBottom: "10px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: t.green, borderRadius: "3px", transition: "width 0.3s" }} />
                </div>
                {/* Projects */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {Object.entries(c.projects).sort((a, b) => b[1].hours - a[1].hours).map(([name, data]) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                      <span style={{ color: t.textSecondary, flex: 1 }}>{name}</span>
                      <span style={{ color: t.textTertiary, fontSize: "12px" }}>{data.hours}h</span>
                      {!hide && <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "12px", color: t.text, minWidth: "70px", textAlign: "right" }}>{fmt(data.revenue)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SETTINGS
// ============================================================
function Settings({ settings, setSettings, clients, projects, pencils, timeEntries, invoices }) {
  const u = (k, v) => setSettings(prev => ({ ...prev, [k]: v }));
  const uRate = (k, v) => setSettings(prev => ({ ...prev, serviceRates: { ...prev.serviceRates, [k]: parseFloat(v) || 0 } }));

  const exportData = () => {
    const data = { settings, clients, projects, pencils, timeEntries, invoices, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freelance-manager-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: "520px" }}>
      <h2 style={{ fontSize: "20px", fontWeight: 750, letterSpacing: "-0.03em", marginBottom: "22px" }}>Settings</h2>

      <Card title="Business Info">
        <Field label="Name" value={settings.businessName} onChange={v => u("businessName", v)} />
        <Field label="Email" value={settings.businessEmail} onChange={v => u("businessEmail", v)} />
        <Field label="Phone" value={settings.businessPhone || ""} onChange={v => u("businessPhone", v)} />
        <TextArea label="Address" value={settings.businessAddress} onChange={v => u("businessAddress", v)} rows={2} />
      </Card>

      <Card title="Bank Details">
        <Field label="Bank Name" value={settings.bankName || ""} onChange={v => u("bankName", v)} />
        <Field label="Routing Number" value={settings.routing || ""} onChange={v => u("routing", v)} />
        <Field label="Account Number" value={settings.accountNumber || ""} onChange={v => u("accountNumber", v)} />
      </Card>

      <Card title="Default Service Rates">
        {SERVICE_TYPES.filter(s => s.id !== "expense").map(s => (
          <Field key={s.id} label={s.label} type="number" value={settings.serviceRates?.[s.id] ?? s.defaultRate}
            onChange={v => uRate(s.id, v)} />
        ))}
      </Card>

      <Card title="Invoice">
        <div style={{ display: "flex", gap: "10px" }}>
          <Field label="Prefix" value={settings.invoicePrefix} onChange={v => u("invoicePrefix", v)} style={{flex:1}} />
          <Field label="Next #" type="number" value={settings.nextInvoiceNumber} onChange={v => u("nextInvoiceNumber", parseInt(v) || 1)} style={{flex:1}} />
        </div>
        <Field label="Payment Terms (days)" type="number" value={settings.paymentTerms} onChange={v => u("paymentTerms", parseInt(v) || 30)} />
      </Card>

      <Card title="Display">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: t.text }}>Hide dollar amounts</div>
            <div style={{ fontSize: "12px", color: t.textTertiary }}>Hides billing totals on the dashboard and reports</div>
          </div>
          <button onClick={() => u("hideDollars", !settings.hideDollars)}
            style={{
              width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
              background: settings.hideDollars ? t.green : t.borderLight,
              position: "relative", transition: "background 0.2s",
            }}>
            <div style={{
              width: "18px", height: "18px", borderRadius: "50%", background: t.white,
              position: "absolute", top: "3px",
              left: settings.hideDollars ? "23px" : "3px",
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }} />
          </button>
        </div>
      </Card>

      <Card title="Data">
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: t.text }}>Export backup</div>
              <div style={{ fontSize: "12px", color: t.textTertiary }}>
                {clients?.length || 0} clients, {projects?.length || 0} projects, {timeEntries?.length || 0} time entries, {invoices?.length || 0} invoices
              </div>
            </div>
            <Btn onClick={exportData}>&#8595; Export JSON</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{
      background: t.white, border: `1px solid ${t.border}`, borderRadius: "10px",
      padding: "18px", marginBottom: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
    }}>
      <h3 style={{ fontSize: "12px", fontWeight: 700, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "14px" }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{children}</div>
    </div>
  );
}
