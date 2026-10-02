export type Perm =
  | 'view_claims' | 'view_pii' | 'scan_docs' | 'resolve_alerts' | 'view_intel'
  | 'submit_claim' | 'run_agents' | 'approve_fix' | 'export_reports' | 'manage_rules' | 'view_audit'

export type RoleId = 'admin' | 'investigator' | 'auditor' | 'claims' | 'policyholder' | 'hospital'

export interface Role {
  kind: 'staff' | 'customer'; id: RoleId; title: string; tagline: string; person: string; initials: string
  email: string; org: string; color: string; level: number; levelLabel: string
  icon: string; perms: Perm[]
}

export const PERMS: Record<Perm, { label: string; desc: string }> = {
  view_claims:    { label: 'View claims',        desc: 'Browse the claims register' },
  submit_claim:   { label: 'Submit claims',      desc: 'File new claims for pre-screening' },
  view_pii:       { label: 'See identities',     desc: 'Unmasked names and IDs' },
  scan_docs:      { label: 'Document forensics', desc: 'Scan and verify documents' },
  resolve_alerts: { label: 'Resolve alerts',     desc: 'Close and flag alerts' },
  view_intel:     { label: 'AI Intelligence',    desc: 'Models, graph, patterns' },
  run_agents:     { label: 'Run AI agents',      desc: 'Red, Blue, Green loop' },
  approve_fix:    { label: 'Approve fixes',      desc: 'Freeze payouts, apply fixes' },
  export_reports: { label: 'Export reports',     desc: 'PDF and Excel downloads' },
  manage_rules:   { label: 'Manage rules',       desc: 'Edit rules and models' },
  view_audit:     { label: 'Audit logs',         desc: 'Full activity trail' },
}
export const PERM_ORDER = Object.keys(PERMS) as Perm[]

export const ROLES: Role[] = [
  {
    kind: 'staff', id: 'admin', title: 'Platform Administrator', tagline: 'Full control, approvals and governance',
    person: 'Dr. Rekha Menon', initials: 'DR', email: 'rekha@starhealth.in', org: 'Star Health & Allied Insurance',
    color: '#FF7A3D', level: 4, levelLabel: 'Level 4 · Full access',
    icon: 'M12 2l8 3v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5l8-3zM9 12l2 2 4-4',
    perms: ['view_claims','submit_claim','view_pii','scan_docs','resolve_alerts','view_intel','run_agents','approve_fix','export_reports','manage_rules','view_audit'],
  },
  {
    kind: 'staff', id: 'investigator', title: 'Fraud Investigator', tagline: 'SIU case work, forensics and AI agents',
    person: 'Arjun Kapoor', initials: 'AK', email: 'arjun.kapoor@starhealth.in', org: 'Special Investigation Unit',
    color: '#F2A93B', level: 3, levelLabel: 'Level 3 · Investigate',
    icon: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
    perms: ['view_claims','view_pii','scan_docs','resolve_alerts','view_intel','run_agents','export_reports'],
  },
  {
    kind: 'staff', id: 'auditor', title: 'IRDAI Compliance Auditor', tagline: 'Read-only oversight with masked identities',
    person: 'Meera Nair', initials: 'MN', email: 'meera.nair@irdai.gov.in', org: 'IRDAI · Regulatory Audit',
    color: '#5BA8FF', level: 2, levelLabel: 'Level 2 · Read-only',
    icon: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 006 0L5 7zM19 7l-3 7a3 3 0 006 0l-3-7z',
    perms: ['view_claims','view_intel','export_reports','view_audit'],
  },
  {
    kind: 'staff', id: 'claims', title: 'TPA Claims Officer', tagline: 'Front-line claims review and document checks',
    person: 'Sanjay Patel', initials: 'SP', email: 'sanjay.patel@starhealth.in', org: 'Claims Processing Desk',
    color: '#57C48A', level: 1, levelLabel: 'Level 1 · Operations',
    icon: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7',
    perms: ['view_claims','submit_claim','view_pii','scan_docs'],
  },
  {
    kind: 'customer', id: 'policyholder', title: 'Policyholder', tagline: 'Track your claims and verify your documents',
    person: 'Kavita Rao', initials: 'KR', email: 'kavita.rao@gmail.com', org: 'Customer · Health policy holder',
    color: '#B98CFF', level: 1, levelLabel: 'Customer · Own claims',
    icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
    perms: ['view_claims','submit_claim','scan_docs'],
  },
  {
    kind: 'customer', id: 'hospital', title: 'Hospital Partner', tagline: 'Submit claims, check pre-auth and download reports',
    person: 'Dr. Anil Verma', initials: 'AV', email: 'anil.verma@apollohospitals.com', org: 'Network hospital · Apollo',
    color: '#3FC8C0', level: 2, levelLabel: 'Partner · Claim submission',
    icon: 'M4 21V6l8-3 8 3v15M9 21v-5h6v5M12 8v4M10 10h4',
    perms: ['view_claims','submit_claim','scan_docs','export_reports'],
  },
]

export const rolesWith = (p: Perm) => ROLES.filter(r => r.perms.includes(p)).map(r => r.title)

export const maskName = (n: string) =>
  n.split(' ').map(w => w[0] + '•'.repeat(Math.max(2, w.length - 1))).join(' ')
