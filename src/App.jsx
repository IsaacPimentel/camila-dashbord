import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Plus, X, Check, Trash2, Building2, Truck, CalendarDays, Circle, CheckCircle2, LayoutGrid, Rows3, ShieldAlert, ClipboardList, Archive, Pencil, Download, Upload, Copy } from 'lucide-react';

const STORAGE_KEY = 'kam-dashboard-state-v2';
const CATEGORIES = ['Cotización', 'Arte', 'Aprobación', 'Envío', 'Seguimiento', 'Otro'];
const STAGES = ['no_implementado', 'implementando', 'finalizado'];
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);

function stageMeta(stage) {
  if (stage === 'implementando') return { label: 'Implementándose', tone: 'amber' };
  if (stage === 'finalizado') return { label: 'Finalizado', tone: 'green' };
  return { label: 'No implementado', tone: 'gray' };
}
function nextStage(stage) {
  const i = STAGES.indexOf(stage);
  return STAGES[(i + 1) % STAGES.length];
}
function defaultSunat(campaignId) {
  return [
    { id: uid(), campaignId, text: 'Correo con cotización guardado', done: false },
    { id: uid(), campaignId, text: 'OC guardada en carpeta', done: false },
    { id: uid(), campaignId, text: 'Reporte final guardado', done: false },
  ];
}

function seedData() {
  const molitalia = uid(), bacus = uid();
  const dynamic = uid(), boom = uid();
  const camp1 = uid(), camp2 = uid(), camp3 = uid();
  const d = (offset) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + offset);
    return dt.toISOString().slice(0, 10);
  };
  return {
    accounts: [
      { id: molitalia, name: 'Molitalia' },
      { id: bacus, name: 'Bacus' },
    ],
    suppliers: [
      { id: dynamic, name: 'Dynamic' },
      { id: boom, name: 'Boom' },
    ],
    campaigns: [
      { id: camp1, accountId: molitalia, name: 'Verano 2026', elemento: 'Jaladista', startDate: d(2), endDate: d(16), stage: 'implementando', cotizacionAprobada: true, ordenCompra: false, facturado: false },
      { id: camp2, accountId: molitalia, name: 'Verano 2026', elemento: 'Cabecera', startDate: d(6), endDate: d(20), stage: 'no_implementado', cotizacionAprobada: false, ordenCompra: false, facturado: false },
      { id: camp3, accountId: bacus, name: 'Lanzamiento', elemento: 'Punta de góndola', startDate: d(11), endDate: d(25), stage: 'no_implementado', cotizacionAprobada: false, ordenCompra: false, facturado: false },
    ],
    checklist: [
      { id: uid(), campaignId: camp1, text: 'Confirmar aprobación de arte con cliente', category: 'Aprobación', done: false },
    ],
    sunat: [
      ...defaultSunat(camp1),
      ...defaultSunat(camp2),
      ...defaultSunat(camp3),
    ],
    pendings: [
      { id: uid(), campaignId: camp1, supplierId: dynamic, description: 'Prototipo de cabecera', expectedDate: d(3), done: false },
      { id: uid(), campaignId: camp2, supplierId: dynamic, description: 'Muestras de color', expectedDate: d(-1), done: false },
      { id: uid(), campaignId: camp3, supplierId: boom, description: 'Arte final aprobado', expectedDate: d(4), done: false },
    ],
    quickTasks: [
      { id: uid(), accountId: molitalia, text: 'Reposición de jaladista dañado', dueDate: d(1), done: false },
    ],
  };
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - t) / 86400000);
}

function urgency(days) {
  if (days === null) return { label: 'Sin fecha', tone: 'gray' };
  if (days < 0) return { label: `${Math.abs(days)}d de atraso`, tone: 'red' };
  if (days === 0) return { label: 'Hoy', tone: 'red' };
  if (days <= 2) return { label: `En ${days}d`, tone: 'red' };
  if (days <= 7) return { label: `En ${days}d`, tone: 'amber' };
  return { label: `En ${days}d`, tone: 'green' };
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  const [y, m, dd] = dateStr.split('-');
  return `${dd}/${m}/${y.slice(2)}`;
}

export default function App() {
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('campanas');
  const [groupByAccount, setGroupByAccount] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [showNewQuick, setShowNewQuick] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [hideDonePendings, setHideDonePendings] = useState(true);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY);
        setData(res && res.value ? JSON.parse(res.value) : seedData());
      } catch (e) {
        setData(seedData());
      }
      setReady(true);
    })();
  }, []);

  const persist = useCallback((next) => {
    setData(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify(next)); }
      catch (e) { console.error('storage error', e); }
    }, 250);
  }, []);

  const accountName = (id) => data?.accounts.find(a => a.id === id)?.name || '—';
  const supplierName = (id) => data?.suppliers.find(s => s.id === id)?.name || '—';
  const campaignById = (id) => data?.campaigns.find(c => c.id === id);

  // ---- mutations ----
  const addAccountIfNew = (name, current) => {
    const found = current.accounts.find(a => a.name.toLowerCase() === name.trim().toLowerCase());
    if (found) return { accounts: current.accounts, id: found.id };
    const acc = { id: uid(), name: name.trim() };
    return { accounts: [...current.accounts, acc], id: acc.id };
  };

  const addCampaign = ({ accountName: accName, name, elemento, startDate, endDate }) => {
    const { accounts, id: accountId } = addAccountIfNew(accName, data);
    const campaignId = uid();
    const campaign = {
      id: campaignId, accountId, name: name.trim(), elemento: elemento.trim(),
      startDate, endDate, stage: 'no_implementado',
      cotizacionAprobada: false, ordenCompra: false, facturado: false,
    };
    persist({
      ...data, accounts,
      campaigns: [...data.campaigns, campaign],
      sunat: [...data.sunat, ...defaultSunat(campaignId)],
    });
    setShowNewCampaign(false);
  };

  const deleteCampaign = (campaignId) => {
    persist({
      ...data,
      campaigns: data.campaigns.filter(c => c.id !== campaignId),
      checklist: data.checklist.filter(c => c.campaignId !== campaignId),
      pendings: data.pendings.filter(p => p.campaignId !== campaignId),
      sunat: data.sunat.filter(s => s.campaignId !== campaignId),
    });
    setSelectedCampaignId(null);
  };

  const updateCampaignField = (campaignId, field, value) => {
    persist({ ...data, campaigns: data.campaigns.map(c => c.id === campaignId ? { ...c, [field]: value } : c) });
  };
  const cycleStage = (campaignId) => {
    const c = data.campaigns.find(x => x.id === campaignId);
    if (!c) return;
    updateCampaignField(campaignId, 'stage', nextStage(c.stage || 'no_implementado'));
  };

  const addChecklistItem = (campaignId, text, category) => {
    if (!text.trim()) return;
    persist({ ...data, checklist: [...data.checklist, { id: uid(), campaignId, text: text.trim(), category, done: false }] });
  };
  const toggleChecklist = (id) => persist({ ...data, checklist: data.checklist.map(i => i.id === id ? { ...i, done: !i.done } : i) });
  const deleteChecklistItem = (id) => persist({ ...data, checklist: data.checklist.filter(i => i.id !== id) });

  const addSunatItem = (campaignId, text) => {
    if (!text.trim()) return;
    persist({ ...data, sunat: [...data.sunat, { id: uid(), campaignId, text: text.trim(), done: false }] });
  };
  const toggleSunat = (id) => persist({ ...data, sunat: data.sunat.map(i => i.id === id ? { ...i, done: !i.done } : i) });
  const deleteSunatItem = (id) => persist({ ...data, sunat: data.sunat.filter(i => i.id !== id) });

  const addSupplier = (name) => {
    if (!name.trim()) return;
    const exists = data.suppliers.find(s => s.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) { setShowNewSupplier(false); return; }
    persist({ ...data, suppliers: [...data.suppliers, { id: uid(), name: name.trim() }] });
    setShowNewSupplier(false);
  };

  const addPending = (campaignId, { supplierName: supName, description, expectedDate }) => {
    if (!description.trim() || !supName.trim()) return;
    let suppliers = data.suppliers;
    let supplier = suppliers.find(s => s.name.toLowerCase() === supName.trim().toLowerCase());
    if (!supplier) {
      supplier = { id: uid(), name: supName.trim() };
      suppliers = [...suppliers, supplier];
    }
    persist({
      ...data,
      suppliers,
      pendings: [...data.pendings, { id: uid(), campaignId, supplierId: supplier.id, description: description.trim(), expectedDate, done: false }],
    });
  };
  const togglePending = (id) => persist({ ...data, pendings: data.pendings.map(p => p.id === id ? { ...p, done: !p.done } : p) });
  const deletePending = (id) => persist({ ...data, pendings: data.pendings.filter(p => p.id !== id) });

  const addQuickTask = ({ accountName: accName, text, dueDate }) => {
    const { accounts, id: accountId } = addAccountIfNew(accName, data);
    persist({ ...data, accounts, quickTasks: [...data.quickTasks, { id: uid(), accountId, text: text.trim(), dueDate: dueDate || null, done: false }] });
    setShowNewQuick(false);
  };
  const toggleQuickTask = (id) => persist({ ...data, quickTasks: data.quickTasks.map(q => q.id === id ? { ...q, done: !q.done } : q) });
  const deleteQuickTask = (id) => persist({ ...data, quickTasks: data.quickTasks.filter(q => q.id !== id) });

  // ---- derived ----
  const combinedItems = useMemo(() => {
    if (!data) return [];
    const camps = data.campaigns
      .filter(c => showClosed || !(c.ordenCompra && c.facturado))
      .map(c => ({ kind: 'campaign', accountId: c.accountId, sortDate: c.startDate, item: c }));
    const quicks = data.quickTasks
      .filter(q => showClosed || !q.done)
      .map(q => ({ kind: 'quick', accountId: q.accountId, sortDate: q.dueDate, item: q }));
    return [...camps, ...quicks].sort((a, b) => {
      const da = daysUntil(a.sortDate); const db = daysUntil(b.sortDate);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }, [data, showClosed]);

  const groupedItems = useMemo(() => {
    const map = new Map();
    if (!data) return map;
    for (const acc of data.accounts) map.set(acc.id, []);
    for (const entry of combinedItems) {
      if (!map.has(entry.accountId)) map.set(entry.accountId, []);
      map.get(entry.accountId).push(entry);
    }
    return map;
  }, [combinedItems, data]);

  const supplierPendingCounts = useMemo(() => {
    const map = {};
    if (!data) return map;
    for (const s of data.suppliers) map[s.id] = data.pendings.filter(p => p.supplierId === s.id && !p.done).length;
    return map;
  }, [data]);

  if (!ready || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0B1220', color: '#93A1BE', fontFamily: 'Inter, sans-serif' }}>
        Cargando…
      </div>
    );
  }

  const openTasksCount = (campaignId) => data.checklist.filter(i => i.campaignId === campaignId && !i.done).length;
  const openPendingsCount = (campaignId) => data.pendings.filter(p => p.campaignId === campaignId && !p.done).length;
  const sunatFor = (campaignId) => data.sunat.filter(s => s.campaignId === campaignId);

  const selectedCampaign = selectedCampaignId ? campaignById(selectedCampaignId) : null;
  const selectedSupplier = selectedSupplierId ? data.suppliers.find(s => s.id === selectedSupplierId) : null;

  return (
    <div className="kam-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .kam-root {
          --bg: #0B1220; --panel: #121A2C; --border: #24304A;
          --text: #EAF0FA; --text-dim: #8C9BBD; --text-faint: #5C6A8A;
          --red: #E4574B; --red-bg: #E4574B22; --amber: #E3A23D; --amber-bg: #E3A23D22;
          --green: #4CB292; --green-bg: #4CB29222; --gray: #5C6A8A; --gray-bg: #5C6A8A22;
          --gold: #D8B45F; --gold-bg: #D8B45F22;
          font-family: 'Inter', sans-serif;
          background: var(--bg); color: var(--text);
          min-height: 100vh; padding: 28px 20px 60px;
        }
        .kam-root * { box-sizing: border-box; }
        .kam-head { max-width: 1080px; margin: 0 auto 22px; display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .kam-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 26px; letter-spacing: -0.01em; margin: 0; }
        .kam-sub { color: var(--text-dim); font-size: 13.5px; margin-top: 4px; }
        .kam-date { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; color: var(--text-faint); }
        .kam-tabs { max-width: 1080px; margin: 0 auto 20px; display: flex; gap: 6px; border-bottom: 1px solid var(--border); }
        .kam-tab { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 14.5px; padding: 10px 4px; margin-right: 22px; background: none; border: none; color: var(--text-faint); cursor: pointer; border-bottom: 2px solid transparent; }
        .kam-tab.active { color: var(--text); border-bottom-color: var(--gold); }
        .kam-toolbar { max-width: 1080px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .kam-toolbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .kam-btn { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 13.5px; display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 9px; border: 1px solid var(--border); background: var(--panel); color: var(--text); cursor: pointer; }
        .kam-btn:hover { border-color: var(--gold); }
        .kam-btn.primary { background: var(--gold); color: #1A1305; border-color: var(--gold); }
        .kam-btn.ghost { background: transparent; }
        .kam-toggle-group { display: flex; border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
        .kam-toggle { background: var(--panel); border: none; color: var(--text-faint); padding: 8px 10px; cursor: pointer; display: flex; align-items: center; }
        .kam-toggle.active { background: var(--border); color: var(--text); }
        .kam-check-label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-dim); cursor: pointer; user-select: none; }
        .kam-grid { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
        .kam-account-block { max-width: 1080px; margin: 0 auto 24px; }
        .kam-account-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 15px; color: var(--text-dim); margin-bottom: 10px; display: flex; align-items: center; gap: 7px; }
        .kam-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 14px 15px; cursor: pointer; transition: border-color .15s ease; }
        .kam-card:hover { border-color: var(--gold); }
        .kam-card.quick { border-style: dashed; }
        .kam-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .kam-card-account { font-size: 11.5px; color: var(--text-faint); }
        .kam-card-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 16px; margin-top: 2px; }
        .kam-elemento-badge { display: inline-block; margin-top: 6px; font-size: 11.5px; font-weight: 600; padding: 3px 9px; border-radius: 100px; background: var(--gold-bg); color: var(--gold); }
        .kam-chip { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; padding: 3px 9px; border-radius: 100px; white-space: nowrap; border: none; cursor: default; }
        .kam-chip.red { background: var(--red-bg); color: var(--red); }
        .kam-chip.amber { background: var(--amber-bg); color: var(--amber); }
        .kam-chip.green { background: var(--green-bg); color: var(--green); }
        .kam-chip.gray { background: var(--gray-bg); color: var(--gray); }
        .kam-stage-chip { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 11px; padding: 4px 10px; border-radius: 100px; cursor: pointer; border: 1px solid transparent; margin-top: 8px; display: inline-block; }
        .kam-stage-chip.gray { background: var(--gray-bg); color: var(--text-dim); border-color: var(--border); }
        .kam-stage-chip.amber { background: var(--amber-bg); color: var(--amber); border-color: var(--amber); }
        .kam-stage-chip.green { background: var(--green-bg); color: var(--green); border-color: var(--green); }
        .kam-card-meta { display: flex; gap: 12px; margin-top: 10px; font-size: 12px; color: var(--text-dim); flex-wrap: wrap; }
        .kam-card-meta span { display: flex; align-items: center; gap: 4px; }
        .kam-milestone-icons { display: flex; gap: 6px; margin-top: 9px; }
        .kam-mini { font-size: 10px; padding: 2px 7px; border-radius: 6px; background: var(--gray-bg); color: var(--text-faint); }
        .kam-mini.on { background: var(--green-bg); color: var(--green); }
        .kam-empty { max-width: 1080px; margin: 40px auto; text-align: center; color: var(--text-faint); font-size: 14px; }

        .kam-overlay { position: fixed; inset: 0; background: #05070ecc; display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
        .kam-modal { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 540px; max-height: 88vh; overflow-y: auto; padding: 22px; }
        .kam-modal-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .kam-modal-title { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 19px; }
        .kam-modal-account { font-size: 12.5px; color: var(--text-faint); margin-top: 3px; }
        .kam-x { background: none; border: none; color: var(--text-faint); cursor: pointer; padding: 4px; }
        .kam-x:hover { color: var(--text); }
        .kam-elemento-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
        .kam-elemento-input { background: #0D1424; border: 1px solid var(--gold); color: var(--gold); border-radius: 100px; padding: 3px 10px; font-size: 12px; font-weight: 600; font-family: 'Inter', sans-serif; }
        .kam-edit-icon { color: var(--text-faint); cursor: pointer; display: flex; }
        .kam-edit-icon:hover { color: var(--gold); }
        .kam-field-row { display: flex; gap: 10px; margin-top: 14px; }
        .kam-field { flex: 1; }
        .kam-label { font-size: 11.5px; color: var(--text-faint); margin-bottom: 5px; display: block; }
        .kam-input, .kam-select { width: 100%; background: #0D1424; border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 8px 10px; font-size: 13.5px; font-family: 'Inter', sans-serif; }
        .kam-input:focus, .kam-select:focus { outline: none; border-color: var(--gold); }
        .kam-section-label { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 13.5px; margin: 22px 0 4px; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }
        .kam-section-note { font-size: 11.5px; color: var(--text-faint); margin-bottom: 10px; }
        .kam-item { display: flex; align-items: center; gap: 9px; padding: 8px 0; border-bottom: 1px solid var(--border); }
        .kam-item:last-child { border-bottom: none; }
        .kam-item-check { background: none; border: none; cursor: pointer; color: var(--text-faint); display: flex; }
        .kam-item-check.done { color: var(--green); }
        .kam-item-text { flex: 1; font-size: 13.5px; }
        .kam-item-text.done { color: var(--text-faint); text-decoration: line-through; }
        .kam-item-cat { font-size: 10.5px; color: var(--text-faint); background: #0D1424; border: 1px solid var(--border); border-radius: 6px; padding: 2px 7px; }
        .kam-item-del { background: none; border: none; color: var(--text-faint); cursor: pointer; opacity: .5; padding: 3px; }
        .kam-item-del:hover { opacity: 1; color: var(--red); }
        .kam-add-row { display: flex; gap: 7px; margin-top: 10px; }
        .kam-add-row .kam-input { flex: 2; }
        .kam-add-row .kam-select { flex: 1; }
        .kam-add-btn { background: var(--border); border: none; color: var(--text); border-radius: 8px; padding: 0 12px; cursor: pointer; display: flex; align-items: center; }
        .kam-add-btn:hover { background: var(--gold); color: #1A1305; }
        .kam-pending-sub { font-size: 11.5px; color: var(--text-faint); margin-top: -1px; }
        .kam-pending-supplier { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: var(--gold); background: #D8B45F1c; border-radius: 6px; padding: 2px 7px; white-space: nowrap; }
        .kam-danger-row { margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; }
        .kam-link-danger { background: none; border: none; color: var(--text-faint); font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 5px; }
        .kam-link-danger:hover { color: var(--red); }

        .kam-stage-control { display: flex; gap: 6px; margin-top: 8px; }
        .kam-stage-btn { flex: 1; font-size: 12px; font-weight: 600; padding: 8px 6px; border-radius: 8px; border: 1px solid var(--border); background: #0D1424; color: var(--text-faint); cursor: pointer; text-align: center; }
        .kam-stage-btn.sel-gray { background: var(--gray-bg); color: var(--text); border-color: var(--gray); }
        .kam-stage-btn.sel-amber { background: var(--amber-bg); color: var(--amber); border-color: var(--amber); }
        .kam-stage-btn.sel-green { background: var(--green-bg); color: var(--green); border-color: var(--green); }

        .kam-milestone-row { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
        .kam-milestone-btn { flex: 1; min-width: 140px; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 9px; border: 1px solid var(--border); background: #0D1424; color: var(--text-dim); cursor: pointer; font-size: 13px; font-weight: 600; }
        .kam-milestone-btn.on { background: var(--green-bg); border-color: var(--green); color: var(--green); }
        .kam-milestone-btn.gold.on { background: var(--gold-bg); border-color: var(--gold); color: var(--gold); }
        .kam-milestone-note { font-size: 11.5px; color: var(--text-faint); margin-top: 6px; }
        .kam-closed-banner { margin-top: 12px; background: var(--green-bg); color: var(--green); border: 1px solid var(--green); border-radius: 9px; padding: 10px 12px; font-size: 12.5px; font-weight: 600; }
        .kam-sunat-label { color: var(--amber); }

        .kam-supplier-grid { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .kam-supplier-card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 18px; cursor: pointer; }
        .kam-supplier-card:hover { border-color: var(--gold); }
        .kam-supplier-name { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 17px; display: flex; align-items: center; gap: 8px; }
        .kam-supplier-count { margin-top: 10px; font-family: 'IBM Plex Mono', monospace; font-size: 22px; color: var(--gold); }
        .kam-supplier-count-label { font-size: 11.5px; color: var(--text-faint); }
        .kam-pending-row { padding: 10px 0; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 10px; }
        .kam-pending-row:last-child { border-bottom: none; }
        .kam-pending-desc { font-size: 13.5px; }
        .kam-pending-desc.done { color: var(--text-faint); text-decoration: line-through; }
        .kam-pending-context { font-size: 11.5px; color: var(--text-faint); margin-top: 2px; }
      `}</style>

      <div className="kam-head">
        <div>
          <h1 className="kam-title">Centro de control KAM</h1>
          <div className="kam-sub">{data.campaigns.length} campañas · {data.quickTasks.filter(q => !q.done).length} pendientes rápidos · {data.accounts.length} cuentas</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="kam-date">{new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <button className="kam-btn ghost" onClick={() => setShowDataModal(true)}><Download size={14} /> Datos</button>
        </div>
      </div>

      <div className="kam-tabs">
        <button className={`kam-tab ${tab === 'campanas' ? 'active' : ''}`} onClick={() => setTab('campanas')}>Campañas</button>
        <button className={`kam-tab ${tab === 'proveedores' ? 'active' : ''}`} onClick={() => setTab('proveedores')}>Proveedores</button>
      </div>

      {tab === 'campanas' && (
        <>
          <div className="kam-toolbar">
            <div className="kam-toolbar-left">
              <div className="kam-toggle-group">
                <button className={`kam-toggle ${!groupByAccount ? 'active' : ''}`} onClick={() => setGroupByAccount(false)} title="Todas ordenadas por urgencia"><Rows3 size={15} /></button>
                <button className={`kam-toggle ${groupByAccount ? 'active' : ''}`} onClick={() => setGroupByAccount(true)} title="Agrupadas por cuenta"><LayoutGrid size={15} /></button>
              </div>
              <label className="kam-check-label"><input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} /> <Archive size={13} /> Mostrar cerradas</label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="kam-btn ghost" onClick={() => setShowNewQuick(true)}><ClipboardList size={15} /> Pendiente rápido</button>
              <button className="kam-btn primary" onClick={() => setShowNewCampaign(true)}><Plus size={15} /> Nueva campaña</button>
            </div>
          </div>

          {combinedItems.length === 0 && (
            <div className="kam-empty">Nada por aquí. Crea una campaña o un pendiente rápido.</div>
          )}

          {!groupByAccount && (
            <div className="kam-grid">
              {combinedItems.map(entry => entry.kind === 'campaign' ? (
                <CampaignCard key={entry.item.id} campaign={entry.item} accountName={accountName(entry.item.accountId)}
                  openTasks={openTasksCount(entry.item.id)} openPendings={openPendingsCount(entry.item.id)}
                  onClick={() => setSelectedCampaignId(entry.item.id)}
                  onCycleStage={() => cycleStage(entry.item.id)} />
              ) : (
                <QuickCard key={entry.item.id} task={entry.item} accountName={accountName(entry.item.accountId)}
                  onToggle={() => toggleQuickTask(entry.item.id)} onDelete={() => deleteQuickTask(entry.item.id)} />
              ))}
            </div>
          )}

          {groupByAccount && data.accounts.map(acc => {
            const items = groupedItems.get(acc.id) || [];
            if (items.length === 0) return null;
            return (
              <div className="kam-account-block" key={acc.id}>
                <div className="kam-account-name"><Building2 size={15} /> {acc.name}</div>
                <div className="kam-grid">
                  {items.map(entry => entry.kind === 'campaign' ? (
                    <CampaignCard key={entry.item.id} campaign={entry.item} accountName={acc.name}
                      openTasks={openTasksCount(entry.item.id)} openPendings={openPendingsCount(entry.item.id)}
                      onClick={() => setSelectedCampaignId(entry.item.id)}
                      onCycleStage={() => cycleStage(entry.item.id)} hideAccount />
                  ) : (
                    <QuickCard key={entry.item.id} task={entry.item} accountName={acc.name}
                      onToggle={() => toggleQuickTask(entry.item.id)} onDelete={() => deleteQuickTask(entry.item.id)} hideAccount />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === 'proveedores' && (
        <>
          <div className="kam-toolbar">
            <div />
            <button className="kam-btn primary" onClick={() => setShowNewSupplier(true)}><Plus size={15} /> Nuevo proveedor</button>
          </div>
          {data.suppliers.length === 0 && <div className="kam-empty">Aún no tienes proveedores registrados.</div>}
          <div className="kam-supplier-grid">
            {data.suppliers.map(s => (
              <div className="kam-supplier-card" key={s.id} onClick={() => setSelectedSupplierId(s.id)}>
                <div className="kam-supplier-name"><Truck size={17} /> {s.name}</div>
                <div className="kam-supplier-count">{supplierPendingCounts[s.id] || 0}</div>
                <div className="kam-supplier-count-label">pendientes abiertos</div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedCampaign && (
        <CampaignModal
          campaign={selectedCampaign}
          accName={accountName(selectedCampaign.accountId)}
          checklist={data.checklist.filter(i => i.campaignId === selectedCampaign.id)}
          sunatItems={sunatFor(selectedCampaign.id)}
          pendings={data.pendings.filter(p => p.campaignId === selectedCampaign.id)}
          supplierName={supplierName}
          supplierNames={data.suppliers.map(s => s.name)}
          onClose={() => setSelectedCampaignId(null)}
          onUpdateField={(field, val) => updateCampaignField(selectedCampaign.id, field, val)}
          onAddChecklist={(text, cat) => addChecklistItem(selectedCampaign.id, text, cat)}
          onToggleChecklist={toggleChecklist}
          onDeleteChecklist={deleteChecklistItem}
          onAddSunat={(text) => addSunatItem(selectedCampaign.id, text)}
          onToggleSunat={toggleSunat}
          onDeleteSunat={deleteSunatItem}
          onAddPending={(payload) => addPending(selectedCampaign.id, payload)}
          onTogglePending={togglePending}
          onDeletePending={deletePending}
          onDeleteCampaign={() => deleteCampaign(selectedCampaign.id)}
        />
      )}

      {selectedSupplier && (
        <SupplierModal
          supplier={selectedSupplier}
          items={data.pendings.filter(p => p.supplierId === selectedSupplier.id)}
          campaignById={campaignById}
          accountName={accountName}
          hideDone={hideDonePendings}
          onToggleHideDone={() => setHideDonePendings(v => !v)}
          onClose={() => setSelectedSupplierId(null)}
          onToggle={togglePending}
          onDelete={deletePending}
          onOpenCampaign={(cid) => { setSelectedSupplierId(null); setSelectedCampaignId(cid); }}
        />
      )}

      {showNewCampaign && (
        <NewCampaignModal
          accountNames={data.accounts.map(a => a.name)}
          onClose={() => setShowNewCampaign(false)}
          onSave={addCampaign}
        />
      )}

      {showNewSupplier && (
        <NewSupplierModal onClose={() => setShowNewSupplier(false)} onSave={addSupplier} />
      )}

      {showNewQuick && (
        <NewQuickModal accountNames={data.accounts.map(a => a.name)} onClose={() => setShowNewQuick(false)} onSave={addQuickTask} />
      )}

      {showDataModal && (
        <DataModal data={data} onClose={() => setShowDataModal(false)} onImport={(parsed) => { persist(parsed); setShowDataModal(false); }} />
      )}
    </div>
  );
}

function DataModal({ data, onClose, onImport }) {
  const [mode, setMode] = useState('export');
  const [pasteText, setPasteText] = useState('');
  const [confirmImport, setConfirmImport] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copiar');
  const [error, setError] = useState('');
  const jsonStr = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const fileInputRef = useRef(null);

  const handleDownload = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kam-datos-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonStr);
      setCopyLabel('¡Copiado!');
      setTimeout(() => setCopyLabel('Copiar'), 1500);
    } catch (e) {
      setError('No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.');
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPasteText(String(reader.result || ''));
    reader.readAsText(file);
  };

  const doImport = () => {
    try {
      const parsed = JSON.parse(pasteText);
      if (!parsed.accounts || !parsed.campaigns) throw new Error('bad shape');
      onImport({
        accounts: parsed.accounts || [],
        suppliers: parsed.suppliers || [],
        campaigns: parsed.campaigns || [],
        checklist: parsed.checklist || [],
        sunat: parsed.sunat || [],
        pendings: parsed.pendings || [],
        quickTasks: parsed.quickTasks || [],
      });
    } catch (e) {
      setError('Ese texto no parece un backup válido de este dashboard.');
    }
  };

  return (
    <div className="kam-overlay" onClick={onClose}>
      <div className="kam-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="kam-modal-head">
          <div className="kam-modal-title">Exportar / Importar datos</div>
          <button className="kam-x" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="kam-toggle-group" style={{ marginTop: 12, width: 'fit-content' }}>
          <button className={`kam-toggle ${mode === 'export' ? 'active' : ''}`} onClick={() => { setMode('export'); setError(''); }} style={{ padding: '8px 14px' }}>Exportar</button>
          <button className={`kam-toggle ${mode === 'import' ? 'active' : ''}`} onClick={() => { setMode('import'); setError(''); }} style={{ padding: '8px 14px' }}>Importar</button>
        </div>

        {mode === 'export' && (
          <>
            <div className="kam-section-note" style={{ marginTop: 14 }}>Descarga o copia este backup. Súbelo o pégalo en el dashboard de tu otra cuenta para llevarte todo lo que cargaste aquí.</div>
            <textarea readOnly value={jsonStr} onClick={e => e.target.select()}
              style={{ width: '100%', height: 160, marginTop: 10, background: '#0D1424', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: 8, padding: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="kam-btn primary" onClick={handleDownload}><Download size={15} /> Descargar .json</button>
              <button className="kam-btn" onClick={handleCopy}><Copy size={15} /> {copyLabel}</button>
            </div>
          </>
        )}

        {mode === 'import' && (
          <>
            <div className="kam-section-note" style={{ marginTop: 14 }}>Sube el archivo .json que descargaste de la otra cuenta, o pega su contenido abajo. Esto reemplaza todo lo que tengas cargado aquí.</div>
            <div style={{ marginTop: 10 }}>
              <button className="kam-btn" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Subir archivo .json</button>
              <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFile} style={{ display: 'none' }} />
            </div>
            <textarea value={pasteText} onChange={e => { setPasteText(e.target.value); setError(''); }} placeholder="…o pega aquí el contenido del backup"
              style={{ width: '100%', height: 140, marginTop: 10, background: '#0D1424', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 10, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 }} />
            {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{error}</div>}
            <div className="kam-danger-row" style={{ justifyContent: 'flex-end' }}>
              {!confirmImport ? (
                <button className="kam-btn primary" disabled={!pasteText.trim()} style={{ opacity: pasteText.trim() ? 1 : 0.5 }} onClick={() => setConfirmImport(true)}>Reemplazar mis datos con esto</button>
              ) : (
                <button className="kam-btn primary" style={{ background: 'var(--red)', borderColor: 'var(--red)' }} onClick={doImport}>Confirmar: reemplazar todo</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CampaignCard({ campaign, accountName, openTasks, openPendings, onClick, onCycleStage, hideAccount }) {
  const days = daysUntil(campaign.startDate);
  const u = urgency(days);
  const stage = stageMeta(campaign.stage || 'no_implementado');
  const closed = campaign.ordenCompra && campaign.facturado;
  return (
    <div className="kam-card" onClick={onClick} style={closed ? { opacity: 0.6 } : undefined}>
      <div className="kam-card-top">
        <div>
          {!hideAccount && <div className="kam-card-account">{accountName}</div>}
          <div className="kam-card-name">{campaign.name}</div>
          {campaign.elemento && <div className="kam-elemento-badge">{campaign.elemento}</div>}
        </div>
        <span className={`kam-chip ${u.tone}`}>{u.label}</span>
      </div>
      <button className={`kam-stage-chip ${stage.tone}`} onClick={e => { e.stopPropagation(); onCycleStage(); }}>{stage.label}</button>
      <div className="kam-card-meta">
        <span><CalendarDays size={13} /> {fmt(campaign.startDate)}</span>
        {openTasks > 0 && <span><Circle size={7} fill="currentColor" /> {openTasks} tarea{openTasks !== 1 ? 's' : ''}</span>}
        {openPendings > 0 && <span style={{ color: 'var(--gold)' }}><Truck size={13} /> {openPendings}</span>}
      </div>
      <div className="kam-milestone-icons">
        <span className={`kam-mini ${campaign.cotizacionAprobada ? 'on' : ''}`}>Cotiz.</span>
        <span className={`kam-mini ${campaign.ordenCompra ? 'on' : ''}`}>OC</span>
        <span className={`kam-mini ${campaign.facturado ? 'on' : ''}`}>Fact.</span>
      </div>
    </div>
  );
}

function QuickCard({ task, accountName, onToggle, onDelete, hideAccount }) {
  const days = daysUntil(task.dueDate);
  const u = task.dueDate ? urgency(days) : null;
  return (
    <div className="kam-card quick">
      <div className="kam-card-top">
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <button className={`kam-item-check ${task.done ? 'done' : ''}`} onClick={onToggle} style={{ marginTop: 1 }}>
            {task.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>
          <div>
            {!hideAccount && <div className="kam-card-account">{accountName}</div>}
            <div className="kam-card-name" style={{ fontSize: 14, textDecoration: task.done ? 'line-through' : 'none', color: task.done ? 'var(--text-faint)' : 'var(--text)' }}>{task.text}</div>
          </div>
        </div>
        {u && <span className={`kam-chip ${u.tone}`}>{u.label}</span>}
      </div>
      <div className="kam-card-meta">
        <span>Pendiente rápido</span>
        <button className="kam-item-del" onClick={onDelete}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function CampaignModal({ campaign, accName, checklist, sunatItems, pendings, supplierName, supplierNames, onClose, onUpdateField, onAddChecklist, onToggleChecklist, onDeleteChecklist, onAddSunat, onToggleSunat, onDeleteSunat, onAddPending, onTogglePending, onDeletePending, onDeleteCampaign }) {
  const [taskText, setTaskText] = useState('');
  const [taskCat, setTaskCat] = useState(CATEGORIES[0]);
  const [sunatText, setSunatText] = useState('');
  const [pSupplier, setPSupplier] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pDate, setPDate] = useState(todayISO());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingElemento, setEditingElemento] = useState(false);
  const [elementoDraft, setElementoDraft] = useState(campaign.elemento || '');

  const stage = campaign.stage || 'no_implementado';
  const closed = campaign.ordenCompra && campaign.facturado;

  return (
    <div className="kam-overlay" onClick={onClose}>
      <div className="kam-modal" onClick={e => e.stopPropagation()}>
        <div className="kam-modal-head">
          <div>
            <div className="kam-modal-title">{campaign.name}</div>
            <div className="kam-modal-account">{accName}</div>
            <div className="kam-elemento-row">
              {editingElemento ? (
                <input className="kam-elemento-input" autoFocus value={elementoDraft}
                  onChange={e => setElementoDraft(e.target.value)}
                  onBlur={() => { onUpdateField('elemento', elementoDraft); setEditingElemento(false); }}
                  onKeyDown={e => { if (e.key === 'Enter') { onUpdateField('elemento', elementoDraft); setEditingElemento(false); } }} />
              ) : (
                <>
                  <span className="kam-elemento-badge">{campaign.elemento || 'Sin elemento'}</span>
                  <span className="kam-edit-icon" onClick={() => setEditingElemento(true)}><Pencil size={13} /></span>
                </>
              )}
            </div>
          </div>
          <button className="kam-x" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="kam-field-row">
          <div className="kam-field">
            <label className="kam-label">Fecha de inicio</label>
            <input type="date" className="kam-input" value={campaign.startDate || ''} onChange={e => onUpdateField('startDate', e.target.value)} />
          </div>
          <div className="kam-field">
            <label className="kam-label">Fecha fin / límite</label>
            <input type="date" className="kam-input" value={campaign.endDate || ''} onChange={e => onUpdateField('endDate', e.target.value)} />
          </div>
        </div>

        <div className="kam-section-label">Etapa</div>
        <div className="kam-stage-control">
          {STAGES.map(s => {
            const m = stageMeta(s);
            return (
              <button key={s} className={`kam-stage-btn ${stage === s ? `sel-${m.tone}` : ''}`} onClick={() => onUpdateField('stage', s)}>{m.label}</button>
            );
          })}
        </div>

        <div className="kam-section-label">Hitos de cobro</div>
        <div className="kam-milestone-row">
          <button className={`kam-milestone-btn gold ${campaign.cotizacionAprobada ? 'on' : ''}`} onClick={() => onUpdateField('cotizacionAprobada', !campaign.cotizacionAprobada)}>
            {campaign.cotizacionAprobada ? <CheckCircle2 size={16} /> : <Circle size={16} />} Cotización aprobada
          </button>
        </div>
        {campaign.cotizacionAprobada && <div className="kam-milestone-note">Acción pendiente: ingresar a backoffice.</div>}
        <div className="kam-milestone-row">
          <button className={`kam-milestone-btn ${campaign.ordenCompra ? 'on' : ''}`} onClick={() => onUpdateField('ordenCompra', !campaign.ordenCompra)}>
            {campaign.ordenCompra ? <CheckCircle2 size={16} /> : <Circle size={16} />} Orden de Compra
          </button>
          <button className={`kam-milestone-btn ${campaign.facturado ? 'on' : ''}`} onClick={() => onUpdateField('facturado', !campaign.facturado)}>
            {campaign.facturado ? <CheckCircle2 size={16} /> : <Circle size={16} />} Facturado
          </button>
        </div>
        {closed && <div className="kam-closed-banner">Campaña cerrada y cobrada. Se ocultará del tablero salvo que actives "Mostrar cerradas".</div>}

        <div className="kam-section-label kam-sunat-label"><ShieldAlert size={15} /> SUNAT · documentación obligatoria</div>
        <div className="kam-section-note">Guarda el correo con la cotización, la OC y el reporte de la marca. La empresa audita esto para pagarte.</div>
        {sunatItems.map(item => (
          <div className="kam-item" key={item.id}>
            <button className={`kam-item-check ${item.done ? 'done' : ''}`} onClick={() => onToggleSunat(item.id)}>
              {item.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <span className={`kam-item-text ${item.done ? 'done' : ''}`}>{item.text}</span>
            <button className="kam-item-del" onClick={() => onDeleteSunat(item.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="kam-add-row">
          <input className="kam-input" placeholder="Agregar documento a guardar" value={sunatText}
            onChange={e => setSunatText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && sunatText.trim()) { onAddSunat(sunatText); setSunatText(''); } }} />
          <button className="kam-add-btn" onClick={() => { if (sunatText.trim()) { onAddSunat(sunatText); setSunatText(''); } }}><Plus size={16} /></button>
        </div>

        <div className="kam-section-label">Mis pendientes</div>
        {checklist.length === 0 && <div className="kam-pending-sub">Sin tareas todavía.</div>}
        {checklist.map(item => (
          <div className="kam-item" key={item.id}>
            <button className={`kam-item-check ${item.done ? 'done' : ''}`} onClick={() => onToggleChecklist(item.id)}>
              {item.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <span className={`kam-item-text ${item.done ? 'done' : ''}`}>{item.text}</span>
            <span className="kam-item-cat">{item.category}</span>
            <button className="kam-item-del" onClick={() => onDeleteChecklist(item.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="kam-add-row">
          <input className="kam-input" placeholder="Nueva tarea (ej. enviar cotización)" value={taskText}
            onChange={e => setTaskText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && taskText.trim()) { onAddChecklist(taskText, taskCat); setTaskText(''); } }} />
          <select className="kam-select" value={taskCat} onChange={e => setTaskCat(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="kam-add-btn" onClick={() => { if (taskText.trim()) { onAddChecklist(taskText, taskCat); setTaskText(''); } }}><Plus size={16} /></button>
        </div>

        <div className="kam-section-label">Pendientes de proveedor</div>
        {pendings.length === 0 && <div className="kam-pending-sub">Nada pendiente de proveedor registrado.</div>}
        {pendings.map(p => (
          <div className="kam-item" key={p.id}>
            <button className={`kam-item-check ${p.done ? 'done' : ''}`} onClick={() => onTogglePending(p.id)}>
              {p.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <span className={`kam-item-text ${p.done ? 'done' : ''}`}>{p.description}</span>
            <span className="kam-pending-supplier">{supplierName(p.supplierId)}</span>
            <span className="kam-item-cat">{fmt(p.expectedDate)}</span>
            <button className="kam-item-del" onClick={() => onDeletePending(p.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        <div className="kam-add-row">
          <input className="kam-input" style={{ flex: 1 }} list="supplier-suggestions" placeholder="Proveedor" value={pSupplier} onChange={e => setPSupplier(e.target.value)} />
          <datalist id="supplier-suggestions">{supplierNames.map(n => <option key={n} value={n} />)}</datalist>
          <input className="kam-input" style={{ flex: 2 }} placeholder="Qué me debe (ej. muestras de color)" value={pDesc} onChange={e => setPDesc(e.target.value)} />
          <input type="date" className="kam-input" style={{ flex: 1 }} value={pDate} onChange={e => setPDate(e.target.value)} />
          <button className="kam-add-btn" onClick={() => { if (pSupplier.trim() && pDesc.trim()) { onAddPending({ supplierName: pSupplier, description: pDesc, expectedDate: pDate }); setPSupplier(''); setPDesc(''); } }}><Plus size={16} /></button>
        </div>

        <div className="kam-danger-row">
          {!confirmDelete ? (
            <button className="kam-link-danger" onClick={() => setConfirmDelete(true)}><Trash2 size={13} /> Eliminar campaña</button>
          ) : (
            <button className="kam-link-danger" style={{ color: 'var(--red)' }} onClick={onDeleteCampaign}>Confirmar eliminación</button>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplierModal({ supplier, items, campaignById, accountName, hideDone, onToggleHideDone, onClose, onToggle, onDelete, onOpenCampaign }) {
  const sorted = useMemo(() => {
    return [...items]
      .filter(i => !hideDone || !i.done)
      .sort((a, b) => {
        const da = daysUntil(a.expectedDate); const db = daysUntil(b.expectedDate);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
  }, [items, hideDone]);

  return (
    <div className="kam-overlay" onClick={onClose}>
      <div className="kam-modal" onClick={e => e.stopPropagation()}>
        <div className="kam-modal-head">
          <div className="kam-modal-title">{supplier.name}</div>
          <button className="kam-x" onClick={onClose}><X size={20} /></button>
        </div>
        <label className="kam-check-label" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={hideDone} onChange={onToggleHideDone} /> Ocultar recibidos
        </label>

        <div style={{ marginTop: 14 }}>
          {sorted.length === 0 && <div className="kam-pending-sub">Nada pendiente aquí.</div>}
          {sorted.map(p => {
            const camp = campaignById(p.campaignId);
            const days = daysUntil(p.expectedDate);
            const u = urgency(days);
            return (
              <div className="kam-pending-row" key={p.id}>
                <button className={`kam-item-check ${p.done ? 'done' : ''}`} onClick={() => onToggle(p.id)}>
                  {p.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div style={{ flex: 1 }}>
                  <div className={`kam-pending-desc ${p.done ? 'done' : ''}`}>{p.description}</div>
                  <div className="kam-pending-context">
                    {camp ? (
                      <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onOpenCampaign(camp.id)}>
                        {accountName(camp.accountId)} · {camp.name}{camp.elemento ? ` · ${camp.elemento}` : ''}
                      </span>
                    ) : 'Campaña eliminada'} · esperado {fmt(p.expectedDate)}
                  </div>
                </div>
                {!p.done && <span className={`kam-chip ${u.tone}`}>{u.label}</span>}
                <button className="kam-item-del" onClick={() => onDelete(p.id)}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NewCampaignModal({ accountNames, onClose, onSave }) {
  const [accountName, setAccountName] = useState('');
  const [name, setName] = useState('');
  const [elemento, setElemento] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const canSave = accountName.trim() && name.trim() && elemento.trim() && startDate;

  return (
    <div className="kam-overlay" onClick={onClose}>
      <div className="kam-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="kam-modal-head">
          <div className="kam-modal-title">Nueva campaña</div>
          <button className="kam-x" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="kam-field" style={{ marginTop: 14 }}>
          <label className="kam-label">Cuenta</label>
          <input className="kam-input" list="account-suggestions" placeholder="Ej. Molitalia" value={accountName} onChange={e => setAccountName(e.target.value)} />
          <datalist id="account-suggestions">{accountNames.map(n => <option key={n} value={n} />)}</datalist>
        </div>
        <div className="kam-field" style={{ marginTop: 12 }}>
          <label className="kam-label">Nombre de campaña</label>
          <input className="kam-input" placeholder="Ej. Verano 2026, Lanzamiento" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="kam-field" style={{ marginTop: 12 }}>
          <label className="kam-label">Elemento</label>
          <input className="kam-input" placeholder="Ej. Jaladista, Cabecera, Punta de góndola" value={elemento} onChange={e => setElemento(e.target.value)} />
        </div>
        <div className="kam-field-row">
          <div className="kam-field">
            <label className="kam-label">Fecha de inicio</label>
            <input type="date" className="kam-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="kam-field">
            <label className="kam-label">Fecha fin (opcional)</label>
            <input type="date" className="kam-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="kam-btn primary" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }}
            onClick={() => canSave && onSave({ accountName, name, elemento, startDate, endDate })}>
            <Plus size={15} /> Crear campaña
          </button>
        </div>
      </div>
    </div>
  );
}

function NewSupplierModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  return (
    <div className="kam-overlay" onClick={onClose}>
      <div className="kam-modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div className="kam-modal-head">
          <div className="kam-modal-title">Nuevo proveedor</div>
          <button className="kam-x" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="kam-field" style={{ marginTop: 14 }}>
          <label className="kam-label">Nombre</label>
          <input className="kam-input" placeholder="Ej. Dynamic" value={name} autoFocus
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name); }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="kam-btn primary" disabled={!name.trim()} style={{ opacity: name.trim() ? 1 : 0.5 }} onClick={() => onSave(name)}>
            <Plus size={15} /> Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

function NewQuickModal({ accountNames, onClose, onSave }) {
  const [accountName, setAccountName] = useState('');
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState('');
  const canSave = accountName.trim() && text.trim();
  return (
    <div className="kam-overlay" onClick={onClose}>
      <div className="kam-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="kam-modal-head">
          <div className="kam-modal-title">Nuevo pendiente rápido</div>
          <button className="kam-x" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="kam-section-note" style={{ marginTop: 4 }}>Para algo puntual con una cuenta que no es una campaña completa: una reposición, un cambio de video, etc.</div>
        <div className="kam-field" style={{ marginTop: 10 }}>
          <label className="kam-label">Cuenta</label>
          <input className="kam-input" list="quick-account-suggestions" placeholder="Ej. Molitalia" value={accountName} onChange={e => setAccountName(e.target.value)} />
          <datalist id="quick-account-suggestions">{accountNames.map(n => <option key={n} value={n} />)}</datalist>
        </div>
        <div className="kam-field" style={{ marginTop: 12 }}>
          <label className="kam-label">Qué hay que hacer</label>
          <input className="kam-input" placeholder="Ej. Reposición de jaladista dañado" value={text} onChange={e => setText(e.target.value)} />
        </div>
        <div className="kam-field" style={{ marginTop: 12 }}>
          <label className="kam-label">Fecha límite (opcional)</label>
          <input type="date" className="kam-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="kam-btn primary" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }}
            onClick={() => canSave && onSave({ accountName, text, dueDate })}>
            <Plus size={15} /> Crear pendiente
          </button>
        </div>
      </div>
    </div>
  );
}
