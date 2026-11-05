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
const server = new McpServer({
  name: 'datacenter-auditor',
  version: '1.0.0'
});

// Load Corpus from local data folder or fall back
const DATA_DIR = path.join(__dirname, 'data');
const PROTOCOLS_PATH = path.join(DATA_DIR, 'protocols.txt');
const CORPUS_PATH = path.join(DATA_DIR, 'corpus.txt');

let corpusText = '';
try {
  if (fs.existsSync(PROTOCOLS_PATH)) {
    corpusText = fs.readFileSync(PROTOCOLS_PATH, 'utf-8');
  } else if (fs.existsSync(CORPUS_PATH)) {
    corpusText = fs.readFileSync(CORPUS_PATH, 'utf-8');
  }
} catch (e) {
  // Silent fallback
}

// -------------------------------------------------------------
// TOOL 1: Audit Commissioning Script (MOP / SOP / EOP / IST)
// -------------------------------------------------------------
server.tool(
  'audit_commissioning_script',
  'Audits a data center commissioning script (MOP, SOP, EOP, or IST Level 1-5) against deterministic physical boundary rules and safety gates.',
  {
    script_text: z.string().describe('The raw text of the MOP, SOP, EOP or commissioning script to audit'),
    commissioning_level: z.enum(['L1', 'L2', 'L3', 'L4', 'L5', 'ALL']).optional().default('ALL').describe('Commissioning level being executed (L1 Factory, L2 Quality/Receipt, L3 Component/PFT, L4 System/FPT, L5 Integrated IST)')
  },
  async ({ script_text, commissioning_level }) => {
    const textLower = script_text.toLowerCase();
    const findings = [];
    let isCategoryA = false;

    // Check 1: Liquid vs Air Thermal Boundary (Rule 01)
    if (
      (textLower.includes('nvl72') || textLower.includes('gb200') || textLower.includes('liquid cooling') || textLower.includes('direct-to-chip')) &&
      (textLower.includes('air heater') || textLower.includes('resistive heater') || textLower.includes('air load bank')) &&
      !textLower.includes('liquid load bank')
    ) {
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
    if (textLower.includes('mop') || textLower.includes('method of procedure')) {
      if (!textLower.includes('point of no return') && !textLower.includes('ponr')) {
        isCategoryA = true;
        findings.push({
          code: 'CAT-A-04',
          rule: 'State-Machine Governance Missing PONR (Rule 04)',
          severity: 'CATEGORY A - IMMEDIATE REJECTION',
          finding: 'MOP alters redundancy or performs switching without declaring an explicit Point of No Return (PONR).',
          action: 'Halt approval. Require explicit step identifying the exact physical switching action after which restoration must proceed forward rather than backward.'
        });
      }
      if (!textLower.includes('back-out') && !textLower.includes('backout') && !textLower.includes('abort') && !textLower.includes('rollback')) {
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
    if (textLower.includes('eop') || textLower.includes('emergency operating procedure')) {
      if (textLower.includes('troubleshoot') || textLower.includes('diagnose root cause') || textLower.includes('inspect circuit board')) {
        isCategoryA = true;
        findings.push({
          code: 'CAT-A-05',
          rule: 'EOP Boundary Violation: In-Band Troubleshooting (Rule 04)',
          severity: 'CATEGORY A - IMMEDIATE REJECTION',
          finding: 'Emergency Operating Procedure contains diagnostic or troubleshooting steps during active fault stabilization.',
          action: 'Purge troubleshooting from EOP. EOP must contain ONLY deterministic state-restoration and isolation actions.'
        });
      }
    }

    // Check 4: Pressure Envelope Verification (Rule 02)
    if (textLower.includes('hydrostatic') || textLower.includes('pressure test') || textLower.includes('leak check')) {
      if (textLower.includes('bar') || textLower.includes('psi') || textLower.includes('kpa')) {
        if (!textLower.includes('relief') && !textLower.includes('psv') && !textLower.includes('prv')) {
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
      if (textLower.includes('handover') || textLower.includes('turnover') || textLower.includes('ist')) {
        if (!textLower.includes('ntp') && !textLower.includes('ptp') && !textLower.includes('clock sync')) {
          findings.push({
            code: 'CAT-C-05',
            rule: 'Sequence-of-Events (SOE) Time Sync Unverified (Rule 05)',
            severity: 'CATEGORY C - OBSERVATION',
            finding: 'Script does not verify IEEE 1588 PTP or NIST NTP millisecond synchronization across protective relays, PLC, and BMS recorders.',
            action: 'Add hold point verifying time sync within +/- 1ms across all event recording devices prior to IST trip tests.'
          });
        }
        if (!textLower.includes('shelved') && !textLower.includes('forced') && !textLower.includes('out-of-service')) {
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
      `Ground Truth Corpus: https://datacenterfieldguides.com/SKILL.md`
    ].join('\n');

    return {
      content: [{ type: 'text', text: report }]
    };
  }
);

// -------------------------------------------------------------
// TOOL 2: Verify Hydraulic Boundary (NVL72 Liquid Cooling)
// -------------------------------------------------------------
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
      if (supply_temp_c <= 17) ashraeClass = 'W1 (Sub-ambient, risk of whitespace condensation)';
      else if (supply_temp_c <= 27) ashraeClass = 'W1 (17°C - 27°C, typical chiller-assisted)';
      else if (supply_temp_c <= 32) ashraeClass = 'W2 (27°C - 32°C, dry cooler with chiller trim)';
      else if (supply_temp_c <= 40) ashraeClass = 'W3 (32°C - 40°C, direct dry-cooler heat rejection)';
      else if (supply_temp_c <= 45) ashraeClass = 'W4 (40°C - 45°C, warm water / heat reuse class)';
      else {
        ashraeClass = 'EXCEEDS ASHRAE W4 (> 45°C) - RISK OF HARDWARE THERMAL TRIP';
        notes.push(`CRITICAL: Supply coolant temperature (${supply_temp_c}°C) exceeds ASHRAE W4 maximum allowable threshold.`);
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
      `Reference: ASHRAE TC 9.9 Thermal Guidelines for Liquid Cooling | NVIDIA GB200 NVL72 Spec`
    ].filter(Boolean).join('\n');

    return {
      content: [{ type: 'text', text: output }]
    };
  }
);

// -------------------------------------------------------------
// TOOL 3: Darcy-Weisbach Pipe Hydraulics & Sizing
// -------------------------------------------------------------
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
    // Nominal to inner diameter in meters
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
    const fluid = fluidProps[coolant_type] || fluidProps.pg25;

    // Conversions
    const q_m3_s = flow_lpm / (1000 * 60);
    const area = Math.PI * Math.pow(d / 2, 2);
    const velocity = q_m3_s / area;

    // Reynolds number: Re = (rho * v * D) / mu
    const reynolds = (fluid.rho * velocity * d) / fluid.mu;

    // Friction factor (f)
    // Swamee-Jain formula for smooth commercial pipe (roughness e = 0.000015 m)
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

    // Darcy-Weisbach: delta_P = f * (L/D) * (rho * v^2 / 2) (in Pascals)
    const delta_p_pa = f * (pipe_length_m / d) * (fluid.rho * Math.pow(velocity, 2) / 2);
    const delta_p_kpa = delta_p_pa / 1000;
    const delta_p_psi = delta_p_kpa * 0.145038;

    // Velocity limits evaluation
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
      `Governing Equations: Darcy-Weisbach ΔP = f·(L/D)·(ρv²/2) | Swamee-Jain Friction Factor`
    ].join('\n');

    return {
      content: [{ type: 'text', text: report }]
    };
  }
);

// -------------------------------------------------------------
// TOOL 4: Search Field Protocols (69-Protocol Ground-Truth)
// -------------------------------------------------------------
server.tool(
  'search_field_protocols',
  'Searches the Data Center Field Guides ground-truth corpus for commissioning procedures, fatal flaw criteria, and engineering formulas.',
  {
    query: z.string().describe('Search terms or protocol topic (e.g. "NVL72 manifold", "corrosion coupon", "MOP switching", "Level 4 commissioning", "substation TDD")')
  },
  async ({ query }) => {
    if (!corpusText) {
      return {
        content: [{ type: 'text', text: `Search offline. Ground truth reference available online at https://datacenterfieldguides.com/llms-full.txt` }]
      };
    }

    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const paragraphs = corpusText.split(/\n\n+/);
    
    const matches = [];
    for (const para of paragraphs) {
      const lower = para.toLowerCase();
      let matchCount = 0;
      for (const t of terms) {
        if (lower.includes(t)) matchCount++;
      }
      if (matchCount > 0) {
        matches.push({ score: matchCount, text: para.trim() });
      }
    }

    matches.sort((a, b) => b.score - a.score);
    const topMatches = matches.slice(0, 3);

    if (topMatches.length === 0) {
      return {
        content: [{ type: 'text', text: `No direct matches found for "${query}" in the 69-protocol corpus.\nBrowse the full index at: https://datacenterfieldguides.com/llms.txt` }]
      };
    }

    const result = [
      `Found ${matches.length} matches for "${query}" in Data Center Field Guides Ground Truth:`,
      `=======================================================`,
      ...topMatches.map((m, i) => `[MATCH ${i + 1} // RELEVANCE SCORE: ${m.score}]\n${m.text}\n`),
      `=======================================================`,
      `Full unredacted protocol access: https://datacenterfieldguides.com/llms-full.txt`
    ].join('\n');

    return {
      content: [{ type: 'text', text: result }]
    };
  }
);

// -------------------------------------------------------------
// TOOL 5: ANSI/ISA-71.04 Corrosion Reactivity Classifier
// -------------------------------------------------------------
server.tool(
  'classify_corrosion_severity',
  'Classifies data center whitespace atmospheric corrosion severity according to ANSI/ISA-71.04-2013 for Copper and Silver reactivity.',
  {
    copper_angstroms_30d: z.number().describe('Copper reactivity rate in Angstroms per 30 days (Å/30 days)'),
    silver_angstroms_30d: z.number().describe('Silver reactivity rate in Angstroms per 30 days (Å/30 days)')
  },
  async ({ copper_angstroms_30d, silver_angstroms_30d }) => {
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
      `Reference: ANSI/ISA-71.04-2013 | Volume 08: Judge a Corrosion Coupon`
    ].join('\n');

    return {
      content: [{ type: 'text', text: output }]
    };
  }
);

// -------------------------------------------------------------
// TOOL 6: Defect Code Lookup
// -------------------------------------------------------------
server.tool(
  'lookup_defect_code',
  'Looks up fatal commissioning flaws and defect codes (e.g. A-01, B-02, C-03) from the Data Center Field Guides audit standard.',
  {
    defect_code: z.string().describe('Defect code such as "A-01", "B-04", "CAT-A-01"')
  },
  async ({ defect_code }) => {
    const defectDatabase = {
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
      'B-05': {
        title: 'BMS Turnover Sign-off With Active Alarm Suppression',
        severity: 'CATEGORY B - DEFICIENCY',
        trigger: 'Signing off BMS/EPMS turnover without auditing Shelved, Out-of-Service, or Forced-Manual point lists.',
        consequence: 'Silent blind spots during commercial operation; suppressed alarms fail to notify staff of impending loss of redundancy.',
        mandate: 'Audit database points; verify zero points are forced manual or shelved before turnover sign-off.',
        standards: 'ISA-18.2 Management of Alarm Systems for the Process Industries'
      }
    };

    const cleanCode = defect_code.toUpperCase().replace(/^CAT-/, '');
    const found = defectDatabase[cleanCode] || defectDatabase[defect_code];

    if (!found) {
      return {
        content: [{
          type: 'text',
          text: `Defect code "${defect_code}" not found in quick table. Refer to the complete defect taxonomy in Volume 07: Refuse the Handover and SKILL.md: https://datacenterfieldguides.com/SKILL.md`
        }]
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
      `=======================================================`
    ].join('\n');

    return {
      content: [{ type: 'text', text: report }]
    };
  }
);

// Start server on stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal MCP Server error:', err);
  process.exit(1);
});
