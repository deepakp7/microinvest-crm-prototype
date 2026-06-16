# MicroInvest CRM - Configurable Low-Code SvelteKit Prototype

This prototype implements a highly responsive, modern dark-themed glassmorphic dashboard representing the MicroInvest CRM client requirements.

## 🚀 Getting Started

1. **Open your terminal** and navigate to this folder:
   ```bash
   cd /Users/deepakpandiyarajan/Projects/ffg2026/prototype
   ```

2. **Install the SvelteKit and Vite dependencies**:
   ```bash
   npm install
   ```

3. **Start the local development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and visit `http://localhost:5173` (or the URL outputted by the server).

## 🛠️ Key Capabilities to Demo

1. **Role Persona Swapping**: Use the selector in the top-right header to shift between **Sales Rep**, **Relationship Manager**, **Risk & Compliance**, **Operations**, **Management Team**, or **Admin** to see metrics, widgets, and controls adjust dynamically.
2. **Low-Code Custom Fields**: Navigate to the **Low-Code Builder** (as Admin), create a new field (e.g. "Investment Duration"), and see it instantly rendered inside the **Manual Lead Form** on the Leads page.
3. **Automated Lifecycle Email Timeline**: On the **Opportunities** page, click on any deal card to open the detail view. Change its stage and notice the automated transition emails (e.g. SMTP confirmation or proposal requests) trigger and record instantly in the history stream.
4. **Operations Hub**: When a deal is marked "Won", navigate to **Loan Booking** (as Operations or Admin), configure the interest rates and terms, and click confirm. This will auto-sync with the Margill integration payload (viewable in the REST API inspector console) and write double-entry asset/cash journals into the Accounting Ledger view.
5. **Excel Synchronization**: Click the "Daily Sync Simulator" zone on the Loan Booking page to mimic importing Margill excel spreadsheets, instantly updating active portfolio values.
