import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'
import { ROLES, PERMS, PERM_ORDER, rolesWith, maskName, type Role, type RoleId, type Perm } from './rbac'
import { buildReport, downloadReport, type ReportKind, type ReportFormat } from './reports'
import {
  apiGetKpi, apiGetClaims, apiGetAlerts, apiGetAuditLogs,
  apiSubmitClaim, apiUpdateClaimStatus, apiResolveAlert,
  apiAnalyzeDocWithGemini, apiChatWithGemini,
  downloadExcelReportFile, downloadPdfReportFile,
  type BackendClaim, type BackendAlert, type BackendKpi, type BackendAuditLog
} from './api'

// ─── Design Tokens ───────────────────────────────────────────────────────────
const C = {
  bg: '#160F0A', sidebar: '#1C130C', card: '#241A12', card2: '#2A1E14', card3: '#301F14',
  border: 'rgba(255,214,170,0.07)', borderStrong: 'rgba(255,214,170,0.14)', borderBright: 'rgba(255,214,170,0.22)',
  text: '#F6ECE0', dim: '#C9AF98', faint: '#9C8672', ghost: 'rgba(246,236,224,0.35)',
  orange: '#FF7A3D', orangeDeep: '#C2540E', orangeMid: '#E86A28',
  amber: '#F2A93B', amberDeep: '#B9791C',
  safe: '#57C48A', safeDark: '#3A9E6A',
  danger: '#FF4D4D',
  grad: 'linear-gradient(135deg,#FF7A3D,#C2540E)',
  gradAmber: 'linear-gradient(135deg,#F2A93B,#B9791C)',
  gradSafe: 'linear-gradient(135deg,#57C48A,#3A9E6A)',
  gradDark: 'linear-gradient(160deg,#2C1508 0%,#1C130C 55%,#160F0A 100%)',
  gradCard: 'linear-gradient(145deg,#2A1E14,#1E1509)',
  gradC1: 'linear-gradient(135deg,#FF8A50,#C2540E)',
  gradC2: 'linear-gradient(135deg,#F5B15A,#B9791C)',
  gradC3: 'linear-gradient(135deg,#D96B3A,#7A3B12)',
  gradC4: 'linear-gradient(135deg,#A06A3E,#4A2E1F)',
  orangeSoft: 'rgba(255,122,61,0.10)', amberSoft: 'rgba(242,169,59,0.10)',
  safeSoft: 'rgba(87,196,138,0.10)', dangerSoft: 'rgba(255,77,77,0.10)',
  glow: '0 0 20px rgba(255,122,61,0.22)', glowAmber: '0 0 20px rgba(242,169,59,0.22)',
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen  = 'splash' | 'onboarding' | 'role' | 'login' | 'otp' | 'main'
type Tab     = 'dashboard' | 'claims' | 'analytics' | 'alerts' | 'profile'
type DocStep = 'select' | 'scanning' | 'result'
type DocType = 'claim' | 'bill' | 'policy' | 'id' | 'discharge'

// ─── Data ─────────────────────────────────────────────────────────────────────
const CLAIMS = [
  { id:'CLM-8821', claimant:'Priya Sharma',  initials:'PS', provider:'Apollo Multi-spec', type:'Duplicate Billing',  risk:'High'   as const, amt:'₹1,20,000', date:'22 Sep 2026', ai:94 },
  { id:'CLM-8819', claimant:'Ramesh Gupta',  initials:'RG', provider:'Fortis Noida',      type:'Upcoding',           risk:'Medium' as const, amt:'₹48,500',   date:'21 Sep 2026', ai:67 },
  { id:'CLM-8810', claimant:'Ananya Nair',   initials:'AN', provider:'Max Saket',         type:'Ghost Patient',      risk:'High'   as const, amt:'₹2,10,000', date:'20 Sep 2026', ai:91 },
  { id:'CLM-8799', claimant:'Vijay Patel',   initials:'VP', provider:'Medanta Gurgaon',   type:'Unnecessary Proc.',  risk:'Low'    as const, amt:'₹22,000',   date:'19 Sep 2026', ai:31 },
  { id:'CLM-8780', claimant:'Suresh Kumar',  initials:'SK', provider:'AIIMS Delhi',       type:'Inflated Bills',     risk:'Medium' as const, amt:'₹87,500',   date:'18 Sep 2026', ai:58 },
  { id:'CLM-8772', claimant:'Kavita Rao',    initials:'KR', provider:'Narayana Health',   type:'Duplicate Billing',  risk:'High'   as const, amt:'₹1,65,000', date:'17 Sep 2026', ai:88 },
  { id:'CLM-8765', claimant:'Neeraj Mehta',  initials:'NM', provider:'Columbia Asia',     type:'Phantom Services',   risk:'High'   as const, amt:'₹3,20,000', date:'16 Sep 2026', ai:96 },
  { id:'CLM-8751', claimant:'Deepa Iyer',    initials:'DI', provider:'Manipal Hospital',  type:'Upcoding',           risk:'Medium' as const, amt:'₹54,000',   date:'15 Sep 2026', ai:62 },
]

const ALERTS_DATA = [
  { id:'ALT-991', title:'Unusually High ER Claims',  provider:'Apollo Multi-spec', time:'2 min ago',  risk:'High'   as const, desc:'14 ER claims filed within 6 hours — possible claim mill activity detected.' },
  { id:'ALT-988', title:'Duplicate Policy Detected', provider:'Star Health TPA',   time:'18 min ago', risk:'High'   as const, desc:'Policy TPA-88211 appears under two separate claimant IDs simultaneously.' },
  { id:'ALT-985', title:'Upcoding Flag: Cardiology', provider:'Fortis Noida',      time:'1 hr ago',   risk:'Medium' as const, desc:'Cardiac procedure codes escalated from ICD J45 to J96 without clinical note.' },
  { id:'ALT-981', title:'New Provider Claim Spike',  provider:'City Care Clinic',  time:'3 hr ago',   risk:'Medium' as const, desc:'Claims volume jumped 340% in 2 weeks post-onboarding. Pattern review triggered.' },
]

const FRAUD_RULES = [
  { name:'Duplicate Claim Guard',  trigger:'Same ICD + Provider in 30d',   hits:44, on:true  },
  { name:'ER Frequency Spike',     trigger:'ER visits > 4 per month',      hits:12, on:true  },
  { name:'New Provider Watchlist', trigger:'Claims spike > 200% in 14d',   hits:8,  on:true  },
  { name:'Upcoding Detector',      trigger:'ICD severity jump ≥ 2 levels', hits:31, on:false },
]

const AI_MODELS = [
  { name:'XGBoost Classifier',  tag:'Supervised',    accuracy:94.2, precision:91.8, recall:88.4, throughput:'12.3K/day', grad:C.gradC1, status:'Live' },
  { name:'LSTM Sequence',       tag:'Deep Learning', accuracy:88.7, precision:86.2, recall:91.3, throughput:'3.4K/day',  grad:C.gradC2, status:'Live' },
  { name:'Isolation Forest',    tag:'Unsupervised',  accuracy:96.1, precision:79.4, recall:96.1, throughput:'28.5K/day', grad:C.gradC3, status:'Live' },
  { name:'Document CNN',        tag:'Vision',        accuracy:97.3, precision:96.8, recall:95.2, throughput:'2.8K/day',  grad:C.gradC4, status:'Live' },
]

const EMERGING_PATTERNS = [
  { id:'EP-041', title:'Coordinated Billing Ring',        confidence:89, status:'Confirmed'  as const, type:'Network Fraud',    desc:'4 providers submitting near-identical claim batches in 48hr windows.' },
  { id:'EP-038', title:'Cross-Insurer Duplicate Claims',  confidence:92, status:'Active'     as const, type:'Identity Fraud',   desc:'Same patient filing identical claims across 3 insurers via PAN + biometric match.' },
  { id:'EP-035', title:'Synthetic Identity Cluster',      confidence:67, status:'Emerging'   as const, type:'Premium Fraud',    desc:'12 applications with incrementally modified demographics in 90 min window.' },
  { id:'EP-031', title:'ICD Code Escalation Network',     confidence:81, status:'Monitoring' as const, type:'Claim Inflation',  desc:'Cardiology cluster upcoding ICD codes across patient batches — 23 providers.' },
  { id:'EP-029', title:'Post-Season Flood Claim Cluster', confidence:44, status:'Unknown'    as const, type:'Emerging Unknown', desc:'200+ simultaneous household claims in statistically flood-unaffected zones.' },
]

const AI_ANOMALIES = [
  { id:'ANO-224', score:94, title:'Behavioral Drift — Apollo',   detail:'Claim velocity 3.8σ above 90-day baseline. Matches historical claim mill signature with 94% confidence.' },
  { id:'ANO-221', score:79, title:'Demographic Cluster Signal',  detail:'12 applicants share PIN code with near-identical income + family declarations filed within 2hr window.' },
  { id:'ANO-218', score:86, title:'ICD Transition Anomaly',      detail:'Isolation Forest flagged 23 claims with statistically improbable ICD-10 severity code transitions.' },
]

const TREND_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug']
const TREND_DATA = [
  { label:'Duplicate Claims', vals:[22,28,24,38,30,45,42,47], grad:C.gradC1 },
  { label:'Upcoding',         vals:[15,18,14,22,19,25,28,30], grad:C.gradC2 },
  { label:'Ghost Patients',   vals:[8,10,9,14,11,16,18,20],   grad:C.gradC3 },
  { label:'Inflated Bills',   vals:[12,14,12,16,13,18,15,17], grad:C.gradC4 },
]

const DOC_TYPES: { id:DocType; label:string; sub:string; emoji:string }[] = [
  { id:'claim',     label:'Insurance Claim Form',    sub:'IRDA standard claim submission',  emoji:'📋' },
  { id:'bill',      label:'Medical / Hospital Bill', sub:'Provider-issued billing doc',     emoji:'🏥' },
  { id:'policy',    label:'Policy Application',      sub:'New or renewal policy form',      emoji:'📄' },
  { id:'id',        label:'Identity Proof',          sub:'Aadhaar, PAN, Passport, DL',      emoji:'🪪' },
  { id:'discharge', label:'Discharge Summary',       sub:'Hospital treatment record',       emoji:'📃' },
]

const SCAN_RESULTS: Record<DocType,{ score:number; verdict:string; vcol:string; indicators:{ text:string; pass:boolean; weight:'High'|'Medium'|'Low' }[] }> = {
  claim:     { score:38, verdict:'SUSPECTED FORGERY', vcol:C.orange,
    indicators:[
      { text:'Metadata timestamp precedes document creation date', pass:false, weight:'High' },
      { text:'Digital watermark absent or tampered',               pass:false, weight:'High' },
      { text:'Font substitution detected in signature field',      pass:false, weight:'Medium' },
      { text:'Claimant signature pressure pattern anomalous',      pass:false, weight:'Medium' },
      { text:'IRDA QR code verified successfully',                  pass:true,  weight:'Low'   },
    ]},
  bill:      { score:74, verdict:'LIKELY AUTHENTIC', vcol:C.amber,
    indicators:[
      { text:'Hospital letterhead validated in registry',          pass:true,  weight:'High' },
      { text:'GST number cross-verified with GSTIN portal',        pass:true,  weight:'High' },
      { text:'Minor pixel artifacts detected in total amount',     pass:false, weight:'Medium' },
      { text:'Doctor signature matches enrolled biometric',        pass:true,  weight:'High' },
      { text:'Date and admission record cross-match — clean',      pass:true,  weight:'Medium' },
    ]},
  policy:    { score:28, verdict:'HIGH RISK — FORGERY', vcol:C.danger,
    indicators:[
      { text:'Policy number format non-compliant with IRDAI schema', pass:false, weight:'High' },
      { text:'Agent code not found in IRDAI broker registry',         pass:false, weight:'High' },
      { text:'Applicant signature duplicated from prior document',    pass:false, weight:'High' },
      { text:'Proposal form metadata: origin IP flagged',             pass:false, weight:'Medium' },
      { text:'Nominee details — PAN validation failed',               pass:false, weight:'Medium' },
    ]},
  id:        { score:91, verdict:'AUTHENTIC', vcol:C.safe,
    indicators:[
      { text:'UIDAI database cross-verification: match confirmed', pass:true, weight:'High' },
      { text:'MRZ / barcode checksum validated',                   pass:true, weight:'High' },
      { text:'Holographic pattern integrity intact',                pass:true, weight:'High' },
      { text:'Micro-text and security features present',           pass:true, weight:'Medium' },
      { text:'Biometric hash consistent with national registry',   pass:true, weight:'High' },
    ]},
  discharge: { score:52, verdict:'REVIEW REQUIRED', vcol:C.amber,
    indicators:[
      { text:'Hospital registration number validated',                pass:true,  weight:'High' },
      { text:'ICD-10 codes inconsistent with stated diagnosis',       pass:false, weight:'High' },
      { text:'Attending doctor NMC registration — active',            pass:true,  weight:'Medium' },
      { text:'Admission/discharge dates overlap with another claim',  pass:false, weight:'High' },
      { text:'Document layout matches known template',                pass:true,  weight:'Low'   },
    ]},
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useCountUp(target:number, delay=0, duration=1000) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const timer = setTimeout(() => {
      const start = performance.now()
      const tick = (now:number) => {
        const p = Math.min((now - start) / duration, 1)
        const eased = 1 - (1 - p) ** 3
        setVal(Math.round(eased * target))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(timer)
  }, [target])
  return val
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Ic = {
  shield:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3z" strokeLinejoin="round"/></svg>,
  grid:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  claims:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l7 3v6c0 5-3.1 8.6-7 10-3.9-1.4-7-5-7-10V5l7-3z"/></svg>,
  brain:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96-.46 2.5 2.5 0 01-1.07-3.27 3 3 0 01-.34-5.58 2.5 2.5 0 010-4.38 2.5 2.5 0 012.87-3.81z"/><path d="M14.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 004.96-.46 2.5 2.5 0 001.07-3.27 3 3 0 00.34-5.58 2.5 2.5 0 000-4.38 2.5 2.5 0 00-2.87-3.81z"/></svg>,
  bell:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>,
  person:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  scan:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>,
  back:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
  search:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>,
  filter:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>,
  eye:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  chevron:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 18l6-6-6-6"/></svg>,
  check:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>,
  x:        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  lock:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  logout:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06-.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  doc:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  camera:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  upload:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  cpu:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/></svg>,
  flag:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  biometric:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
  network:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><path d="M12 8v4M9.5 16.5L7 17M14.5 16.5L17 17"/></svg>,
  help:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  trend:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 17l4-8 4 5 3-4 7 7"/></svg>,
  alert:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.9L2.8 17a2 2 0 001.7 3h15a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
  crown:    <svg width="13" height="13" viewBox="0 0 24 24" fill={C.amber}><path d="M2 20h20M5 20L3 8l5.5 4.5L12 4l3.5 8.5L21 8l-2 12H5z"/></svg>,
  plus:     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>,
}

// ─── Shared Components ────────────────────────────────────────────────────────
function RiskPill({ level }: { level:'High'|'Medium'|'Low' }) {
  const s = { High:{bg:C.orangeSoft,c:C.orange}, Medium:{bg:C.amberSoft,c:C.amber}, Low:{bg:C.safeSoft,c:C.safe} }[level]
  return (
    <span style={{ background:s.bg, color:s.c, fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, display:'inline-flex', alignItems:'center', gap:5, border:`1px solid ${s.c}22`, whiteSpace:'nowrap' }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:s.c }}/>
      {level}
    </span>
  )
}

function Toggle({ on, onToggle }: { on:boolean; onToggle:()=>void }) {
  return (
    <div onClick={onToggle} style={{ width:42, height:24, borderRadius:12, background:on?C.grad:'rgba(255,255,255,0.1)', position:'relative', cursor:'pointer', flexShrink:0, transition:'background .25s', boxShadow:on?'0 2px 12px rgba(194,84,14,0.3)':'none' }}>
      <div style={{ position:'absolute', top:3, left:on?21:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left .22s cubic-bezier(.4,0,.2,1)', boxShadow:'0 1px 4px rgba(0,0,0,0.35)' }}/>
    </div>
  )
}

function Card({ children, style={}, onClick }: { children:React.ReactNode; style?:React.CSSProperties; onClick?:()=>void }) {
  return (
    <div style={{ background:C.gradCard, border:`1px solid ${C.border}`, borderRadius:20, padding:18, ...style }} onClick={onClick}>
      {children}
    </div>
  )
}

function SectionLabel({ children, action }: { children:React.ReactNode; action?:React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
      <span style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:C.faint, fontWeight:700 }}>{children}</span>
      {action}
    </div>
  )
}

function LiveBadge({ label='LIVE', color=C.safe }: { label?:string; color?:string }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:`${color}15`, border:`1px solid ${color}30`, borderRadius:20, padding:'3px 10px' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:color, animation:'bs-pulse 1.5s ease-in-out infinite' }}/>
      <span style={{ fontSize:10, fontWeight:700, color, letterSpacing:'0.8px' }}>{label}</span>
    </div>
  )
}

// High-end Luxury Circular Risk Score Dial
function GaugeRing({ score, size=64, label='RISK' }: { score:number; size?:number; label?:string }) {
  const strokeWidth = size * 0.10
  const r = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  // 240 degree gauge (symmetric arc at top and sides, opening at bottom)
  const arcLength = circ * (240 / 360)
  const dashOffset = arcLength * (1 - Math.min(100, Math.max(0, score)) / 100)
  
  const col = score >= 75 ? C.orange : score >= 50 ? C.amber : C.safe
  const gradId = `dial-grad-${score}-${size}`

  return (
    <div style={{ position:'relative', width:size, height:size, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      {/* Background Soft Glow Disc */}
      <div style={{ position:'absolute', inset:size*0.08, borderRadius:'50%', background:`radial-gradient(circle, ${col}20 0%, transparent 70%)`, pointerEvents:'none' }}/>

      <svg width={size} height={size} style={{ transform:'rotate(150deg)', overflow:'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={score>=75 ? '#FFA066' : score>=50 ? '#FFD07A' : '#72E5A6'} />
            <stop offset="100%" stopColor={col} />
          </linearGradient>
        </defs>

        {/* Track Arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circ}`}
          strokeLinecap="round"
        />

        {/* Value Arc with Gradient & Glow */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arcLength} ${circ}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 6px ${col}90)`,
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        />
      </svg>

      {/* Centered Readout */}
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
        <div style={{ fontSize:size*0.30, fontWeight:900, color:'#FFF8F0', lineHeight:1, letterSpacing:'-0.5px' }}>
          {score}
        </div>
        <div style={{ fontSize:size*0.12, fontWeight:800, color:col, letterSpacing:'0.8px', marginTop:2, lineHeight:1, textTransform:'uppercase' }}>
          {label}
        </div>
      </div>
    </div>
  )
}


// Mini metric ring
function MiniRing({ pct, color, size=52, label }: { pct:number; color:string; size?:number; label:string }) {
  const r=size*0.38, cx=size/2, circ=2*Math.PI*r
  const dash=(pct/100)*circ
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
      <div style={{ position:'relative', width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={size*0.08}/>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={size*0.08} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.22, fontWeight:800, color }}>{pct}%</div>
      </div>
      <div style={{ fontSize:9.5, color:C.faint, textAlign:'center' }}>{label}</div>
    </div>
  )
}

// Press-interactive button wrapper
function PressBtn({ children, onClick, style={} }: { children:React.ReactNode; onClick?:(e?: any)=>void; style?:React.CSSProperties }) {
  const [p, setP] = useState(false)
  return (
    <button onClick={onClick}
      onPointerDown={()=>setP(true)} onPointerUp={()=>setP(false)} onPointerLeave={()=>setP(false)}
      style={{ ...style, transform:p?'scale(0.95)':'scale(1)', transition:'transform .12s', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
      {children}
    </button>
  )
}

// Horizontal scrollable stat chip
function StatChip({ icon, label, value, sub, color=C.orange, delay=0 }: { icon:React.ReactNode; label:string; value:string; sub:string; color?:string; delay?:number }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = setTimeout(()=>setMounted(true), delay); return ()=>clearTimeout(t) }, [])
  return (
    <div style={{ background:C.gradCard, border:`1px solid ${C.border}`, borderRadius:16, padding:'12px 14px', flexShrink:0, width:120, opacity:mounted?1:0, transform:mounted?'translateY(0)':'translateY(12px)', transition:'all .4s cubic-bezier(.16,1,.3,1)' }}>
      <div style={{ color, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:20, fontWeight:900, color:C.text, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:C.faint, marginTop:2 }}>{label}</div>
      <div style={{ fontSize:10.5, color, marginTop:4, fontWeight:600 }}>{sub}</div>
    </div>
  )
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone:()=>void }) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t1=setTimeout(()=>setPhase(1),100)
    const t2=setTimeout(()=>setPhase(2),2600)
    const t3=setTimeout(onDone,3200)
    return ()=>[t1,t2,t3].forEach(clearTimeout)
  },[])

  return (
    <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 55% 35%,#2E1508 0%,#160F0A 65%)`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', opacity:phase===2?0:1, transition:'opacity .55s' }}>
      {/* Ambient rings */}
      {[280,220,160].map((s,i)=>(
        <div key={i} style={{ position:'absolute', width:s, height:s, borderRadius:'50%', border:`1px solid rgba(255,122,61,${0.06-i*0.015})`, animation:`bs-pulse 3s ease-in-out ${i*0.5}s infinite` }}/>
      ))}
      {/* Glow blob */}
      <div style={{ position:'absolute', width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,122,61,0.12) 0%,transparent 70%)' }}/>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:24, opacity:phase>=1?1:0, transform:phase>=1?'translateY(0)':'translateY(28px)', transition:'all .75s cubic-bezier(.16,1,.3,1)', position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ width:100, height:100, borderRadius:30, background:'linear-gradient(145deg,rgba(255,122,61,0.2),rgba(194,84,14,0.08))', border:`1px solid rgba(255,122,61,0.28)`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 24px 64px rgba(194,84,14,0.32), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3z" fill="url(#sg)"/>
            <path d="M9 12l2 2 4-4" stroke="rgba(255,255,255,0.92)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <defs><linearGradient id="sg" x1="4" y1="2" x2="20" y2="22"><stop stopColor="#FF7A3D"/><stop offset="1" stopColor="#C2540E"/></linearGradient></defs>
          </svg>
        </div>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:32, fontWeight:900, letterSpacing:2, color:C.text, lineHeight:1 }}>
            BHARAT<span style={{ color:C.amber }}>SHIELD</span>
          </div>
          <div style={{ fontSize:11, fontWeight:500, color:C.orange, letterSpacing:4, marginTop:8 }}>AI FRAUD INTELLIGENCE</div>
        </div>

        {/* Progress bar */}
        <div style={{ width:130, height:3, borderRadius:2, background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
          <div style={{ height:'100%', background:C.grad, borderRadius:2, animation:'bs-bar 2.4s ease-out forwards' }}/>
        </div>

        <div style={{ fontSize:12, color:C.faint }}>Trusted by 400+ insurers across India</div>
      </div>

      <div style={{ position:'absolute', bottom:44, display:'flex', alignItems:'center', gap:7, opacity:phase>=1?1:0, transition:'opacity .5s .6s' }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background:C.safe }}/>
        <span style={{ fontSize:11, color:C.faint }}>IRDAI Compliant · ISO 27001 · DPDP Act 2023</span>
      </div>
    </div>
  )
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    bg:'rgba(255,122,61,0.08)', bc:'rgba(255,122,61,0.2)',
    icon: <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="32" fill="rgba(255,122,61,0.1)" stroke="rgba(255,122,61,0.2)" strokeWidth="1"/><path d="M36 14L18 21v12c0 11 7.5 20 18 24 10.5-4 18-13 18-24V21L36 14z" fill="url(#s0)"/><path d="M28 36l5 5 10-10" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><defs><linearGradient id="s0" x1="18" y1="14" x2="54" y2="62"><stop stopColor="#FF7A3D"/><stop offset="1" stopColor="#C2540E"/></linearGradient></defs></svg>,
    title: 'AI-Powered Fraud\nDetection',
    desc: 'Real-time ML models scan every claim against 200+ evolving fraud signatures — XGBoost, LSTM sequences, and Isolation Forest working in concert.',
  },
  {
    bg:'rgba(242,169,59,0.08)', bc:'rgba(242,169,59,0.2)',
    icon: <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="32" fill="rgba(242,169,59,0.1)" stroke="rgba(242,169,59,0.2)" strokeWidth="1"/><rect x="16" y="18" width="40" height="36" rx="4" fill="rgba(242,169,59,0.1)" stroke="rgba(242,169,59,0.35)" strokeWidth="1.5"/><line x1="14" y1="36" x2="58" y2="36" stroke="url(#s1)" strokeWidth="2.5" strokeLinecap="round"/><rect x="22" y="24" width="28" height="4" rx="2" fill="rgba(242,169,59,0.35)"/><rect x="22" y="32" width="18" height="3" rx="1.5" fill="rgba(242,169,59,0.2)"/><circle cx="50" cy="50" r="8" fill="url(#s1)"/><path d="M47 50l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round"/><defs><linearGradient id="s1" x1="14" y1="14" x2="58" y2="58"><stop stopColor="#F2A93B"/><stop offset="1" stopColor="#B9791C"/></linearGradient></defs></svg>,
    title: 'Document Forgery\nDetection',
    desc: 'CNN-based computer vision authenticates claim forms, medical bills, discharge summaries, and IDs — detecting tampering at pixel and metadata level.',
  },
  {
    bg:'rgba(87,196,138,0.08)', bc:'rgba(87,196,138,0.2)',
    icon: <svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="32" fill="rgba(87,196,138,0.1)" stroke="rgba(87,196,138,0.2)" strokeWidth="1"/><circle cx="36" cy="24" r="7" fill="rgba(87,196,138,0.2)" stroke="#57C48A" strokeWidth="1.5"/><circle cx="18" cy="52" r="5" fill="rgba(87,196,138,0.2)" stroke="#57C48A" strokeWidth="1.5"/><circle cx="54" cy="52" r="5" fill="rgba(87,196,138,0.2)" stroke="#57C48A" strokeWidth="1.5"/><path d="M36 31L18 47M36 31L54 47M24 40l24 0" stroke="#57C48A" strokeWidth="1.5" strokeDasharray="3 2"/><circle cx="36" cy="40" r="4" fill="#57C48A" opacity=".6"/></svg>,
    title: 'Emerging Pattern\nIntelligence',
    desc: 'Beyond known fraud: unsupervised anomaly detection surfaces evolving networks and unknown signatures — catching what rule-based systems cannot see.',
  },
]

function OnboardingScreen({ onDone }: { onDone:()=>void }) {
  const [slide, setSlide] = useState(0)
  const s = SLIDES[slide]; const last = slide === 2
  return (
    <div style={{ position:'absolute', inset:0, background:C.bg, display:'flex', flexDirection:'column' }}>
      <div onClick={onDone} style={{ position:'absolute', top:52, right:22, background:C.card2, border:`1px solid ${C.border}`, borderRadius:20, padding:'6px 16px', color:C.dim, fontSize:12.5, fontWeight:600, cursor:'pointer', zIndex:10 }}>Skip</div>

      {/* Ambient bg */}
      <div style={{ position:'absolute', top:'8%', left:'50%', transform:'translateX(-50%)', width:320, height:320, borderRadius:'50%', background:`radial-gradient(circle,${s.bg} 0%,transparent 70%)`, transition:'background .5s', pointerEvents:'none' }}/>

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 32px 20px' }}>
        <div key={slide} style={{ animation:'bs-fadein .4s ease-out', display:'flex', flexDirection:'column', alignItems:'center', gap:30, textAlign:'center' }}>
          <div style={{ width:100, height:100, borderRadius:28, background:s.bg, border:`1px solid ${s.bc}`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 20px 60px ${s.bc}` }}>
            {s.icon}
          </div>
          <div>
            <div style={{ fontSize:28, fontWeight:800, color:C.text, lineHeight:1.2, whiteSpace:'pre-line', letterSpacing:-0.4 }}>{s.title}</div>
            <div style={{ fontSize:14.5, color:C.dim, lineHeight:1.72, marginTop:14, fontWeight:300, maxWidth:320 }}>{s.desc}</div>
          </div>
        </div>
      </div>

      <div style={{ padding:'0 24px 48px' }}>
        {/* Dots */}
        <div style={{ display:'flex', justifyContent:'center', gap:7, marginBottom:22 }}>
          {SLIDES.map((_,i)=>(
            <div key={i} onClick={()=>setSlide(i)} style={{ height:4, borderRadius:2, cursor:'pointer', background:i===slide?C.orange:'rgba(255,255,255,0.12)', width:i===slide?32:8, transition:'all .3s' }}/>
          ))}
        </div>
        <PressBtn onClick={()=>last?onDone():setSlide(v=>v+1)} style={{ width:'100%', background:C.grad, borderRadius:18, padding:'17px', fontSize:15, fontWeight:700, color:'#fff', boxShadow:'0 10px 32px rgba(194,84,14,0.38)' }}>
          {last?'Enter Dashboard →':'Continue'}
        </PressBtn>
      </div>
    </div>
  )
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// ─── RBAC CONTEXT ────────────────────────────────────────────────────────────
interface LogEntry { t:string; msg:string; ok:boolean }
interface RBAC {
  role:Role; can:(p:Perm)=>boolean; guard:(p:Perm,label:string,fn:()=>void)=>void
  deny:(p:Perm,label:string)=>void; toast:(m:string,ok?:boolean)=>void; log:LogEntry[]; mask:(n:string)=>string
}
const RBACCtx = createContext<RBAC|null>(null)
const useRBAC = () => useContext(RBACCtx)!
const nowT = () => new Date().toLocaleTimeString('en-IN',{ hour:'2-digit', minute:'2-digit', second:'2-digit' })

function RBACProvider({ role, children }: { role:Role; children:React.ReactNode }) {
  const [log,setLog] = useState<LogEntry[]>(()=>[{ t:nowT(), msg:`Signed in as ${role.title}`, ok:true }])
  const [toastMsg,setToastMsg] = useState<{ m:string; ok:boolean; k:number }|null>(null)
  const push = useCallback((msg:string,ok:boolean)=>setLog(l=>[{ t:nowT(), msg, ok },...l].slice(0,30)),[])
  const toast = useCallback((m:string,ok=true)=>setToastMsg({ m, ok, k:Date.now() }),[])
  const can = useCallback((p:Perm)=>role.perms.includes(p),[role])
  const deny = useCallback((p:Perm,label:string)=>{
    push(`Blocked: ${label}`,false)
    toast(`Access denied · ${label}. Requires ${rolesWith(p).slice(0,2).join(' or ')}.`,false)
  },[push,toast])
  const guard = useCallback((p:Perm,label:string,fn:()=>void)=>{
    if(role.perms.includes(p)){ push(`Allowed: ${label}`,true); fn() } else deny(p,label)
  },[role,push,deny])
  useEffect(()=>{ if(!toastMsg) return; const t=setTimeout(()=>setToastMsg(null),3200); return ()=>clearTimeout(t) },[toastMsg])
  const mask = useCallback((n:string)=>role.perms.includes('view_pii')?n:maskName(n),[role])
  return (
    <RBACCtx.Provider value={{ role, can, guard, deny, toast, log, mask }}>
      {children}
      {toastMsg && (
        <div key={toastMsg.k} style={{ position:'absolute', top:16, left:14, right:14, zIndex:600, animation:'bs-pop .3s ease-out', pointerEvents:'none' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(32,20,12,0.97)', border:`1px solid ${toastMsg.ok?C.safe:C.danger}66`, borderRadius:16, padding:'11px 14px', boxShadow:`0 14px 36px rgba(0,0,0,0.55), 0 0 22px ${toastMsg.ok?C.safe:C.danger}22` }}>
            <span style={{ width:28, height:28, borderRadius:9, background:`${toastMsg.ok?C.safe:C.danger}22`, color:toastMsg.ok?C.safe:C.danger, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{toastMsg.ok?Ic.check:Ic.lock}</span>
            <span style={{ fontSize:12.5, color:C.text, lineHeight:1.4 }}>{toastMsg.m}</span>
          </div>
        </div>
      )}
    </RBACCtx.Provider>
  )
}

// ─── ROLE SELECT ─────────────────────────────────────────────────────────────
function StepBar({ at }: { at:0|1|2 }) {
  return (
    <div style={{ display:'flex', gap:6 }}>
      {['Role','Sign in','Verify'].map((l,i)=>(
        <div key={l} style={{ flex:1 }}>
          <div style={{ height:3, borderRadius:2, background:i<=at?C.grad:'rgba(255,255,255,0.09)', transition:'background .3s' }}/>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.6px', marginTop:5, color:i===at?C.orange:C.faint }}>{i+1}. {l.toUpperCase()}</div>
        </div>
      ))}
    </div>
  )
}

function RoleSelectScreen({ onSelect }: { onSelect:(r:Role)=>void }) {
  const [sel,setSel] = useState<RoleId|null>(null)
  const role = ROLES.find(r=>r.id===sel)
  return (
    <div style={{ position:'absolute', inset:0, background:C.bg, display:'flex', flexDirection:'column' }}>
      <div style={{ flex:1, overflowY:'auto', padding:'52px 18px 130px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div style={{ width:36, height:36, borderRadius:11, background:C.grad, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 18px rgba(194,84,14,0.45)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3z" fill="white"/><path d="M9 12l2 2 4-4" stroke="rgba(194,84,14,0.6)" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div style={{ fontSize:16, fontWeight:900, color:C.text, letterSpacing:1 }}>BHARAT<span style={{ color:C.amber }}>SHIELD</span></div>
        </div>
        <StepBar at={0}/>
        <div style={{ fontSize:26, fontWeight:800, color:C.text, letterSpacing:-0.4, margin:'22px 0 6px' }}>Choose your role</div>
        <div style={{ fontSize:13, color:C.dim, lineHeight:1.55, marginBottom:18 }}>Your role decides what you can see and do. Access is enforced on every screen and recorded in the audit trail.</div>

        {(['staff','customer'] as const).map(kind=>(<div key={kind}>
        <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:'1px', color:C.amber, margin:'6px 2px 10px' }}>{kind==='staff'?'INSURER & REGULATOR STAFF':'CUSTOMERS & PARTNERS'}</div>
        {ROLES.filter(r=>r.kind===kind).map(r=>{
          const on = sel===r.id
          return (
            <div key={r.id} onClick={()=>setSel(r.id)} role="button" style={{ borderRadius:22, border:`1.5px solid ${on?r.color:C.border}`, background:on?`linear-gradient(150deg,${r.color}1C,#1E140C 70%)`:C.gradCard, padding:14, marginBottom:11, cursor:'pointer', transition:'all .25s', boxShadow:on?`0 12px 32px ${r.color}26`:'none', transform:on?'scale(1.01)':'scale(1)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:48, height:48, borderRadius:15, background:`${r.color}1A`, border:`1px solid ${r.color}44`, color:r.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={r.icon}/></svg>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:800, color:C.text }}>{r.title}</div>
                  <div style={{ fontSize:11.5, color:C.faint, marginTop:2, lineHeight:1.35 }}>{r.tagline}</div>
                </div>
                <span style={{ width:22, height:22, borderRadius:'50%', border:`2px solid ${on?r.color:'rgba(255,255,255,0.2)'}`, background:on?r.color:'transparent', color:'#1A0E06', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .2s' }}>{on&&Ic.check}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12 }}>
                <div style={{ display:'flex', gap:3 }}>
                  {[1,2,3,4].map(n=><span key={n} style={{ width:18, height:5, borderRadius:3, background:n<=r.level?r.color:'rgba(255,255,255,0.1)' }}/>)}
                </div>
                <span style={{ fontSize:10.5, fontWeight:700, color:r.color, letterSpacing:'.4px' }}>{r.levelLabel}</span>
              </div>
              {on && (
                <div style={{ marginTop:12, animation:'bs-pop .3s ease-out' }}>
                  <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.8px', color:C.faint, marginBottom:7 }}>WHAT THIS ROLE CAN DO</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    {PERM_ORDER.map(p=>{
                      const ok = r.perms.includes(p)
                      return (
                        <div key={p} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', borderRadius:10, background:ok?`${r.color}14`:'rgba(255,255,255,0.03)', border:`1px solid ${ok?r.color+'33':C.border}`, opacity:ok?1:0.5 }}>
                          <span style={{ color:ok?r.color:C.faint, display:'flex', transform:'scale(.85)' }}>{ok?Ic.check:Ic.lock}</span>
                          <span style={{ fontSize:11, fontWeight:600, color:ok?C.text:C.faint, textDecoration:ok?'none':'line-through' }}>{PERMS[p].label}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ fontSize:11, color:C.faint, marginTop:10 }}>Demo account: <span style={{ color:C.dim, fontWeight:600 }}>{r.person}</span> · {r.org}</div>
                </div>
              )}
            </div>
          )
        })}
        </div>))}
      </div>

      <div style={{ position:'absolute', left:0, right:0, bottom:0, padding:'26px 18px 22px', background:`linear-gradient(180deg,transparent,${C.bg} 38%)`, pointerEvents:'none' }}>
        <PressBtn onClick={()=>role&&onSelect(role)} style={{ width:'100%', background:role?`linear-gradient(135deg,${role.color},${C.orangeDeep})`:'rgba(255,255,255,0.06)', borderRadius:18, padding:'16px', fontSize:15, fontWeight:800, color:role?'#1A0E06':C.faint, boxShadow:role?`0 12px 30px ${role.color}44`:'none', pointerEvents:role?'all':'none', transition:'all .25s' }}>
          {role ? `Continue as ${role.title} →` : 'Select a role to continue'}
        </PressBtn>
        <div style={{ textAlign:'center', fontSize:10.5, color:C.faint, marginTop:10 }}>Role-based access control · DPDP Act 2023 compliant</div>
      </div>
    </div>
  )
}

// ─── BIOMETRIC SIGN-IN (WebAuthn platform authenticator, with simulated fallback) ───
const b64 = (b:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(b)))
const unb64 = (s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0))
async function deviceBiometric(role:Role): Promise<void> {
  const key = `bs-cred-${role.id}`
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const saved = localStorage.getItem(key)
  if (saved) {
    await navigator.credentials.get({ publicKey:{ challenge, timeout:60000, userVerification:'required', allowCredentials:[{ id:unb64(saved), type:'public-key' }] } })
  } else {
    const cred = await navigator.credentials.create({ publicKey:{
      challenge, rp:{ name:'BharatShield AI' },
      user:{ id:new TextEncoder().encode(role.id), name:role.email, displayName:role.person },
      pubKeyCredParams:[{ alg:-7, type:'public-key' },{ alg:-257, type:'public-key' }],
      authenticatorSelection:{ authenticatorAttachment:'platform', userVerification:'required' }, timeout:60000,
    } }) as PublicKeyCredential | null
    if (cred) localStorage.setItem(key, b64(cred.rawId))
  }
}

function BiometricSheet({ role, onSuccess, onClose }: { role:Role; onSuccess:()=>void; onClose:()=>void }) {
  const [state,setState] = useState<'scan'|'fallback'|'holding'|'ok'>('scan')
  const [pct,setPct] = useState(0)
  const [note,setNote] = useState('Touch the fingerprint sensor or look at your camera')
  const live = useRef(true)
  useEffect(()=>{ live.current=true; return ()=>{ live.current=false } },[])
  const succeed = useCallback(()=>{ if(!live.current) return; setState('ok'); setTimeout(()=>live.current&&onSuccess(),900) },[onSuccess])

  useEffect(()=>{
    (async()=>{
      try {
        if (!window.PublicKeyCredential || !(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) throw new Error('none')
        await deviceBiometric(role); succeed()
      } catch (e) {
        if(!live.current) return
        const name = (e as Error)?.name
        setNote(name==='NotAllowedError' ? 'Device prompt was cancelled or blocked in this preview. Use the on-screen sensor instead.' : 'No device biometric available here. Use the on-screen sensor instead.')
        setState('fallback')
      }
    })()
  },[role,succeed])

  const timer = useRef<number>(0)
  const stop = ()=>{ clearInterval(timer.current); if(state==='holding'){ setState('fallback'); setPct(0) } }
  const hold = ()=>{
    if(state==='ok') return
    setState('holding'); let v=0
    timer.current = window.setInterval(()=>{ v+=5; setPct(v); if(v>=100){ clearInterval(timer.current); setPct(100); succeed() } },70)
  }
  useEffect(()=>()=>clearInterval(timer.current),[])

  const ok = state==='ok', col = ok?C.safe:role.color
  const R=62, Cc=2*Math.PI*R
  return (
    <div style={{ position:'absolute', inset:0, zIndex:500, background:'rgba(8,4,2,0.78)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:430, background:'linear-gradient(180deg,#24170E,#160F0A)', borderTopLeftRadius:32, borderTopRightRadius:32, border:`1px solid ${C.borderStrong}`, padding:'22px 24px 30px', animation:'bs-fadein .3s ease-out', textAlign:'center' }}>
        <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)', margin:'0 auto 18px' }}/>
        <div style={{ fontSize:17, fontWeight:800, color:C.text }}>{ok?'Identity verified':'Biometric sign-in'}</div>
        <div style={{ fontSize:12.5, color:C.dim, marginTop:6, lineHeight:1.5, minHeight:38 }}>{ok?`Welcome, ${role.person}. Opening your ${role.title} workspace.`:note}</div>

        <div onPointerDown={state==='fallback'?hold:undefined} onPointerUp={stop} onPointerLeave={stop}
          style={{ position:'relative', width:150, height:150, margin:'18px auto', cursor:state==='fallback'||state==='holding'?'pointer':'default', touchAction:'none', userSelect:'none' }}>
          <svg width="150" height="150" viewBox="0 0 150 150" style={{ position:'absolute', inset:0, transform:'rotate(-90deg)' }}>
            <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5"/>
            <circle cx="75" cy="75" r={R} fill="none" stroke={col} strokeWidth="5" strokeLinecap="round" strokeDasharray={Cc} strokeDashoffset={Cc*(1-(ok?100:pct)/100)} style={{ transition:'stroke-dashoffset .1s linear, stroke .3s' }}/>
          </svg>
          {state!=='ok' && <span style={{ position:'absolute', inset:14, borderRadius:'50%', border:`1.5px solid ${col}`, animation:'bs-halo 1.8s ease-out infinite' }}/>}
          <div style={{ position:'absolute', inset:16, borderRadius:'50%', background:`${col}14`, color:col, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', transition:'all .3s' }}>
            {ok ? <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
              : <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11v3a9 9 0 01-1.2 4.5M8 11a4 4 0 118 0v3c0 1.6-.3 3.100-.9 4.500M5 11a7 7 0 1114 0v2.500M5 15c0 1.500.2 2.500.6 3.500M19 15.500c0 1.500-.2 2.300-.5 3"/></svg>}
            {state!=='ok' && <span style={{ position:'absolute', left:0, right:0, top:0, height:2, background:`linear-gradient(90deg,transparent,${col},transparent)`, boxShadow:`0 0 12px ${col}`, animation:'bs-scan 1.8s ease-in-out infinite' }}/>}
          </div>
        </div>

        <div style={{ fontSize:11.5, fontWeight:700, letterSpacing:'.6px', color:ok?C.safe:C.amber, minHeight:16 }}>
          {ok?'MATCH CONFIRMED':state==='scan'?'WAITING FOR DEVICE…':state==='holding'?`SCANNING ${pct}%`:'PRESS AND HOLD THE SENSOR'}
        </div>
        {!ok && <button onClick={onClose} style={{ marginTop:16, background:'none', border:'none', color:C.faint, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Use password instead</button>}
      </div>
    </div>
  )
}

function LoginScreen({ role, onNext, onBack }: { role:Role; onNext:()=>void; onBack:()=>void }) {
  const [email, setEmail] = useState(role.email)
  const [pw, setPw] = useState('••••••••')
  const [showPw, setShowPw] = useState(false)
  const [focus, setFocus] = useState<string|null>(null)
  const [bio, setBio] = useState(false)

  const inp = (f:string):React.CSSProperties => ({
    background:C.card2, border:`1.5px solid ${focus===f?C.orange:C.border}`, borderRadius:14,
    padding:'14px 44px 14px 16px', color:C.text, fontSize:14, width:'100%', outline:'none',
    transition:'border-color .2s, box-shadow .2s',
    boxShadow:focus===f?`0 0 0 3px rgba(255,122,61,0.12)`:'none',
  })

  return (
    <div style={{ position:'absolute', inset:0, background:C.bg, display:'flex', flexDirection:'column', overflowY:'auto' }}>
      {/* Header card */}
      <div style={{ background:C.gradDark, paddingTop:64, paddingBottom:48, paddingLeft:28, paddingRight:28, borderBottomLeftRadius:36, borderBottomRightRadius:36, flexShrink:0, boxShadow:'0 16px 48px rgba(0,0,0,0.5)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:220, height:220, borderRadius:'50%', background:'rgba(255,122,61,0.05)' }}/>
        <div style={{ position:'absolute', bottom:-30, left:-30, width:160, height:160, borderRadius:'50%', background:'rgba(242,169,59,0.04)' }}/>

        <div style={{ display:'flex', alignItems:'center', gap:12, position:'relative', marginBottom:28 }}>
          <div style={{ width:46, height:46, borderRadius:14, background:C.grad, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 8px 24px rgba(194,84,14,0.45)', flexShrink:0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3z" fill="white"/><path d="M9 12l2 2 4-4" stroke="rgba(194,84,14,0.6)" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:C.text, letterSpacing:1 }}>BHARAT<span style={{ color:C.amber }}>SHIELD</span></div>
            <div style={{ fontSize:10.5, color:C.faint, letterSpacing:1.8 }}>FRAUD INTELLIGENCE PLATFORM</div>
          </div>
        </div>

        <div style={{ position:'relative' }}>
          <div style={{ marginBottom:18 }}><StepBar at={1}/></div>
          <div style={{ fontSize:28, fontWeight:800, color:C.text, letterSpacing:-0.3 }}>Welcome back</div>
          <div style={{ fontSize:14, color:C.dim, marginTop:6, fontWeight:300 }}>Sign in to your secure fraud intelligence portal</div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:16, background:`${role.color}14`, border:`1px solid ${role.color}44`, borderRadius:16, padding:'9px 12px' }}>
            <span style={{ width:32, height:32, borderRadius:10, background:`${role.color}22`, color:role.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={role.icon}/></svg>
            </span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.8px', color:C.faint }}>SIGNING IN AS</div>
              <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{role.title}</div>
            </div>
            <button onClick={onBack} style={{ background:'none', border:`1px solid ${C.borderStrong}`, color:C.amber, borderRadius:10, padding:'6px 10px', fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Change</button>
          </div>
        </div>
      </div>

      <div style={{ padding:'36px 28px', flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:11, fontWeight:700, color:C.faint, letterSpacing:'0.8px', textTransform:'uppercase', display:'block', marginBottom:7 }}>{role.kind==='customer'?'Registered Email':'Work Email'}</label>
          <input style={inp('email')} value={email} onChange={e=>setEmail(e.target.value)} onFocus={()=>setFocus('email')} onBlur={()=>setFocus(null)} type="email"/>
        </div>
        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:11, fontWeight:700, color:C.faint, letterSpacing:'0.8px', textTransform:'uppercase', display:'block', marginBottom:7 }}>Password</label>
          <div style={{ position:'relative' }}>
            <input style={{ ...inp('pw'), paddingRight:44 }} value={pw} onChange={e=>setPw(e.target.value)} onFocus={()=>setFocus('pw')} onBlur={()=>setFocus(null)} type={showPw?'text':'password'}/>
            <button onClick={()=>setShowPw(v=>!v)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:C.faint }}>
              {showPw?Ic.eyeOff:Ic.eye}
            </button>
          </div>
        </div>
        <div style={{ textAlign:'right', marginBottom:28 }}>
          <span style={{ fontSize:12.5, color:C.amber, fontWeight:600, cursor:'pointer' }}>Forgot password?</span>
        </div>

        <PressBtn onClick={onNext} style={{ width:'100%', background:C.grad, borderRadius:18, padding:'17px', fontSize:15, fontWeight:700, color:'#fff', boxShadow:'0 10px 32px rgba(194,84,14,0.38)', marginBottom:16 }}>
          Sign In Securely
        </PressBtn>

        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <div style={{ flex:1, height:1, background:C.border }}/><span style={{ fontSize:12, color:C.faint }}>or</span><div style={{ flex:1, height:1, background:C.border }}/>
        </div>

        <PressBtn onClick={()=>setBio(true)} style={{ width:'100%', background:C.card2, border:`1px solid ${C.borderStrong}`, borderRadius:18, padding:'14px', fontSize:13.5, fontWeight:600, color:C.dim, gap:10 }}>
          {Ic.biometric} Use Biometric Authentication
        </PressBtn>
        {bio && <BiometricSheet role={role} onSuccess={onNext} onClose={()=>setBio(false)}/>}

        <div style={{ marginTop:'auto', paddingTop:28, textAlign:'center', fontSize:12, color:C.faint, lineHeight:1.65 }}>
          Protected under India's DPDP Act 2023.<br/>All sessions are end-to-end encrypted and audited.
        </div>
      </div>
    </div>
  )
}

// ─── OTP ──────────────────────────────────────────────────────────────────────
function OTPScreen({ email, onDone }: { email:string; onDone:()=>void }) {
  const [otp, setOtp] = useState(['','','','','',''])
  const [timer, setTimer] = useState(30)
  const refs = useRef<(HTMLInputElement|null)[]>([])
  useEffect(()=>{ const t=setInterval(()=>setTimer(n=>n>0?n-1:0),1000); return ()=>clearInterval(t) },[])

  const handle = (i:number, v:string) => {
    if(!/^\d?$/.test(v)) return
    const n=[...otp]; n[i]=v; setOtp(n)
    if(v&&i<5) refs.current[i+1]?.focus()
    if(!v&&i>0) refs.current[i-1]?.focus()
  }
  const filled = otp.every(d=>d!=='')

  return (
    <div style={{ position:'absolute', inset:0, background:C.bg, display:'flex', flexDirection:'column' }}>
      <div style={{ background:C.gradDark, paddingTop:64, paddingBottom:38, paddingLeft:28, paddingRight:28, borderBottomLeftRadius:32, borderBottomRightRadius:32, flexShrink:0 }}>
        <div style={{ width:48, height:48, borderRadius:14, background:C.orangeSoft, border:`1px solid ${C.orange}22`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
          {Ic.lock}
        </div>
        <div style={{ fontSize:26, fontWeight:800, color:C.text }}>Verify Identity</div>
        <div style={{ fontSize:14, color:C.dim, marginTop:6, fontWeight:300 }}>6-digit code sent to<br/><span style={{ color:C.amber, fontWeight:600 }}>{email}</span></div>
      </div>

      <div style={{ padding:'40px 28px', flex:1, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:36 }}>
          {otp.map((d,i)=>(
            <input key={i} ref={el=>{refs.current[i]=el}} type="tel" maxLength={1} value={d} onChange={e=>handle(i,e.target.value)}
              style={{ width:46, height:58, borderRadius:14, textAlign:'center', fontSize:22, fontWeight:800, color:C.text, background:d?C.card3:C.card2, border:`2px solid ${d?C.orange:C.border}`, outline:'none', transition:'all .15s', boxShadow:d?`0 0 0 3px rgba(255,122,61,0.12), 0 4px 12px rgba(194,84,14,0.22)`:'none' }}
            />
          ))}
        </div>

        {timer>0
          ? <div style={{ textAlign:'center', fontSize:13, color:C.faint }}>Resend code in <span style={{ color:C.amber, fontWeight:700 }}>0:{String(timer).padStart(2,'0')}</span></div>
          : <div style={{ textAlign:'center', fontSize:13, color:C.orange, fontWeight:600, cursor:'pointer' }} onClick={()=>setTimer(30)}>Resend OTP</div>
        }

        <div style={{ marginTop:'auto' }}>
          <PressBtn onClick={onDone} style={{ width:'100%', background:filled?C.grad:'rgba(255,122,61,0.15)', borderRadius:18, padding:'17px', fontSize:15, fontWeight:700, color:filled?'#fff':C.faint, boxShadow:filled?'0 10px 32px rgba(194,84,14,0.35)':'none', transition:'all .2s', pointerEvents:filled?'all':'none' }}>
            {filled ? 'Verify & Enter Dashboard →' : 'Enter all 6 digits'}
          </PressBtn>
        </div>
      </div>
    </div>
  )
}

// ─── THREAT HERO (risk score) ────────────────────────────────────────────────
const THREAT = {
  '24H': { score:94, delta:'+6', spark:[52,58,55,63,70,66,78,84,80,91,88,94],
    cats:[['Claim Inflation',82],['Document Forgery',71],['Identity Theft',58],['Premium Fraud',44],['Emerging Unknown',37]] },
  '7D':  { score:81, delta:'+3', spark:[61,64,70,66,72,75,69,77,74,79,83,81],
    cats:[['Claim Inflation',68],['Identity Theft',61],['Document Forgery',52],['Premium Fraud',47],['Emerging Unknown',29]] },
  '30D': { score:72, delta:'-4', spark:[80,78,74,76,70,73,69,71,74,68,70,72],
    cats:[['Premium Fraud',64],['Claim Inflation',59],['Identity Theft',48],['Document Forgery',41],['Emerging Unknown',22]] },
} as const
type Range = keyof typeof THREAT
const zoneOf = (n:number) => n >= 71 ? {l:'HIGH',c:C.orange,t:'Critical — escalate now'} : n >= 41 ? {l:'MEDIUM',c:C.amber,t:'Elevated — review queue'} : {l:'LOW',c:C.safe,t:'Stable — routine checks'}

function ThreatHero() {
  const [range,setRange] = useState<Range>('24H')
  const [vi,setVi] = useState(0)
  const [shown,setShown] = useState(0)
  const d = THREAT[range]
  const prev = useRef(0)
  useEffect(()=>{
    const from = prev.current, to = d.score, t0 = performance.now()
    let raf = 0
    const tick = (t:number)=>{
      const k = Math.min(1,(t-t0)/1100), e = 1-Math.pow(1-k,3)
      const v = from + (to-from)*e
      setShown(Math.round(v)); prev.current = v
      if (k<1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return ()=>cancelAnimationFrame(raf)
  },[d.score])
  useEffect(()=>setVi(0),[range])

  const z = zoneOf(shown)
  const SZ=210, cx=SZ/2, R=86, N=48
  const ang = (i:number)=> (-225 + (270*i)/(N-1)) * Math.PI/180
  const lit = Math.round((shown/100)*(N-1))
  const needle = ang(Math.min(N-1,Math.max(0,(shown/100)*(N-1))))
  const nx = cx+Math.cos(needle)*(R-24), ny = cx+Math.sin(needle)*(R-24)
  const sp = d.spark, mx = Math.max(...sp), mn = Math.min(...sp)
  const line = sp.map((v,i)=>`${i?'L':'M'}${(i*(100/(sp.length-1))).toFixed(1)},${(22-((v-mn)/(mx-mn||1))*18-2).toFixed(1)}`).join(' ')
  const vec = d.cats[vi]
  const vcol = vec[1]>=71?C.orange:vec[1]>=41?C.amber:C.safe
  const up = d.delta.startsWith('+')

  const tile:React.CSSProperties = { flex:1, minWidth:0, background:'rgba(0,0,0,0.3)', border:`1px solid ${C.border}`, borderRadius:14, padding:'10px 10px 9px' }
  const cap:React.CSSProperties = { fontSize:9.5, fontWeight:700, letterSpacing:'.8px', color:C.faint, marginBottom:4 }

  return (
    <div style={{ background:'linear-gradient(160deg,#36190A 0%,#1F130B 50%,#160F0A 100%)', border:`1px solid ${C.borderStrong}`, borderRadius:26, padding:'16px 14px 12px', marginBottom:14, position:'relative', overflow:'hidden', boxShadow:`0 22px 46px -26px ${z.c}66` }}>
      <div style={{ position:'absolute', top:50, left:'50%', width:260, height:260, marginLeft:-130, borderRadius:'50%', background:`radial-gradient(circle,${z.c}2A,transparent 65%)`, transition:'background .6s', pointerEvents:'none' }}/>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
        <div>
            <div style={{ fontSize:15.5, fontWeight:800, color:C.text, letterSpacing:'-0.2px', lineHeight:1.1 }}>Threat Level</div>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3, fontSize:10, fontWeight:700, letterSpacing:'.8px', color:C.orange }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:C.orange, animation:'bs-pulse 1.5s ease-in-out infinite' }}/>AI MONITORING
            </div>
          </div>
        <div style={{ display:'flex', background:'rgba(0,0,0,0.4)', border:`1px solid ${C.border}`, borderRadius:12, padding:3 }}>
          {(Object.keys(THREAT) as Range[]).map(r=>(
            <button key={r} onClick={()=>setRange(r)} style={{ border:0, cursor:'pointer', fontFamily:'inherit', fontSize:10.5, fontWeight:700, padding:'5px 9px', borderRadius:9, color:range===r?'#1A0E06':C.faint, background:range===r?C.grad:'transparent', transition:'all .2s' }}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{ position:'relative', width:SZ, height:SZ*0.9, margin:'2px auto 0' }}>
        <svg width={SZ} height={SZ} style={{ position:'absolute', top:0, left:0, overflow:'visible' }}>
          {Array.from({length:N}).map((_,i)=>{
            const a=ang(i), pct=(i/(N-1))*100, col=pct>70?C.orange:pct>40?C.amber:C.safe, on=i<=lit
            const major = i%8===0, r1=R-(major?13:8), r2=R+(major?4:2)
            return <line key={i} x1={cx+Math.cos(a)*r1} y1={cx+Math.sin(a)*r1} x2={cx+Math.cos(a)*r2} y2={cx+Math.sin(a)*r2}
              stroke={on?col:'rgba(255,230,200,0.12)'} strokeWidth={major?3:2.2} strokeLinecap="round"
              style={{ filter:on&&i>lit-4?`drop-shadow(0 0 4px ${col})`:'none', transition:'stroke .25s' }}/>
          })}
          <circle cx={cx} cy={cx} r={R-30} fill="rgba(0,0,0,0.3)" stroke={`${z.c}40`} strokeWidth="1"/>
          <circle cx={nx} cy={ny} r="4.5" fill={z.c} style={{ filter:`drop-shadow(0 0 8px ${z.c})` }}/>
        </svg>
        <div style={{ position:'absolute', left:0, width:SZ, top:SZ*0.3, textAlign:'center' }}>
          <div style={{ fontSize:54, fontWeight:900, lineHeight:0.95, color:z.c, letterSpacing:'-2px', textShadow:`0 0 26px ${z.c}70`, fontVariantNumeric:'tabular-nums' }}>{shown}</div>
          <div style={{ fontSize:9, fontWeight:700, letterSpacing:'2px', color:C.faint, marginTop:3 }}>RISK SCORE</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginTop:7, background:`${z.c}1C`, border:`1px solid ${z.c}44`, color:z.c, borderRadius:20, padding:'3px 11px', fontSize:10.5, fontWeight:800, letterSpacing:'.8px' }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:z.c }}/>{z.l}
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, position:'relative', marginTop:2 }}>
        <div style={tile}>
          <div style={cap}>TREND</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:16, fontWeight:900, color:up?C.orange:C.safe, lineHeight:1 }}>{up?'▲':'▼'}{d.delta.slice(1)}</span>
          </div>
          <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width:'100%', height:18, display:'block', marginTop:5 }}>
            <path d={line} fill="none" stroke={z.c} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </div>
        <button onClick={()=>setVi(i=>(i+1)%d.cats.length)} style={{ ...tile, flex:1.5, textAlign:'left', cursor:'pointer', fontFamily:'inherit' }} aria-label="Next fraud vector">
          <div style={{ ...cap, display:'flex', justifyContent:'space-between' }}><span>TOP VECTOR</span><span style={{ color:C.ghost }}>{vi+1}/{d.cats.length} ›</span></div>
          <div style={{ fontSize:12.5, fontWeight:800, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{vec[0]}</div>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginTop:7 }}>
            <span style={{ flex:1, height:5, borderRadius:3, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
              <span style={{ display:'block', height:'100%', width:`${vec[1]}%`, background:`linear-gradient(90deg,${vcol}88,${vcol})`, borderRadius:3, transition:'width .6s cubic-bezier(.2,.8,.2,1)' }}/>
            </span>
            <span style={{ fontSize:12, fontWeight:800, color:vcol }}>{vec[1]}</span>
          </div>
        </button>
        <div style={tile}>
          <div style={cap}>OPEN CASES</div>
          <div style={{ fontSize:16, fontWeight:900, color:C.text, lineHeight:1 }}>29</div>
          <div style={{ fontSize:10, color:C.orange, fontWeight:700, marginTop:7 }}>4 critical</div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:11, fontSize:10.5, color:C.faint, position:'relative' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.safe} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>
        Encrypted · Synced 2 min ago
      </div>
    </div>
  )
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardScreen({ onOpenScan }: { onOpenScan:()=>void }) {
  const { can:canD } = useRBAC()
  const [kpi, setKpi] = useState<BackendKpi | null>(null)
  const [dbClaims, setDbClaims] = useState<BackendClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPattern, setExpandedPattern] = useState<string|null>(null)

  useEffect(() => {
    let active = true
    const fetchData = async () => {
      try {
        const [k, c] = await Promise.all([apiGetKpi(), apiGetClaims()])
        if (active) {
          setKpi(k)
          setDbClaims(c)
        }
      } catch (err) {
        console.warn("Realtime DB sync error:", err)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchData()
    const interval = setInterval(fetchData, 20000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  const topClaims = dbClaims.length > 0 
    ? dbClaims.filter(c => c.aiForensics?.riskLevel === 'CRITICAL' || c.aiForensics?.riskLevel === 'HIGH').slice(0, 4)
    : CLAIMS.filter(c=>c.risk==='High').slice(0,3).map(c => ({
        id: c.id,
        patient: { name: c.claimant },
        treatment: { diagnosis: c.type },
        hospital: { name: c.provider },
        financials: { billedAmount: parseInt(c.amt.replace(/\D/g,'')) },
        aiForensics: { fraudScore: c.ai, riskLevel: 'HIGH' as const }
      }))

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'0 16px 110px' }}>
      <ThreatHero/>

      {/* ── Quick Stats Strip (Real-time National Network) ────────────────── */}
      <SectionLabel action={<LiveBadge label={loading ? "SYNCING..." : "LIVE SYNC"} color={C.safe}/>}>National Forensic Metrics</SectionLabel>
      <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4, marginBottom:14 }}>
        <StatChip icon={Ic.alert} label="High-Risk Queue" value={String(kpi?.highRiskAlertsCount || topClaims.length || 6)} sub="Active in SIU" color={C.orange} delay={0}/>
        <StatChip icon={Ic.trend} label="Fraud Prevented" value={kpi?.fraudAmountPrevented || "₹48.6 Cr"} sub="Saved YTD" color={C.amber} delay={80}/>
        <StatChip icon={Ic.cpu} label="Ensemble AUC" value={`${kpi?.ensembleModelAuc ? (kpi.ensembleModelAuc * 100).toFixed(1) : '99.7'}%`} sub="Vision AI + XGBoost" color={C.safe} delay={160}/>
        <StatChip icon={Ic.claims} label="Total Audited" value={kpi?.totalClaimsProcessed ? `${(kpi.totalClaimsProcessed/1000).toFixed(1)}K` : "142K"} sub="Real-time claims" color={C.faint} delay={240}/>
      </div>

      {/* ── Official Reports & Dossier Downloads (PDF & Excel) ────────────── */}
      <div style={{ marginBottom:14, background:'linear-gradient(160deg,#2A1608 0%,#1C1007 55%,#120C05 100%)', border:`1px solid ${C.orange}40`, borderRadius:22, padding:'18px 16px 16px', position:'relative', overflow:'hidden', boxShadow:`0 18px 48px -20px ${C.orange}44` }}>
        {/* top amber glow bar */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${C.amber},${C.orange},transparent)`, borderRadius:'22px 22px 0 0' }}/>
        {/* decorative watermark crest */}
        <svg style={{ position:'absolute', right:-10, bottom:-14, opacity:0.045, pointerEvents:'none' }} width="110" height="110" viewBox="0 0 24 24" fill={C.amber}>
          <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.35C17.25 23.15 21 18.25 21 13V7l-9-5z"/>
          <path fill="#fff" d="M10.5 16.5l-3-3 1.4-1.4 1.6 1.6 4.1-4.1 1.4 1.4z"/>
        </svg>

        {/* header row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, position:'relative' }}>
          <div style={{ flex:1, paddingRight:10 }}>
            {/* eyebrow */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
              <div style={{ width:14, height:2, borderRadius:2, background:`linear-gradient(90deg,${C.amber},${C.orange})` }}/>
              <span style={{ fontSize:9, fontWeight:800, letterSpacing:'1.2px', color:C.amber, textTransform:'uppercase' }}>Forensic Intelligence</span>
            </div>
            <div style={{ fontSize:16, fontWeight:900, color:'#FFF5EA', letterSpacing:'-0.3px', lineHeight:1.2 }}>Official Investigation<br/>Reports</div>
            <div style={{ fontSize:10.5, color:'#A07858', marginTop:5, lineHeight:1.5 }}>IRDAI & DPDP Act 2023 · Encrypted Dossiers</div>
          </div>
          {/* GOVT APPROVED badge */}
          <div style={{ flexShrink:0, textAlign:'center' }}>
            <div style={{ background:`linear-gradient(135deg,${C.amber}28,${C.orange}18)`, border:`1.5px solid ${C.amber}55`, borderRadius:12, padding:'5px 10px', boxShadow:`0 4px 14px ${C.amber}25` }}>
              <div style={{ fontSize:8, fontWeight:900, letterSpacing:'1px', color:C.amber, lineHeight:1.3 }}>GOVT</div>
              <div style={{ fontSize:8, fontWeight:900, letterSpacing:'1px', color:C.amber, lineHeight:1.3 }}>APPROVED</div>
            </div>
            <div style={{ marginTop:5, fontSize:8.5, color:'#6B5040', fontWeight:600, textAlign:'center' }}>Sec 45·IPC</div>
          </div>
        </div>

        {/* divider */}
        <div style={{ height:1, background:`linear-gradient(90deg,${C.orange}33,${C.amber}22,transparent)`, marginBottom:14 }}/>

        {/* download buttons */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {/* PDF */}
          <PressBtn onClick={()=>downloadPdfReportFile()} style={{ background:'linear-gradient(145deg,#C2540E 0%,#7A2808 100%)', borderRadius:16, padding:'13px 10px', color:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5, boxShadow:`0 8px 24px rgba(194,84,14,0.45), inset 0 1px 0 rgba(255,200,120,0.15)`, border:'1px solid rgba(255,140,60,0.25)' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:2 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
              </svg>
            </div>
            <div style={{ fontSize:11.5, fontWeight:800, letterSpacing:'-0.2px', textAlign:'center', lineHeight:1.2 }}>Download PDF<br/>Dossier</div>
            <div style={{ fontSize:9, fontWeight:600, color:'rgba(255,220,180,0.7)', letterSpacing:'0.4px' }}>Encrypted · Signed</div>
          </PressBtn>
          {/* Excel */}
          <PressBtn onClick={()=>downloadExcelReportFile()} style={{ background:'linear-gradient(145deg,#1A8050 0%,#0E4D30 100%)', borderRadius:16, padding:'13px 10px', color:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5, boxShadow:`0 8px 24px rgba(26,128,80,0.45), inset 0 1px 0 rgba(100,255,170,0.1)`, border:'1px solid rgba(50,200,120,0.2)' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:2 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
              </svg>
            </div>
            <div style={{ fontSize:11.5, fontWeight:800, letterSpacing:'-0.2px', textAlign:'center', lineHeight:1.2 }}>Export Excel<br/>Report</div>
            <div style={{ fontSize:9, fontWeight:600, color:'rgba(180,255,210,0.6)', letterSpacing:'0.4px' }}>Live Data · XLSX</div>
          </PressBtn>
        </div>
      </div>

      {/* ── Critical Cases (Fetched from National Network) ─────────────────── */}
      <Card style={{ marginBottom:14 }}>
        <SectionLabel action={<span style={{ fontSize:12, color:C.orange, fontWeight:700 }}>{topClaims.length} active</span>}>
          Critical Cases — Live SIU Priority
        </SectionLabel>
        {topClaims.map((cl: any, i: number)=>(
          <div key={cl.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:i<topClaims.length-1?`1px solid ${C.border}`:'none' }}>
            {/* Initials */}
            <div style={{ width:38, height:38, borderRadius:11, background:C.orangeSoft, border:`1px solid ${C.orange}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:C.orange, flexShrink:0 }}>
              {canD('view_pii') ? (cl.patient?.name ? cl.patient.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2) : 'CL') : '••'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:2 }}>{cl.id}</div>
              <div style={{ fontSize:11.5, color:C.faint, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {cl.treatment?.diagnosis || "Investigation"} · {cl.hospital?.name || "Hospital"}
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.amber }}>
                ₹{cl.financials?.billedAmount ? (cl.financials.billedAmount).toLocaleString('en-IN') : '1,20,000'}
              </div>
              <div style={{ fontSize:10.5, fontWeight:700, color:C.orange, marginTop:1 }}>
                {cl.aiForensics?.fraudScore || 90}% risk
              </div>
            </div>
          </div>
        ))}
      </Card>

      {/* ── Emerging Patterns ─────────────────────────────────────────────── */}
      <Card style={{ marginBottom:14 }}>
        <SectionLabel action={<span style={{ fontSize:12, color:C.amber, fontWeight:600 }}>5 patterns →</span>}>
          Emerging Fraud Patterns
        </SectionLabel>
        {EMERGING_PATTERNS.slice(0,3).map((p,i)=>{
          const open = expandedPattern === p.id
          const sc = { Confirmed:{c:C.orange,bg:C.orangeSoft}, Active:{c:C.orange,bg:C.orangeSoft}, Emerging:{c:C.amber,bg:C.amberSoft}, Monitoring:{c:C.amber,bg:C.amberSoft}, Unknown:{c:C.faint,bg:'rgba(255,255,255,0.06)'} }[p.status]
          return (
            <div key={p.id} onClick={()=>setExpandedPattern(open?null:p.id)} style={{ paddingBottom:i<2?12:0, marginBottom:i<2?12:0, borderBottom:i<2?`1px solid ${C.border}`:'none', cursor:'pointer' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{p.title}</div>
                  <span style={{ fontSize:10, fontWeight:700, background:sc.bg, color:sc.c, padding:'2px 8px', borderRadius:8, display:'inline-block', marginTop:4 }}>{p.status}</span>
                </div>
                <div style={{ textAlign:'center', flexShrink:0 }}>
                  <div style={{ fontSize:20, fontWeight:900, color:p.confidence>=80?C.orange:C.amber }}>{p.confidence}%</div>
                  <div style={{ fontSize:9.5, color:C.faint }}>conf.</div>
                </div>
              </div>
              {/* Confidence bar */}
              <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginBottom:open?8:0 }}>
                <div style={{ height:'100%', width:`${p.confidence}%`, borderRadius:2, background:p.confidence>=80?C.grad:C.gradAmber, animation:'bs-bar .7s ease-out' }}/>
              </div>
              {open && <div style={{ fontSize:12, color:C.faint, lineHeight:1.6, animation:'bs-fadein .25s ease-out' }}>{p.desc}</div>}
            </div>
          )
        })}
      </Card>

      {/* ── Trend Chart ───────────────────────────────────────────────────── */}
      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:C.text }}>Claims Value Trend</div>
            <div style={{ fontSize:12, color:C.faint, marginTop:2 }}>8-month · Total ₹24.8L flagged</div>
          </div>
          <div style={{ background:C.card2, borderRadius:8, padding:'5px 10px', fontSize:11.5, fontWeight:600, color:C.dim, border:`1px solid ${C.border}` }}>FY 25-26</div>
        </div>
        {(() => {
          const vals=[180,290,210,340,260,410,390,470]; const max=Math.max(...vals)
          return (
            <>
              <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:80 }}>
                {vals.map((v,i)=>(
                  <div key={i} style={{ flex:1, height:'100%', display:'flex', flexDirection:'column', justifyContent:'flex-end', position:'relative' }}>
                    <div style={{ width:'100%', borderRadius:'4px 4px 0 0', background:i===7?C.grad:`linear-gradient(180deg,rgba(255,122,61,0.3),rgba(194,84,14,0.1))`, height:`${(v/max)*100}%`, transition:'height .6s', position:'relative' }}>
                      {i===7 && <div style={{ position:'absolute', top:-24, left:'50%', transform:'translateX(-50%)', background:C.grad, borderRadius:6, padding:'2px 6px', fontSize:9.5, fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>₹4.7L</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', marginTop:6 }}>
                {TREND_MONTHS.map((m,i)=><span key={i} style={{ flex:1, textAlign:'center', fontSize:9.5, color:i===7?C.amber:C.faint, fontWeight:i===7?700:400 }}>{m}</span>)}
              </div>
            </>
          )
        })()}
      </Card>
    </div>
  )
}

// ─── CLAIMS ───────────────────────────────────────────────────────────────────
function ClaimsScreen({ onNew }: { onNew:()=>void }) {
  const { can, mask, guard, toast, role } = useRBAC()
  const pii = can('view_pii')
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string|null>(null)
  const [claimsList, setClaimsList] = useState<BackendClaim[]>([])
  const [loading, setLoading] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiGetClaims()
      if (data && data.length > 0) {
        setClaimsList(data)
      }
    } catch (e) {
      console.warn("Using fallback claims on network glitch", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClaims()
    const id = setInterval(fetchClaims, 25000)
    return () => clearInterval(id)
  }, [fetchClaims])

  const handleStatusChange = async (claimId: string, newStatus: string) => {
    try {
      setActionBusy(true)
      await apiUpdateClaimStatus(claimId, newStatus, role.person)
      toast(`Claim ${claimId} marked as ${newStatus}`)
      await fetchClaims()
    } catch {
      toast(`Failed to update ${claimId}`, false)
    } finally {
      setActionBusy(false)
    }
  }

  // Use DB claims if available, otherwise fallback
  const displayClaims = claimsList.length > 0 ? claimsList : CLAIMS.map(c=>({
    id: c.id,
    claimNumber: c.id,
    insurer: "HDFC ERGO Health",
    patient: { name: c.claimant, age: 40, gender: 'Male', phone: '', aadhaarMasked: 'XXXX-XXXX-1122', city: 'Mumbai', state: 'MH' },
    policy: { number: 'POL-9921', plan: 'Health Protect', sumInsured: 500000, status: 'ACTIVE' },
    hospital: { name: c.provider, city: 'Mumbai', state: 'MH', nabhAccredited: true, riskRating: c.risk.toUpperCase(), syndicateFlag: c.risk==='High' },
    treatment: { diagnosis: c.type, icd10: 'K35.2', admissionDate: c.date, dischargeDate: c.date, lengthOfStayDays: 3, roomCategory: 'Standard' },
    financials: { billedAmount: parseInt(c.amt.replace(/\D/g,'')) || 100000, approvedAmount: 0, disallowedAmount: parseInt(c.amt.replace(/\D/g,'')) || 100000, gipsaBenchmarkTariff: 45000, tariffInflationPct: 40 },
    aiForensics: { fraudScore: c.ai, riskLevel: c.risk==='High'?'HIGH':c.risk==='Medium'?'MEDIUM':'LOW' as any, isolationForestScore: 0.8, xgbAnomalyScore: 0.8, lstmTemporalAnomaly: 0.7, deepfakeDocScore: 0.1, flags: ['Tariff deviation detected'], geminiSummary: 'Forensic flags detected.' },
    status: c.risk==='High'?'ESCALATED_SIU':'UNDER_REVIEW' as any,
    timeline: []
  }))

  const TABS = [
    { l:'All', count:displayClaims.length },
    { l:'High Risk', count:displayClaims.filter(c=>c.aiForensics?.riskLevel==='CRITICAL'||c.aiForensics?.riskLevel==='HIGH').length },
    { l:'Medium', count:displayClaims.filter(c=>c.aiForensics?.riskLevel==='MEDIUM').length },
    { l:'Approved', count:displayClaims.filter(c=>c.status==='APPROVED').length }
  ]

  const filtered = displayClaims.filter(c => {
    const isHigh = c.aiForensics?.riskLevel === 'CRITICAL' || c.aiForensics?.riskLevel === 'HIGH'
    const isMed = c.aiForensics?.riskLevel === 'MEDIUM'
    const isApproved = c.status === 'APPROVED'
    const matchTab = filter==='All' || (filter==='High Risk'&&isHigh) || (filter==='Medium'&&isMed) || (filter==='Approved'&&isApproved)
    const matchSearch = !search || c.id.toLowerCase().includes(search.toLowerCase()) || (pii && c.patient?.name.toLowerCase().includes(search.toLowerCase())) || c.hospital?.name.toLowerCase().includes(search.toLowerCase()) || c.treatment?.diagnosis.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const totalAtRisk = filtered.reduce((sum,c)=>sum+(c.financials?.billedAmount||0),0)

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'0 16px 110px' }}>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <div style={{ fontSize:20, fontWeight:800, color:C.text }}>Claims Forensics</div>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <PressBtn onClick={onNew} style={{ height:36, background:C.grad, borderRadius:12, padding:'0 12px', color:'#fff', fontSize:12, fontWeight:800, display:'inline-flex', alignItems:'center', gap:5, boxShadow:'0 4px 14px rgba(194,84,14,0.35)', border:'1px solid rgba(255,200,120,0.25)', whiteSpace:'nowrap' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>New Claim</span>
            </PressBtn>
            <PressBtn onClick={()=>downloadExcelReportFile()} title="Export Live Excel Report" style={{ width:36, height:36, borderRadius:12, background:'linear-gradient(145deg,#1F8A53 0%,#125833 100%)', border:'1px solid rgba(50,200,120,0.3)', color:'#fff', boxShadow:'0 4px 14px rgba(26,128,80,0.35)', padding:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>
              </svg>
            </PressBtn>
            <PressBtn onClick={()=>downloadPdfReportFile()} title="Download Live PDF Dossier" style={{ width:36, height:36, borderRadius:12, background:'linear-gradient(145deg,#C2540E 0%,#7A2808 100%)', border:'1px solid rgba(255,140,60,0.3)', color:'#fff', boxShadow:'0 4px 14px rgba(194,84,14,0.35)', padding:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
              </svg>
            </PressBtn>
          </div>
        </div>
        <div style={{ fontSize:12, color:C.faint }}>
          {filtered.length} live claims · <span style={{ color:C.amber, fontWeight:600 }}>₹{(totalAtRisk/100000).toFixed(1)}L at risk</span> · {loading ? "Syncing..." : "Forensic Cloud Active"}
        </div>
      </div>

      {/* Search */}
      <div style={{ display:'flex', alignItems:'center', gap:10, background:C.card2, border:`1px solid ${C.border}`, borderRadius:14, padding:'10px 14px', marginBottom:12 }}>
        <span style={{ color:C.faint, flexShrink:0 }}>{Ic.search}</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} style={{ background:'none', border:'none', outline:'none', color:C.text, fontSize:13.5, flex:1 }} placeholder="Search claim ID, patient, hospital, ICD-10…"/>
        {search && <span onClick={()=>setSearch('')} style={{ color:C.faint, cursor:'pointer', fontSize:18, lineHeight:1 }}>×</span>}
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:2 }}>
        {TABS.map(t=>(
          <button key={t.l} onClick={()=>setFilter(t.l)} style={{ background:filter===t.l?C.grad:C.card2, border:`1px solid ${filter===t.l?'transparent':C.border}`, borderRadius:20, padding:'7px 14px', fontSize:12.5, fontWeight:600, color:filter===t.l?'#fff':C.dim, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, boxShadow:filter===t.l?'0 4px 16px rgba(194,84,14,0.35)':'none', display:'flex', alignItems:'center', gap:6 }}>
            {t.l}
            <span style={{ background:filter===t.l?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.07)', borderRadius:10, padding:'0 6px', fontSize:11 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Claims list */}
      {filtered.length===0
        ? <div style={{ textAlign:'center', padding:'60px 20px', color:C.faint }}><div style={{ fontSize:32, marginBottom:12 }}>🔍</div><div style={{ fontSize:15, fontWeight:600, color:C.dim }}>No claims match</div><div style={{ fontSize:13, marginTop:6 }}>Try adjusting your search or filter</div></div>
        : <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(cl=>{
              const open = expanded===cl.id
              const rLevel = cl.aiForensics?.riskLevel || 'LOW'
              const rCol = rLevel==='CRITICAL'||rLevel==='HIGH' ? C.orange : rLevel==='MEDIUM' ? C.amber : C.safe
              const initials = cl.patient?.name ? cl.patient.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2) : 'CL'
              const fraudScore = cl.aiForensics?.fraudScore || 50
              const amtStr = `₹${(cl.financials?.billedAmount || 0).toLocaleString('en-IN')}`

              return (
                <div key={cl.id} onClick={()=>setExpanded(open?null:cl.id)} style={{ background:C.gradCard, border:`1px solid ${C.border}`, borderRadius:20, overflow:'hidden', cursor:'pointer', transition:'border-color .15s', borderLeft:`3px solid ${rCol}` }}>
                  <div style={{ padding:'14px 16px' }}>
                    {/* Top row */}
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:40, height:40, borderRadius:12, background:`${rCol}18`, border:`1px solid ${rCol}25`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:rCol, flexShrink:0 }}>
                          {pii ? initials : '••'}
                        </div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{cl.id}</div>
                          <div style={{ fontSize:11, color:C.faint, marginTop:1 }}>{cl.insurer || "Health"} · {cl.treatment?.icd10 || "ICD-10"}</div>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <span style={{ background:`${rCol}18`, color:rCol, border:`1px solid ${rCol}33`, fontSize:10.5, fontWeight:800, padding:'3px 8px', borderRadius:12 }}>{rLevel}</span>
                        <div style={{ fontSize:14, fontWeight:800, color:C.amber, marginTop:6 }}>{amtStr}</div>
                      </div>
                    </div>

                    {/* Details grid */}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                      <div>
                        <div style={{ fontSize:9.5, color:C.faint, marginBottom:2, textTransform:'uppercase', letterSpacing:'0.6px' }}>CLAIMANT</div>
                        <div style={{ fontSize:12.5, fontWeight:600, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{mask(cl.patient?.name || 'Patient')}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:9.5, color:C.faint, marginBottom:2, textTransform:'uppercase', letterSpacing:'0.6px' }}>HOSPITAL / PROVIDER</div>
                        <div style={{ fontSize:12.5, fontWeight:600, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{cl.hospital?.name || 'Provider'}</div>
                      </div>
                    </div>

                    {/* Diagnosis & Status */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, fontSize:11.5 }}>
                      <span style={{ color:C.dim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220 }}>
                        {cl.treatment?.diagnosis || "Treatment"}
                      </span>
                      <span style={{ color:cl.status==='APPROVED'?C.safe:cl.status==='REJECTED'?C.danger:C.amber, fontWeight:700 }}>
                        {cl.status?.replace('_',' ') || "IN REVIEW"}
                      </span>
                    </div>

                    {/* AI Score bar */}
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                          <span style={{ fontSize:10.5, color:C.faint }}>Neural Ensemble Risk</span>
                          <span style={{ fontSize:11, fontWeight:800, color:rCol }}>{fraudScore}%</span>
                        </div>
                        <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${fraudScore}%`, borderRadius:3, background:fraudScore>=75?C.grad:fraudScore>=45?C.gradAmber:C.gradSafe }}/>
                        </div>
                      </div>
                      <PressBtn style={{ background:C.grad, borderRadius:11, padding:'8px 12px', fontSize:11.5, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {open ? 'Collapse ▲' : 'Forensics ▼'}
                      </PressBtn>
                    </div>
                  </div>

                  {/* Expanded Forensics View */}
                  {open && (
                    <div style={{ borderTop:`1px solid ${C.border}`, padding:'14px 16px', background:'rgba(255,255,255,0.02)', animation:'bs-fadein .2s ease-out' }}>
                      <div style={{ fontSize:10.5, fontWeight:800, color:C.amber, letterSpacing:'0.8px', marginBottom:8 }}>BHARATSHIELD AI FORENSIC ANALYSIS</div>
                      <div style={{ fontSize:12, color:C.dim, lineHeight:1.55, background:'rgba(255,122,61,0.06)', border:`1px solid ${C.orange}22`, borderRadius:12, padding:10, marginBottom:12 }}>
                        {cl.aiForensics?.geminiSummary || "Multi-modal model detected procedural tariff discrepancy exceeding standard GIPSA schedules."}
                      </div>

                      {cl.aiForensics?.flags && cl.aiForensics.flags.length > 0 && (
                        <div style={{ marginBottom:12 }}>
                          <div style={{ fontSize:9.5, color:C.faint, fontWeight:700, marginBottom:6 }}>DETECTED ANOMALY FLAGS:</div>
                          {cl.aiForensics.flags.map((flag, idx) => (
                            <div key={idx} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11.5, color:C.text, marginBottom:4 }}>
                              <span style={{ color:C.orange }}>⚠</span> {flag}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Live Action Buttons updating MongoDB */}
                      <div style={{ display:'flex', gap:8, marginTop:14 }}>
                        <PressBtn onClick={(e)=>{ e.stopPropagation(); handleStatusChange(cl.id, 'ESCALATED_SIU') }} style={{ flex:1, background:C.orangeSoft, border:`1px solid ${C.orange}35`, borderRadius:12, padding:'10px', fontSize:11.5, fontWeight:700, color:C.orange, display:'flex', justifyContent:'center', alignItems:'center', gap:4 }}>
                          {Ic.flag} Escalate SIU
                        </PressBtn>
                        <PressBtn onClick={(e)=>{ e.stopPropagation(); handleStatusChange(cl.id, 'APPROVED') }} style={{ flex:1, background:C.safeSoft, border:`1px solid ${C.safe}35`, borderRadius:12, padding:'10px', fontSize:11.5, fontWeight:700, color:C.safe, display:'flex', justifyContent:'center', alignItems:'center', gap:4 }}>
                          ✓ Approve
                        </PressBtn>
                        <PressBtn onClick={(e)=>{ e.stopPropagation(); handleStatusChange(cl.id, 'REJECTED') }} style={{ flex:1, background:C.dangerSoft, border:`1px solid ${C.danger}35`, borderRadius:12, padding:'10px', fontSize:11.5, fontWeight:700, color:C.danger, display:'flex', justifyContent:'center', alignItems:'center', gap:4 }}>
                          ✕ Repudiate
                        </PressBtn>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      }
    </div>
  )
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
// ─── REPORTS CENTER ───────────────────────────────────────────────────────────
const REPORT_TYPES: { id:ReportKind; label:string; sub:string; color:string; pages:string }[] = [
  { id:'executive', label:'Executive Summary', sub:'KPIs, trends, top cases',    color:C.orange, pages:'3 sections' },
  { id:'claims',    label:'Claims Forensics',  sub:'All flagged claims + AI score', color:C.amber,  pages:'8 claims' },
  { id:'models',    label:'Model Performance', sub:'Accuracy, precision, recall', color:C.safe,   pages:'4 models' },
  { id:'patterns',  label:'Pattern Intel',     sub:'Fraud library + trends',     color:C.orangeMid, pages:'5 patterns' },
]
const PDF_RED = '#E5322D', XLS_GREEN = '#21A366'
function FileIcon({ kind, size=22 }: { kind:ReportFormat; size?:number }) {
  const col = kind==='pdf' ? PDF_RED : XLS_GREEN
  return (
    <svg width={size} height={size*1.2} viewBox="0 0 24 29" fill="none" style={{ flexShrink:0 }}>
      <path d="M3 2.5A1.5 1.5 0 014.5 1H15l6 6v19.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 26.5v-24z" fill={col}/>
      <path d="M15 1l6 6h-4.5A1.5 1.5 0 0115 5.5V1z" fill="#fff" fillOpacity=".4"/>
      {kind==='pdf' ? (
        <text x="12" y="21" textAnchor="middle" fontSize="7.2" fontWeight="900" fill="#fff" fontFamily="Inter,Arial,sans-serif">PDF</text>
      ) : (
        <path d="M8.2 12.5l7.6 10M15.8 12.5l-7.6 10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/>
      )}
    </svg>
  )
}

type Generated = { id:number; kind:ReportKind; fmt:ReportFormat; period:string; at:string; file:string }

function ReportsCenter() {
  const { can, guard } = useRBAC()
  const [kind,setKind] = useState<ReportKind>('executive')
  const [fmt,setFmt] = useState<ReportFormat>('pdf')
  const [period,setPeriod] = useState('30 Days')
  const [busy,setBusy] = useState(false)
  const [pct,setPct] = useState(0)
  const [err,setErr] = useState('')
  const [history,setHistory] = useState<Generated[]>([])
  const rt = REPORT_TYPES.find(r=>r.id===kind)!

  const run = useCallback(async (k:ReportKind, f:ReportFormat, per:string)=>{
    setBusy(true); setErr(''); setPct(8)
    const timer = setInterval(()=>setPct(p=>Math.min(90,p+9)),140)
    try {
      const data = buildReport(k, per, { claims:CLAIMS, models:AI_MODELS, patterns:EMERGING_PATTERNS, trendMonths:TREND_MONTHS, trends:TREND_DATA })
      const file = `BharatShield_${k}_${per.replace(/\s/g,'')}_${new Date().toISOString().slice(0,10)}`
      await downloadReport(data, f, file)
      clearInterval(timer); setPct(100)
      setHistory(h=>[{ id:Date.now(), kind:k, fmt:f, period:per, at:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}), file:`${file}.${f}` },...h].slice(0,4))
    } catch { clearInterval(timer); setErr('Could not generate the report. Please try again.') }
    setTimeout(()=>{ setBusy(false); setPct(0) }, 700)
  },[])

  const seg = (on:boolean,col=C.orange):React.CSSProperties=>({ flex:1, border:`1px solid ${on?col+'66':C.border}`, background:on?`${col}1F`:'rgba(255,255,255,0.03)', color:on?col:C.faint, borderRadius:12, padding:'9px 0', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .2s' })

  return (
    <Card style={{ marginBottom:14, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,122,61,0.14),transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, position:'relative' }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.text }}>Reports & Analytics</div>
          <div style={{ fontSize:12, color:C.faint, marginTop:2 }}>Export audit-ready reports as PDF or Excel</div>
        </div>
        <LiveBadge label="READY" color={C.safe}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14, position:'relative' }}>
        {REPORT_TYPES.map(r=>{
          const on = r.id===kind
          return (
            <button key={r.id} onClick={()=>setKind(r.id)} style={{ textAlign:'left', fontFamily:'inherit', cursor:'pointer', padding:'11px 12px', borderRadius:14, border:`1px solid ${on?r.color+'77':C.border}`, background:on?`${r.color}17`:'rgba(255,255,255,0.03)', boxShadow:on?`0 0 18px ${r.color}22`:'none', transition:'all .2s' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:r.color }}/>
                <span style={{ width:14, height:14, borderRadius:'50%', border:`1.5px solid ${on?r.color:C.faint}`, background:on?r.color:'transparent', display:'flex', alignItems:'center', justifyContent:'center', color:'#1A0E06', fontSize:9, fontWeight:900 }}>{on?'✓':''}</span>
              </div>
              <div style={{ fontSize:12.5, fontWeight:700, color:on?C.text:C.dim }}>{r.label}</div>
              <div style={{ fontSize:10.5, color:C.faint, marginTop:2, lineHeight:1.35 }}>{r.sub}</div>
            </button>
          )
        })}
      </div>

      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.8px', color:C.faint, marginBottom:6 }}>PERIOD</div>
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        {['7 Days','30 Days','90 Days','FY 25-26'].map(p=><button key={p} onClick={()=>setPeriod(p)} style={{...seg(period===p), fontSize:11}}>{p}</button>)}
      </div>

      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.8px', color:C.faint, marginBottom:6 }}>FORMAT</div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <button onClick={()=>setFmt('pdf')} style={{...seg(fmt==='pdf',PDF_RED), display:'flex', alignItems:'center', justifyContent:'center', gap:8}}><FileIcon kind="pdf" size={16}/>PDF</button>
        <button onClick={()=>setFmt('xlsx')} style={{...seg(fmt==='xlsx',XLS_GREEN), display:'flex', alignItems:'center', justifyContent:'center', gap:8}}><FileIcon kind="xlsx" size={16}/>Excel</button>
      </div>

      <PressBtn onClick={busy?undefined:()=>guard('export_reports','Export report',()=>run(kind,fmt,period))} style={{ width:'100%', position:'relative', overflow:'hidden', background:fmt==='pdf'?`linear-gradient(135deg,${PDF_RED},#A91E1A)`:`linear-gradient(135deg,${XLS_GREEN},#15703F)`, borderRadius:16, padding:'15px', fontSize:14, fontWeight:800, color:'#fff', boxShadow:`0 10px 28px ${fmt==='pdf'?PDF_RED:XLS_GREEN}55`, opacity:busy?.9:1 }}>
        {busy && <span style={{ position:'absolute', left:0, top:0, bottom:0, width:`${pct}%`, background:'rgba(255,255,255,0.22)', transition:'width .25s' }}/>}
        <span style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:9 }}>{!busy && !can('export_reports') && <span style={{ display:'flex' }}>{Ic.lock}</span>}{!busy && can('export_reports') && <span style={{ background:'#fff', borderRadius:4, padding:'2px 3px', display:'flex' }}><FileIcon kind={fmt} size={14}/></span>}{busy ? (pct>=100?'Downloaded ✓':`Generating ${rt.label}… ${pct}%`) : `Download ${fmt==='pdf'?'PDF':'Excel'} Report`}</span>
      </PressBtn>
      {err && <div style={{ marginTop:10, fontSize:12, color:C.danger }}>{err}</div>}

      {history.length>0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.8px', color:C.faint, marginBottom:8 }}>RECENT EXPORTS</div>
          {history.map(h=>{
            const t = REPORT_TYPES.find(r=>r.id===h.kind)!
            return (
              <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, marginBottom:6 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:h.fmt==='pdf'?`${PDF_RED}1F`:`${XLS_GREEN}1F`, display:'flex', alignItems:'center', justifyContent:'center' }}><FileIcon kind={h.fmt} size={18}/></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:700, color:C.text }}>{t.label}</div>
                  <div style={{ fontSize:10.5, color:C.faint }}>{h.period} · {h.at}</div>
                </div>
                <button onClick={()=>run(h.kind,h.fmt,h.period)} disabled={busy} style={{ background:'none', border:`1px solid ${C.borderStrong}`, color:C.dim, borderRadius:10, padding:'6px 10px', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>↓ Again</button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── AGENTIC FRAUD GRAPH (Red → Blue → Green) ─────────────────────────────────
const GW = 1120, GH = 440
const AG_RED = '#FF5A5A', AG_BLUE = '#5BA8FF', AG_GREEN = C.safe
const GI = {
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  globe:'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  device:'M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2',
  claim:'M6 3h9l4 4v14H6zM9 12h7M9 16h7',
  hospital:'M4 4h16v16H4zM12 8v8M8 12h8',
  doctor:'M12 12a4 4 0 100-8 4 4 0 000 8zM5 21c0-4 3-6 7-6s7 2 7 6M17 3v4M15 5h4',
  bank:'M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18',
  db:'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6',
  link:'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  loss:'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4',
  siren:'M7 18v-6a5 5 0 0110 0v6M5 18h14M12 2v2M4 6l1.5 1.5M20 6l-1.5 1.5',
  bug:'M9 9a3 3 0 016 0v6a3 3 0 01-6 0zM4 9l3 2M20 9l-3 2M4 17l3-2M20 17l-3-2',
  check:'M5 12l5 5 9-10',
  warn:'M12 4l9 16H3zM12 10v4M12 17h.01',
} as const
type GK = keyof typeof GI
interface AN { id:string; x:number; y:number; kind:GK; label:string; sub:string; col:string; o:number; sat?:boolean; risk:number; bug?:boolean; fix?:number }
interface AE { a:string; b:string; hot?:boolean; curve?:boolean }

const AG_TOP = [...CLAIMS].sort((a,b)=>b.ai-a.ai)
const amtNum = (a:string)=>Number(a.replace(/[₹,]/g,''))
const AG_EXPO = (amtNum(AG_TOP[0].amt)+amtNum(AG_TOP[1].amt)+amtNum(AG_TOP[2].amt))/100000
const CREAM='#E9CFAE', PURPLE='#B48CFF', TOOLB='#7FB2FF'
const AG_NODES: AN[] = [
  { id:'scan', x:70,  y:90,  kind:'eye',      label:'Fraud Scanner', sub:'Red Agent probe', col:AG_RED, o:0, risk:0 },
  { id:'portal',x:270,y:90,  kind:'globe',    label:'Claim Portal',  sub:'Entry Point',     col:'#8FD3B0', o:1, risk:42 },
  { id:'dev',  x:90,  y:250, kind:'device',   label:'Device ••4471', sub:'Shared IMEI',     col:CREAM, o:2, risk:97 },
  { id:'c1',   x:270, y:250, kind:'claim',    label:AG_TOP[0].id,    sub:`Claim · ${AG_TOP[0].amt}`, col:CREAM, o:3, risk:AG_TOP[0].ai, bug:true },
  { id:'pr',   x:450, y:250, kind:'hospital', label:AG_TOP[0].provider, sub:'Provider',     col:CREAM, o:4, risk:90 },
  { id:'dr',   x:630, y:250, kind:'doctor',   label:'Dr. R. Malhotra', sub:'Attending Doctor', col:CREAM, o:5, risk:89, fix:3 },
  { id:'bk',   x:810, y:250, kind:'bank',     label:'HDFC ••9032',   sub:'Payout Account',  col:PURPLE, o:6, risk:95, fix:1 },
  { id:'loss', x:990, y:250, kind:'loss',     label:`₹${AG_EXPO.toFixed(1)}L at risk`, sub:'Projected loss', col:C.orange, o:7, risk:98, fix:3 },
  { id:'c2',   x:270, y:385, kind:'claim',    label:AG_TOP[1].id,    sub:`Claim · ${AG_TOP[1].amt}`, col:CREAM, o:4, risk:AG_TOP[1].ai },
  { id:'p2',   x:450, y:385, kind:'hospital', label:AG_TOP[1].provider, sub:'Provider',     col:CREAM, o:4, risk:92 },
  { id:'t1',   x:400, y:105, kind:'link',     label:'TPA-88211',     sub:'Duplicate Policy', col:TOOLB, o:4, sat:true, risk:93, fix:2 },
  { id:'t2',   x:500, y:105, kind:'link',     label:'Ghost Patient', sub:'No admission',    col:TOOLB, o:4, sat:true, risk:85 },
  { id:'kyc',  x:810, y:105, kind:'db',       label:'KYC Mismatch', sub:'Beneficiary data', col:C.safe, o:6, sat:true, risk:74 },
]
const AG_EDGES: AE[] = [
  { a:'portal',b:'c1' }, { a:'dev',b:'c1',hot:true }, { a:'c1',b:'pr',hot:true }, { a:'pr',b:'dr',hot:true }, { a:'dr',b:'bk',hot:true }, { a:'bk',b:'loss',hot:true },
  { a:'pr',b:'t1' }, { a:'pr',b:'t2' }, { a:'bk',b:'kyc' }, { a:'dev',b:'c2' }, { a:'c2',b:'p2' }, { a:'p2',b:'bk',hot:true,curve:true },
]
const AG_ALERTS = [
  { n:'c1', step:1, t:AG_TOP[0].type, s:`${AG_TOP[0].ai}% confidence` },
  { n:'bk', step:2, t:'Shared payout a/c', s:'3 claimants · 96%' },
  { n:'dr', step:3, t:'NMC ID mismatch', s:'2 hospitals · 89%' },
]
const AG_FIXES = ['Freeze payout a/c HDFC ••9032', 'Revoke duplicate policy TPA-88211', 'Escalate Dr. Malhotra to NMC review']
const AG_INFO = [
  { key:'red',   name:'Red Agent',   badge:'Offensive', col:AG_RED,   blurb:'Discovers every fraud path with automated probing and risk discovery.', tab:'Probe' },
  { key:'blue',  name:'Blue Agent',  badge:'Defensive', col:AG_BLUE,  blurb:'Automates threat hunting and investigation to validate and prioritise real fraud.', tab:'Investigate' },
  { key:'green', name:'Green Agent', badge:'Resolution', col:AG_GREEN, blurb:'Turns verified fraud into fixes: freezes payouts and opens cases at the source.', tab:'Resolve' },
]
const AG_MAX = [7,3,3]
const gCol = (r:number) => r>=71 ? C.orange : r>=41 ? C.amber : C.safe

function AgentBot({ kind, col }: { kind:0|1|2; col:string }) {
  return (
    <svg width="46" height="52" viewBox="0 0 46 52" fill="none" style={{ flexShrink:0 }}>
      {kind===2 && <path d="M9 17a14 11 0 0128 0z" fill="#9BE39B" stroke="#4FA860" strokeWidth="1.5"/>}
      {kind===1 && <path d="M9 17a14 12 0 0128 0M23 3v4" stroke={col} strokeWidth="2.4" strokeLinecap="round" fill="none"/>}
      {kind===0 && <path d="M23 2l15 16H8z" fill={col} fillOpacity=".85" stroke={col} strokeWidth="1.5" strokeLinejoin="round"/>}
      <rect x="7" y="16" width="32" height="26" rx="11" fill="#1B2A5C" stroke={col} strokeWidth="2"/>
      <rect x="11" y="21" width="24" height="15" rx="7.5" fill="#0C1636"/>
      {kind===0 ? <path d="M15 28h16" stroke={col} strokeWidth="3.4" strokeLinecap="round"/> : <><circle cx="19" cy="27" r="2.2" fill={col}/><circle cx="27" cy="27" r="2.2" fill={col}/><path d="M20 31.5q3 2.5 6 0" stroke={col} strokeWidth="1.6" strokeLinecap="round" fill="none"/></>}
    </svg>
  )
}

function FraudGraph({ full=false, onExpand, onClose }: { full?:boolean; onExpand?:()=>void; onClose?:()=>void }) {
  const { can, guard, toast } = useRBAC()
  const canRun = can('run_agents')
  const [phase,setPhase] = useState(canRun?0:3)            // 0 idle, 1 red, 2 blue, 3 green
  const [step,setStep] = useState(canRun?0:3)
  const [status,setStatus] = useState<'idle'|'running'|'awaiting'|'applying'|'done'>(canRun?'idle':'done')
  const [view,setView] = useState(canRun?0:2)              // tab index 0..2
  const [sel,setSel] = useState<string|null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    if(status!=='running' && status!=='applying') return
    let t:number
    if(status==='running' && phase===1){
      t = window.setTimeout(()=>{ if(step<7) setStep(step+1); else { setPhase(2); setStep(0); setView(1) } }, step<7?620:900)
    } else if(status==='running' && phase===2){
      t = window.setTimeout(()=>{ if(step<3) setStep(step+1); else { setPhase(3); setStep(0); setView(2); setStatus('awaiting') } }, step<3?1200:1000)
    } else if(status==='applying'){
      t = window.setTimeout(()=>{ if(step<3) setStep(step+1); else setStatus('done') }, 1000)
    }
    return ()=>clearTimeout(t)
  },[status,phase,step])

  const start = ()=>{ setSel(null); setPhase(1); setStep(0); setView(0); setStatus('running') }
  const approve = ()=>{ setStep(0); setStatus('applying') }

  // effective graph state for the selected tab
  const ph = phase===0 ? 0 : view+1
  const st = phase===0 ? 0 : (view+1===phase ? step : AG_MAX[view])
  const red = ph>=1, blue = ph===2, green = ph===3
  const nodeOn = (n:AN)=> ph>=1 && (ph>1 || n.o<=st)
  const fixed = (n:AN)=> green && n.fix!==undefined && st>=n.fix
  const hotOn = blue && st>=1
  const pathFixed = green && st>=3
  const S = full ? 1 : 0.78
  const canvasH = full ? undefined : Math.round(GH*S)
  const nodeById = (id:string)=>AG_NODES.find(n=>n.id===id)!

  // auto-pan to the point of interest
  useEffect(()=>{
    const el = scroller.current; if(!el) return
    let target: AN | undefined
    if(ph===1) target = AG_NODES.find(n=>n.o===st && !n.sat) ?? AG_NODES[0]
    else if(ph===2) target = nodeById(AG_ALERTS[Math.max(0,st-1)].n)
    else if(ph===3) target = nodeById('bk')
    if(!target) return
    const scale = el.scrollHeight ? (el.querySelector('svg') as SVGSVGElement).getBoundingClientRect().width/GW : S
    el.scrollTo({ left: Math.max(0, target.x*scale - el.clientWidth/2), behavior:'smooth' })
  },[ph,st])

  const chipLabel = { idle:'READY', running:['','PROBING','INVESTIGATING'][phase]||'', awaiting:'AWAITING APPROVAL', applying:'REMEDIATING', done:'RESOLVED' }[status]
  const chipCol = status==='done'||green&&status!=='awaiting' ? AG_GREEN : phase===1 ? AG_RED : phase===2 ? AG_BLUE : status==='idle' ? C.faint : C.amber
  const info = AG_INFO[view]
  const selNode = sel ? nodeById(sel) : null

  const nodeEl = (n:AN)=>{
    const r = n.sat?17:28, on = nodeOn(n), fx = fixed(n), isSel = sel===n.id
    const ring = fx ? AG_GREEN : n.col
    const alertHere = blue && AG_ALERTS.find(a=>a.n===n.id && st>=a.step)
    return (
      <g key={n.id} transform={`translate(${n.x} ${n.y})`} style={{ cursor:'pointer' }} onClick={e=>{ e.stopPropagation(); setSel(s=>s===n.id?null:n.id) }}>
        <g style={{ transformBox:'fill-box', transformOrigin:'center', opacity:on?1:(ph===0?0.18:0), transform:on?'scale(1)':'scale(.55)', transition:'opacity .45s, transform .45s cubic-bezier(.2,.9,.3,1.3)' }}>
          {alertHere && <circle r={r+9} fill={`${AG_RED}30`} stroke={`${AG_RED}66`} strokeWidth="1"/>}
          {alertHere && <circle r={r+3} fill="none" stroke={AG_RED} strokeWidth="1.6" strokeDasharray="4 3" style={{ transformOrigin:'0 0', animation:'bs-spin 9s linear infinite' }}/>}
          {isSel && <circle r={r+6} fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1.4" strokeDasharray="2 4"/>}
          {n.id==='scan' && <circle r={r+6} fill={`${AG_RED}22`}/>}
          <circle r={r} fill={n.id==='loss'?'#3A1A0C':'#1E140C'} stroke={ring} strokeWidth={n.sat?1.6:2.2} style={{ filter:`drop-shadow(0 0 ${n.sat?4:7}px ${ring}55)`, transition:'stroke .5s' }}/>
          <g transform={`translate(${-r*0.5} ${-r*0.5}) scale(${r/24})`} fill="none" stroke={ring} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition:'stroke .5s' }}><path d={GI[n.kind]}/></g>
          {(n.bug && blue && st>=1 && !fx) && <g transform={`translate(${r*0.72} ${-r*0.72})`}><circle r="10" fill="#3A1414" stroke={AG_RED} strokeWidth="1.5"/><g transform="translate(-6 -6) scale(.5)" fill="none" stroke={AG_RED} strokeWidth="2.4" strokeLinecap="round"><path d={GI.bug}/></g></g>}
          {fx && <g transform={`translate(${r*0.72} ${r*0.72})`} style={{ animation:'bs-pop .4s ease-out' }}><circle r="10" fill={AG_GREEN} stroke="#14281D" strokeWidth="2"/><g transform="translate(-6 -6) scale(.5)" fill="none" stroke="#0F1F16" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d={GI.check}/></g></g>}
          {(red && !blue && !green && st>=7 && n.risk>=90 && !n.sat && n.id!=='scan') && <g transform={`translate(${r*0.72} ${r*0.72})`}><circle r="9" fill="#3A2A0A" stroke={C.amber} strokeWidth="1.5"/><g transform="translate(-6 -6) scale(.5)" fill="none" stroke={C.amber} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={GI.warn}/></g></g>}
          <text y={r+(n.sat?15:20)} textAnchor="middle" fontSize={n.sat?12:15} fontWeight="600" fill={C.text}>{n.label}</text>
          <text y={r+(n.sat?28:36)} textAnchor="middle" fontSize={n.sat?10:11.5} fill={C.faint}>{fx && n.id==='loss' ? 'Blocked' : n.sub}</text>
        </g>
      </g>
    )
  }

  const canvas = (
    <div style={{ position:'relative', borderRadius:18, overflow:'hidden', border:`1px solid ${C.borderStrong}`, background:'#160E09', display:'flex', flexDirection:'column', flex:full?1:undefined, minHeight:0 }}>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 12px', borderBottom:`1px solid ${C.border}`, background:'linear-gradient(90deg,rgba(255,122,61,0.16),rgba(255,122,61,0.02))' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={C.orange}><path d="M12 1l2.4 7.6L22 11l-7.6 2.4L12 21l-2.4-7.6L2 11l7.6-2.4z"/></svg>
        <span style={{ fontSize:12.5, fontWeight:700, color:C.text, flex:1 }}>Fraud Path Visualization</span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:9.5, fontWeight:800, letterSpacing:'.7px', color:chipCol, background:`${chipCol}18`, border:`1px solid ${chipCol}44`, borderRadius:20, padding:'3px 9px' }}>
          <span style={{ width:5, height:5, borderRadius:'50%', background:chipCol, animation:status==='running'||status==='applying'?'bs-pulse 1s ease-in-out infinite':undefined }}/>{chipLabel}
        </span>
      </div>
      <div ref={scroller} onClick={()=>setSel(null)} style={{ overflowX:'auto', overflowY:'hidden', height:canvasH, flex:full?1:undefined, minHeight:0, position:'relative', backgroundImage:'radial-gradient(rgba(255,214,170,0.10) 1px,transparent 1px)', backgroundSize:'16px 16px' }}>
        <svg viewBox={`0 0 ${GW} ${GH}`} height={full?'100%':canvasH} width={full?undefined:GW*S} style={{ display:'block', minWidth:full?GW*0.9:undefined }} preserveAspectRatio="xMinYMid meet">
          <defs>
            <linearGradient id="beam" x1="0" x2="1"><stop offset="0" stopColor={AG_RED} stopOpacity=".55"/><stop offset="1" stopColor={AG_RED} stopOpacity="0"/></linearGradient>
          </defs>
          {red && st>=1 && ph===1 && <polygon points="70,90 300,20 300,170" fill="url(#beam)" style={{ animation:'bs-beam 1.4s ease-in-out infinite' }}/>}
          {AG_EDGES.map((e,i)=>{
            const A=nodeById(e.a), B=nodeById(e.b)
            const on = nodeOn(A)&&nodeOn(B)
            const d = e.curve ? `M${A.x} ${A.y} C${A.x+150} ${A.y},${B.x-150} ${B.y+90},${B.x} ${B.y}` : `M${A.x} ${A.y} L${B.x} ${B.y}`
            const hotCol = pathFixed ? AG_GREEN : AG_RED
            const hotNow = e.hot && (hotOn || pathFixed)
            const base = A.col===B.col ? A.col : `${A.col}`
            return (
              <g key={i} style={{ opacity:on?1:(ph===0?0.12:0), transition:'opacity .5s' }}>
                {hotNow && <path d={d} fill="none" stroke={hotCol} strokeOpacity=".3" strokeWidth="11" strokeLinecap="round"/>}
                <path d={d} fill="none" stroke={hotNow?hotCol:base} strokeOpacity={hotNow?1:0.6} strokeWidth={hotNow?3:2} strokeDasharray={e.curve&&!hotNow?'6 5':hotNow&&!pathFixed?'10 6':undefined} style={hotNow&&!pathFixed?{ animation:'bs-flow .8s linear infinite' }:undefined}/>
              </g>
            )
          })}
          {AG_NODES.map(nodeEl)}
          {blue && AG_ALERTS.filter(a=>st>=a.step).map(a=>{
            const n=nodeById(a.n), w=180, h=48, x=n.x-w/2, y=n.y-28-10-h
            return (
              <g key={a.n} style={{ animation:'bs-pop .4s ease-out' }}>
                <path d={`M${x+8} ${y}h${w-16}a8 8 0 018 8v${h-16}a8 8 0 01-8 8h${-(w/2-14)}l-6 7-6-7h${-(w/2-14)}a8 8 0 01-8-8v${-(h-16)}a8 8 0 018-8z`} fill="#2A1212" stroke={AG_RED} strokeWidth="1.6"/>
                <rect x={x+8} y={y+9} width="30" height="30" rx="8" fill="#4A1C1C"/>
                <g transform={`translate(${x+14} ${y+15}) scale(.75)`} fill="none" stroke={AG_RED} strokeWidth="2.2" strokeLinecap="round"><path d={GI.siren}/></g>
                <text x={x+46} y={y+21} fontSize="12.5" fontWeight="700" fill={C.text}>{a.t}</text>
                <text x={x+46} y={y+37} fontSize="11" fill={C.dim}>{a.s}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {phase===0 && (
        <div style={{ position:'absolute', left:0, right:0, top:42, bottom:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(22,14,9,0.55)', backdropFilter:'blur(2px)' }}>
          <PressBtn onClick={()=>guard('run_agents','Run AI agents',start)} style={{ background:C.grad, color:'#fff', fontWeight:800, fontSize:14, borderRadius:16, padding:'13px 20px', boxShadow:'0 12px 30px rgba(194,84,14,0.4)', display:'flex', alignItems:'center', gap:9 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M7 4l13 8-13 8z"/></svg>Run Red · Blue · Green agents
          </PressBtn>
        </div>
      )}

      {selNode && (
        <div style={{ position:'absolute', left:10, bottom:10, right:10, background:'rgba(28,19,12,0.94)', border:`1px solid ${C.borderStrong}`, borderRadius:14, padding:'9px 12px', display:'flex', alignItems:'center', gap:10, animation:'bs-pop .25s ease-out' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{selNode.label}</div>
            <div style={{ fontSize:11, color:C.faint }}>{selNode.sub}{selNode.risk?` · ${AG_EDGES.filter(e=>e.a===selNode.id||e.b===selNode.id).length} links`:''}</div>
          </div>
          {selNode.risk>0 && <div style={{ textAlign:'center' }}><div style={{ fontSize:20, fontWeight:900, color:gCol(selNode.risk), lineHeight:1 }}>{selNode.risk}</div><div style={{ fontSize:8.5, color:C.faint, letterSpacing:'.6px' }}>RISK</div></div>}
        </div>
      )}
    </div>
  )

  const logs: Record<number,{ at:number; t:string }[]> = {
    0: [{ at:1, t:`Scanning ${CLAIMS.length} claims and ${AG_NODES.length} linked entities` }, { at:3, t:`Device ••4471 linked to 3 claimants` }, { at:6, t:'Payout path traced to HDFC ••9032' }, { at:7, t:'Fraud path validated · 6 hops' }],
    1: [{ at:1, t:`${AG_TOP[0].type} confirmed · ${AG_TOP[0].ai}%` }, { at:2, t:'Shared payout account correlated' }, { at:3, t:'Doctor registry mismatch verified' }],
    2: AG_FIXES.map((t,i)=>({ at:i+1, t })),
  }
  const shown = (logs[view]||[]).filter(l=> ph===view+1 && (view+1===phase ? (view===2 ? (status==='applying'||status==='done') : true) : true) && l.at<=st)

  const panel = (
    <div style={{ marginTop:12 }}>
      <div style={{ display:'flex', gap:12, alignItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <AgentBot kind={view as 0|1|2} col={info.col}/>
          <div style={{ marginTop:-2, fontSize:9, fontWeight:800, color:'#0E1636', background:info.col, borderRadius:6, padding:'1px 7px', whiteSpace:'nowrap' }}>{info.badge}</div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14.5, fontWeight:800, color:C.text }}>{info.name}</div>
          <div style={{ fontSize:12, color:C.dim, lineHeight:1.45, marginTop:2 }}>{info.blurb}</div>
        </div>
      </div>

      {view===2 && status==='awaiting' && phase===3 && (
        <div style={{ marginTop:12, background:`${AG_GREEN}10`, border:`1px solid ${AG_GREEN}44`, borderRadius:16, padding:'12px 14px', animation:'bs-pop .3s ease-out' }}>
          <div style={{ fontSize:12.5, fontWeight:800, color:AG_GREEN, marginBottom:6 }}>Found root cause</div>
          <div style={{ fontFamily:'ui-monospace,Menlo,monospace', fontSize:10.5, color:C.dim, background:'rgba(0,0,0,0.35)', borderRadius:10, padding:'8px 10px', lineHeight:1.6 }}>
            payout_account: HDFC••9032<br/>shared_by: 3 identities · device ••4471
          </div>
          <div style={{ fontSize:11.5, color:C.text, margin:'9px 0 4px', fontWeight:700 }}>Prepared fix</div>
          {AG_FIXES.map(f=><div key={f} style={{ fontSize:12, color:C.dim, display:'flex', gap:7, marginBottom:3 }}><span style={{ color:AG_GREEN }}>•</span>{f}</div>)}
          <div style={{ fontSize:11.5, color:C.faint, margin:'8px 0 10px' }}>Blocks ₹{AG_EXPO.toFixed(1)}L exposure. Apply now or review?</div>
          <div style={{ display:'flex', gap:8 }}>
            <PressBtn onClick={()=>can('approve_fix')?guard('approve_fix','Approve fix',approve):toast('Approval request sent to the Platform Administrator.')} style={{ flex:1, background:can('approve_fix')?C.gradSafe:'rgba(242,169,59,0.16)', border:can('approve_fix')?'none':`1px solid ${C.amber}55`, color:can('approve_fix')?'#0E1F16':C.amber, fontWeight:800, fontSize:13, borderRadius:12, padding:'11px' }}>{can('approve_fix')?'Approve & apply':'Request approval'}</PressBtn>
            <PressBtn onClick={()=>setSel('bk')} style={{ background:'rgba(255,255,255,0.06)', color:C.text, fontWeight:700, fontSize:13, borderRadius:12, padding:'11px 16px', border:`1px solid ${C.borderStrong}` }}>Review</PressBtn>
          </div>
        </div>
      )}

      {shown.length>0 && (
        <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:6 }}>
          {shown.map(l=>(
            <div key={l.t} style={{ display:'flex', alignItems:'center', gap:9, fontSize:12, color:C.text, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, borderRadius:11, padding:'8px 10px', animation:'bs-pop .3s ease-out' }}>
              <span style={{ width:16, height:16, borderRadius:'50%', background:`${info.col}25`, color:info.col, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, flexShrink:0 }}>✓</span>{l.t}
            </div>
          ))}
        </div>
      )}

      {status==='done' && view===2 && (
        <div style={{ marginTop:10, fontSize:12, color:AG_GREEN, background:`${AG_GREEN}12`, border:`1px solid ${AG_GREEN}40`, borderRadius:12, padding:'10px 12px', lineHeight:1.5, animation:'bs-pop .3s ease-out' }}>
          Fix validated · Case FRD-2041 opened and assigned to SIU. ₹{AG_EXPO.toFixed(1)}L exposure blocked.
        </div>
      )}

      {status==='done' && (
        <PressBtn onClick={()=>guard('run_agents','Re-run AI agents',start)} style={{ width:'100%', marginTop:10, background:'rgba(255,255,255,0.05)', border:`1px solid ${C.borderStrong}`, color:C.text, fontWeight:700, fontSize:12.5, borderRadius:12, padding:'10px' }}>{canRun?'↻ Re-run agent loop':'Read-only result · running agents is restricted'}</PressBtn>
      )}
    </div>
  )

  const tabs = (
    <div style={{ display:'flex', gap:6, marginBottom:10 }}>
      {AG_INFO.map((a,i)=>{
        const locked = phase===0 ? i>0 : i+1>phase
        const on = view===i
        return (
          <button key={a.key} disabled={locked} onClick={()=>setView(i)} style={{ flex:1, fontFamily:'inherit', cursor:locked?'default':'pointer', border:`1px solid ${on?a.col+'77':C.border}`, background:on?`${a.col}1C`:'rgba(255,255,255,0.03)', color:on?a.col:locked?C.ghost:C.dim, borderRadius:12, padding:'8px 4px', fontSize:11.5, fontWeight:800, opacity:locked?.55:1, transition:'all .25s' }}>
            <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:locked?C.ghost:a.col, marginRight:6 }}/>{a.name.split(' ')[0]}
            <div style={{ fontSize:9.5, fontWeight:600, color:on?C.dim:C.faint, marginTop:1 }}>{a.tab}</div>
          </button>
        )
      })}
    </div>
  )

  const dots = (
    <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:12 }}>
      {AG_INFO.map((a,i)=><span key={a.key} style={{ width:view===i?18:6, height:6, borderRadius:3, background:view===i?a.col:'rgba(255,255,255,0.12)', transition:'all .3s' }}/>)}
    </div>
  )

  if (full) return (
    <div style={{ position:'absolute', inset:0, zIndex:200, background:C.bg, display:'flex', flexDirection:'column', padding:'14px 14px 16px', animation:'bs-fadein .25s ease-out', overflowY:'auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:C.text }}>Agentic Fraud Graph</div>
          <div style={{ fontSize:11.5, color:C.faint }}>Red → Blue → Green · swipe to pan · tap nodes</div>
        </div>
        <button onClick={onClose} style={{ width:36, height:36, borderRadius:12, border:`1px solid ${C.borderStrong}`, background:C.card, color:C.text, fontSize:16, cursor:'pointer' }}>✕</button>
      </div>
      {tabs}
      <div style={{ height:340, display:'flex' }}>{canvas}</div>
      {panel}{dots}
    </div>
  )

  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.text }}>Agentic Fraud Graph</div>
          <div style={{ fontSize:12, color:C.faint, marginTop:2 }}>Red → Blue → Green agent loop · {CLAIMS.length} claims analysed</div>
        </div>
        <button onClick={onExpand} style={{ border:`1px solid ${C.borderStrong}`, background:'rgba(255,255,255,0.04)', color:C.text, borderRadius:10, padding:'6px 10px', fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>⤢ Expand</button>
      </div>
      {tabs}
      {canvas}
      {panel}{dots}
    </Card>
  )
}

// ─── GEMINI AI COPILOT CARD ──────────────────────────────────────────────────
function GeminiCopilotCard() {
  const [q, setQ] = useState('')
  const [ans, setAns] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  const PRESETS = [
    "Unbundled ICU billing rules",
    "Section 45 evidence checklist",
    "Phantom lab test audit",
    "Motor collision velocity check"
  ]

  const ask = async (prompt?: string) => {
    const text = prompt || q
    if (!text.trim()) return
    setLoading(true)
    setAns(null)
    try {
      const response = await apiChatWithGemini(text)
      setAns(response)
    } catch {
      setAns("BharatShield Copilot: Unable to reach forensics service. Please verify server connection.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ marginBottom:14, background:'linear-gradient(145deg,#20140C 0%,#150E08 100%)', border:`1px solid ${C.orange}44` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.text, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:17 }}>✨</span> BharatShield SIU AI Copilot
          </div>
          <div style={{ fontSize:11.5, color:C.faint, marginTop:2 }}>Real-time SIU Forensic Advisory</div>
        </div>
        <LiveBadge label="SIU COPILOT" color={C.orange}/>
      </div>

      <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:6, marginBottom:10 }}>
        {PRESETS.map(p=>(
          <button key={p} onClick={()=>{ setQ(p); ask(p) }} style={{ background:'rgba(255,122,61,0.1)', border:`1px solid ${C.orange}33`, color:C.amber, borderRadius:12, padding:'5px 10px', fontSize:11, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', fontFamily:'inherit' }}>
            {p}
          </button>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:10 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') ask() }} placeholder="Ask AI Copilot about fraud vectors, IRDAI rules…" style={{ flex:1, background:C.card2, border:`1px solid ${C.borderStrong}`, borderRadius:12, padding:'10px 14px', color:C.text, fontSize:12.5, outline:'none' }}/>
        <PressBtn onClick={()=>ask()} style={{ background:C.grad, borderRadius:12, padding:'0 16px', color:'#fff', fontSize:12.5, fontWeight:700 }}>
          {loading ? "..." : "Ask"}
        </PressBtn>
      </div>

      {loading && (
        <div style={{ fontSize:12, color:C.amber, padding:'10px 0', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:12, height:12, borderRadius:'50%', border:`2px solid ${C.amber}`, borderTopColor:'transparent', animation:'bs-spin 0.8s linear infinite' }}/>
          Consulting BharatShield Forensics Engine…
        </div>
      )}

      {ans && (
        <div style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${C.borderStrong}`, borderRadius:14, padding:'12px 14px', fontSize:12.5, color:C.dim, lineHeight:1.6, animation:'bs-fadein .2s ease-out' }}>
          <div style={{ fontSize:10.5, fontWeight:800, color:C.amber, letterSpacing:'0.6px', marginBottom:4 }}>AI FORENSIC OPINION</div>
          {ans}
        </div>
      )}
    </Card>
  )
}

function AnalyticsScreen() {
  const [graphFull,setGraphFull] = useState(false)
  const [modelIdx, setModelIdx] = useState(0)
  const m = AI_MODELS[modelIdx]

  const dataQuality = [
    { label:'Data Completeness',       pct:91, color:C.safe },
    { label:'Schema Conformance',      pct:97, color:C.safe },
    { label:'Cross-field Consistency', pct:83, color:C.amber },
    { label:'Duplicate Record Rate',   pct:96, color:C.safe },
  ]

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'0 16px 110px' }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:20, fontWeight:800, color:C.text }}>AI Intelligence</div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
          <span style={{ fontSize:12, color:C.faint }}>4 live models ·</span>
          <LiveBadge label="28.5K claims/day"/>
        </div>
      </div>

      {graphFull ? <FraudGraph full onClose={()=>setGraphFull(false)}/> : null}
      <FraudGraph onExpand={()=>setGraphFull(true)}/>

      <ReportsCenter/>

      {/* ── Real-time Gemini AI Fraud Copilot ──────────────────────────────── */}
      <GeminiCopilotCard/>

      {/* Model selector */}
      <Card style={{ marginBottom:14, padding:0, overflow:'hidden' }}>
        {/* Tab strip */}
        <div style={{ display:'flex', borderBottom:`1px solid ${C.border}` }}>
          {AI_MODELS.map((am,i)=>(
            <button key={am.name} onClick={()=>setModelIdx(i)} style={{ flex:1, background:'none', border:'none', cursor:'pointer', padding:'10px 4px', fontSize:11, fontWeight:600, color:modelIdx===i?C.orange:C.faint, borderBottom:`2px solid ${modelIdx===i?C.orange:'transparent'}`, transition:'all .2s' }}>
              {am.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Model detail */}
        <div style={{ padding:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
            <div style={{ width:48, height:48, borderRadius:14, background:m.grad, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 8px 24px rgba(0,0,0,0.3)` }}>
              {Ic.cpu}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{m.name}</div>
              <div style={{ fontSize:12, color:C.faint, marginTop:1 }}>{m.tag}</div>
            </div>
            <LiveBadge label={m.status} color={C.safe}/>
          </div>

          {/* Metrics */}
          <div style={{ display:'flex', justifyContent:'space-around', marginBottom:16 }}>
            <MiniRing pct={Math.round(m.accuracy)} color={C.orange} size={60} label="Accuracy"/>
            <MiniRing pct={Math.round(m.precision)} color={C.amber} size={60} label="Precision"/>
            <MiniRing pct={Math.round(m.recall)} color={C.safe} size={60} label="Recall"/>
          </div>

          <div style={{ background:'rgba(255,255,255,0.03)', borderRadius:12, padding:'10px 14px', border:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:12, color:C.faint }}>Daily Throughput</span>
            <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{m.throughput}</span>
          </div>
        </div>
      </Card>

      {/* Fraud type trends */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:3 }}>Fraud Type Trends</div>
        <div style={{ fontSize:12, color:C.faint, marginBottom:16 }}>Monthly counts · last 8 months</div>
        {TREND_DATA.map((row,ri)=>{
          const mx=Math.max(...row.vals)
          return (
            <div key={row.label} style={{ marginBottom:ri<3?16:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                <span style={{ fontSize:12.5, color:C.dim }}>{row.label}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:C.faint }}>{TREND_MONTHS[TREND_MONTHS.length-1]}</span>
                  <span style={{ fontSize:13, fontWeight:800, color:C.text }}>{row.vals[row.vals.length-1]}</span>
                  <span style={{ color:C.orange, fontSize:11 }}>↑</span>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:36 }}>
                {row.vals.map((v,i)=>(
                  <div key={i} style={{ flex:1, borderRadius:'3px 3px 0 0', height:`${(v/mx)*100}%`, background:i===row.vals.length-1?row.grad:'rgba(255,255,255,0.07)' }}/>
                ))}
              </div>
            </div>
          )
        })}
      </Card>

      {/* Emerging patterns */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:3 }}>Pattern Library</div>
        <div style={{ fontSize:12, color:C.faint, marginBottom:16 }}>AI-surfaced · includes unknown signatures</div>
        {EMERGING_PATTERNS.map((p,i)=>{
          const sc = { Confirmed:{c:C.orange,bg:C.orangeSoft}, Active:{c:C.orange,bg:C.orangeSoft}, Emerging:{c:C.amber,bg:C.amberSoft}, Monitoring:{c:C.amber,bg:C.amberSoft}, Unknown:{c:C.faint,bg:'rgba(255,255,255,0.06)'} }[p.status]
          return (
            <div key={p.id} style={{ display:'flex', gap:12, paddingBottom:i<4?14:0, marginBottom:i<4?14:0, borderBottom:i<4?`1px solid ${C.border}`:'none' }}>
              <div style={{ width:36, height:36, borderRadius:10, background:sc.bg, color:sc.c, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {Ic.brain}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text, flex:1, paddingRight:8 }}>{p.title}</div>
                  <span style={{ fontSize:10, fontWeight:700, background:sc.bg, color:sc.c, padding:'2px 8px', borderRadius:8, whiteSpace:'nowrap', flexShrink:0 }}>{p.status}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${p.confidence}%`, borderRadius:2, background:p.confidence>=80?C.grad:C.gradAmber, animation:'bs-bar .7s ease-out' }}/>
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:sc.c, flexShrink:0 }}>{p.confidence}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </Card>

      {/* Data quality */}
      <Card>
        <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:3 }}>Data Quality Monitor</div>
        <div style={{ fontSize:12, color:C.faint, marginBottom:16 }}>Assessed daily · critical for model accuracy</div>
        {dataQuality.map((q,i)=>(
          <div key={q.label} style={{ marginBottom:i<3?14:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:12.5, color:C.dim }}>{q.label}</span>
              <span style={{ fontSize:12.5, fontWeight:700, color:q.color }}>{q.pct}%</span>
            </div>
            <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.05)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${q.pct}%`, borderRadius:3, background:q.pct>=90?C.gradSafe:C.gradAmber, animation:'bs-bar .8s ease-out' }}/>
            </div>
          </div>
        ))}
        <div style={{ background:C.amberSoft, border:`1px solid rgba(242,169,59,0.2)`, borderRadius:12, padding:'10px 14px', marginTop:16, display:'flex', gap:10 }}>
          <span style={{ color:C.amber, fontSize:16, lineHeight:1 }}>⚠</span>
          <span style={{ fontSize:12, color:C.amber, lineHeight:1.55 }}>Cross-field consistency at 83% — review hospital ID ↔ NMC registry pipeline</span>
        </div>
      </Card>
    </div>
  )
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────
function AlertsScreen() {
  const { can, guard, role, toast } = useRBAC()
  const [resolved, setResolved] = useState<string[]>([])
  const [rules, setRules] = useState(FRAUD_RULES)
  const [liveAlerts, setLiveAlerts] = useState<BackendAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [investigatingId, setInvestigatingId] = useState<string | null>(null)
  const [investigationNotes, setInvestigationNotes] = useState<Record<string, string>>({})

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiGetAlerts()
      if (data && data.length > 0) {
        setLiveAlerts(data)
      }
    } catch {
      console.warn("Using default alerts on network fallback")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    const timer = setInterval(fetchAlerts, 25000)
    return () => clearInterval(timer)
  }, [fetchAlerts])

  const alertsToDisplay = liveAlerts.length > 0 ? liveAlerts : ALERTS_DATA.map(a => ({
    id: a.id,
    alertId: a.id,
    type: 'RULE_TRIGGER' as const,
    severity: a.risk === 'High' ? 'HIGH' : 'MEDIUM' as const,
    title: a.title,
    description: a.desc,
    provider: a.provider,
    status: (resolved.includes(a.id) ? 'RESOLVED' : 'ACTIVE') as any,
    timestamp: a.time,
    evidence: { trigger: 'System threshold exceeded' }
  }))

  const unresolved = alertsToDisplay.filter(a => a.status === 'ACTIVE' && !resolved.includes(a.id)).length

  const handleResolveAlert = async (alertId: string) => {
    try {
      await apiResolveAlert(alertId, role.person)
      setResolved(p => [...p, alertId])
      toast(`Alert ${alertId} resolved & logged to audit trail`)
      fetchAlerts()
    } catch {
      setResolved(p => [...p, alertId])
      toast(`Alert ${alertId} resolved locally`)
    }
  }

  const handleInvestigate = async (alertId: string, title: string) => {
    setInvestigatingId(alertId)
    try {
      const res = await apiChatWithGemini(
        `Perform rapid forensic SIU investigation for Alert ${alertId}: "${title}". Provide immediate recommended action steps for the claims processing officer in 2 brief bullet points.`
      )
      setInvestigationNotes(prev => ({ ...prev, [alertId]: res }))
    } catch {
      setInvestigationNotes(prev => ({ ...prev, [alertId]: 'Gemini copilot recommends: 1. Place temporary payment hold on provider. 2. Request original operative notes and indoor case papers.' }))
    }
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'0 16px 110px' }}>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:C.text, letterSpacing:'-0.4px', display:'flex', alignItems:'center', gap:8 }}>
              <span>Security & Alerts</span>
              {unresolved > 0 && (
                <span style={{ fontSize:10, fontWeight:800, color:C.orange, background:C.orangeSoft, border:`1px solid ${C.orange}40`, padding:'2px 8px', borderRadius:10 }}>
                  {unresolved} ACTIVE
                </span>
              )}
            </div>
            <div style={{ fontSize:12, color:C.dim, marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ display:'inline-flex', width:6, height:6, borderRadius:'50%', background:C.safe, animation:'bs-pulse 1.5s infinite' }}/>
              <span style={{ fontWeight:600 }}>Active SIU Protection</span>
            </div>
          </div>
          <PressBtn onClick={fetchAlerts} style={{ height:32, padding:'0 12px', background:C.card2, border:`1px solid ${C.borderStrong}`, borderRadius:10, color:C.dim, fontSize:11.5, fontWeight:700, gap:5 }}>
            <span style={{ fontSize:12, transform: loading ? 'rotate(180deg)' : 'none', transition:'transform .4s' }}>↻</span>
            <span>{loading ? 'Syncing…' : 'Refresh'}</span>
          </PressBtn>
        </div>

        {/* Rapid Alert Metric Chips */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
          <div style={{ background:'linear-gradient(145deg,rgba(42,20,10,0.7),rgba(26,13,7,0.8))', border:`1px solid ${C.orange}33`, borderRadius:14, padding:'9px 8px', textAlign:'center', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.orange }}/>
            <div style={{ fontSize:8.5, fontWeight:800, color:C.faint, letterSpacing:'0.6px', textTransform:'uppercase' }}>Critical SIU</div>
            <div style={{ fontSize:16, fontWeight:900, color:C.orange, marginTop:1 }}>{unresolved || 3}</div>
          </div>
          <div style={{ background:'linear-gradient(145deg,rgba(35,24,14,0.7),rgba(24,16,9,0.8))', border:`1px solid ${C.amber}33`, borderRadius:14, padding:'9px 8px', textAlign:'center', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.amber }}/>
            <div style={{ fontSize:8.5, fontWeight:800, color:C.faint, letterSpacing:'0.6px', textTransform:'uppercase' }}>Anomalies</div>
            <div style={{ fontSize:16, fontWeight:900, color:C.amber, marginTop:1 }}>{AI_ANOMALIES.length}</div>
          </div>
          <div style={{ background:'linear-gradient(145deg,rgba(18,36,26,0.7),rgba(12,25,18,0.8))', border:`1px solid ${C.safe}33`, borderRadius:14, padding:'9px 8px', textAlign:'center', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:C.safe }}/>
            <div style={{ fontSize:8.5, fontWeight:800, color:C.faint, letterSpacing:'0.6px', textTransform:'uppercase' }}>Rules Live</div>
            <div style={{ fontSize:16, fontWeight:900, color:C.safe, marginTop:1 }}>{rules.filter(r=>r.on).length} / {rules.length}</div>
          </div>
        </div>
      </div>

      {/* AI Anomalies */}
      <SectionLabel action={<LiveBadge color={C.orange} label="AI RADAR"/>}>
        Detected Anomalies
      </SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:22 }}>
        {AI_ANOMALIES.map(a=>(
          <div key={a.id} style={{ background:'linear-gradient(155deg,#241409 0%,#191008 60%,#120B06 100%)', border:`1px solid rgba(255,122,61,0.28)`, borderRadius:20, overflow:'hidden', boxShadow:'0 10px 30px -10px rgba(0,0,0,0.5)', position:'relative' }}>
            {/* Top Amber glow indicator line */}
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${a.score>90?C.orange:C.amber},transparent)` }}/>
            
            <div style={{ padding:'16px 16px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:10 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                    <span style={{ fontSize:10.5, fontWeight:800, color:C.amber, letterSpacing:'0.5px' }}>{a.id}</span>
                    <span style={{ background:`${C.orange}18`, color:C.orange, fontSize:9.5, fontWeight:800, padding:'2px 8px', borderRadius:8, border:`1px solid ${C.orange}35`, letterSpacing:'0.4px' }}>
                      NEURAL ANOMALY
                    </span>
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:C.text, lineHeight:1.3 }}>{a.title}</div>
                </div>
                <div style={{ flexShrink:0 }}>
                  <GaugeRing score={a.score} size={62} label="SCORE"/>
                </div>
              </div>

              <div style={{ fontSize:12, color:C.dim, lineHeight:1.55, marginBottom:14, background:'rgba(0,0,0,0.22)', padding:'9px 12px', borderRadius:12, border:`1px solid ${C.border}` }}>
                {a.detail}
              </div>

              {investigationNotes[a.id] && (
                <div style={{ background:'linear-gradient(145deg,rgba(242,169,59,0.12),rgba(194,84,14,0.08))', border:`1px solid ${C.amber}50`, borderRadius:14, padding:'11px 13px', marginBottom:12, boxShadow:'0 4px 16px rgba(0,0,0,0.2)' }}>
                  <div style={{ fontSize:11, fontWeight:800, color:C.amber, marginBottom:5, display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:13 }}>⚡</span> BharatShield Forensic Intelligence Note
                  </div>
                  <div style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>
                    {investigationNotes[a.id]}
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:9 }}>
                <PressBtn onClick={()=>handleInvestigate(a.id, a.title)} style={{ flex:1.2, height:38, background:C.grad, borderRadius:12, padding:'0 14px', fontSize:12.5, fontWeight:800, color:'#fff', boxShadow:'0 4px 14px rgba(194,84,14,0.35)', border:'1px solid rgba(255,200,120,0.25)', gap:6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <span>{investigatingId===a.id && !investigationNotes[a.id] ? 'Forensic Audit…' : 'Investigate'}</span>
                </PressBtn>
                <PressBtn onClick={()=>{ toast(`Anomaly ${a.id} dismissed`); setResolved(p=>[...p, a.id]) }} style={{ flex:0.8, height:38, background:C.card2, border:`1px solid ${C.borderStrong}`, borderRadius:12, padding:'0 12px', fontSize:12, fontWeight:700, color:C.faint }}>
                  Dismiss
                </PressBtn>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Rule-Based Alerts */}
      <SectionLabel action={<span style={{ fontSize:11.5, color:C.amber, fontWeight:700 }}>Live Feed</span>}>
        Active Real-Time Alerts
      </SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:11, marginBottom:24 }}>
        {alertsToDisplay.map((a: any)=>{
          const isDone = a.status === 'RESOLVED' || resolved.includes(a.id)
          const riskLevel = a.severity === 'HIGH' ? 'High' : 'Medium'
          const col = riskLevel==='High' ? C.orange : C.amber
          const title = a.title || a.flagReason || `Alert ${a.id}`
          const provider = a.provider || a.hospital || 'Network Hospital'
          const desc = a.description || a.flagReason || 'Anomalous billing behavior detected'
          return (
            <div key={a.id} style={{ background:'linear-gradient(155deg,#20150B 0%,#181008 65%,#120B05 100%)', border:`1px solid ${isDone?C.border:`${col}35`}`, borderLeft:`3.5px solid ${isDone?C.safeDark:col}`, borderRadius:18, padding:'16px', opacity:isDone?0.55:1, transition:'all .3s', boxShadow:isDone?'none':`0 10px 26px -12px ${col}25` }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14.5, fontWeight:800, color:C.text, marginBottom:3, letterSpacing:'-0.2px' }}>{title}</div>
                  <div style={{ fontSize:11.5, color:C.faint, display:'flex', alignItems:'center', gap:6 }}>
                    <span>{provider}</span>
                    <span>•</span>
                    <span style={{ color:C.dim }}>{a.timestamp || 'Recent'}</span>
                  </div>
                </div>
                <RiskPill level={riskLevel}/>
              </div>
              <div style={{ fontSize:12.5, color:C.dim, lineHeight:1.55, marginBottom:12 }}>{desc}</div>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <PressBtn onClick={()=>guard('resolve_alerts',`Resolve ${a.id}`,()=>handleResolveAlert(a.id))} style={{ height:34, background:isDone?C.safeSoft:col==C.orange?'linear-gradient(145deg,#C2540E,#7A2808)':'linear-gradient(145deg,#B9791C,#74480A)', border:`1px solid ${isDone?C.safeDark:col}50`, borderRadius:11, padding:'0 14px', fontSize:12, fontWeight:800, color:isDone?C.safe:'#fff', boxShadow:isDone?'none':`0 4px 12px ${col}30`, transition:'all .2s' }}>
                  {isDone ? '✓ Resolved & Audited' : <>{!can('resolve_alerts') && <span style={{ display:'inline-flex', marginRight:6, verticalAlign:'middle' }}>{Ic.lock}</span>}Resolve & File</>}
                </PressBtn>
              </div>
            </div>
          )
        })}
      </div>

      {/* Fraud Rules */}
      <Card>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.text }}>Detection Rules</div>
          <span style={{ fontSize:12, color:C.safe, fontWeight:600 }}>{rules.filter(r=>r.on).length} active</span>
        </div>
        <div style={{ fontSize:12, color:C.faint, marginBottom:16 }}>95 triggers today · synced with engine</div>
        {rules.map((r,i)=>(
          <div key={r.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:i<rules.length-1?`1px solid ${C.border}`:'none' }}>
            <div style={{ width:36, height:36, borderRadius:10, background:r.on?C.orangeSoft:'rgba(255,255,255,0.05)', color:r.on?C.orange:C.faint, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .2s' }}>
              {Ic.shield}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:r.on?C.text:C.faint, transition:'color .2s' }}>{r.name}</div>
              <div style={{ fontSize:11, color:C.faint, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.trigger}</div>
            </div>
            <div style={{ textAlign:'center', marginRight:8, flexShrink:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.amber }}>{r.hits}</div>
              <div style={{ fontSize:9.5, color:C.faint }}>hits</div>
            </div>
            <Toggle on={r.on} onToggle={()=>setRules(rs=>rs.map((rx,j)=>j===i?{...rx,on:!rx.on}:rx))}/>
          </div>
        ))}
      </Card>
    </div>
  )
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
// ─── SHEETS ──────────────────────────────────────────────────────────────────
function Sheet({ title, sub, onClose, children, footer, accent=C.orange }: { title:string; sub?:string; onClose:()=>void; children:React.ReactNode; footer?:React.ReactNode; accent?:string }) {
  return (
    <div style={{ position:'absolute', inset:0, zIndex:400, background:'rgba(8,4,2,0.72)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:430, height:'90%', background:'linear-gradient(180deg,#24170E,#160F0A 40%)', borderTopLeftRadius:30, borderTopRightRadius:30, border:`1px solid ${C.borderStrong}`, borderBottom:'none', display:'flex', flexDirection:'column', animation:'bs-fadein .28s ease-out' }}>
        <div style={{ padding:'10px 20px 14px', flexShrink:0 }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)', margin:'0 auto 14px' }}/>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:4, height:34, borderRadius:2, background:accent }}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:18, fontWeight:800, color:C.text }}>{title}</div>
              {sub && <div style={{ fontSize:12, color:C.faint, marginTop:2 }}>{sub}</div>}
            </div>
            <button onClick={onClose} aria-label="Close" style={{ width:34, height:34, borderRadius:11, background:'rgba(255,255,255,0.06)', border:`1px solid ${C.border}`, color:C.dim, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>{Ic.x}</button>
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'4px 18px 24px' }}>{children}</div>
        {footer && <div style={{ padding:'12px 18px 22px', borderTop:`1px solid ${C.border}`, flexShrink:0 }}>{footer}</div>}
      </div>
    </div>
  )
}

const Field = ({ label, value, onChange, type='text', ph }: { label:string; value:string; onChange:(v:string)=>void; type?:string; ph?:string }) => (
  <div style={{ marginBottom:14 }}>
    <label style={{ fontSize:10.5, fontWeight:700, color:C.faint, letterSpacing:'.8px', textTransform:'uppercase', display:'block', marginBottom:6 }}>{label}</label>
    <input value={value} onChange={e=>onChange(e.target.value)} type={type} placeholder={ph} style={{ width:'100%', background:C.card2, border:`1.5px solid ${C.border}`, borderRadius:13, padding:'13px 14px', color:C.text, fontSize:14, outline:'none', fontFamily:'inherit' }}/>
  </div>
)

const Row = ({ title, sub, right, color=C.orange }: { title:string; sub?:string; right?:React.ReactNode; color?:string }) => (
  <div style={{ display:'flex', alignItems:'center', gap:12, background:C.gradCard, border:`1px solid ${C.border}`, borderRadius:16, padding:'13px 14px', marginBottom:9 }}>
    <span style={{ width:3, alignSelf:'stretch', borderRadius:2, background:color, opacity:.8 }}/>
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:13.5, fontWeight:700, color:C.text }}>{title}</div>
      {sub && <div style={{ fontSize:11.5, color:C.faint, marginTop:2, lineHeight:1.4 }}>{sub}</div>}
    </div>
    {right}
  </div>
)

const SmallBtn = ({ children, onClick, tone=C.orange }: { children:React.ReactNode; onClick:()=>void; tone?:string }) => (
  <button onClick={onClick} style={{ background:`${tone}18`, border:`1px solid ${tone}55`, color:tone, borderRadius:10, padding:'7px 12px', fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>{children}</button>
)

const Bar = ({ children }: { children:React.ReactNode }) => (
  <div style={{ fontSize:10.5, fontWeight:800, letterSpacing:'1px', color:C.amber, margin:'14px 2px 9px' }}>{children}</div>
)

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
interface Notif { id:number; kind:'critical'|'warn'|'info'|'ok'; title:string; body:string; time:string; tab:Tab }
const NOTIFS: Notif[] = [
  { id:1, kind:'critical', title:'Fraud ring detected',          body:'Device ••4471 linked to 9 claims across 3 hospitals.', time:'2 min ago',  tab:'analytics' },
  { id:2, kind:'critical', title:'High-risk claim CLM-2847',     body:'AI risk score 92. Duplicate billing pattern found.',    time:'14 min ago', tab:'claims' },
  { id:3, kind:'warn',     title:'Rule triggered: ER Spike',     body:'Apollo Clinic crossed 4 ER visits per month.',          time:'1 hr ago',   tab:'alerts' },
  { id:4, kind:'info',     title:'Model retrained',              body:'XGBoost v4.2 is live with 94.2% accuracy.',             time:'3 hr ago',   tab:'analytics' },
  { id:5, kind:'ok',       title:'Payout frozen successfully',   body:'Green agent froze ₹3.2L pending SIU review.',           time:'Yesterday',  tab:'alerts' },
  { id:6, kind:'info',     title:'IRDAI monthly report ready',   body:'September compliance pack can be exported.',            time:'Yesterday',  tab:'analytics' },
]
const NK = { critical:C.danger, warn:C.amber, info:'#5BA8FF', ok:C.safe }

function NotificationsSheet({ read, setRead, onClose, onGo }: { read:number[]; setRead:(r:number[])=>void; onClose:()=>void; onGo:(t:Tab)=>void }) {
  const unread = NOTIFS.filter(n=>!read.includes(n.id)).length
  return (
    <Sheet title="Notifications" sub={unread?`${unread} unread`:'You are all caught up'} onClose={onClose}
      footer={<PressBtn onClick={()=>setRead(NOTIFS.map(n=>n.id))} style={{ width:'100%', background:C.card2, border:`1px solid ${C.borderStrong}`, borderRadius:16, padding:'13px', fontSize:13.5, fontWeight:700, color:unread?C.amber:C.faint }}>Mark all as read</PressBtn>}>
      {NOTIFS.map(n=>{
        const isNew = !read.includes(n.id), col = NK[n.kind]
        return (
          <div key={n.id} onClick={()=>{ setRead([...new Set([...read,n.id])]); onClose(); onGo(n.tab) }} style={{ display:'flex', gap:12, padding:'13px 14px', marginBottom:9, borderRadius:16, cursor:'pointer', background:isNew?`linear-gradient(145deg,${col}14,#1E1509)`:C.gradCard, border:`1px solid ${isNew?col+'44':C.border}` }}>
            <span style={{ width:36, height:36, borderRadius:11, background:`${col}1E`, color:col, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{n.kind==='ok'?Ic.check:n.kind==='info'?Ic.brain:Ic.alert}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ fontSize:13.5, fontWeight:700, color:C.text }}>{n.title}</span>
                {isNew && <span style={{ width:7, height:7, borderRadius:'50%', background:C.orange, flexShrink:0 }}/>}
              </div>
              <div style={{ fontSize:12, color:C.dim, marginTop:3, lineHeight:1.45 }}>{n.body}</div>
              <div style={{ fontSize:10.5, color:C.faint, marginTop:5 }}>{n.time}</div>
            </div>
          </div>
        )
      })}
    </Sheet>
  )
}

// ─── NEW CLAIM (submit + AI pre-screen) ──────────────────────────────────────
function NewClaimSheet({ onClose }: { onClose:()=>void }) {
  const { role, toast, mask } = useRBAC()
  const [step,setStep] = useState(0)
  const [f,setF] = useState({ patient:role.kind==='customer'&&role.id==='policyholder'?role.person:'', policy:'', hospital:role.id==='hospital'?'Apollo Hospitals':'', dx:'', amt:'', date:'' })
  const [docs,setDocs] = useState<string[]>([])
  const [phase,setPhase] = useState<'form'|'screening'|'done'>('form')
  const [pct,setPct] = useState(0)
  const [createdClaim, setCreatedClaim] = useState<BackendClaim | null>(null)
  const set = (k:keyof typeof f)=>(v:string)=>setF(p=>({ ...p, [k]:v }))
  const amt = parseInt(f.amt.replace(/\D/g,'')||'0')
  const valid = [f.patient&&f.policy&&f.hospital, f.dx&&amt>0&&f.date, docs.length>0][step]
  const DOCS = ['Discharge summary','Hospital bill','Policy card','Patient ID proof','Lab reports']

  const handleStartScreening = async () => {
    setPhase('screening')
    setPct(15)
    const iv = setInterval(() => {
      setPct(p => (p < 85 ? p + 8 : p))
    }, 180)

    try {
      const res = await apiSubmitClaim({
        patientName: f.patient,
        policyNumber: f.policy,
        hospitalName: f.hospital,
        diagnosis: f.dx,
        billedAmount: amt,
        admissionDate: f.date,
        submittedBy: role.person,
        treatment: { notes: `Attached documents: ${docs.join(', ')}` }
      })
      clearInterval(iv)
      setPct(100)
      setCreatedClaim(res.claim)
      setPhase('done')
    } catch (err) {
      clearInterval(iv)
      console.error(err)
      toast("Submitting with local fallback...", false)
      setPct(100)
      setPhase('done')
    }
  }

  const score = createdClaim?.aiForensics?.fraudScore || 68
  const level = createdClaim?.aiForensics?.riskLevel || (score>=71?'HIGH':score>=41?'MEDIUM':'LOW')
  const col = level==='CRITICAL'||level==='HIGH'?C.orange:level==='MEDIUM'?C.amber:C.safe
  const claimId = createdClaim?.id || 'CLM-2026-9042'

  if(phase==='screening') return (
    <Sheet title="BharatShield AI Pre-screening" sub="Auditing against GIPSA tariffs and 200+ ML fraud signatures" onClose={()=>{}}>
      <div style={{ textAlign:'center', padding:'50px 10px' }}>
        <div style={{ width:120, height:120, margin:'0 auto 22px', borderRadius:'50%', border:`4px solid ${C.orange}33`, borderTopColor:C.orange, animation:'bs-spin 1s linear infinite', display:'flex', alignItems:'center', justifyContent:'center' }}/>
        <div style={{ fontSize:30, fontWeight:900, color:C.text }}>{pct}%</div>
        <div style={{ fontSize:13, color:C.dim, marginTop:8 }}>{pct<35?'Running Medical Tariffs Check…':pct<70?'Scanning hospital syndicate clusters…':'Generating immutable audit record…'}</div>
      </div>
    </Sheet>
  )
  if(phase==='done') return (
    <Sheet title="Claim Securely Logged" sub={`${claimId} · Live Forensic Record`} onClose={onClose} accent={col}
      footer={<PressBtn onClick={()=>{ toast(`${claimId} added to SIU review queue`); onClose() }} style={{ width:'100%', background:C.grad, borderRadius:16, padding:'15px', fontSize:14.5, fontWeight:800, color:'#fff' }}>Done</PressBtn>}>
      <div style={{ textAlign:'center', padding:'22px 0 10px' }}>
        <div style={{ width:84, height:84, margin:'0 auto 14px', borderRadius:'50%', background:`${col}1A`, border:`2px solid ${col}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, fontWeight:900, color:col }}>{score}</div>
        <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{level} risk · {level==='LOW'?'Fast-track approved':level==='MEDIUM'?'Sent for manual review':'Escalated to SIU'}</div>
        <div style={{ fontSize:12.5, color:C.dim, marginTop:6, lineHeight:1.5 }}>
          {createdClaim?.aiForensics?.geminiSummary || (level==='LOW'?'No anomalies found. Expected settlement in 48 hours.':'Our team may contact you for additional documents.')}
        </div>
      </div>
      <Bar>OFFICIAL CLAIM DETAILS</Bar>
      <Row title={mask(f.patient)} sub={`Policy ${f.policy} · ${f.hospital}`} />
      <Row title={`₹${amt.toLocaleString('en-IN')}`} sub={`${f.dx} · admitted ${f.date}`} color={C.amber}/>
      <Row title={`${docs.length} documents attached`} sub={docs.join(', ') || "Standard billing attached"} color={C.safe}/>
    </Sheet>
  )
  return (
    <Sheet title="New claim" sub={`Step ${step+1} of 3 · ${['Patient & policy','Treatment','Documents'][step]}`} onClose={onClose}
      footer={<div style={{ display:'flex', gap:10 }}>
        {step>0 && <PressBtn onClick={()=>setStep(s=>s-1)} style={{ flex:1, background:C.card2, border:`1px solid ${C.borderStrong}`, borderRadius:16, padding:'14px', fontSize:14, fontWeight:700, color:C.dim }}>Back</PressBtn>}
        <PressBtn onClick={()=>{ if(!valid) return toast('Please complete all fields to continue',false); if(step<2) setStep(s=>s+1); else handleStartScreening() }} style={{ flex:2, background:valid?C.grad:'rgba(255,255,255,0.06)', borderRadius:16, padding:'14px', fontSize:14.5, fontWeight:800, color:valid?'#fff':C.faint }}>{step<2?'Continue':'Submit for AI screening'}</PressBtn>
      </div>}>
      <div style={{ display:'flex', gap:6, margin:'4px 0 18px' }}>{[0,1,2].map(i=><div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<=step?C.grad:'rgba(255,255,255,0.09)' }}/>)}</div>
      {step===0 && <>
        <Field label="Patient name" value={f.patient} onChange={set('patient')} ph="As on policy card"/>
        <Field label="Policy number" value={f.policy} onChange={set('policy')} ph="e.g. SH-7741290"/>
        <Field label="Hospital" value={f.hospital} onChange={set('hospital')} ph="Network hospital name"/>
      </>}
      {step===1 && <>
        <Field label="Diagnosis" value={f.dx} onChange={set('dx')} ph="e.g. Appendicitis"/>
        <Field label="Claim amount (₹)" value={f.amt} onChange={set('amt')} type="number" ph="e.g. 125000"/>
        <Field label="Admission date" value={f.date} onChange={set('date')} type="date"/>
      </>}
      {step===2 && <>
        <div style={{ fontSize:12.5, color:C.dim, marginBottom:12 }}>Attach at least one document. More documents lower the risk score.</div>
        {DOCS.map(d=>{ const on=docs.includes(d); return (
          <div key={d} onClick={()=>setDocs(p=>on?p.filter(x=>x!==d):[...p,d])} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 14px', marginBottom:9, borderRadius:16, cursor:'pointer', background:on?C.safeSoft:C.gradCard, border:`1px solid ${on?C.safe+'66':C.border}` }}>
            <span style={{ color:on?C.safe:C.faint, display:'flex' }}>{Ic.doc}</span>
            <span style={{ flex:1, fontSize:13.5, fontWeight:600, color:C.text }}>{d}</span>
            <span style={{ color:on?C.safe:C.faint, fontSize:12, fontWeight:700 }}>{on?'Attached':'Tap to attach'}</span>
          </div>) })}
      </>}
    </Sheet>
  )
}

// ─── SETTINGS SHEETS ─────────────────────────────────────────────────────────
type SettingId = 'profile'|'security'|'notify'|'rules'|'models'|'api'|'dpdp'|'audit'|'help'

function SettingSheet({ id, onClose }: { id:SettingId; onClose:()=>void }) {
  const { role, toast, log } = useRBAC()
  const [name,setName] = useState(role.person), [phone,setPhone] = useState('+91 98765 43210'), [dept,setDept] = useState(role.org)
  const [sec,setSec] = useState({ bio:true, otp:true, lock:true })
  const [notif,setNotif] = useState({ crit:true, rules:true, email:false, sms:true, digest:false })
  const [rules,setRules] = useState(FRAUD_RULES)
  const [thr,setThr] = useState(70), [sched,setSched] = useState('Weekly')
  const [apis,setApis] = useState([{ n:'IRDAI Regulatory Export', s:'Connected', ok:true },{ n:'HIS Hospital Webhook', s:'Connected', ok:true },{ n:'Aadhaar eKYC Gateway', s:'Degraded', ok:false },{ n:'Payments / Payout Hold', s:'Connected', ok:true }])
  const [reqs,setReqs] = useState([{ id:'DPDP-114', t:'Data erasure request', who:'Customer #4471' },{ id:'DPDP-115', t:'Access to personal data', who:'Customer #9032' },{ id:'DPDP-118', t:'Correction of records', who:'Customer #2210' }])
  const [sessions,setSessions] = useState([{ d:'This device · Chrome', w:'Mumbai · Active now' },{ d:'iPhone 15', w:'Pune · 2 hrs ago' },{ d:'Windows Laptop', w:'Delhi · Yesterday' }])
  const [faq,setFaq] = useState<number|null>(null)
  const tg = (o:any,set:(v:any)=>void,k:string)=><Toggle on={o[k]} onToggle={()=>set({ ...o, [k]:!o[k] })}/>
  const save = (m:string)=><PressBtn onClick={()=>{ toast(m); onClose() }} style={{ width:'100%', background:C.grad, borderRadius:16, padding:'15px', fontSize:14.5, fontWeight:800, color:'#fff' }}>Save changes</PressBtn>

  if(id==='profile') return <Sheet title="Edit profile" sub={role.title} onClose={onClose} footer={save('Profile updated')}>
    <Field label="Full name" value={name} onChange={setName}/><Field label="Email" value={role.email} onChange={()=>{}}/><Field label="Phone" value={phone} onChange={setPhone} type="tel"/><Field label="Department" value={dept} onChange={setDept}/>
  </Sheet>
  if(id==='security') return <Sheet title="Security & 2FA" sub="Protect your account" onClose={onClose}>
    <Row title="Biometric login" sub="Fingerprint or face unlock" right={tg(sec,setSec,'bio')}/>
    <Row title="Two-factor OTP" sub="Code required on every sign-in" right={tg(sec,setSec,'otp')}/>
    <Row title="Auto-lock after 5 min" sub="Lock the app when idle" right={tg(sec,setSec,'lock')}/>
    <Bar>ACTIVE SESSIONS</Bar>
    {sessions.map((s,i)=><Row key={s.d} title={s.d} sub={s.w} color={i?C.amber:C.safe} right={i?<SmallBtn tone={C.danger} onClick={()=>{ setSessions(p=>p.filter(x=>x.d!==s.d)); toast('Session revoked') }}>Revoke</SmallBtn>:<span style={{ fontSize:11, fontWeight:700, color:C.safe }}>CURRENT</span>}/>)}
  </Sheet>
  if(id==='notify') return <Sheet title="Notification preferences" onClose={onClose} footer={save('Preferences saved')}>
    <Row title="Critical fraud alerts" sub="Rings and risk score above 70" right={tg(notif,setNotif,'crit')}/>
    <Row title="Rule triggers" sub="When a detection rule fires" right={tg(notif,setNotif,'rules')}/>
    <Row title="Email notifications" right={tg(notif,setNotif,'email')}/>
    <Row title="SMS notifications" right={tg(notif,setNotif,'sms')}/>
    <Row title="Daily digest at 9 AM" right={tg(notif,setNotif,'digest')}/>
  </Sheet>
  if(id==='rules') return <Sheet title="Fraud rule editor" sub={`${rules.filter(r=>r.on).length} of ${rules.length} rules active`} onClose={onClose} footer={save('Rules published to production')}>
    {rules.map((r,i)=><Row key={r.name} title={r.name} sub={`${r.trigger} · ${r.hits} hits this month`} color={r.on?C.safe:C.faint} right={<Toggle on={r.on} onToggle={()=>setRules(p=>p.map((x,j)=>j===i?{ ...x, on:!x.on }:x))}/>}/>)}
  </Sheet>
  if(id==='models') return <Sheet title="Model configuration" sub="XGBoost + GNN ensemble" onClose={onClose} footer={save('Model configuration saved')}>
    <Bar>FLAG CLAIMS ABOVE RISK SCORE</Bar>
    <div style={{ background:C.gradCard, border:`1px solid ${C.border}`, borderRadius:16, padding:16 }}>
      <div style={{ fontSize:32, fontWeight:900, color:C.orange, textAlign:'center' }}>{thr}</div>
      <input type="range" min={30} max={95} value={thr} onChange={e=>setThr(+e.target.value)} style={{ width:'100%', accentColor:C.orange }}/>
      <div style={{ fontSize:11.5, color:C.faint, textAlign:'center', marginTop:6 }}>Lower catches more fraud but raises false positives</div>
    </div>
    <Bar>RETRAINING SCHEDULE</Bar>
    <div style={{ display:'flex', gap:8 }}>{['Daily','Weekly','Monthly'].map(s=><button key={s} onClick={()=>setSched(s)} style={{ flex:1, padding:'12px', borderRadius:13, cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:13, background:sched===s?C.grad:C.card2, color:sched===s?'#fff':C.dim, border:`1px solid ${sched===s?'transparent':C.border}` }}>{s}</button>)}</div>
  </Sheet>
  if(id==='api') return <Sheet title="Integration APIs" sub="Webhooks and regulatory export" onClose={onClose}>
    {apis.map((a,i)=><Row key={a.n} title={a.n} sub={a.s} color={a.ok?C.safe:C.amber} right={<SmallBtn tone={a.ok?C.safe:C.amber} onClick={()=>{ setApis(p=>p.map((x,j)=>j===i?{ ...x, s:'Connected', ok:true }:x)); toast(`${a.n}: connection healthy`) }}>{a.ok?'Test':'Reconnect'}</SmallBtn>}/>)}
  </Sheet>
  const [dbAuditLogs, setDbAuditLogs] = useState<BackendAuditLog[]>([])
  useEffect(() => {
    if (id === 'audit') {
      apiGetAuditLogs().then(data => {
        if (data && data.length > 0) setDbAuditLogs(data)
      }).catch(console.warn)
    }
  }, [id])

  if(id==='dpdp') return <Sheet title="DPDP Rights Center" sub={`${reqs.length} pending requests`} onClose={onClose}>
    {reqs.length===0 && <div style={{ textAlign:'center', color:C.faint, padding:'50px 0', fontSize:13 }}>No pending requests. Every data principal request is resolved.</div>}
    {reqs.map(r=><Row key={r.id} title={r.t} sub={`${r.id} · ${r.who} · due in 7 days`} color={C.amber} right={<SmallBtn tone={C.safe} onClick={()=>{ setReqs(p=>p.filter(x=>x.id!==r.id)); toast(`${r.id} fulfilled`) }}>Fulfil</SmallBtn>}/>)}
  </Sheet>
  if(id==='audit') return <Sheet title="Audit logs" sub="Immutable Audit Trail · 90 days retention" onClose={onClose}>
    <Bar>THIS SESSION ACTIONS</Bar>
    {log.length === 0 ? (
      <div style={{ fontSize:12, color:C.faint, padding:'8px 12px' }}>No session actions logged yet.</div>
    ) : (
      log.map((l,i)=><Row key={i} title={l.msg} sub={l.t} color={l.ok?C.safe:C.danger}/>)
    )}
    <Bar>IMMUTABLE OFFICIAL AUDIT TRAIL</Bar>
    {dbAuditLogs.length === 0 ? (
      [['Rule "Upcoding Detector" disabled','Dr. Rekha Menon · Yesterday 17:42'],['Report exported: Monthly fraud summary','Meera Nair · Yesterday 11:05'],['Payout frozen for CLM-2847','Green agent · 2 days ago']].map(([t,s])=><Row key={t} title={t} sub={s} color={C.amber}/>)
    ) : (
      dbAuditLogs.map((a: any) => {
        const detailStr = a.details ? (typeof a.details === 'object' ? (a.details.claimId || a.details.alertId || a.details.reason || JSON.stringify(a.details)) : a.details) : 'Audit Entry'
        const actorName = a.actor?.name || a.user || 'System Auditor'
        return (
          <Row key={a._id || a.action + a.timestamp} title={`${a.action} · ${detailStr}`} sub={`${actorName} · ${new Date(a.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })} · ${new Date(a.timestamp).toLocaleDateString('en-IN')}`} color={a.status==='FAILED'?C.danger:C.safe}/>
        )
      })
    )}
  </Sheet>
  const FAQ = [['How does the AI score a claim?','Four models combine claim, provider and network signals into a 0-100 risk score.'],['Why can\'t I see some data?','Your role controls access. Identities are masked unless your role has personal-data access.'],['How do I escalate a case?','Open the claim and tap Flag to route it to the SIU queue.']]
  return <Sheet title="Help & support" sub="We reply within 2 hours" onClose={onClose}>
    {FAQ.map(([q,a],i)=><div key={q} onClick={()=>setFaq(faq===i?null:i)}><Row title={q} sub={faq===i?a:undefined} right={<span style={{ color:C.faint, transform:faq===i?'rotate(90deg)':'none', transition:'.2s', display:'flex' }}>{Ic.chevron}</span>}/></div>)}
    <Bar>CONTACT US</Bar>
    <div style={{ display:'flex', gap:8 }}>{['Live chat','Raise ticket','Call helpline'].map(c=><button key={c} onClick={()=>toast(`${c} request sent to support`)} style={{ flex:1, padding:'13px 6px', borderRadius:13, background:C.card2, border:`1px solid ${C.borderStrong}`, color:C.amber, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>{c}</button>)}</div>
  </Sheet>
}

// ─── PROFILE ─────────────────────────────────────────────────────────────────
function ProfileScreen({ onLogout }: { onLogout:()=>void }) {
  const { role, can, deny, log } = useRBAC()
  const [open,setOpen] = useState<SettingId|null>(null)
  const [matrix,setMatrix] = useState(false)
  const GROUPS: { label:string; color:string; items:{ id:SettingId; icon:React.ReactNode; l:string; s:string; need?:Perm }[] }[] = [
    { label:'Account', color:C.orange, items:[
      { id:'profile', icon:Ic.person, l:'Edit Profile', s:'Name, role, contact' },
      { id:'security', icon:Ic.lock, l:'Security & 2FA', s:'Password, biometrics, sessions' },
      { id:'notify', icon:Ic.bell, l:'Notification Prefs', s:'Alerts, email, SMS' },
    ]},
    ...(role.kind==='staff' ? [{ label:'Platform', color:C.amber, items:[
      { id:'rules' as SettingId, icon:Ic.shield, l:'Fraud Rule Editor', s:'Manage detection logic', need:'manage_rules' as Perm },
      { id:'models' as SettingId, icon:Ic.brain, l:'Model Configuration', s:'Thresholds, retraining schedule', need:'manage_rules' as Perm },
      { id:'api' as SettingId, icon:Ic.network, l:'Integration APIs', s:'Webhooks, IRDAI export', need:'manage_rules' as Perm },
    ]}] : []),
    { label:role.kind==='staff'?'Compliance':'Privacy & Help', color:C.safe, items:[
      ...(role.kind==='staff' ? [{ id:'dpdp' as SettingId, icon:Ic.lock, l:'DPDP Rights Center', s:'3 pending requests', need:'view_audit' as Perm }] : []),
      ...(role.kind==='staff' ? [{ id:'audit' as SettingId, icon:Ic.scan, l:'Audit Logs', s:'Full trail · 90 days', need:'view_audit' as Perm }] : []),
      { id:'help' as SettingId, icon:Ic.help, l:'Help & Support', s:'Chat, tickets, docs' },
    ]},
  ]
  const STATS = role.kind==='staff' ? [['47','Investigations'],['234','Rules Active'],['₹1.2Cr','Fraud Saved']] : role.id==='hospital' ? [['128','Claims Filed'],['96%','Approved'],['1.8d','Avg Settle']] : [['3','My Claims'],['₹4.2L','Covered'],['48h','Avg Settle']]
  const granted = role.perms.length

  return (
    <div style={{ flex:1, overflowY:'auto', paddingBottom:110 }}>
      <div style={{ background:`linear-gradient(145deg,${role.color}22,#1C110A 65%)`, margin:'0 16px 14px', borderRadius:24, padding:20, border:`1px solid ${role.color}44`, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', background:`${role.color}12` }}/>
        <div style={{ display:'flex', alignItems:'center', gap:14, position:'relative', marginBottom:16 }}>
          <div style={{ width:66, height:66, borderRadius:20, background:`linear-gradient(135deg,${role.color},${C.orangeDeep})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#1A0E06', flexShrink:0, boxShadow:`0 10px 28px ${role.color}55` }}>{role.initials}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:17, fontWeight:800, color:C.text }}>{role.person}</div>
            <span style={{ display:'inline-block', marginTop:5, background:`${role.color}1C`, border:`1px solid ${role.color}55`, borderRadius:8, padding:'3px 9px', fontSize:10.5, fontWeight:800, color:role.color }}>{role.title}</span>
            <div style={{ fontSize:12, color:C.faint, marginTop:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{role.org}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, position:'relative' }}>
          {STATS.map(([v,l])=>(
            <div key={l} style={{ background:'rgba(255,255,255,0.04)', borderRadius:12, padding:'10px 8px', textAlign:'center', border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:16, fontWeight:900, color:C.amber }}>{v}</div><div style={{ fontSize:10, color:C.faint, marginTop:2 }}>{l}</div>
            </div>))}
        </div>
      </div>

      <div style={{ margin:'0 16px 14px' }}>
        <SectionLabel>Your access</SectionLabel>
        <div style={{ background:C.gradCard, border:`1px solid ${C.border}`, borderRadius:20, padding:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div><div style={{ fontSize:13.5, fontWeight:800, color:C.text }}>{role.levelLabel}</div><div style={{ fontSize:11.5, color:C.faint, marginTop:2 }}>{granted} of {PERM_ORDER.length} permissions granted</div></div>
            <div style={{ display:'flex', gap:3 }}>{[1,2,3,4].map(n=><span key={n} style={{ width:14, height:5, borderRadius:3, background:n<=role.level?role.color:'rgba(255,255,255,0.1)' }}/>)}</div>
          </div>
          <div style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}><div style={{ width:`${granted/PERM_ORDER.length*100}%`, height:'100%', background:role.color, borderRadius:3 }}/></div>
          <button onClick={()=>setMatrix(v=>!v)} style={{ marginTop:12, background:'none', border:'none', color:C.amber, fontWeight:700, fontSize:12.5, cursor:'pointer', fontFamily:'inherit', padding:0 }}>{matrix?'Hide permission matrix ▴':'View permission matrix ▾'}</button>
          {matrix && <div style={{ marginTop:12, animation:'bs-fadein .25s ease-out' }}>
            {PERM_ORDER.map(p=>{ const ok=can(p); return (
              <div key={p} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:`1px solid ${C.border}` }}>
                <span style={{ color:ok?C.safe:C.faint, display:'flex' }}>{ok?Ic.check:Ic.lock}</span>
                <div style={{ flex:1 }}><div style={{ fontSize:12.5, fontWeight:600, color:ok?C.text:C.faint }}>{PERMS[p].label}</div><div style={{ fontSize:10.5, color:C.faint }}>{PERMS[p].desc}</div></div>
                <span style={{ fontSize:10, fontWeight:800, color:ok?C.safe:C.faint }}>{ok?'GRANTED':'LOCKED'}</span>
              </div>) })}
          </div>}
        </div>
      </div>

      {log.length>0 && <div style={{ margin:'0 16px 14px' }}>
        <SectionLabel>Recent access activity</SectionLabel>
        <div style={{ background:C.gradCard, border:`1px solid ${C.border}`, borderRadius:20, overflow:'hidden' }}>
          {log.slice(0,4).map((l,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', borderTop:i?`1px solid ${C.border}`:'none' }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:l.ok?C.safe:C.danger, flexShrink:0 }}/>
              <span style={{ flex:1, fontSize:12.5, color:C.text }}>{l.msg}</span><span style={{ fontSize:10.5, color:C.faint }}>{l.t}</span>
            </div>))}
        </div>
      </div>}

      {role.id==='admin' && <div style={{ margin:'0 16px 14px', background:'linear-gradient(135deg,#F2A93B,#C2540E)', borderRadius:20, padding:18, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-20, right:-20, width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,0.12)' }}/>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, position:'relative' }}>{Ic.crown}<span style={{ fontSize:14, fontWeight:800, color:'#fff' }}>Enterprise plan active</span></div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.88)', lineHeight:1.6, fontWeight:300, position:'relative' }}>IRDAI-aligned reporting, unlimited investigators and custom ML model training are enabled.</div>
      </div>}

      {GROUPS.map(g=>(
        <div key={g.label} style={{ margin:'0 16px 14px' }}>
          <SectionLabel>{g.label}</SectionLabel>
          <div style={{ background:C.gradCard, border:`1px solid ${C.border}`, borderRadius:20, overflow:'hidden' }}>
            {g.items.map((item,i)=>{
              const locked = !!item.need && !can(item.need)
              return (
                <div key={item.l} onClick={()=>locked?deny(item.need!,item.l):setOpen(item.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:i<g.items.length-1?`1px solid ${C.border}`:'none', cursor:'pointer', opacity:locked?0.55:1 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:`${g.color}14`, border:`1px solid ${g.color}22`, color:g.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{item.icon}</div>
                  <div style={{ flex:1 }}><div style={{ fontSize:13.5, fontWeight:600, color:C.text }}>{item.l}</div><div style={{ fontSize:11.5, color:C.faint, marginTop:1 }}>{locked?`Requires ${rolesWith(item.need!)[0]}`:item.s}</div></div>
                  <span style={{ color:C.faint }}>{locked?Ic.lock:Ic.chevron}</span>
                </div>)
            })}
          </div>
        </div>
      ))}

      <div style={{ margin:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
        <PressBtn onClick={onLogout} style={{ width:'100%', background:C.card2, border:`1px solid ${C.borderStrong}`, borderRadius:18, padding:'15px', fontSize:14, fontWeight:700, color:C.amber, gap:8 }}>Switch Role</PressBtn>
        <PressBtn onClick={onLogout} style={{ width:'100%', background:'transparent', border:`1.5px solid ${C.border}`, borderRadius:18, padding:'15px', fontSize:14, fontWeight:600, color:C.orange, gap:8 }}>{Ic.logout} Sign Out</PressBtn>
        <div style={{ textAlign:'center', fontSize:11, color:C.faint, padding:'6px 0' }}>BharatShield AI · v1.0 MVP · Build 2026.10</div>
      </div>
      {open && <SettingSheet id={open} onClose={()=>setOpen(null)}/>}
    </div>
  )
}

// ─── DOCUMENT SCAN ────────────────────────────────────────────────────────────
function DocScanScreen({ onClose }: { onClose:()=>void }) {
  const { toast, role } = useRBAC()
  const [step, setStep] = useState<DocStep>('select')
  const [selected, setSelected] = useState<DocType|null>(null)
  const [scanPct, setScanPct] = useState(0)
  const [stageIdx, setStageIdx] = useState(0)
  const [aiResult, setAiResult] = useState<any>(null)
  const [filingClaim, setFilingClaim] = useState(false)
  const [filedClaimId, setFiledClaimId] = useState<string | null>(null)
  const [customProvider, setCustomProvider] = useState('Apollo Multi-spec Hospital')
  const [customAmount, setCustomAmount] = useState('1,45,000')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)

  const handleTakePhoto = async () => {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      })

      if (photo?.dataUrl) {
        setCapturedImage(photo.dataUrl)
        if (!selected) {
          setSelected('bill')
        }
        toast('Document captured via HD Camera')
      }
    } catch (err: any) {
      console.warn('[Camera error/dismissed]', err)
      if (err?.message !== 'User cancelled photos app' && !err?.message?.includes('cancelled')) {
        // Fallback for desktop testing or browser file picker
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*,application/pdf'
        input.capture = 'environment'
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0]
          if (file) {
            const reader = new FileReader()
            reader.onload = (re) => {
              setCapturedImage(re.target?.result as string)
              if (!selected) setSelected('bill')
              toast('Document image loaded')
            }
            reader.readAsDataURL(file)
          }
        }
        input.click()
      }
    }
  }

  const STAGES = [
    'Initializing Neural Forensics & CNN…',
    'Extracting IRDAI digital seals & GSTIN…',
    'Cross-referencing NMC doctor registry…',
    'Analyzing font artifacts & pixel compression…',
    'Auditing against GIPSA tariff schedules…',
    'Synthesizing final forensic verdict…'
  ]

  const startScan = useCallback(() => {
    if (!selected) return
    setStep('scanning')
    setScanPct(0)
    setStageIdx(0)
    setAiResult(null)
    setFiledClaimId(null)

    // Fire backend AI Document Forensics API in background
    let backendPayload: any = null
    apiAnalyzeDocWithGemini({
      docType: selected,
      provider: customProvider,
      claimAmount: customAmount,
      patientName: 'Sanjay Deshmukh',
      ...(capturedImage ? { imageBase64: capturedImage } : {})
    } as any).then(res => {
      backendPayload = res?.analysis || res
    }).catch(err => {
      console.warn("Using local forensic fallback", err)
    })

    // Ultra-reliable smooth scan progression (never hangs or stalls)
    let p = 0
    const iv = setInterval(() => {
      p += Math.random() * 14 + 10
      const currentPct = Math.min(Math.round(p), 100)
      setScanPct(currentPct)
      const stage = Math.min(Math.floor((currentPct / 100) * STAGES.length), STAGES.length - 1)
      setStageIdx(stage)

      if (p >= 100) {
        clearInterval(iv)
        if (backendPayload) {
          setAiResult(backendPayload)
        }
        setScanPct(100)
        setTimeout(() => setStep('result'), 250)
      }
    }, 120)
  }, [selected, customProvider, customAmount, capturedImage])

  const staticFallback = selected ? SCAN_RESULTS[selected] : null
  const score = aiResult?.authenticityScore ?? (aiResult?.fraudScore ? Math.max(10, 100 - aiResult.fraudScore) : staticFallback?.score ?? 78)
  const verdict = aiResult?.verdict ?? (aiResult?.riskLevel ? (aiResult.riskLevel === 'LOW' ? 'AUTHENTIC' : aiResult.riskLevel === 'MEDIUM' ? 'REVIEW REQUIRED' : 'SUSPECTED FRAUD') : staticFallback?.verdict ?? 'AUTHENTIC')
  const verdictColor = score >= 70 ? C.safe : score >= 45 ? C.amber : C.danger

  const indicators = aiResult?.forensicIndicators && aiResult.forensicIndicators.length > 0
    ? aiResult.forensicIndicators.map((ind: any) => ({
        text: ind.indicator || ind.text,
        pass: ind.status === 'PASS' || ind.pass === true,
        weight: (ind.severity || ind.weight || 'Medium') as 'High' | 'Medium' | 'Low'
      }))
    : (staticFallback?.indicators ?? [])

  const handlePushToClaims = async () => {
    try {
      setFilingClaim(true)
      const res = await apiSubmitClaim({
        patientName: 'Sanjay Deshmukh',
        policyNumber: 'POL-2026-8819',
        hospitalName: customProvider,
        diagnosis: selected === 'bill' ? 'Interventional Cardiology' : selected === 'claim' ? 'Acute Appendicitis' : 'Medical Hospitalization',
        billedAmount: parseInt(customAmount.replace(/\D/g, '')) || 145000,
        admissionDate: '2026-09-28',
        submittedBy: role.person,
        treatment: {
          notes: `Verified via BharatShield Neural Forensics. Score: ${score}%, Verdict: ${verdict}.`
        }
      })
      const newId = res.claim?.id || 'CLM-2026-9901'
      setFiledClaimId(newId)
      toast(`Claim ${newId} securely filed to registry`)
    } catch {
      toast("Filed claim locally (network issue)", false)
      setFiledClaimId('CLM-LOCAL-889')
    } finally {
      setFilingClaim(false)
    }
  }

  return (
    <div style={{ position:'absolute', inset:0, background:C.bg, zIndex:50, display:'flex', flexDirection:'column', animation:'bs-fadein .2s ease-out' }}>
      {/* Header */}
      <div style={{ background:C.sidebar, borderBottom:`1px solid ${C.border}`, paddingTop:52, paddingBottom:14, paddingLeft:18, paddingRight:18, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:C.orange, padding:4 }}>{Ic.back}</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text }}>Document Forensics</div>
          <div style={{ fontSize:11.5, color:C.faint }}>BharatShield Neural Forensics + CNN Scanner</div>
        </div>
        <LiveBadge label="VISION AI v4.2" color={C.orange}/>
      </div>

      {/* Step progress bar */}
      <div style={{ background:C.sidebar, padding:'10px 18px 0', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ display:'flex', gap:4, marginBottom:10 }}>
          {(['select','scanning','result'] as DocStep[]).map((s,i)=>{
            const active = step===s; const done = (step==='scanning'&&i===0)||(step==='result'&&i<2)
            return (
              <div key={s} style={{ flex:1, height:3, borderRadius:2, background:done?C.orange:active?C.amber:'rgba(255,255,255,0.1)', transition:'background .3s' }}/>
            )
          })}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', paddingBottom:8 }}>
          {['Select Document','AI Forensics Scan','Audit Results'].map((l,i)=>{
            const ci=['select','scanning','result'][i] as DocStep
            const active=step===ci; const done=(step==='scanning'&&i===0)||(step==='result'&&i<2)
            return <span key={l} style={{ fontSize:10.5, fontWeight:600, color:active?C.amber:done?C.orange:C.faint }}>{l}</span>
          })}
        </div>
      </div>

      {/* ── STEP: SELECT ─────────────────────────────────────────────────── */}
      {step==='select' && (
        <div style={{ flex:1, overflowY:'auto', padding:'20px 18px' }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:3 }}>Select Document Type</div>
          <div style={{ fontSize:13, color:C.faint, marginBottom:18 }}>Real-time verification against IRDAI and hospital registries</div>

          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
            {DOC_TYPES.map(d=>(
              <div key={d.id} onClick={()=>setSelected(d.id)} style={{ background:selected===d.id?'linear-gradient(135deg,rgba(255,122,61,0.14),rgba(194,84,14,0.08))':C.gradCard, border:`1.5px solid ${selected===d.id?C.orange:C.border}`, borderRadius:16, padding:'14px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all .15s', boxShadow:selected===d.id?`0 0 0 3px rgba(255,122,61,0.1)`:C.glow.replace('20px','0px') }}>
                <div style={{ width:46, height:46, borderRadius:13, background:selected===d.id?C.grad:C.card2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, transition:'all .15s' }}>{d.emoji}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5, fontWeight:700, color:selected===d.id?C.text:C.dim, transition:'color .15s' }}>{d.label}</div>
                  <div style={{ fontSize:12, color:C.faint, marginTop:2 }}>{d.sub}</div>
                </div>
                {selected===d.id && (
                  <div style={{ width:24, height:24, borderRadius:'50%', background:C.grad, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {Ic.check}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Document metadata inputs for dynamic testing */}
          <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:16, padding:14, marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.amber, marginBottom:10 }}>DOCUMENT DETAILS FOR AI AUDIT</div>
            <div style={{ marginBottom:8 }}>
              <span style={{ fontSize:11, color:C.faint, display:'block', marginBottom:4 }}>Hospital / Provider</span>
              <input value={customProvider} onChange={e=>setCustomProvider(e.target.value)} style={{ width:'100%', background:C.card, border:`1px solid ${C.borderStrong}`, borderRadius:10, padding:'8px 12px', color:C.text, fontSize:12, outline:'none' }}/>
            </div>
            <div>
              <span style={{ fontSize:11, color:C.faint, display:'block', marginBottom:4 }}>Billed Amount (₹)</span>
              <input value={customAmount} onChange={e=>setCustomAmount(e.target.value)} style={{ width:'100%', background:C.card, border:`1px solid ${C.borderStrong}`, borderRadius:10, padding:'8px 12px', color:C.text, fontSize:12, outline:'none' }}/>
            </div>
          </div>

          {capturedImage && (
            <div style={{ background:C.card2, border:`1px solid ${C.orange}`, borderRadius:14, padding:'10px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:12 }}>
              <img src={capturedImage} alt="Captured preview" style={{ width:44, height:44, borderRadius:8, objectFit:'cover', border:`1px solid ${C.borderStrong}` }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12.5, fontWeight:700, color:C.text }}>Document Image Ready</div>
                <div style={{ fontSize:11, color:C.faint }}>Attached for AI Vision & OCR audit</div>
              </div>
              <button onClick={()=>setCapturedImage(null)} style={{ background:'rgba(255,255,255,0.06)', border:'none', color:C.faint, borderRadius:8, padding:'4px 8px', fontSize:11, cursor:'pointer' }}>Remove</button>
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <PressBtn onClick={handleTakePhoto} style={{ flex:1, background:C.card2, border:`1px solid ${capturedImage?C.orange:C.borderStrong}`, borderRadius:14, padding:'14px', fontSize:13.5, fontWeight:600, color:capturedImage?C.orange:C.dim, gap:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
              {Ic.camera} {capturedImage ? 'Retake' : 'Camera'}
            </PressBtn>
            <PressBtn onClick={startScan} style={{ flex:2, background:selected?C.grad:'rgba(255,122,61,0.15)', borderRadius:14, padding:'14px', fontSize:14, fontWeight:700, color:selected?'#fff':C.faint, boxShadow:selected?'0 8px 24px rgba(194,84,14,0.38)':'none', transition:'all .2s', pointerEvents:selected?'all':'none' }}>
              {selected?'Analyze Document →':'Select type first'}
            </PressBtn>
          </div>
        </div>
      )}

      {/* ── STEP: SCANNING ─────────────────────────────────────────────────── */}
      {step==='scanning' && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 28px' }}>
          {/* Document with scan effect */}
          <div style={{ width:180, height:220, borderRadius:20, background:C.card, border:`1px solid ${C.borderStrong}`, position:'relative', overflow:'hidden', marginBottom:32, boxShadow:`0 20px 60px rgba(0,0,0,0.4)` }}>
            {['0,0','0,auto','auto,0','auto,auto'].map((pos,i)=>{
              const [t,b,l,r] = [i<2?0:undefined,i>=2?0:undefined,i%2===0?0:undefined,i%2===1?0:undefined]
              return <div key={i} style={{ position:'absolute', top:t, bottom:b, left:l, right:r, width:22, height:22, borderTop:i<2?`2.5px solid ${C.orange}`:undefined, borderBottom:i>=2?`2.5px solid ${C.orange}`:undefined, borderLeft:i%2===0?`2.5px solid ${C.orange}`:undefined, borderRight:i%2===1?`2.5px solid ${C.orange}`:undefined, borderRadius:i<2?(i===0?'8px 0 0 0':'0 8px 0 0'):(i===2?'0 0 0 8px':'0 0 8px 0') }}/>
            })}

            {/* Scan line */}
            <div style={{ position:'absolute', left:0, right:0, height:2.5, background:`linear-gradient(90deg,transparent,${C.orange},transparent)`, top:`${scanPct}%`, boxShadow:`0 0 16px ${C.orange}, 0 0 4px ${C.orange}`, zIndex:4 }}/>
            <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg,transparent ${Math.max(0,scanPct-15)}%,rgba(255,122,61,0.06) ${scanPct}%,transparent ${Math.min(100,scanPct+15)}%)`, zIndex:2 }}/>

            {/* Doc content or Captured Photo */}
            {capturedImage ? (
              <img src={capturedImage} alt="Scanning doc" style={{ width:'100%', height:'100%', objectFit:'cover', filter:'brightness(0.85) contrast(1.05)' }} />
            ) : (
              <div style={{ padding:20, position:'relative', zIndex:0 }}>
                {[40,28,36,22,30,28,24,34,20].map((w,i)=>(
                  <div key={i} style={{ height:6, borderRadius:3, background:'rgba(255,255,255,0.08)', marginBottom:10, width:`${w}px` }}/>
                ))}
              </div>
            )}
          </div>

          <div style={{ fontSize:23, fontWeight:800, color:C.text, marginBottom:8, textAlign:'center' }}>AI Scanning…</div>
          <div style={{ fontSize:13.5, color:C.orange, fontWeight:600, marginBottom:28, height:22, textAlign:'center' }}>
            {STAGES[stageIdx]}
          </div>

          {/* Progress */}
          <div style={{ width:'100%', height:8, borderRadius:4, background:C.card2, overflow:'hidden', marginBottom:8 }}>
            <div style={{ height:'100%', width:`${scanPct}%`, borderRadius:4, background:C.grad, transition:'width .18s', boxShadow:'0 0 12px rgba(255,122,61,0.4)' }}/>
          </div>
          <div style={{ fontSize:12, color:C.faint }}>{Math.round(scanPct)}% · BharatShield Multi-Modal Neural Pipeline</div>
        </div>
      )}

      {/* ── STEP: RESULT ─────────────────────────────────────────────────── */}
      {step==='result' && selected && (
        <div style={{ flex:1, overflowY:'auto', padding:'20px 18px 32px' }}>
          {/* Score card */}
          <div style={{ background:`${verdictColor}14`, border:`1.5px solid ${verdictColor}35`, borderRadius:22, padding:20, marginBottom:18, textAlign:'center', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:`${verdictColor}0A` }}/>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'1px', color:verdictColor, textTransform:'uppercase', marginBottom:12, position:'relative' }}>Forensic Authenticity Result</div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
              <GaugeRing score={score} size={120} label="Authenticity"/>
            </div>
            <div style={{ fontSize:20, fontWeight:900, color:verdictColor, letterSpacing:-0.5, marginBottom:6 }}>{verdict}</div>
            <div style={{ fontSize:13, color:C.dim }}>{DOC_TYPES.find(d=>d.id===selected)?.label} · {customProvider}</div>
          </div>

          {/* AI Metrics Badge Row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
            <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:14, padding:'12px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.faint }}>Tariff Inflation Risk</div>
              <div style={{ fontSize:16, fontWeight:800, color:C.amber, marginTop:3 }}>{aiResult?.tariffInflationRisk || '12%'}</div>
            </div>
            <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:14, padding:'12px', textAlign:'center' }}>
              <div style={{ fontSize:11, color:C.faint }}>Duplicate Probability</div>
              <div style={{ fontSize:16, fontWeight:800, color:score>70?C.safe:C.danger, marginTop:3 }}>{aiResult?.duplicateProbability || (score>70?'3.2%':'64.8%')}</div>
            </div>
          </div>

          {/* Forensic Indicators */}
          <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:12 }}>Neural Forensic Indicators</div>
          <Card style={{ marginBottom:18 }}>
            {indicators.map((ind: any, i: number)=>(
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'11px 0', borderBottom:i<indicators.length-1?`1px solid ${C.border}`:'none' }}>
                <div style={{ width:30, height:30, borderRadius:9, background:ind.pass?C.safeSoft:C.orangeSoft, color:ind.pass?C.safe:C.orange, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, border:`1px solid ${ind.pass?C.safe:C.orange}25` }}>
                  {ind.pass?Ic.check:Ic.x}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:4 }}>{ind.text}</div>
                  <span style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:8, background:ind.weight==='High'?C.orangeSoft:ind.weight==='Medium'?C.amberSoft:'rgba(255,255,255,0.06)', color:ind.weight==='High'?C.orange:ind.weight==='Medium'?C.amber:C.faint }}>
                    {ind.weight} severity
                  </span>
                </div>
              </div>
            ))}
          </Card>

          {/* Direct Claims Save Action */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filedClaimId ? (
              <div style={{ background:C.safeSoft, border:`1px solid ${C.safeDark}`, borderRadius:16, padding:'14px', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.safe }}>✓ Claim {filedClaimId} Created</div>
                <div style={{ fontSize:11.5, color:C.dim, marginTop:3 }}>Added to live SIU review queue and claim registry</div>
              </div>
            ) : (
              <PressBtn onClick={handlePushToClaims} style={{ width:'100%', background:C.gradSafe, borderRadius:16, padding:'16px', fontSize:14, fontWeight:800, color:'#fff', boxShadow:'0 10px 28px rgba(58,158,106,0.35)', gap:8 }}>
                {filingClaim ? 'Filing Claim…' : '⚡ File Directly to SIU Claims Queue'}
              </PressBtn>
            )}

            {score < 60 && (
              <PressBtn onClick={()=>{ toast('Flagged to SIU Priority Investigation queue') }} style={{ width:'100%', background:C.grad, borderRadius:16, padding:'14px', fontSize:13.5, fontWeight:700, color:'#fff', boxShadow:'0 10px 28px rgba(194,84,14,0.38)', gap:8 }}>
                {Ic.flag} Flag Document for SIU Fraud Investigation
              </PressBtn>
            )}

            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <PressBtn onClick={()=>{setStep('select');setSelected(null);setAiResult(null);setFiledClaimId(null)}} style={{ flex:1, background:C.card2, border:`1px solid ${C.borderStrong}`, borderRadius:14, padding:'14px', fontSize:13, fontWeight:600, color:C.dim }}>
                Scan Another
              </PressBtn>
              <PressBtn onClick={onClose} style={{ flex:1, background:C.card2, border:`1px solid ${C.borderStrong}`, borderRadius:14, padding:'14px', fontSize:13, fontWeight:600, color:C.dim }}>
                Close
              </PressBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TOP BAR ─────────────────────────────────────────────────────────────────
function TopBar({ tab, onProfile, onBell, unread }: { tab:Tab; onProfile:()=>void; onBell:()=>void; unread:number }) {
  const { role } = useRBAC()
  const greeting = () => {
    const h = new Date().getHours()
    return h<12?'Good morning':h<17?'Good afternoon':'Good evening'
  }
  const show = tab === 'dashboard'
  return (
    <div style={{ background:C.sidebar, borderBottom:`1px solid ${C.border}`, paddingTop:42, paddingBottom:show?16:12, paddingLeft:18, paddingRight:18, flexShrink:0, transition:'padding .3s' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:show?10:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:C.grad, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 12px rgba(194,84,14,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3z" fill="white"/><path d="M9 12l2 2 4-4" stroke="rgba(194,84,14,0.55)" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div style={{ fontSize:16, fontWeight:900, color:C.text, letterSpacing:0.8 }}>BHARAT<span style={{ color:C.amber }}>SHIELD</span></div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ position:'relative' }}>
            <div onClick={onBell} role="button" aria-label="Notifications" style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:C.faint, cursor:'pointer' }}>{Ic.bell}</div>
            {unread>0 && <span style={{ position:'absolute', top:-4, right:-4, minWidth:16, height:16, borderRadius:8, padding:'0 4px', background:C.grad, border:`1.5px solid ${C.sidebar}`, color:'#fff', fontSize:9.5, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{unread}</span>}
          </div>
          <div onClick={onProfile} style={{ width:36, height:36, borderRadius:'50%', background:C.grad, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', cursor:'pointer', boxShadow:'0 4px 12px rgba(194,84,14,0.4)' }}>{role.initials}</div>
        </div>
      </div>
      {show && (
        <div style={{ animation:'bs-fadein .3s ease-out' }}>
          <div style={{ fontSize:15, fontWeight:600, color:C.text }}>{greeting()}, {role.id==='admin'?'Dr. Rekha':role.person.split(' ')[0]}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:3 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:'.5px', color:role.color, background:`${role.color}18`, border:`1px solid ${role.color}44`, borderRadius:20, padding:'3px 9px', whiteSpace:'nowrap' }}>{role.title.toUpperCase()}</span>
            <LiveBadge label="SYSTEMS NOMINAL" color={C.safe}/>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
const NAV: { id:Tab; label:string; icon:React.ReactNode; badge?:number }[] = [
  { id:'dashboard',  label:'Home',     icon:Ic.grid },
  { id:'claims',     label:'Claims',   icon:Ic.claims, badge:12 },
  { id:'analytics',  label:'AI Intel', icon:Ic.brain },
  { id:'alerts',     label:'Alerts',   icon:Ic.bell, badge:4 },
]

function BottomNav({ tab, setTab, onFAB }: { tab:Tab; setTab:(t:Tab)=>void; onFAB:()=>void }) {
  const { can } = useRBAC()
  const scanLocked = !can('scan_docs')
  const left = NAV.slice(0,2), right = NAV.slice(2,4)

  const NavItem = ({ t }: { t:typeof NAV[0] }) => {
    const active = tab === t.id
    const locked = t.id==='analytics' && !can('view_intel')
    const [p, setP] = useState(false)
    return (
      <button onClick={()=>setTab(t.id)} onPointerDown={()=>setP(true)} onPointerUp={()=>setP(false)} onPointerLeave={()=>setP(false)}
        style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:'4px 0', position:'relative', transform:p?'scale(0.9)':'scale(1)', transition:'transform .12s', opacity:locked?0.5:1 }}>
        {active && <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:44, height:44, borderRadius:14, background:C.grad, zIndex:0, boxShadow:'0 6px 20px rgba(194,84,14,0.35)' }}/>}
        <div style={{ position:'relative', zIndex:1, color:active?'#fff':C.faint, width:44, height:36, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {t.icon}
          {locked ? <span style={{ position:'absolute', top:3, right:5, color:C.amber, display:'flex', transform:'scale(.7)' }}>{Ic.lock}</span> : null}
          {t.badge&&!active&&!locked ? <span style={{ position:'absolute', top:4, right:4, background:C.grad, color:'#fff', fontSize:8, fontWeight:800, minWidth:14, height:14, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', border:`1.5px solid ${C.sidebar}` }}>{t.badge}</span> : null}
        </div>
        <span style={{ fontSize:10, fontWeight:active?700:500, color:active?C.orange:C.faint, position:'relative', zIndex:1, transition:'color .2s' }}>{t.label}</span>
      </button>
    )
  }

  const [fabPressed, setFabPressed] = useState(false)

  return (
    <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:100, pointerEvents:'none', paddingBottom:'env(safe-area-inset-bottom,12px)' }}>
      <div style={{ margin:'0 14px 10px', background:C.sidebar, borderRadius:28, border:`1px solid ${C.borderStrong}`, boxShadow:'0 -4px 40px rgba(0,0,0,0.5),0 8px 40px rgba(0,0,0,0.3)', display:'flex', alignItems:'center', padding:'8px 4px', pointerEvents:'all' }}>
        {left.map(t=><NavItem key={t.id} t={t}/>)}

        {/* FAB */}
        <div style={{ flex:1, display:'flex', justifyContent:'center', alignItems:'center' }}>
          <div style={{ position:'relative', marginTop:-24 }}>
            <button onPointerDown={()=>setFabPressed(true)} onPointerUp={()=>setFabPressed(false)} onPointerLeave={()=>setFabPressed(false)} onClick={onFAB}
              style={{ width:56, height:56, borderRadius:'50%', background:scanLocked?'#3A2B20':C.grad, border:'2.5px solid rgba(255,255,255,0.2)', boxShadow:scanLocked?'0 2px 8px rgba(0,0,0,0.4)':'0 6px 24px rgba(194,84,14,0.45),0 2px 8px rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:scanLocked?C.faint:'#fff', transform:fabPressed?'scale(0.9)':'scale(1)', transition:'transform .12s' }}>
              {scanLocked?Ic.lock:Ic.scan}
            </button>
            <div style={{ textAlign:'center', marginTop:4, fontSize:9.5, fontWeight:600, color:C.faint }}>Scan Doc</div>
          </div>
        </div>

        {right.map(t=><NavItem key={t.id} t={t}/>)}
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function MainApp({ onLogout }: { onLogout:()=>void }) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [scanOpen, setScanOpen] = useState(false)
  const { can, guard, deny } = useRBAC()
  const goTab = (t:Tab)=>{ if(t==='analytics' && !can('view_intel')) deny('view_intel','AI Intelligence'); else setTab(t) }
  const openScan = ()=>guard('scan_docs','Document forensics',()=>setScanOpen(true))
  const [notifOpen,setNotifOpen] = useState(false)
  const [read,setRead] = useState<number[]>([])
  const [newClaim,setNewClaim] = useState(false)

  if (scanOpen) return <DocScanScreen onClose={()=>setScanOpen(false)}/>

  return (
    <div style={{ position:'absolute', inset:0, background:C.bg, display:'flex', flexDirection:'column' }}>
      <TopBar tab={tab} onProfile={()=>setTab('profile')} onBell={()=>setNotifOpen(true)} unread={NOTIFS.filter(n=>!read.includes(n.id)).length}/>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', animation:'bs-fadein .3s ease-out' }} key={tab}>
        {tab==='dashboard'  && <DashboardScreen onOpenScan={openScan}/>}
        {tab==='claims'     && <ClaimsScreen onNew={()=>guard('submit_claim','Submit claim',()=>setNewClaim(true))}/>}
        {tab==='analytics'  && <AnalyticsScreen/>}
        {tab==='alerts'     && <AlertsScreen/>}
        {tab==='profile'    && <ProfileScreen onLogout={onLogout}/>}
      </div>
      <BottomNav tab={tab} setTab={goTab} onFAB={openScan}/>
      {notifOpen && <NotificationsSheet read={read} setRead={setRead} onClose={()=>setNotifOpen(false)} onGo={goTab}/>}
      {newClaim && <NewClaimSheet onClose={()=>setNewClaim(false)}/>}
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState<Screen>('splash')
  const [role, setRole] = useState<Role>(ROLES[0])
  return (
    <div style={{ position:'absolute', inset:0, background:C.bg, overflow:'hidden' }}>
      {screen==='splash'     && <SplashScreen     onDone={()=>setScreen('onboarding')}/>}
      {screen==='onboarding' && <OnboardingScreen  onDone={()=>setScreen('role')}/>}
      {screen==='role'       && <RoleSelectScreen  onSelect={r=>{ setRole(r); setScreen('login') }}/>}
      {screen==='login'      && <LoginScreen       role={role} onNext={()=>setScreen('otp')} onBack={()=>setScreen('role')}/>}
      {screen==='otp'        && <OTPScreen          email={role.email} onDone={()=>setScreen('main')}/>}
      {screen==='main'       && <RBACProvider key={role.id} role={role}><MainApp onLogout={()=>setScreen('role')}/></RBACProvider>}
    </div>
  )
}
