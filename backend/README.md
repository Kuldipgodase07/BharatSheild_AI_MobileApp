# BharatShield AI — Production Backend

Senior Database Administrator & Senior AI/ML Integration Services for BharatShield AI Mobile Application.

## Database: MongoDB Atlas (`bharatshield_ai_db`)

### Enterprise Collections & Schema:
1. **`claims`**:
   - `id` / `claimId`: Unique claim identifier (e.g. `CLM-2026-8821`, `CLM-8819`)
   - `patient`: Full demographic details, age, masked Aadhaar, contact, address
   - `policy`: Policy number, plan name, sum insured, status
   - `hospital`: Provider name, city, NABH accreditation, syndicate flag, risk rating
   - `treatment`: ICD-10 diagnosis codes, length of stay, admission/discharge dates, room category
   - `financials`: Billed amount, GIPSA tariff benchmarks, disallowed amount, tariff inflation %
   - `aiForensics`: Real-time fraud score (0-100), risk level (LOW/MEDIUM/HIGH/CRITICAL), XGBoost score, Isolation Forest score, LSTM sequence anomaly, Deepfake score, IRDAI flags, Gemini summary
   - `status`: `SUBMITTED`, `UNDER_REVIEW`, `ESCALATED_SIU`, `APPROVED`, `REJECTED`
   - `timeline`: Immutable audit history of changes

2. **`alerts`**:
   - `alertId`: e.g. `ALT-991`
   - `type`: `RULE_TRIGGER`, `AI_ANOMALY`, `SYNDICATE_CLUSTER`
   - `severity`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
   - `title`: Alert title
   - `description`: Detailed forensic rationale
   - `provider`: Target hospital / claimant
   - `status`: `ACTIVE`, `RESOLVED`
   - `resolvedBy`: Official investigator name
   - `resolvedAt`: Timestamp

3. **`audit_logs`**:
   - Immutable 90-day retention audit trail
   - `timestamp`, `action`, `user`, `actor`, `target`, `details`, `status`, `ipAddress`

4. **`kpi_metrics`**:
   - Real-time aggregated statistics: total claims processed, prevented fraud amount, active alerts, ensemble model AUC, live rules count

## API Endpoints:

- `GET /api/health` - MongoDB connection health and active records count
- `GET /api/kpi` - Real-time executive dashboard KPIs
- `GET /api/claims` - Claims list with live filtering and search
- `GET /api/claims/:id` - Full forensic dossier of a specific claim
- `POST /api/claims` - Submit new claim with automatic Gemini AI pre-screening
- `PATCH /api/claims/:id/status` - Update claim status (Approve, SIU Escalation, Repudiation)
- `GET /api/alerts` - Active fraud alerts from MongoDB
- `PATCH /api/alerts/:id/resolve` - Resolve fraud alert with audit logging
- `GET /api/audit-logs` - Immutable regulatory audit trail
- `POST /api/ai/analyze-doc` - Gemini Flash document forensics analysis
- `POST /api/ai/chat` - Real-time Gemini AI SIU Fraud Copilot
- `GET /api/reports/excel` - Download official formatted Excel report
- `GET /api/reports/pdf` - Download official formatted PDF report

## Running Standalone:
```bash
npm install
node index.js
```
The server will start on `http://localhost:5000`.
