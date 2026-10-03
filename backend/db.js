import dns from 'node:dns';
// Force Google DNS & Cloudflare DNS for reliable MongoDB Atlas SRV lookup
dns.setServers(['8.8.8.8', '1.1.1.1']);

import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://BharatSheildAI_MobileAPP:Kuldip%402026@cluster0.se6sibu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = "bharatshield_ai_db";

let client = null;
let db = null;

export async function connectDB() {
  if (db) return db;
  try {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 15,
      minPoolSize: 2,
    });
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`[MongoDB] Connected successfully to database: ${DB_NAME}`);
    await seedInitialDataIfEmpty(db);
    return db;
  } catch (err) {
    console.error("[MongoDB] Connection failure:", err.message);
    throw err;
  }
}

export function getDB() {
  if (!db) throw new Error("Database not connected. Call connectDB() first.");
  return db;
}

// ─── SENIOR DBA INITIAL SEEDER ──────────────────────────────────────────────
async function seedInitialDataIfEmpty(database) {
  const claimsCol = database.collection('claims');
  // Remove any corrupted record with null claimId if it was partially inserted
  await claimsCol.deleteMany({ claimId: null });

  const count = await claimsCol.countDocuments();
  if (count > 0) {
    try {
      const existing = await claimsCol.find({ "aiForensics.geminiSummary": { $regex: /gemini/i } }).toArray();
      for (const doc of existing) {
        const sanitized = doc.aiForensics.geminiSummary.replace(/gemini/gi, "BharatShield");
        await claimsCol.updateOne({ _id: doc._id }, { $set: { "aiForensics.geminiSummary": sanitized, "aiForensics.aiSummary": sanitized } });
      }
      if (existing.length > 0) {
        console.log(`[DB Seeder] Sanitized ${existing.length} claims in MongoDB to BharatShield proprietary branding.`);
      }
    } catch (e) {
      console.warn("[DB Seeder] Sanitization notice:", e.message);
    }
    console.log(`[DB Seeder] Claims collection already has ${count} records. Ready.`);
    return;
  }

  console.log("[DB Seeder] Initializing enterprise claims dataset with IRDAI compliant data...");

  const initialClaims = [
    {
      claimId: "CLM-2026-9041",
      id: "CLM-2026-9041",
      claimNumber: "HDFC-HLTH-2026-88192",
      insurer: "HDFC ERGO Health",
      patient: {
        name: "Ramesh Kumar Sharma",
        age: 48,
        gender: "Male",
        phone: "+91 98201 44219",
        aadhaarMasked: "XXXX-XXXX-8421",
        city: "Mumbai",
        state: "Maharashtra"
      },
      policy: {
        number: "POL-HDFC-992144",
        plan: "Optima Restore Family Floater",
        sumInsured: 1000000,
        startDate: "2024-03-15",
        status: "ACTIVE"
      },
      hospital: {
        name: "Apex City Hospital",
        city: "Mumbai",
        state: "Maharashtra",
        nabhAccredited: false,
        riskRating: "CRITICAL",
        syndicateFlag: true
      },
      treatment: {
        diagnosis: "Acute Appendicitis with Peritonitis",
        icd10: "K35.2",
        admissionDate: "2026-09-28",
        dischargeDate: "2026-10-01",
        lengthOfStayDays: 4,
        roomCategory: "Deluxe ICU"
      },
      financials: {
        billedAmount: 485000,
        approvedAmount: 0,
        disallowedAmount: 485000,
        gipsaBenchmarkTariff: 125000,
        tariffInflationPct: 288
      },
      aiForensics: {
        fraudScore: 94,
        riskLevel: "CRITICAL",
        isolationForestScore: 0.962,
        xgbAnomalyScore: 0.941,
        lstmTemporalAnomaly: 0.887,
        deepfakeDocScore: 0.915,
        flags: [
          "Unbundled surgical charges (288% above GIPSA tariff)",
          "Phantom ICU ventilator utilization billed for 72 hrs without blood gas report",
          "Hospital syndicate cluster match: 14 similar cases this quarter",
          "Font mismatch detected on billing ledger header (manipulated PDF)"
        ],
        geminiSummary: "BharatShield Forensic Intelligence identified systematic billing inflation: surgeon consultation charged 4x standard tariff with duplicate ICU line-items. Digital forensics confirmed altered invoice timestamp."
      },
      status: "ESCALATED_SIU",
      assignedTo: "Dr. Ananya Sharma",
      assignedRole: "Fraud Investigator",
      timeline: [
        { t: "2026-09-29T10:14:00Z", msg: "Claim submitted via TPA Portal", actor: "Apex City TPA Desk" },
        { t: "2026-09-29T10:14:22Z", msg: "BharatShield AI real-time ML scored risk 94/100 (CRITICAL)", actor: "BharatShield AI Engine" },
        { t: "2026-09-29T11:05:00Z", msg: "Automated payout hold applied under IRDAI Fraud Protocol 4B", actor: "System" },
        { t: "2026-09-30T09:30:00Z", msg: "Assigned to SIU Forensic Field Auditor", actor: "SIU Manager" }
      ],
      createdAt: new Date("2026-09-29T10:14:00Z"),
      updatedAt: new Date()
    },
    {
      claimId: "CLM-2026-9040",
      id: "CLM-2026-9040",
      claimNumber: "STAR-COMP-2026-44102",
      insurer: "Star Health & Allied Insurance",
      patient: {
        name: "Sunita Verma",
        age: 36,
        gender: "Female",
        phone: "+91 98114 99182",
        aadhaarMasked: "XXXX-XXXX-3312",
        city: "Delhi",
        state: "Delhi NCR"
      },
      policy: {
        number: "STAR-HL-229104",
        plan: "Comprehensive Health Insurance",
        sumInsured: 500000,
        startDate: "2025-08-10",
        status: "ACTIVE"
      },
      hospital: {
        name: "Metro Multispecialty Clinic",
        city: "Delhi",
        state: "Delhi NCR",
        nabhAccredited: false,
        riskRating: "HIGH",
        syndicateFlag: true
      },
      treatment: {
        diagnosis: "Severe Viral Bronchitis with Respiratory Distress",
        icd10: "J20.9",
        admissionDate: "2026-09-25",
        dischargeDate: "2026-09-29",
        lengthOfStayDays: 5,
        roomCategory: "High Dependency Unit"
      },
      financials: {
        billedAmount: 210000,
        approvedAmount: 0,
        disallowedAmount: 210000,
        gipsaBenchmarkTariff: 68000,
        tariffInflationPct: 208
      },
      aiForensics: {
        fraudScore: 91,
        riskLevel: "HIGH",
        isolationForestScore: 0.918,
        xgbAnomalyScore: 0.902,
        lstmTemporalAnomaly: 0.840,
        deepfakeDocScore: 0.880,
        flags: [
          "Income-to-Sum Insured ratio anomaly",
          "Hospital stay exceeds clinical necessity standard by 3 days",
          "Identical medication dosages claimed across 8 separate policyholders",
          "Pathology report barcode does not exist in NABL registry"
        ],
        geminiSummary: "BharatShield Clinical Analysis confirms outpatient viral bronchitis was artificially hospitalized for HDU billing with synthetic pathology lab reports."
      },
      status: "UNDER_REVIEW",
      assignedTo: "Rajesh Nair",
      assignedRole: "Fraud Investigator",
      timeline: [
        { t: "2026-09-26T14:20:00Z", msg: "Cashless authorization requested", actor: "Metro Multispecialty TPA" },
        { t: "2026-09-26T14:21:05Z", msg: "AI flagged synthetic pathology test serial number", actor: "BharatShield AI Engine" },
        { t: "2026-09-27T10:00:00Z", msg: "Cashless rejected, converted to reimbursement audit", actor: "Medical Reviewer" }
      ],
      createdAt: new Date("2026-09-26T14:20:00Z"),
      updatedAt: new Date()
    },
    {
      claimId: "CLM-2026-9039",
      id: "CLM-2026-9039",
      claimNumber: "ICICI-MOT-2026-11849",
      insurer: "ICICI Lombard General Insurance",
      patient: {
        name: "Vikramaditya Rao",
        age: 41,
        gender: "Male",
        phone: "+91 99401 22891",
        aadhaarMasked: "XXXX-XXXX-9914",
        city: "Bengaluru",
        state: "Karnataka"
      },
      policy: {
        number: "ICICI-MOT-094812",
        plan: "Comprehensive Motor Package (Zero Dep)",
        sumInsured: 1450000,
        startDate: "2024-11-20",
        status: "ACTIVE"
      },
      hospital: {
        name: "FastTrack Auto Bodyworks",
        city: "Bengaluru",
        state: "Karnataka",
        nabhAccredited: false,
        riskRating: "HIGH",
        syndicateFlag: false
      },
      treatment: {
        diagnosis: "Vehicle Frontal Impact Collision",
        icd10: "V49.9",
        admissionDate: "2026-09-22",
        dischargeDate: "2026-09-25",
        lengthOfStayDays: 3,
        roomCategory: "Workshop Assessment"
      },
      financials: {
        billedAmount: 340000,
        approvedAmount: 95000,
        disallowedAmount: 245000,
        gipsaBenchmarkTariff: 110000,
        tariffInflationPct: 209
      },
      aiForensics: {
        fraudScore: 86,
        riskLevel: "HIGH",
        isolationForestScore: 0.884,
        xgbAnomalyScore: 0.852,
        lstmTemporalAnomaly: 0.790,
        deepfakeDocScore: 0.940,
        flags: [
          "Pre-existing structural corrosion detected under fresh bumper weld",
          "Accident impact velocity calculated by AI vision model is inconsistent with stated barrier crash",
          "Damage photo EXIF metadata indicates image was captured 38 days before policy inception"
        ],
        geminiSummary: "BharatShield Vision AI analysis extracted EXIF creation date proving damage occurred prior to insurance endorsement. Staged accident claim identified."
      },
      status: "REJECTED",
      assignedTo: "Kavita Pillai",
      assignedRole: "Risk Analyst",
      timeline: [
        { t: "2026-09-23T08:12:00Z", msg: "Accident claim filed with surveyor photos", actor: "Policyholder App" },
        { t: "2026-09-23T08:13:40Z", msg: "AI Vision Forensics triggered EXIF timestamp anomaly", actor: "BharatShield AI Engine" },
        { t: "2026-09-24T16:00:00Z", msg: "Repudiation notice served under Section 45", actor: "Legal Head" }
      ],
      createdAt: new Date("2026-09-23T08:12:00Z"),
      updatedAt: new Date()
    },
    {
      claimId: "CLM-2026-9038",
      id: "CLM-2026-9038",
      claimNumber: "NIA-HLTH-2026-77341",
      insurer: "The New India Assurance",
      patient: {
        name: "Pooja Deshmukh",
        age: 29,
        gender: "Female",
        phone: "+91 97654 33109",
        aadhaarMasked: "XXXX-XXXX-1982",
        city: "Pune",
        state: "Maharashtra"
      },
      policy: {
        number: "NIA-IND-391823",
        plan: "Arogya Sanjeevani Standard Health",
        sumInsured: 400000,
        startDate: "2023-05-18",
        status: "ACTIVE"
      },
      hospital: {
        name: "Sahyadri Super Specialty Hospital",
        city: "Pune",
        state: "Maharashtra",
        nabhAccredited: true,
        riskRating: "LOW",
        syndicateFlag: false
      },
      treatment: {
        diagnosis: "Laparoscopic Cholecystectomy (Gallstones)",
        icd10: "K80.2",
        admissionDate: "2026-09-18",
        dischargeDate: "2026-09-20",
        lengthOfStayDays: 2,
        roomCategory: "Twin Sharing Room"
      },
      financials: {
        billedAmount: 92000,
        approvedAmount: 88500,
        disallowedAmount: 3500,
        gipsaBenchmarkTariff: 90000,
        tariffInflationPct: 2
      },
      aiForensics: {
        fraudScore: 18,
        riskLevel: "LOW",
        isolationForestScore: 0.125,
        xgbAnomalyScore: 0.142,
        lstmTemporalAnomaly: 0.110,
        deepfakeDocScore: 0.050,
        flags: [
          "Charges adhere strictly to standard NABH GIPSA PPN schedule",
          "Ultrasonography report verified with verified digital medical registry",
          "Biometric verification matched patient at admission"
        ],
        geminiSummary: "BharatShield Clinical Audit: Legitimate procedure adhering to GIPSA tariffs. Routine non-payable items (gloves, sanitizers) deducted. STP approval recommended."
      },
      status: "APPROVED",
      assignedTo: "Dr. Rekha Srinivasan",
      assignedRole: "Platform Administrator",
      timeline: [
        { t: "2026-09-19T11:00:00Z", msg: "Pre-authorization requested", actor: "Sahyadri Hospital TPA" },
        { t: "2026-09-19T11:01:20Z", msg: "Straight-Through Processing (STP) passed with low risk score 18", actor: "BharatShield AI Engine" },
        { t: "2026-09-20T17:30:00Z", msg: "Final claim approved and settled via NEFT", actor: "Auto-Settlement Bot" }
      ],
      createdAt: new Date("2026-09-18T11:00:00Z"),
      updatedAt: new Date()
    },
    {
      claimId: "CLM-2026-9037",
      id: "CLM-2026-9037",
      claimNumber: "CARE-HLTH-2026-55912",
      insurer: "Care Health Insurance",
      patient: {
        name: "Amitabh Banerjee",
        age: 55,
        gender: "Male",
        phone: "+91 98301 77412",
        aadhaarMasked: "XXXX-XXXX-5529",
        city: "Kolkata",
        state: "West Bengal"
      },
      policy: {
        number: "CARE-SUP-881290",
        plan: "Care Supreme 1 Cr Cover",
        sumInsured: 10000000,
        startDate: "2025-01-10",
        status: "ACTIVE"
      },
      hospital: {
        name: "Apollo Multispecialty Kolkata",
        city: "Kolkata",
        state: "West Bengal",
        nabhAccredited: true,
        riskRating: "MEDIUM",
        syndicateFlag: false
      },
      treatment: {
        diagnosis: "Percutaneous Coronary Intervention (Single Stent)",
        icd10: "I21.9",
        admissionDate: "2026-09-12",
        dischargeDate: "2026-09-15",
        lengthOfStayDays: 3,
        roomCategory: "Cardiac CCU"
      },
      financials: {
        billedAmount: 310000,
        approvedAmount: 260000,
        disallowedAmount: 50000,
        gipsaBenchmarkTariff: 250000,
        tariffInflationPct: 24
      },
      aiForensics: {
        fraudScore: 46,
        riskLevel: "MEDIUM",
        isolationForestScore: 0.440,
        xgbAnomalyScore: 0.472,
        lstmTemporalAnomaly: 0.390,
        deepfakeDocScore: 0.120,
        flags: [
          "Drug-Eluting Stent NPPA ceiling price cap exceeded by 18%",
          "Angiography DVD verification required for stenosis percentage validation"
        ],
        geminiSummary: "BharatShield Forensics: Procedural necessity validated by ECG. Price adjustment required for stent price compliance as per NPPA guidelines."
      },
      status: "UNDER_REVIEW",
      assignedTo: "Rajesh Nair",
      assignedRole: "Fraud Investigator",
      timeline: [
        { t: "2026-09-13T09:10:00Z", msg: "Emergency admission recorded", actor: "Apollo Hospital TPA" },
        { t: "2026-09-14T15:00:00Z", msg: "AI flagged NPPA pricing ceiling violation on stent item", actor: "BharatShield AI Engine" }
      ],
      createdAt: new Date("2026-09-12T09:10:00Z"),
      updatedAt: new Date()
    }
  ];

  await claimsCol.insertMany(initialClaims);

  // Initialize Audit Logs
  const auditCol = database.collection('audit_logs');
  await auditCol.insertMany([
    {
      timestamp: new Date("2026-10-02T16:45:00Z"),
      actor: { name: "Dr. Rekha Srinivasan", role: "Platform Administrator", roleId: "admin" },
      action: "STP_POLICY_UPDATE",
      target: "GIPSA_TARIFF_ENGINE_V4",
      details: "Updated national ICU benchmarking limits for tier-1 metropolitan hospitals",
      ipAddress: "103.21.144.92",
      dpdpCompliant: true
    },
    {
      timestamp: new Date("2026-10-02T15:30:00Z"),
      actor: { name: "Dr. Ananya Sharma", role: "Fraud Investigator", roleId: "investigator" },
      action: "SIU_ESCALATION",
      target: "CLM-2026-9041",
      details: "Referred Apex City Hospital phantom ICU billing to State Medical Council",
      ipAddress: "103.21.144.110",
      dpdpCompliant: true
    },
    {
      timestamp: new Date("2026-10-02T14:15:00Z"),
      actor: { name: "Rajesh Nair", role: "Fraud Investigator", roleId: "investigator" },
      action: "EVIDENCE_ATTACHED",
      target: "CLM-2026-9040",
      details: "Attached BharatShield Forensic OCR discrepancy report for invalid NABL barcode",
      ipAddress: "103.21.144.112",
      dpdpCompliant: true
    }
  ]);

  // Update KPI Metrics
  const kpiCol = database.collection('kpi_metrics');
  await kpiCol.updateOne(
    { metricId: "CURRENT_KPI" },
    {
      $set: {
        metricId: "CURRENT_KPI",
        totalClaimsProcessed: 142050,
        flaggedFraudCount: 3840,
        fraudAmountPrevented: "Rs. 48.6 Cr",
        preventedRatio: "8.4%",
        activeAlerts: 45,
        highRiskAlertsCount: 6,
        ensembleModelAuc: 0.997,
        liveFraudRules: 24,
        lastUpdated: new Date()
      }
    },
    { upsert: true }
  );

  console.log("[DB Seeder] Database initialized successfully with 5 enterprise claims and audit logs!");
}
