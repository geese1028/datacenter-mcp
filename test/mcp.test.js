import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditCommissioningScript,
  verifyHydraulicBoundary,
  calculatePipeFrictionLoss,
  searchFieldProtocols,
  classifyCorrosionSeverity,
  lookupDefectCode,
  DEFECT_DATABASE
} from '../index.js';

test('ASHRAE Liquid Cooling Class Mapping', (t) => {
  // Test < 2°C (Below envelope)
  const below = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 1.5 });
  assert.match(below.ashraeClass, /BELOW ASHRAE ENVELOPE/i);

  // Test W1 (2 - 17°C)
  const w1_min = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 2.0 });
  assert.match(w1_min.ashraeClass, /W1 \/ W17/);
  const w1_mid = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 15.0 });
  assert.match(w1_mid.ashraeClass, /W1 \/ W17/);
  const w1_max = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 17.0 });
  assert.match(w1_max.ashraeClass, /W1 \/ W17/);

  // Test W2 (17 - 27°C)
  const w2 = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 25.0 });
  assert.match(w2.ashraeClass, /W2 \/ W27/);
  const w2_max = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 27.0 });
  assert.match(w2_max.ashraeClass, /W2 \/ W27/);

  // Test W3 (27 - 32°C)
  const w3 = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 30.0 });
  assert.match(w3.ashraeClass, /W3 \/ W32/);
  const w3_max = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 32.0 });
  assert.match(w3_max.ashraeClass, /W3 \/ W32/);

  // Test W4 (32 - 45°C)
  const w4 = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 40.0 });
  assert.match(w4.ashraeClass, /W4 \/ W45/);
  const w4_max = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 45.0 });
  assert.match(w4_max.ashraeClass, /W4 \/ W45/);

  // Test W5 / Exceeds (> 45°C)
  const w5 = verifyHydraulicBoundary({ heat_load_kw: 132, delta_t_c: 10, supply_temp_c: 48.0 });
  assert.match(w5.ashraeClass, /W5 \/ W\+/);
});

test('Commissioning Script Regex False Positives Prevention', (t) => {
  // Test benign sentence containing "checklist", "assist", "people", "barrier", "moped"
  const benignText = `
    Standard Maintenance Checklist:
    1. Confirm all technical staff and operations people are present.
    2. Inspect pedestrian safety barrier around the moped parking and generator compound.
    3. Verify warehouse lighting and clear access.
  `;
  const result = auditCommissioningScript({ script_text: benignText, commissioning_level: 'ALL' });
  assert.equal(result.isCategoryA, false);
  assert.equal(result.findings.length, 0);
  assert.match(result.verdict, /PASSED/);
});

test('Commissioning Script True Positive Detection', (t) => {
  // Test CAT-A-01: NVL72 with air load bank
  const scriptA01 = `Execute test on NVL72 rack using 120kW resistive air heaters.`;
  const resA01 = auditCommissioningScript({ script_text: scriptA01 });
  assert.equal(resA01.isCategoryA, true);
  assert.ok(resA01.findings.some(f => f.code === 'CAT-A-01'));

  // Test CAT-A-04 & CAT-B-04: MOP without PONR or back-out
  const scriptA04 = `MOP for 10kV switchgear transfer between bus A and bus B. Step 1: Open breaker. Step 2: Close tie.`;
  const resA04 = auditCommissioningScript({ script_text: scriptA04 });
  assert.equal(resA04.isCategoryA, true);
  assert.ok(resA04.findings.some(f => f.code === 'CAT-A-04'));
  assert.ok(resA04.findings.some(f => f.code === 'CAT-B-04'));

  // Test CAT-A-05: EOP with troubleshooting
  const scriptA05 = `Emergency Operating Procedure (EOP): Upon loss of primary pump, troubleshoot inverter fault code and inspect circuit board.`;
  const resA05 = auditCommissioningScript({ script_text: scriptA05 });
  assert.equal(resA05.isCategoryA, true);
  assert.ok(resA05.findings.some(f => f.code === 'CAT-A-05'));

  // Test CAT-B-02: Hydrostatic test with pressure units but no PSV
  const scriptB02 = `Perform hydrostatic pressure test on header at 10 bar for 4 hours. Record gauge pressure.`;
  const resB02 = auditCommissioningScript({ script_text: scriptB02 });
  assert.ok(resB02.findings.some(f => f.code === 'CAT-B-02'));

  // Test CAT-C-05 & CAT-B-05: IST without NTP/PTP or alarm audit
  const scriptIST = `Execute IST integrated system test for facility handover. Observe BMS overall green status.`;
  const resIST = auditCommissioningScript({ script_text: scriptIST, commissioning_level: 'L5' });
  assert.ok(resIST.findings.some(f => f.code === 'CAT-C-05'));
  assert.ok(resIST.findings.some(f => f.code === 'CAT-B-05'));
});

test('Defect Database and Lookup Completeness', (t) => {
  const expectedCodes = ['A-01', 'A-04', 'A-05', 'B-02', 'B-04', 'B-05', 'C-05'];
  
  for (const code of expectedCodes) {
    // Test direct code
    const res = lookupDefectCode({ defect_code: code });
    assert.ok(res.found, `Code ${code} must exist in database`);
    assert.equal(typeof res.found.title, 'string');
    assert.equal(typeof res.found.mandate, 'string');

    // Test with CAT- prefix
    const resPrefixed = lookupDefectCode({ defect_code: `CAT-${code}` });
    assert.ok(resPrefixed.found, `CAT-${code} must resolve`);

    // Test lowercase
    const resLower = lookupDefectCode({ defect_code: `cat-${code.toLowerCase()}` });
    assert.ok(resLower.found, `cat-${code.toLowerCase()} must resolve`);
  }

  // Test unknown code
  const unknown = lookupDefectCode({ defect_code: 'Z-99' });
  assert.equal(unknown.found, null);
  assert.match(unknown.text, /not found in quick table/i);
});

test('Corrosion Classification ANSI/ISA-71.04', (t) => {
  const g1 = classifyCorrosionSeverity({ copper_angstroms_30d: 250, silver_angstroms_30d: 150 });
  assert.equal(g1.overallLevel, 'G1');
  assert.equal(g1.isWarrantySafe, true);

  const g2 = classifyCorrosionSeverity({ copper_angstroms_30d: 450, silver_angstroms_30d: 100 });
  assert.equal(g2.overallLevel, 'G2');
  assert.equal(g2.isWarrantySafe, false);

  const gx = classifyCorrosionSeverity({ copper_angstroms_30d: 2200, silver_angstroms_30d: 150 });
  assert.equal(gx.overallLevel, 'GX');
  assert.equal(gx.isWarrantySafe, false);
});

test('Hydraulics and Pipe Sizing Darcy-Weisbach', (t) => {
  const pipeRes = calculatePipeFrictionLoss({
    flow_lpm: 162.5,
    pipe_dn: 'DN50',
    pipe_length_m: 20,
    coolant_type: 'pg25'
  });
  assert.ok(pipeRes.velocity > 1.0 && pipeRes.velocity < 2.0);
  assert.ok(pipeRes.reynolds > 4000);
  assert.ok(pipeRes.delta_p_kpa > 0);
});
