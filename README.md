# Data Center Auditor MCP Server

[![Website](https://img.shields.io/badge/Website-datacenterfieldguides.com-00d4ff.svg)](https://datacenterfieldguides.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Protocol-orange.svg)](https://modelcontextprotocol.io)
[![Standard: ASHRAE TC 9.9](https://img.shields.io/badge/ASHRAE-TC_9.9-blue)](https://www.ashrae.org)
[![Standard: ANSI/ISA-71.04](https://img.shields.io/badge/ISA--71.04-2013-green)](https://www.isa.org)

A deterministic Model Context Protocol (MCP) server for mission-critical AI data centers, high-density direct-to-chip liquid cooling (NVIDIA GB200 NVL72), and Level 1–5 commissioning TDD protocols.

Powered by the first-principles engineering protocols from **[Data Center Field Guides](https://datacenterfieldguides.com/)** by **[Tristan Howard](https://datacenterfieldguides.com/about)**.

---

## ⚠️ Engineering Safety & Liability Disclaimer

> **IMPORTANT**: The calculation formulas, defect code lookups, and commissioning audit tools provided in this server are for **first-principles theoretical modeling, educational reference, and design review assistance only**. 
> 
> Fluid hydraulic dynamics, electrical switching (NFPA 70E), and hydrostatic pressure envelopes (ASME B31.3) in mission-critical hyperscale facilities carry severe life-safety, arc-flash, and equipment-damage risks. Output from this tool **does not substitute for stamped submittals and peer-reviewed design calculations produced by a licensed Professional Engineer (PE)** or manufacturer-certified equipment specifications.

---

## 🛠 Features & Available Tools

This MCP server equips AI agents with 6 deterministic engineering calculation and validation tools:

| Tool | Category | Description | Governing Standard |
| :--- | :--- | :--- | :--- |
| `verify_hydraulic_boundary` | Thermal / Fluid | Calculates required liquid coolant flow rate ($L/min$, $GPM$), mass balance, heat removal capacity, and ASHRAE liquid cooling class ($W1$–$W4$) for 132 kW NVL72 racks. | ASHRAE TC 9.9 / NVIDIA GB200 NVL72 |
| `calculate_pipe_friction_loss` | Fluid Hydraulics | Calculates Darcy-Weisbach pressure drop ($\Delta P$), pipe fluid velocity, Reynolds number ($Re$), and erosion risk thresholds ($<0.5\text{ m/s}$ settling, $>2.0\text{ m/s}$ erosion) across DN25–DN100 pipes. | Darcy-Weisbach / Swamee-Jain / ASME B31.3 |
| `audit_commissioning_script` | TDD Commissioning | Audits MOP, SOP, EOP, and IST Level 1–5 commissioning scripts against physical boundaries, Point of No Return (PONR) rules, and safety gates. | ASHRAE Guideline 0 / NFPA 70E / Uptime |
| `classify_corrosion_severity` | Environmental | Classifies whitespace atmospheric corrosion severity for Copper and Silver reactivity rates according to ANSI/ISA-71.04-2013 ($G1$, $G2$, $G3$, $GX$). | ANSI/ISA-71.04-2013 / RoHS |
| `search_field_protocols` | Standard Index | Structured lookup for physical boundary formulas, fatal flaw criteria, and engineering thresholds across the 69 Data Center Field Guide protocols. | DCFG Field Handbook |
| `lookup_defect_code` | Audit Codes | Fast lookup for fatal commissioning flaws and defect codes (e.g. `A-01`, `A-04`, `B-02`, `B-05`). | DCFG Defect Taxonomy |

---

## 🚀 Quick Start & Installation

### Option 1: Manual Configuration for Claude Desktop

Add the following to your `claude_desktop_config.json` (on macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "datacenter-auditor": {
      "command": "node",
      "args": ["/PATH/TO/datacenter-mcp/index.js"]
    }
  }
}
```

---

### Option 2: Manual Configuration for Cursor

Create or edit `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "datacenter-auditor": {
      "command": "node",
      "args": ["/PATH/TO/datacenter-mcp/index.js"]
    }
  }
}
```

---

## 📐 Governing Physics & Mathematical Formulations

### 1. Thermal Heat Balance
$$\dot{Q} = \dot{m} \cdot c_p \cdot \Delta T$$
Where $\dot{Q}$ is rack heat dissipation ($132\text{ kW}$ for NVL72), $\dot{m}$ is coolant mass flow, $c_p$ is fluid specific heat ($3.96\text{ kJ/kg}\cdot\text{K}$ for PG25), and $\Delta T$ is cold plate temperature delta ($10\text{ K}$–$15\text{ K}$).

### 2. Darcy-Weisbach Pressure Drop
$$\Delta P = f \cdot \frac{L}{D} \cdot \frac{\rho v^2}{2}$$
Friction factor $f$ calculated via the Swamee-Jain explicit approximation of the Colebrook-White equation for turbulent pipe flow ($Re \ge 2,300$):
$$f = \frac{0.25}{\left[\log_{10}\left(\frac{\varepsilon}{3.7D} + \frac{5.74}{Re^{0.9}}\right)\right]^2}$$

### 3. Atmospheric Reactivity Monitoring
Evaluation according to ANSI/ISA-71.04-2013 Table 1 for 30-day passive coupon exposure:
* **Level G1 (Mild)**: $\text{Cu} < 300\text{ \AA/30d}$, $\text{Ag} < 200\text{ \AA/30d}$ (Mandatory for RoHS compliance).
* **Level G2 (Moderate)**: $\text{Cu} < 1000\text{ \AA/30d}$, $\text{Ag} < 1000\text{ \AA/30d}$.
* **Level G3 (Harsh)**: $\text{Cu} < 2000\text{ \AA/30d}$, $\text{Ag} < 2000\text{ \AA/30d}$.
* **Level GX (Severe)**: $\text{Cu} \ge 2000\text{ \AA/30d}$, $\text{Ag} \ge 2000\text{ \AA/30d}$.

---

## 📚 References & Comprehensive Specifications

The complete 74-protocol engineering library, case studies, and 9-Volume field guide series are available at:
* **Official Website**: [https://datacenterfieldguides.com/](https://datacenterfieldguides.com/)
* **9-Volume Book Series**: [https://datacenterfieldguides.com/buy](https://datacenterfieldguides.com/buy) · [Amazon Author Central](https://www.amazon.com/author/tristanhoward)
* **Author Profile**: [Tristan Howard — Principal Data Center Systems Engineer & CxA](https://datacenterfieldguides.com/about)
* **AI Specification & LLM Grounding**: [`SKILL.md`](https://datacenterfieldguides.com/SKILL.md) · [`llms.txt`](https://datacenterfieldguides.com/llms.txt) · [`llms-full.txt`](https://datacenterfieldguides.com/llms-full.txt)
* **Core Governing Field Protocols**:
  * [SOP vs. MOP vs. EOP Meaning & Full Form: Data Center RACI Matrix and Field Authorization](https://datacenterfieldguides.com/blog/sop-mop-eop-matrix)
  * [SOP, MOP, and EOP Are Three Papers: Data Center Switching & Emergency Governance](https://datacenterfieldguides.com/blog/sop-mop-eop)
  * [MOP Point of No Return (PONR): LOTO Isolation, Switching Scripts & Rollback Timing](https://datacenterfieldguides.com/blog/mop-point-of-no-return)
  * [An EOP Stops at the First Safe State: Emergency Operating Procedure Boundaries](https://datacenterfieldguides.com/blog/eop-stops)
  * [NVIDIA GB200 NVL72 Liquid Cooling EOP: 5-Second Loss-of-Flow Ride-Through](https://datacenterfieldguides.com/blog/liquid-cooling-eop-nvl72)
  * [NVL72 Liquid Load Bank Testing: P&ID Hydraulics, Quick Disconnects & Boundary Acceptance](https://datacenterfieldguides.com/blog/nvl72-liquid-load-bank-testing-guide)
  * [Data Center Commissioning Levels 1 to 5 (L0–L6): 5 Levels of Commissioning, L2 Testing & IST](https://datacenterfieldguides.com/blog/commissioning-levels-0-to-6)
  * [Data Center CFD Verification Guide: Airflow Modeling vs. Physical Whitespace Measurements](https://datacenterfieldguides.com/blog/data-center-cfd-verification-guide)
  * [Carbon Media & Corrosion Coupon Analysis: ANSI/ISA-71.04-2013 Severity Rates & RoHS G1 Protection](https://datacenterfieldguides.com/blog/data-center-corrosion-coupon-isa-71-04-guide)
  * [Facility Location Due Diligence Checklist: Data Center Site Selection & Property Audit](https://datacenterfieldguides.com/blog/data-center-facility-location-due-diligence)
  * [Data Center Technical Due Diligence Checklist: Infrastructure Asset & Engineering Audit](https://datacenterfieldguides.com/blog/data-center-technical-due-diligence-checklist)
  * [A Handover Signature Is a Sentence: Commissioning L4/L5 Custody Transfer Refusal Gates](https://datacenterfieldguides.com/blog/a-signature-is-a-sentence)
  * [Witnessed Is Not the Same as Accepted a Document: Field Commissioning Verification](https://datacenterfieldguides.com/blog/witnessed-or-a-document)

## 📄 License
MIT © Tristan Howard ([Data Center Field Guides](https://datacenterfieldguides.com/))
