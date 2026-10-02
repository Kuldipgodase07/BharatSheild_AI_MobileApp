// ─── BHARATSHIELD AI REAL-TIME API CLIENT ────────────────────────────────────

export interface BackendClaim {
  _id?: string;
  claimId?: string;
  id: string;
  claimNumber?: string;
  insurer: string;
  patient: {
    name: string;
    age: number;
    gender: string;
    phone: string;
    aadhaarMasked: string;
    city: string;
    state: string;
  };
  policy: {
    number: string;
    plan: string;
    sumInsured: number;
    startDate?: string;
    status: string;
  };
  hospital: {
    name: string;
    city: string;
    state: string;
    nabhAccredited: boolean;
    riskRating: string;
    syndicateFlag: boolean;
  };
  treatment: {
    diagnosis: string;
    icd10: string;
    admissionDate: string;
    dischargeDate: string;
    lengthOfStayDays: number;
    roomCategory: string;
  };
  financials: {
    billedAmount: number;
    approvedAmount: number;
    disallowedAmount: number;
    gipsaBenchmarkTariff: number;
    tariffInflationPct: number;
  };
  aiForensics: {
    fraudScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    isolationForestScore: number;
    xgbAnomalyScore: number;
    lstmTemporalAnomaly: number;
    deepfakeDocScore: number;
    flags: string[];
    geminiSummary: string;
  };
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ESCALATED_SIU' | 'APPROVED' | 'REJECTED';
  assignedTo?: string;
  assignedRole?: string;
  timeline: { t: string; msg: string; actor: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BackendAlert {
  _id?: string;
  id: string;
  alertId?: string;
  claimId?: string;
  amount?: string;
  assignedTo?: string;
  flagReason?: string;
  hospital?: string;
  patient?: string;
  title?: string;
  description?: string;
  provider?: string;
  riskScore?: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'RESOLVED';
  timestamp?: string;
  createdAt?: string;
  evidence?: any;
}

export interface BackendKpi {
  totalClaimsProcessed: number;
  flaggedFraudCount: number;
  fraudAmountPrevented: string;
  preventedRatio: string;
  activeAlerts: number;
  highRiskAlertsCount: number;
  ensembleModelAuc: number;
  liveFraudRules: number;
  lastUpdated?: string;
}

export interface BackendAuditLog {
  _id?: string;
  timestamp: string;
  actor?: { name: string; role: string; roleId: string };
  user?: string;
  action: string;
  target?: string;
  details?: any;
  ipAddress?: string;
  dpdpCompliant?: boolean;
  status?: string;
}

export interface GeminiDocAnalysisResult {
  fraudScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  tariffInflationPct?: number;
  tariffInflationRisk?: string;
  duplicateProbability?: string;
  authenticityScore?: number;
  verdict?: string;
  anomalies?: string[];
  forensicIndicators?: { text?: string; indicator?: string; pass?: boolean; status?: string; weight?: string; severity?: string }[];
  recommendation?: 'AUTO_APPROVE' | 'MANUAL_AUDIT' | 'REJECT' | 'ESCALATE_SIU';
  executiveSummary?: string;
  analysis?: any;
}

// ─── API Methods ─────────────────────────────────────────────────────────────

export async function apiGetKpi(): Promise<BackendKpi> {
  const res = await fetch('/api/kpi');
  if (!res.ok) throw new Error('Failed to fetch KPI metrics');
  return res.json();
}

export async function apiGetClaims(params?: { search?: string; risk?: string; status?: string }): Promise<BackendClaim[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.risk) query.set('risk', params.risk);
  if (params?.status) query.set('status', params.status);
  const res = await fetch(`/api/claims?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch claims');
  return res.json();
}

export async function apiGetClaimById(id: string): Promise<BackendClaim> {
  const res = await fetch(`/api/claims/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('Failed to fetch claim');
  return res.json();
}

export async function apiSubmitClaim(payload: any): Promise<{ success: boolean; claim: BackendClaim }> {
  const res = await fetch('/api/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to submit claim');
  return res.json();
}

export async function apiUpdateClaimStatus(id: string, status: string, actor: string, notes?: string) {
  const res = await fetch(`/api/claims/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, actor, notes })
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}

export async function apiGetAlerts(): Promise<BackendAlert[]> {
  const res = await fetch('/api/alerts');
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function apiResolveAlert(id: string, resolvedBy: string) {
  const res = await fetch(`/api/alerts/${encodeURIComponent(id)}/resolve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolvedBy })
  });
  if (!res.ok) throw new Error('Failed to resolve alert');
  return res.json();
}

export async function apiGetAuditLogs(): Promise<BackendAuditLog[]> {
  const res = await fetch('/api/audit-logs');
  if (!res.ok) throw new Error('Failed to fetch audit logs');
  return res.json();
}

export async function apiAnalyzeDocWithGemini(payload: { documentText?: string; claimData?: any; docType?: string; provider?: string; claimAmount?: string; patientName?: string }): Promise<GeminiDocAnalysisResult> {
  const res = await fetch('/api/ai/analyze-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to run Gemini AI analysis');
  return res.json();
}

export async function apiChatWithGemini(query: string, role?: string, claimContext?: any): Promise<string> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, role, claimContext })
  });
  if (!res.ok) throw new Error('Failed to contact Gemini Copilot');
  const data = await res.json();
  return data.answer;
}

export async function downloadExcelReportFile(clientFallbackClaims?: any[]) {
  try {
    const res = await fetch('/api/reports/excel');
    const blob = await res.blob();
    const { saveBlobFile } = await import('./reports');
    await saveBlobFile(blob, `BharatShield_Forensic_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) {
    console.warn('[Backend Excel unavailable, generating locally via ExcelJS]', e);
    try {
      const { downloadReport, buildReport } = await import('./reports');
      const data = buildReport('claims', '30 Days', {
        claims: clientFallbackClaims || [
          { id:'CLM-8821', claimant:'Priya Sharma', provider:'Apollo Multi-spec', type:'Duplicate Billing', risk:'High', amt:'₹1,20,000', date:'22 Sep 2026', ai:94 },
          { id:'CLM-8819', claimant:'Ramesh Gupta', provider:'Fortis Noida', type:'Upcoding', risk:'Medium', amt:'₹48,500', date:'21 Sep 2026', ai:67 },
          { id:'CLM-8810', claimant:'Ananya Nair', provider:'Max Saket', type:'Ghost Patient', risk:'High', amt:'₹2,10,000', date:'20 Sep 2026', ai:91 },
          { id:'CLM-8799', claimant:'Vijay Patel', provider:'Medanta Gurgaon', type:'Unnecessary Proc.', risk:'Low', amt:'₹22,000', date:'19 Sep 2026', ai:31 },
          { id:'CLM-8780', claimant:'Suresh Kumar', provider:'AIIMS Delhi', type:'Inflated Bills', risk:'Medium', amt:'₹87,500', date:'18 Sep 2026', ai:58 }
        ],
        models: [
          { name:'XGBoost Classifier', tag:'Supervised', accuracy:94.2, precision:91.8, recall:88.4, throughput:'12.3K/day' },
          { name:'Isolation Forest', tag:'Unsupervised', accuracy:96.1, precision:79.4, recall:96.1, throughput:'28.5K/day' }
        ],
        patterns: [
          { id:'EP-041', title:'Coordinated Billing Ring', type:'Network Fraud', status:'Confirmed', confidence:89, desc:'Coordinated batch billing detected' }
        ],
        trendMonths: ['Jan','Feb','Mar','Apr','May'],
        trends: [{ label:'Flagged Claims', vals:[22,28,24,38,30] }]
      });
      await downloadReport(data, 'xlsx', `BharatShield_Forensic_Report_${new Date().toISOString().slice(0, 10)}`);
    } catch (err2) {
      console.error('[Excel local generation error]', err2);
      window.open('/api/reports/excel', '_blank');
    }
  }
}

export async function downloadPdfReportFile(clientFallbackClaims?: any[]) {
  try {
    const res = await fetch('/api/reports/pdf');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const { saveBlobFile } = await import('./reports');
    await saveBlobFile(blob, `BharatShield_Fraud_Dossier_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (e) {
    console.warn('[Backend PDF unavailable, generating locally via jsPDF]', e);
    try {
      const { downloadReport, buildReport } = await import('./reports');
      const data = buildReport('executive', '30 Days', {
        claims: clientFallbackClaims || [
          { id:'CLM-8821', claimant:'Priya Sharma', provider:'Apollo Multi-spec', type:'Duplicate Billing', risk:'High', amt:'₹1,20,000', date:'22 Sep 2026', ai:94 },
          { id:'CLM-8819', claimant:'Ramesh Gupta', provider:'Fortis Noida', type:'Upcoding', risk:'Medium', amt:'₹48,500', date:'21 Sep 2026', ai:67 },
          { id:'CLM-8810', claimant:'Ananya Nair', provider:'Max Saket', type:'Ghost Patient', risk:'High', amt:'₹2,10,000', date:'20 Sep 2026', ai:91 },
          { id:'CLM-8799', claimant:'Vijay Patel', provider:'Medanta Gurgaon', type:'Unnecessary Proc.', risk:'Low', amt:'₹22,000', date:'19 Sep 2026', ai:31 },
          { id:'CLM-8780', claimant:'Suresh Kumar', provider:'AIIMS Delhi', type:'Inflated Bills', risk:'Medium', amt:'₹87,500', date:'18 Sep 2026', ai:58 }
        ],
        models: [
          { name:'XGBoost Classifier', tag:'Supervised', accuracy:94.2, precision:91.8, recall:88.4, throughput:'12.3K/day' },
          { name:'Isolation Forest', tag:'Unsupervised', accuracy:96.1, precision:79.4, recall:96.1, throughput:'28.5K/day' }
        ],
        patterns: [
          { id:'EP-041', title:'Coordinated Billing Ring', type:'Network Fraud', status:'Confirmed', confidence:89, desc:'Coordinated batch billing detected' }
        ],
        trendMonths: ['Jan','Feb','Mar','Apr','May'],
        trends: [{ label:'Flagged Claims', vals:[22,28,24,38,30] }]
      });
      await downloadReport(data, 'pdf', `BharatShield_Fraud_Dossier_${new Date().toISOString().slice(0, 10)}`);
    } catch (err2) {
      console.error('[PDF local generation error]', err2);
      window.open('/api/reports/pdf', '_blank');
    }
  }
}

