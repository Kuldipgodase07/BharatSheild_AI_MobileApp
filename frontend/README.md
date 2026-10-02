# BharatShield AI — Mobile Front-End Application

Production-grade, real-time government health insurance fraud mitigation mobile application designed for Android and mobile devices.

## Features:
1. **Device Frame Experience**:
   - iPhone / Android mobile frame presentation inside a clean, light browser backdrop.
   - Zero content spill outside the frame; smooth native touch & scroll physics.

2. **Real-Time MongoDB Integration**:
   - Live synchronization with `bharatshield_ai_db` via `/api` proxy.
   - Dynamic KPIs, real-time claims registry, and live SIU alerts.
   - Status transitions (Approved, SIU Escalation, Repudiated) write directly to the database.

3. **Gemini AI Integration**:
   - **Document Forensics**: Real-time CNN + Gemini vision forensics auditing bills, ID proofs, and claim forms.
   - **Interactive SIU Copilot**: Real-time conversational AI assisting investigators with IC-10 codes, GIPSA tariffs, and Section 45 compliance.

4. **Executive Reporting (PDF & Excel)**:
   - Formatted in signature BharatShield dark luxury & amber theme (`#160F0A`, `#FF7A3D`, `#F2A93B`).
   - One-tap export directly from Dashboard and Analytics screen.

5. **Role-Based Access Control (RBAC)**:
   - 8 Persona Roles: CRO, SIU Investigator, TPA Auditor, Network Hospital Desk, Policyholder, and more.
   - Dynamic PII masking and fine-grained permission enforcement.

## Running Standalone:
```bash
npm install
npm run dev
```
The app will be available at `http://localhost:8443`.
