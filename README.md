# Data Center Auditor MCP Server

[![smithery badge](https://smithery.ai/badge/@geese1028/datacenter-mcp)](https://smithery.ai/server/@geese1028/datacenter-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Protocol-orange.svg)](https://modelcontextprotocol.io)

A deterministic Model Context Protocol (MCP) server for mission-critical AI data centers, high-density direct-to-chip liquid cooling (NVIDIA GB200 NVL72), and Level 1–5 commissioning TDD protocols.

Powered by the first-principles engineering protocols from **[Data Center Field Guides](https://datacenterfieldguides.com)**.

---

## 🛠 Features & Available Tools

This MCP server equips AI agents with 6 deterministic engineering calculation and validation tools:

| Tool | Category | Description | Governing Standard |
| :--- | :--- | :--- | :--- |
| `verify_hydraulic_boundary` | Thermal / Fluid | Calculates required liquid coolant flow rate ($L/min$, $GPM$), mass balance, heat removal capacity, and ASHRAE liquid cooling class ($W1$–$W4$) for 132 kW NVL72 racks. | ASHRAE TC 9.9 / NVIDIA GB200 NVL72 |
| `calculate_pipe_friction_loss` | Fluid Hydraulics | Calculates Darcy-Weisbach pressure drop ($\Delta P$), pipe fluid velocity, Reynolds number ($Re$), and erosion risk thresholds ($<0.5\text{ m/s}$ settling, $>2.0\text{ m/s}$ erosion) across DN25–DN100 pipes. | Darcy-Weisbach / Swamee-Jain / ASME B31.3 |
| `audit_commissioning_script` | TDD Commissioning | Audits MOP, SOP, EOP, and IST Level 1–5 commissioning scripts against physical boundaries, Point of No Return (PONR) rules, and safety gates. | ASHRAE Guideline 0 / NFPA 70E / Uptime |
| `classify_corrosion_severity` | Environmental | Classifies whitespace atmospheric corrosion severity for Copper and Silver reactivity rates according to ANSI/ISA-71.04-2013 ($G1$, $G2$, $G3$, $GX$). | ANSI/ISA-71.04-2013 / RoHS |
| `search_field_protocols` | Ground-Truth Search | Full-text keyword and protocol search across the 69-protocol Data Center Field Guides ground truth corpus. | DCFG Field Handbook |
| `lookup_defect_code` | Audit Codes | Fast lookup for fatal commissioning flaws and defect codes (e.g. `A-01`, `A-04`, `B-02`, `B-05`). | DCFG Defect Taxonomy |

---

## 🚀 Quick Start & Installation

### Option 1: Install via Smithery (Recommended)

To automatically install for Claude Desktop:
```bash
npx -y @smithery/cli install @geese1028/datacenter-mcp --client claude
```

To automatically install for Cursor:
```bash
npx -y @smithery/cli install @geese1028/datacenter-mcp --client cursor
```

---

### Option 2: Manual Configuration for Claude Desktop

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

### Option 3: Manual Configuration for Cursor

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

## 📚 References & Documentation

* **Official Specs**: [https://datacenterfieldguides.com](https://datacenterfieldguides.com)
* **Full Protocol Index**: [https://datacenterfieldguides.com/llms.txt](https://datacenterfieldguides.com/llms.txt)
* **Unredacted Engineering Protocols**: [https://datacenterfieldguides.com/llms-full.txt](https://datacenterfieldguides.com/llms-full.txt)

## 📄 License
MIT © Tristan (Data Center Field Guides)
