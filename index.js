#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize MCP Server
export const server = new McpServer({
  name: 'datacenter-auditor',
  version: '1.0.1'
});

// Load Protocol Catalog
const DATA_DIR = path.join(__dirname, 'data');
const PROTOCOLS_JSON = path.join(DATA_DIR, 'protocols.json');

export let protocols = [];
try {
  if (fs.existsSync(PROTOCOLS_JSON)) {
    protocols = JSON.parse(fs.readFileSync(PROTOCOLS_JSON, 'utf-8'));
  }
} catch (e) {
  // Silent fallback
}

export const DISCLAIMER = [
  `-------------------------------------------------------`,
  `⚠️  ENGINEERING SAFETY DISCLAIMER:`,
  `This calculation and audit output is provided strictly for first-principles`,
  `theoretical modeling and peer review. It does not replace stamped drawings`,
  `from a licensed Professional Engineer (PE) or OEM equipment submittals.`
].join('\n');

export const DEFECT_DATABASE = {
  'A-01': {
    title: 'Air Load Bank on Liquid Infrastructure',
    severity: 'CATEGORY A - IMMEDIATE REJECTION',
    trigger: 'Specifying resistive air heaters or air load banks for liquid-cooled NVL72 / GB200 infrastructure.',
    consequence: 'Zero verification of coolant loop delta-T, pressure drop, flow balancing, or CDU response under load.',
    mandate: 'Mandate hydraulic liquid load bank with flow balance and delta-T measurement at rack manifold.',
    standards: 'ASHRAE TC 9.9 Thermal Guidelines for Liquid Cooling'
  },
  'A-04': {
    title: 'MOP Switching Without Defined Point of No Return (PONR)',
    severity: 'CATEGORY A - IMMEDIATE REJECTION',
    trigger: 'Execution of medium-voltage, low-voltage, or chilled water switching without declaring explicit PONR.',
    consequence: 'Undefined operational state during mid-switching abort; risk of arc flash or catastrophic dual-bus outage.',
    mandate: 'Declare explicit PONR step before any irreversible switching operation begins.',
    standards: 'NFPA 70E Standard for Electrical Safety in the Workplace'
  },
  'A-05': {
    title: 'EOP With In-Band Troubleshooting',
    severity: 'CATEGORY A - IMMEDIATE REJECTION',
    trigger: 'Including diagnostic or root-cause troubleshooting steps inside an Emergency Operating Procedure.',
    consequence: 'Operator distraction during critical incident; cascading failure while trying to diagnose root cause.',
    mandate: 'Purge troubleshooting from EOP. EOP must contain ONLY deterministic state-restoration actions.',
    standards: 'Uptime Institute Operational Sustainability Standard'
  },
  'B-02': {
    title: 'Hydrostatic Test Without Independent Calibrated Relief Protection',
    severity: 'CATEGORY B - DEFICIENCY',
    trigger: 'Hydrostatic pressure test without independent calibrated pressure relief valve (PSV).',
    consequence: 'Risk of hydraulic overpressurization, flange yield, or rupture under thermal fluid expansion.',
    mandate: 'Install certified, calibrated PSV set to 1.1x test pressure before pressurization.',
    standards: 'ASME B31.3 Process Piping Code'
  },
  'B-04': {
    title: 'Missing Pre-Verified Back-Out Procedure',
    severity: 'CATEGORY B - DEFICIENCY',
    trigger: 'MOP lacks an explicit step-by-step pre-verified back-out sequence for aborting before the PONR.',
    consequence: 'Field switching technicians have no verified path to safe resting state when switching fails or stalls.',
    mandate: 'Include verified back-out steps with defined safe physical resting states.',
    standards: 'NFPA 70E / Field Guide Vol 05: Run the Day'
  },
  'B-05': {
    title: 'BMS Turnover Sign-off With Active Alarm Suppression',
    severity: 'CATEGORY B - DEFICIENCY',
    trigger: 'Signing off BMS/EPMS turnover without auditing Shelved, Out-of-Service, or Forced-Manual point lists.',
    consequence: 'Silent blind spots during commercial operation; suppressed alarms fail to notify staff of impending loss of redundancy.',
    mandate: 'Audit database points; verify zero points are forced manual or shelved before turnover sign-off.',
    standards: 'ISA-18.2 Management of Alarm Systems for the Process Industries'
  },
  'C-05': {
    title: 'Sequence-of-Events (SOE) Time Sync Unverified',
    severity: 'CATEGORY C - OBSERVATION',
    trigger: 'Script does not verify IEEE 1588 PTP or NIST NTP millisecond synchronization across protective relays, PLC, and BMS recorders.',
    consequence: 'Root cause forensics fail after multi-breaker trip; chronological order of events cannot be determined.',
    mandate: 'Add hold point verifying time sync within +/- 1ms across all event recording devices prior to IST trip tests.',
    standards: 'IEEE 1588 PTP / NIST NTP Standard'
  }
};

// -------------------------------------------------------------
// CORE AUDIT / CALCULATION LOGIC
// -------------------------------------------------------------

export function auditCommissioningScript({ script_text, commissioning_level = 'ALL' }) {
  const findings = [];
  let isCategoryA = false;

  // Check 1: Liquid vs Air Thermal Boundary (Rule 01)
  const hasLiquidTech = /\b(nvl72|gb200|liquid[- ]cooling|direct[- ]to[- ]chip)\b/i.test(script_text);
  const hasAirLoad = /\b(air[- ]load[- ]banks?|resistive[- ]heaters?|air[- ]heaters?)\b/i.test(script_text);
  const hasLiquidLoad = /\bliquid[- ]load[- ]banks?\b/i.test(script_text);

  if (hasLiquidTech && hasAirLoad && !hasLiquidLoad) {
    isCategoryA = true;
    findings.push({
      code: 'CAT-A-01',
      rule: 'Liquid vs. Air Thermal Boundary Violation (Rule 01)',
      severity: 'CATEGORY A - IMMEDIATE REJECTION',
      finding: 'Script specifies resistive air heaters or air load banks for liquid-cooled NVL72 / GB200 infrastructure without verified liquid load rejection.',
      action: 'Refuse script. Mandate hydraulic liquid load bank with flow balance, delta-T measurement, and CDU step-transient verification at rack manifold.'
    });
  }

  // Check 2: MOP Governance - Point of No Return & Back-out (Rule 04)
  const isMOP = /\b(mop|method[- ]of[- ]procedure)\b/i.test(script_text);
  if (isMOP) {
    const hasPONR = /\b(point[- ]of[- ]no[- ]return|ponr)\b/i.test(script_text);
    if (!hasPONR) {
      isCategoryA = true;
      findings.push({
        code: 'CAT-A-04',
        rule: 'State-Machine Governance Missing PONR (Rule 04)',
        severity: 'CATEGORY A - IMMEDIATE REJECTION',
        finding: 'MOP alters redundancy or performs switching without declaring an explicit Point of No Return (PONR).',
        action: 'Halt approval. Require explicit step identifying the exact physical switching action after which restoration must proceed forward rather than backward.'
      });
    }
    const hasBackout = /\b(back-?out|abort|rollback)\b/i.test(script_text);
    if (!hasBackout) {
      findings.push({
        code: 'CAT-B-04',
        rule: 'Missing Pre-Verified Back-Out Procedure (Rule 04)',
        severity: 'CATEGORY B - DEFICIENCY',
        finding: 'MOP lacks an explicit step-by-step pre-verified back-out sequence for aborting before the PONR.',
        action: 'Include verified back-out steps with defined safe physical resting states.'
      });
    }
  }

  // Check 3: EOP Troubleshooting Prohibition (Rule 04)
  const isEOP = /\b(eop|emergency[- ]operating[- ]procedure)\b/i.test(script_text);
  if (isEOP) {
    const hasTroubleshooting = /\b(troubleshoot(?:ing)?|diagnos(?:e|ing)\s+root\s+cause|inspect\s+circuit\s+board)\b/i.test(script_text);
    if (hasTroubleshooting) {
      isCategoryA = true;
      findings.push({
        code: 'CAT-A-05',
        rule: 'EOP Boundary Violation: In-Band Troubleshooting (Rule 04)',
        severity: 'CATEGORY A - IMMEDIATE REJECTION',
        finding: 'Emergency Operating Procedure contains diagnostic or troubleshooting steps during active fault stabilization.',
        action: 'Purge troubleshooting from EOP. EOP must contain ONLY deterministic state-restoration actions.'
      });
    }
  }

  // Check 4: Pressure Envelope Verification (Rule 02)
  const isPressureTest = /\b(hydrostatic|pressure[- ]test|leak[- ]check)\b/i.test(script_text);
  if (isPressureTest) {
    const hasPressureUnits = /\b(bar|psi|kpa)\b/i.test(script_text);
    if (hasPressureUnits) {
      const hasRelief = /\b(relief|psv|prv)\b/i.test(script_text);
      if (!hasRelief) {
        findings.push({
          code: 'CAT-B-02',
          rule: 'Hydrostatic Test Missing Overpressure Relief Protection (Rule 02)',
          severity: 'CATEGORY B - DEFICIENCY',
          finding: 'Pressure testing procedure does not explicitly verify calibrated pressure relief valve (PSV) installation.',
          action: 'Install certified, calibrated PSV set to 1.1x test pressure before pressurization.'
        });
      }
    }
  }

  // Check 5: BMS / Alarm Integrity & Clock Synchronization (Rule 05)
  if (commissioning_level === 'L4' || commissioning_level === 'L5' || commissioning_level === 'ALL') {
    const isTurnoverOrIST = /\b(handover|turnover|ist|integrated[- ]systems?[- ]test(?:ing)?)\b/i.test(script_text);
    if (isTurnoverOrIST) {
      const hasTimeSync = /\b(ntp|ptp|clock[- ]sync)\b/i.test(script_text);
      if (!hasTimeSync) {
        findings.push({
          code: 'CAT-C-05',
          rule: 'Sequence-of-Events (SOE) Time Sync Unverified (Rule 05)',
          severity: 'CATEGORY C - OBSERVATION',
          finding: 'Script does not verify IEEE 1588 PTP or NIST NTP millisecond synchronization across protective relays, PLC, and BMS recorders.',
          action: 'Add hold point verifying time sync within +/- 1ms across all event recording devices prior to IST trip tests.'
        });
      }
      const hasAlarmAudit = /\b(shelved|forced|out[- ]of[- ]service)\b/i.test(script_text);
      if (!hasAlarmAudit) {
        findings.push({
          code: 'CAT-B-05',
          rule: 'BMS Alarm Suppression Audit Missing (Rule 05)',
          severity: 'CATEGORY B - DEFICIENCY',
          finding: 'Script accepts overall BMS green status without querying the database for Shelved, Out-of-Service, or Forced-Manual points.',
          action: 'Audit database points; verify zero points are forced manual or shelved before turnover sign-off.'
        });
      }
    }
  }

  const verdict = isCategoryA ? 'REJECTED - CATEGORY A FATAL FLAW DETECTED' : (findings.length > 0 ? 'CONDITIONAL - DEFICIENCIES REQUIRE REVISION' : 'PASSED - DETERMINISTIC CRITERIA MET');

  const report = [
    `=======================================================`,
    `DATA CENTER AUDITOR // COMMISSIONING SCRIPT AUDIT REPORT`,
    `=======================================================`,
    `Commissioning Level : ${commissioning_level}`,
    `Audit Verdict       : ${verdict}`,
    `Total Findings      : ${findings.length}`,
    `Category A Blocker  : ${isCategoryA ? 'YES - STOP WORK MANDATED' : 'NONE'}`,
    `-------------------------------------------------------`,
    ...findings.map((f, i) => `[${i + 1}] ${f.severity}\n    Code   : ${f.code}\n    Rule   : ${f.rule}\n    Finding: ${f.finding}\n    Action : ${f.action}\n`),
    `-------------------------------------------------------`,
    `Reference Standards: ASME B31.3 | NFPA 70E | ASHRAE Guideline 0 | ANSI/ISA-71.04-2013 | ISO-8528-1`,
    `Ground Truth Protocols: https://datacenterfieldguides.com/SKILL.md`,
    DISCLAIMER
  ].join('\n');

  return { report, findings, isCategoryA, verdict };
}

export function verifyHydraulicBoundary({ heat_load_kw, delta_t_c, coolant_type = 'pg25', measured_flow_lpm, supply_temp_c }) {
  const fluidProps = {
    water: { cp: 4.18, rho: 994, name: 'Deionized / Treated Water' },
    pg25:  { cp: 3.96, rho: 1022, name: '25% Propylene Glycol (PG25)' },
    pg30:  { cp: 3.88, rho: 1028, name: '30% Propylene Glycol (PG30)' },
    eg25:  { cp: 3.85, rho: 1035, name: '25% Ethylene Glycol (EG25)' }
  };

  const prop = fluidProps[coolant_type] || fluidProps.pg25;
  const massFlow_kg_s = heat_load_kw / (prop.cp * delta_t_c);
  const volFlow_m3_s = massFlow_kg_s / prop.rho;
  const req_lpm = volFlow_m3_s * 1000 * 60;
  const req_gpm = req_lpm * 0.264172;

  const notes = [];
  let flowVerdict = 'THEORETICAL REQUIREMENT CALCULATED';
  if (measured_flow_lpm !== undefined) {
    const flowRatio = measured_flow_lpm / req_lpm;
    if (flowRatio < 0.95) {
      flowVerdict = 'DEFICIENT: MEASURED FLOW BELOW REQUIRED THERMAL REJECTION CAPACITY';
      notes.push(`CRITICAL: Measured flow (${measured_flow_lpm.toFixed(1)} LPM) is ${(100 - flowRatio * 100).toFixed(1)}% below required (${req_lpm.toFixed(1)} LPM) for ${heat_load_kw} kW at ΔT=${delta_t_c}°C.`);
    } else if (flowRatio > 1.30) {
      flowVerdict = 'EXCESSIVE FLOW: POTENTIAL EROSION & HYDRAULIC INEFFICIENCY';
      notes.push(`WARNING: Measured flow exceeds requirement by ${((flowRatio - 1) * 100).toFixed(1)}%. Check pipe fluid velocity (keep < 2.0 m/s).`);
    } else {
      flowVerdict = 'COMPLIANT: FLOW MEETS THERMAL ENVELOPE';
      notes.push(`OPTIMAL: Measured flow matches required thermal envelope within ${(Math.abs(flowRatio - 1) * 100).toFixed(1)}% tolerance.`);
    }
  }

  let ashraeClass = 'UNSPECIFIED (NO SUPPLY TEMP PROVIDED)';
  if (supply_temp_c !== undefined) {
    if (supply_temp_c < 2) {
      ashraeClass = 'BELOW ASHRAE ENVELOPE (< 2°C) - CONDENSATION & FREEZING RISK';
      notes.push(`CRITICAL: Supply coolant temperature (${supply_temp_c}°C) is below ASHRAE liquid cooling minimum envelope (2°C). Risk of whitespace condensation and freezing.`);
    } else if (supply_temp_c <= 17) {
      ashraeClass = 'W1 / W17 (2°C - 17°C, typical chilled water system)';
    } else if (supply_temp_c <= 27) {
      ashraeClass = 'W2 / W27 (17°C - 27°C, cooling tower with chiller trim or dry cooler)';
    } else if (supply_temp_c <= 32) {
      ashraeClass = 'W3 / W32 (27°C - 32°C, direct dry-cooler heat rejection / economizer)';
    } else if (supply_temp_c <= 45) {
      ashraeClass = 'W4 / W45 (32°C - 45°C, warm water / heat reuse class)';
    } else {
      ashraeClass = 'W5 / W+ (> 45°C, extreme warm water) - RISK OF HARDWARE THERMAL TRIP';
      notes.push(`CRITICAL: Supply coolant temperature (${supply_temp_c}°C) exceeds ASHRAE W4 (45°C). Requires specialized high-temperature IT equipment qualification.`);
    }
  }

  const output = [
    `=======================================================`,
    `DATA CENTER AUDITOR // HYDRAULIC & THERMAL VERIFICATION`,
    `=======================================================`,
    `Target Heat Load      : ${heat_load_kw.toFixed(1)} kW`,
    `Design Delta-T (ΔT)   : ${delta_t_c.toFixed(1)} °C`,
    `Fluid Type            : ${prop.name} (Cp = ${prop.cp} kJ/kg·K, ρ = ${prop.rho} kg/m³)`,
    `Required Mass Flow    : ${massFlow_kg_s.toFixed(3)} kg/s`,
    `Required Flow (LPM)   : ${req_lpm.toFixed(1)} LPM`,
    `Required Flow (GPM)   : ${req_gpm.toFixed(1)} GPM`,
    supply_temp_c !== undefined ? `Supply Temperature    : ${supply_temp_c.toFixed(1)} °C (${ashraeClass})` : '',
    measured_flow_lpm !== undefined ? `Measured Flow Rate    : ${measured_flow_lpm.toFixed(1)} LPM` : '',
    `Hydraulic Verdict     : ${flowVerdict}`,
    `-------------------------------------------------------`,
    ...notes.map(n => `- ${n}`),
    `-------------------------------------------------------`,
    `Field Guide Reference: https://datacenterfieldguides.com/blog/nvl72-liquid-load-bank-testing-guide`,
    DISCLAIMER
  ].filter(Boolean).join('\n');

  return { output, req_lpm, req_gpm, massFlow_kg_s, flowVerdict, ashraeClass, notes };
}

export function calculatePipeFrictionLoss({ flow_lpm, pipe_dn, pipe_length_m, coolant_type = 'pg25' }) {
  const dnMap = {
    DN25: 0.0260,
    DN32: 0.0350,
    DN40: 0.0410,
    DN50: 0.0525,
    DN65: 0.0630,
    DN80: 0.0780,
    DN100: 0.1023
  };

  const fluidProps = {
    water: { rho: 994, mu: 0.00072, name: 'Water' },
    pg25:  { rho: 1022, mu: 0.00220, name: 'PG25 (25% Propylene Glycol)' },
    pg30:  { rho: 1028, mu: 0.00280, name: 'PG30 (30% Propylene Glycol)' },
    eg25:  { rho: 1035, mu: 0.00190, name: 'EG25 (25% Ethylene Glycol)' }
  };

  const d = dnMap[pipe_dn];
  if (!d) throw new Error(`Unknown pipe diameter DN: ${pipe_dn}`);
  const fluid = fluidProps[coolant_type] || fluidProps.pg25;
  const q_m3_s = flow_lpm / (1000 * 60);
  const area = Math.PI * Math.pow(d / 2, 2);
  const velocity = q_m3_s / area;
  const reynolds = (fluid.rho * velocity * d) / fluid.mu;

  const roughness = 0.000015;
  let f;
  let flowRegime;
  if (reynolds < 2300) {
    f = 64 / Math.max(reynolds, 1);
    flowRegime = 'Laminar (Re < 2,300)';
  } else {
    flowRegime = 'Turbulent (Re >= 2,300)';
    const term1 = roughness / (3.7 * d);
    const term2 = 5.74 / Math.pow(reynolds, 0.9);
    f = 0.25 / Math.pow(Math.log10(term1 + term2), 2);
  }

  const delta_p_pa = f * (pipe_length_m / d) * (fluid.rho * Math.pow(velocity, 2) / 2);
  const delta_p_kpa = delta_p_pa / 1000;
  const delta_p_psi = delta_p_kpa * 0.145038;

  const warnings = [];
  let velocityStatus = 'OPTIMAL ENVELOPE (0.8 - 2.0 m/s)';
  if (velocity > 3.0) {
    velocityStatus = 'EXCESSIVE VELOCITY - SEVERE EROSION RISK';
    warnings.push(`CRITICAL: Velocity (${velocity.toFixed(2)} m/s) exceeds 3.0 m/s threshold. Mandatory pipe upsizing required to prevent copper tube erosion-corrosion and excessive pump head.`);
  } else if (velocity > 2.0) {
    velocityStatus = 'HIGH VELOCITY (> 2.0 m/s)';
    warnings.push(`WARNING: Fluid velocity (${velocity.toFixed(2)} m/s) is elevated. Acceptable for short jumpers, but upsizing recommended for distribution headers.`);
  } else if (velocity < 0.5) {
    velocityStatus = 'LOW VELOCITY (< 0.5 m/s)';
    warnings.push(`CAUTION: Fluid velocity (${velocity.toFixed(2)} m/s) is below 0.5 m/s. Risk of particulate sedimentation and glycol stratification.`);
  }

  const report = [
    `=======================================================`,
    `DATA CENTER AUDITOR // DARCY-WEISBACH HYDRAULIC SIZING`,
    `=======================================================`,
    `Flow Rate             : ${flow_lpm.toFixed(1)} LPM (${(flow_lpm * 0.264172).toFixed(1)} GPM)`,
    `Pipe Size             : ${pipe_dn} (Inner Diameter: ${(d * 1000).toFixed(1)} mm)`,
    `Pipe Length           : ${pipe_length_m.toFixed(1)} m`,
    `Coolant Fluid         : ${fluid.name} (ρ = ${fluid.rho} kg/m³, μ = ${fluid.mu} Pa·s)`,
    `Fluid Velocity        : ${velocity.toFixed(2)} m/s (${velocityStatus})`,
    `Reynolds Number (Re)  : ${reynolds.toFixed(0)} [${flowRegime}]`,
    `Darcy Friction Factor : ${f.toFixed(4)}`,
    `Pressure Drop (ΔP)    : ${delta_p_kpa.toFixed(2)} kPa (${delta_p_psi.toFixed(2)} psi)`,
    `-------------------------------------------------------`,
    ...(warnings.length > 0 ? warnings.map(w => `- ${w}`) : ['- Flow velocity and pressure gradient are within optimal design envelope.']),
    `-------------------------------------------------------`,
    `Governing Derivations: https://datacenterfieldguides.com/blog/01-marketing-multiples-are-not-flow`,
    DISCLAIMER
  ].join('\n');

  return { report, velocity, reynolds, delta_p_kpa, delta_p_psi, f, warnings };
}

export function searchFieldProtocols({ query }) {
  const qLower = query.toLowerCase();
  const terms = qLower.split(/\s+/).filter(t => t.length > 2);

  const matches = protocols.filter(p => {
    const haystack = (p.id + ' ' + p.topic + ' ' + p.standard + ' ' + p.summary).toLowerCase();
    return terms.some(t => haystack.includes(t));
  });

  if (matches.length === 0) {
    return {
      text: `No direct matches found for "${query}" in the active protocol index.\nBrowse all engineering protocols online at: https://datacenterfieldguides.com/SKILL.md`,
      matches: []
    };
  }

  const result = [
    `Found ${matches.length} protocol standards matching "${query}":`,
    `=======================================================`,
    ...matches.map((m) => `[${m.id}] ${m.topic} (${m.standard})\n  Formula : ${m.formula}\n  Summary : ${m.summary}\n`),
    `=======================================================`,
    `Complete unredacted chapters & field case studies: https://datacenterfieldguides.com`,
    DISCLAIMER
  ].join('\n');

  return { text: result, matches };
}

export function classifyCorrosionSeverity({ copper_angstroms_30d, silver_angstroms_30d }) {
  let cuLevel = 'G1';
  if (copper_angstroms_30d >= 2000) cuLevel = 'GX';
  else if (copper_angstroms_30d >= 1000) cuLevel = 'G3';
  else if (copper_angstroms_30d >= 300) cuLevel = 'G2';

  let agLevel = 'G1';
  if (silver_angstroms_30d >= 2000) agLevel = 'GX';
  else if (silver_angstroms_30d >= 1000) agLevel = 'G3';
  else if (silver_angstroms_30d >= 200) agLevel = 'G2';

  const rank = { G1: 1, G2: 2, G3: 3, GX: 4 };
  const overallLevel = rank[cuLevel] >= rank[agLevel] ? cuLevel : agLevel;

  const levelDescriptions = {
    G1: 'G1 (Mild) - Well-controlled environment. Mandatory for RoHS lead-free solder.',
    G2: 'G2 (Moderate) - Corrosion measurable. Solder creep corrosion risk on fine-pitch components (DIMM, PCIe sockets).',
    G3: 'G3 (Harsh) - High probability of electronic failure due to silver sulfide (Ag2S) or copper sulfide growth.',
    GX: 'GX (Severe) - Extreme environmental degradation. Rapid failure of electronics; requires immediate chemical gas-phase filtration.'
  };

  const isWarrantySafe = overallLevel === 'G1';

  const output = [
    `=======================================================`,
    `ANSI/ISA-71.04-2013 CORROSION REACTIVITY AUDIT REPORT`,
    `=======================================================`,
    `Copper (Cu) Rate     : ${copper_angstroms_30d} Å / 30 days (Classification: Level ${cuLevel})`,
    `Silver (Ag) Rate     : ${silver_angstroms_30d} Å / 30 days (Classification: Level ${agLevel})`,
    `Overall Environment  : Level ${overallLevel}`,
    `Description          : ${levelDescriptions[overallLevel]}`,
    `RoHS Compliance      : ${isWarrantySafe ? 'COMPLIANT (Meets OEM Warranty Requirements)' : 'NON-COMPLIANT (Hardware Warranty at Risk)'}`,
    `-------------------------------------------------------`,
    isWarrantySafe 
      ? 'RECOMMENDATION: Maintain positive pressurization and replace chemical filters per regular schedule.'
      : 'MANDATORY ACTION: Deploy chemical gas-phase filtration (deep-bed carbon/permanganate) immediately to bring environment under G1 (< 300 Å Cu, < 200 Å Ag).',
    `-------------------------------------------------------`,
    `Handbook Reference: https://datacenterfieldguides.com/blog/data-center-corrosion-coupon-isa-71-04-guide`,
    DISCLAIMER
  ].join('\n');

  return { output, cuLevel, agLevel, overallLevel, isWarrantySafe };
}

export function lookupDefectCode({ defect_code }) {
  const cleanCode = defect_code.toUpperCase().replace(/^CAT-/, '').trim();
  const found = DEFECT_DATABASE[cleanCode] || DEFECT_DATABASE[defect_code];

  if (!found) {
    return {
      text: `Defect code "${defect_code}" not found in quick table. Refer to the complete defect taxonomy in Volume 07: Refuse the Handover: https://datacenterfieldguides.com/SKILL.md`,
      found: null
    };
  }

  const report = [
    `=======================================================`,
    `DEFECT CODE AUDIT SHEET: ${defect_code}`,
    `=======================================================`,
    `Title       : ${found.title}`,
    `Severity    : ${found.severity}`,
    `Trigger     : ${found.trigger}`,
    `Consequence : ${found.consequence}`,
    `Mandate     : ${found.mandate}`,
    `Standards   : ${found.standards}`,
    `=======================================================`,
    DISCLAIMER
  ].join('\n');

  return { text: report, found };
}

// -------------------------------------------------------------
// MCP TOOL DEFINITIONS
// -------------------------------------------------------------

// TOOL 1: Audit Commissioning Script
server.tool(
  'audit_commissioning_script',
  'Audits a data center commissioning script (MOP, SOP, EOP, or IST Level 1-5) against deterministic physical boundary rules and safety gates.',
  {
    script_text: z.string().describe('The raw text of the MOP, SOP, EOP or commissioning script to audit'),
    commissioning_level: z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'ALL']).optional().default('ALL').describe('Commissioning level being executed (L1 Factory, L2 Quality/Receipt, L3 Component/PFT, L4 System/FPT, L5 Integrated IST)')
  },
  async ({ script_text, commissioning_level }) => {
    const { report } = auditCommissioningScript({ script_text, commissioning_level });
    return {
      content: [{ type: 'text', text: report }]
    };
  }
);

// TOOL 2: Verify Hydraulic Boundary
server.tool(
  'verify_hydraulic_boundary',
  'Calculates required coolant flow rate, mass balance, heat removal capacity, and ASHRAE Liquid Cooling Class compliance for AI compute racks (e.g., NVIDIA GB200 NVL72).',
  {
    heat_load_kw: z.number().describe('Total heat load to be rejected via liquid loop in kW (e.g. 132 for NVL72)'),
    delta_t_c: z.number().describe('Coolant temperature rise across compute cold plates in °C (e.g. 10 to 15)'),
    coolant_type: z.enum(['water', 'pg25', 'pg30', 'eg25']).optional().default('pg25').describe('Coolant fluid: water, pg25 (25% Propylene Glycol), pg30, eg25 (25% Ethylene Glycol)'),
    measured_flow_lpm: z.number().optional().describe('Actual measured coolant flow rate in Liters/Minute (optional)'),
    supply_temp_c: z.number().optional().describe('Supply coolant temperature in °C (optional)')
  },
  async ({ heat_load_kw, delta_t_c, coolant_type, measured_flow_lpm, supply_temp_c }) => {
    const { output } = verifyHydraulicBoundary({ heat_load_kw, delta_t_c, coolant_type, measured_flow_lpm, supply_temp_c });
    return {
      content: [{ type: 'text', text: output }]
    };
  }
);

// TOOL 3: Darcy-Weisbach Pipe Hydraulics & Sizing
server.tool(
  'calculate_pipe_friction_loss',
  'Calculates Darcy-Weisbach pipe friction pressure drop, flow velocity, Reynolds number, and erosion thresholds for data center liquid cooling loops.',
  {
    flow_lpm: z.number().describe('Volumetric flow rate in Liters/Minute (e.g. 162.5 LPM for NVL72 132kW)'),
    pipe_dn: z.enum(['DN25', 'DN32', 'DN40', 'DN50', 'DN65', 'DN80', 'DN100']).describe('Standard pipe nominal diameter'),
    pipe_length_m: z.number().describe('Total straight pipe length in meters'),
    coolant_type: z.enum(['water', 'pg25', 'pg30', 'eg25']).optional().default('pg25').describe('Coolant fluid type')
  },
  async ({ flow_lpm, pipe_dn, pipe_length_m, coolant_type }) => {
    const { report } = calculatePipeFrictionLoss({ flow_lpm, pipe_dn, pipe_length_m, coolant_type });
    return {
      content: [{ type: 'text', text: report }]
    };
  }
);

// TOOL 4: Search Field Protocols
server.tool(
  'search_field_protocols',
  'Searches the Data Center Field Guides engineering protocol index for rules, fatal flaw criteria, and physical boundary equations.',
  {
    query: z.string().describe('Search terms or protocol topic (e.g. "NVL72", "corrosion", "MOP", "BMS", "hydrostatic")')
  },
  async ({ query }) => {
    const { text } = searchFieldProtocols({ query });
    return {
      content: [{ type: 'text', text }]
    };
  }
);

// TOOL 5: ANSI/ISA-71.04 Corrosion Reactivity Classifier
server.tool(
  'classify_corrosion_severity',
  'Classifies data center whitespace atmospheric corrosion severity according to ANSI/ISA-71.04-2013 for Copper and Silver reactivity.',
  {
    copper_angstroms_30d: z.number().describe('Copper reactivity rate in Angstroms per 30 days (Å/30 days)'),
    silver_angstroms_30d: z.number().describe('Silver reactivity rate in Angstroms per 30 days (Å/30 days)')
  },
  async ({ copper_angstroms_30d, silver_angstroms_30d }) => {
    const { output } = classifyCorrosionSeverity({ copper_angstroms_30d, silver_angstroms_30d });
    return {
      content: [{ type: 'text', text: output }]
    };
  }
);

// TOOL 6: Defect Code Lookup
server.tool(
  'lookup_defect_code',
  'Looks up fatal commissioning flaws and defect codes (e.g. A-01, B-02, C-03) from the Data Center Field Guides audit standard.',
  {
    defect_code: z.string().describe('Defect code such as "A-01", "B-04", "CAT-A-01"')
  },
  async ({ defect_code }) => {
    const { text } = lookupDefectCode({ defect_code });
    return {
      content: [{ type: 'text', text }]
    };
  }
);

// Start server on stdio if run directly from CLI
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('index.js'))) {
  main().catch((err) => {
    console.error('Fatal MCP Server error:', err);
    process.exit(1);
  });
}
