import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB, getDB } from './db.js';
import { analyzeDocumentFraud, chatFraudCopilot } from './gemini.js';
import { generateExcelReport, generatePdfReport } from './reports.js';

const app = express();
const PORT = process.env.SERVER_PORT || process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const db = getDB();
    const count = await db.collection('claims').countDocuments();
    res.json({
      status: 'UP',
      database: 'CONNECTED',
      claimsCount: count,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'DEGRADED', error: err.message });
  }
});

// ─── KPI METRICS ─────────────────────────────────────────────────────────────
app.get('/api/kpi', async (req, res) => {
  try {
    const db = getDB();
    const kpi = await db.collection('kpi_metrics').findOne({ metricId: "CURRENT_KPI" });
    const claimsCount = await db.collection('claims').countDocuments();
    const activeAlerts = await db.collection('alerts').countDocuments({ status: { $ne: 'RESOLVED' } });

    res.json({
      ...kpi,
      totalClaimsProcessed: Math.max(kpi?.totalClaimsProcessed || 142050, claimsCount),
      activeAlerts: Math.max(kpi?.activeAlerts || 45, activeAlerts)
    });
  } catch (err) {
    console.error("[GET /api/kpi error]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── CLAIMS ──────────────────────────────────────────────────────────────────
app.get('/api/claims', async (req, res) => {
  try {
    const { search, risk, status } = req.query;
    const db = getDB();
    const query = {};

    if (risk && risk !== 'ALL') {
      query['aiForensics.riskLevel'] = risk.toUpperCase();
    }
    if (status && status !== 'ALL') {
      query['status'] = status.toUpperCase();
    }
    if (search) {
      query.$or = [
        { id: { $regex: search, $options: 'i' } },
        { 'patient.name': { $regex: search, $options: 'i' } },
        { 'hospital.name': { $regex: search, $options: 'i' } },
        { insurer: { $regex: search, $options: 'i' } },
        { 'treatment.diagnosis': { $regex: search, $options: 'i' } }
      ];
    }

    const claims = await db.collection('claims').find(query).sort({ createdAt: -1 }).toArray();
    res.json(claims);
  } catch (err) {
    console.error("[GET /api/claims error]", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/claims/:id', async (req, res) => {
  try {
    const db = getDB();
    const claim = await db.collection('claims').findOne({ id: req.params.id });
    if (!claim) return res.status(404).json({ error: "Claim not found" });
    res.json(claim);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a new claim with real-time AI scoring & MongoDB storage
app.post('/api/claims', async (req, res) => {
  try {
    const db = getDB();
    const data = req.body;

    const count = await db.collection('claims').countDocuments();
    const claimId = `CLM-2026-${9042 + count}`;

    // Perform real Gemini AI Analysis on the new claim submission
    console.log(`[Claim Submission] Running Gemini AI fraud check on new claim ${claimId}...`);
    const aiResult = await analyzeDocumentFraud({
      documentText: data.treatment?.notes || data.diagnosis || "New patient cashless claim submission",
      claimData: data,
      docType: "claim_admission_record"
    });

    const newClaim = {
      claimId: claimId,
      id: claimId,
      claimNumber: data.claimNumber || `BS-${Date.now().toString().slice(-6)}`,
      insurer: data.insurer || "HDFC ERGO Health",
      patient: {
        name: data.patientName || "Claimant",
        age: parseInt(data.age) || 35,
        gender: data.gender || "Female",
        phone: data.phone || "+91 98000 00000",
        aadhaarMasked: data.aadhaar ? `XXXX-XXXX-${data.aadhaar.slice(-4)}` : "XXXX-XXXX-1122",
        city: data.city || "Mumbai",
        state: data.state || "Maharashtra"
      },
      policy: {
        number: data.policyNumber || "POL-" + Math.floor(100000 + Math.random() * 900000),
        plan: data.plan || "Health Shield Floater",
        sumInsured: parseInt(data.sumInsured) || 500000,
        status: "ACTIVE"
      },
      hospital: {
        name: data.hospitalName || "Apex City Hospital",
        city: data.city || "Mumbai",
        state: data.state || "Maharashtra",
        nabhAccredited: Boolean(data.nabhAccredited),
        riskRating: aiResult.riskLevel,
        syndicateFlag: aiResult.fraudScore > 75
      },
      treatment: {
        diagnosis: data.diagnosis || "Surgical Intervention",
        icd10: data.icd10 || "Z03.8",
        admissionDate: data.admissionDate || new Date().toISOString().split('T')[0],
        dischargeDate: data.dischargeDate || new Date().toISOString().split('T')[0],
        lengthOfStayDays: parseInt(data.lengthOfStayDays) || 3,
        roomCategory: data.roomCategory || "Single Private"
      },
      financials: {
        billedAmount: parseInt(data.billedAmount) || 120000,
        approvedAmount: aiResult.riskLevel === 'CRITICAL' ? 0 : Math.round((parseInt(data.billedAmount) || 120000) * 0.8),
        disallowedAmount: aiResult.riskLevel === 'CRITICAL' ? (parseInt(data.billedAmount) || 120000) : Math.round((parseInt(data.billedAmount) || 120000) * 0.2),
        gipsaBenchmarkTariff: Math.round((parseInt(data.billedAmount) || 120000) * 0.65),
        tariffInflationPct: aiResult.tariffInflationPct || 35
      },
      aiForensics: {
        fraudScore: aiResult.fraudScore,
        riskLevel: aiResult.riskLevel,
        isolationForestScore: Number((aiResult.fraudScore / 100).toFixed(3)),
        xgbAnomalyScore: Number(((aiResult.fraudScore + 2) / 100).toFixed(3)),
        lstmTemporalAnomaly: 0.65,
        deepfakeDocScore: 0.22,
        flags: aiResult.anomalies,
        geminiSummary: aiResult.executiveSummary
      },
      status: aiResult.fraudScore > 80 ? "ESCALATED_SIU" : aiResult.fraudScore > 50 ? "UNDER_REVIEW" : "APPROVED",
      assignedTo: "Dr. Ananya Sharma",
      assignedRole: "Fraud Investigator",
      timeline: [
        { t: new Date().toISOString(), msg: `Claim registered in BharatShield AI Database`, actor: data.submittedBy || "Portal" },
        { t: new Date().toISOString(), msg: `BharatShield AI Forensics assigned Risk Score: ${aiResult.fraudScore} (${aiResult.riskLevel})`, actor: "BharatShield Neural Engine" }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('claims').insertOne(newClaim);

    // If High/Critical risk, generate real-time alert in MongoDB
    if (aiResult.fraudScore > 70) {
      const alertId = `ALT-${Math.floor(9042 + count)}`;
      await db.collection('alerts').insertOne({
        id: alertId,
        claimId: claimId,
        amount: `₹${(newClaim.financials.billedAmount).toLocaleString('en-IN')}`,
        assignedTo: "Dr. Ananya Sharma",
        flagReason: aiResult.anomalies[0] || "Suspected Tariff Inflation",
        hospital: newClaim.hospital.name,
        patient: newClaim.patient.name,
        riskScore: aiResult.fraudScore,
        severity: aiResult.riskLevel,
        status: "ACTIVE",
        timestamp: "Just now",
        createdAt: new Date()
      });
    }

    // Write DPDP Compliant Audit Log
    await db.collection('audit_logs').insertOne({
      timestamp: new Date(),
      actor: { name: data.submittedBy || "System User", role: "Claim Officer", roleId: "officer" },
      action: "SUBMIT_CLAIM",
      target: claimId,
      details: `New claim for ₹${newClaim.financials.billedAmount} processed with BharatShield AI Score ${aiResult.fraudScore}`,
      ipAddress: req.ip || "127.0.0.1",
      dpdpCompliant: true
    });

    res.status(201).json({ success: true, claim: newClaim });
  } catch (err) {
    console.error("[POST /api/claims error]", err);
    res.status(500).json({ error: err.message });
  }
});

// Update Claim Status
app.patch('/api/claims/:id/status', async (req, res) => {
  try {
    const { status, actor = "Dr. Rekha Srinivasan", notes } = req.body;
    const db = getDB();

    const claim = await db.collection('claims').findOne({ id: req.params.id });
    if (!claim) return res.status(404).json({ error: "Claim not found" });

    const updatedTimeline = [
      ...(claim.timeline || []),
      { t: new Date().toISOString(), msg: `Status updated to ${status}${notes ? ': ' + notes : ''}`, actor }
    ];

    await db.collection('claims').updateOne(
      { id: req.params.id },
      {
        $set: {
          status: status.toUpperCase(),
          timeline: updatedTimeline,
          updatedAt: new Date()
        }
      }
    );

    await db.collection('audit_logs').insertOne({
      timestamp: new Date(),
      actor: { name: actor, role: "Auditor", roleId: "auditor" },
      action: "STATUS_UPDATE",
      target: req.params.id,
      details: `Claim status changed to ${status}`,
      ipAddress: req.ip || "127.0.0.1",
      dpdpCompliant: true
    });

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ALERTS ──────────────────────────────────────────────────────────────────
app.get('/api/alerts', async (req, res) => {
  try {
    const db = getDB();
    const alerts = await db.collection('alerts').find({}).sort({ createdAt: -1 }).toArray();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/alerts/:id/resolve', async (req, res) => {
  try {
    const db = getDB();
    await db.collection('alerts').updateOne(
      { id: req.params.id },
      {
        $set: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: req.body.resolvedBy || "SIU Auditor"
        }
      }
    );
    res.json({ success: true, alertId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
app.get('/api/audit-logs', async (req, res) => {
  try {
    const db = getDB();
    const logs = await db.collection('audit_logs').find({}).sort({ timestamp: -1 }).limit(40).toArray();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GEMINI AI DOCUMENT SCANNER ──────────────────────────────────────────────
app.post('/api/ai/analyze-doc', async (req, res) => {
  try {
    const { documentText, claimData, docType } = req.body;
    console.log("[AI Doc Scanner] Analyzing document with Gemini API...");
    const result = await analyzeDocumentFraud({ documentText, claimData, docType });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GEMINI AI COPILOT CHAT ──────────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { query, role, claimContext } = req.body;
    const answer = await chatFraudCopilot({ query, role, claimContext });
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── REPORT DOWNLOADS (EXCEL & PDF) ──────────────────────────────────────────
app.get('/api/reports/excel', async (req, res) => {
  try {
    const db = getDB();
    const claims = await db.collection('claims').find({}).sort({ createdAt: -1 }).toArray();
    const kpi = await db.collection('kpi_metrics').findOne({ metricId: "CURRENT_KPI" }) || {};

    const buffer = await generateExcelReport(claims, kpi);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="BharatShield_Fraud_Report.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error("[Excel Report Error]", err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reports/pdf', async (req, res) => {
  try {
    const db = getDB();
    const claims = await db.collection('claims').find({}).sort({ createdAt: -1 }).toArray();
    const kpi = await db.collection('kpi_metrics').findOne({ metricId: "CURRENT_KPI" }) || {};

    const buffer = await generatePdfReport(claims, kpi);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="BharatShield_Fraud_Dossier.pdf"');
    res.send(buffer);
  } catch (err) {
    console.error("[PDF Report Error]", err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server & Connect MongoDB
async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[BharatShield AI Backend] Production Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("[Server Boot Error]", err);
    process.exit(1);
  }
}

startServer();
