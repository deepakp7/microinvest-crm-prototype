<script>
  import { opportunities, loans, auditLogs, addAuditLog, userRole } from '$lib/store.js';

  let selectedOppId = '';
  let customLoanId = '';
  let interestRate = '5.50%';
  let termMonths = 60;
  let statusMsg = '';
  let apiLogs = [];
  let ledgerLogs = [];

  // Servicing simulation variables
  let selectedLoanId = '';
  $: selectedLoan = $loans.find(l => l.loanId === selectedLoanId);

  // Initialize dynamic servicing values on existing loans
  $: {
    $loans.forEach(l => {
      if (l.remainingBalance === undefined) {
        l.remainingBalance = l.amount;
      }
      if (l.nextPaymentNum === undefined) {
        l.nextPaymentNum = 1;
      }
    });
  }

  // excel sync simulation properties
  let isDragging = false;
  let excelSyncResults = null;

  // Filter won opportunities that aren't booked yet
  $: pendingBookings = $opportunities.filter(o => o.stage === 'won' && !o.booked);
  
  // Auto-generate Margill ID preview when selected opportunity changes
  $: {
    if (selectedOppId && !customLoanId) {
      customLoanId = 'LN-2026-00' + Math.floor(40 + Math.random() * 60);
    }
  }

  // Helper to calculate amortization parameters
  function calculatePMT(principal, annualRate, term) {
    const monthlyRate = parseFloat(annualRate) / 100 / 12;
    if (monthlyRate === 0) return principal / term;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
  }

  function generateSchedule(principal, annualRate, term) {
    const schedule = [];
    const monthlyRate = parseFloat(annualRate) / 100 / 12;
    const monthlyPayment = calculatePMT(principal, annualRate, term);
    let balance = principal;

    for (let i = 1; i <= term; i++) {
      const interest = balance * monthlyRate;
      const principalPaid = monthlyPayment - interest;
      const endingBalance = balance - principalPaid;

      schedule.push({
        num: i,
        beginning: balance,
        payment: monthlyPayment,
        interest,
        principalPaid,
        ending: Math.max(0, endingBalance)
      });
      balance = endingBalance;
      if (balance <= 0) break;
    }
    return schedule;
  }

  function executeBooking() {
    if (!selectedOppId) return;

    const opp = $opportunities.find(o => o.id === selectedOppId);
    if (!opp) return;

    const newLoan = {
      id: 'loan-' + Math.random().toString(36).substr(2, 9),
      opportunityId: opp.id,
      companyName: opp.companyName,
      loanId: customLoanId,
      facility: opp.investmentFacility,
      amount: opp.dealSize,
      esgRating: opp.esgRating,
      status: 'Disbursed',
      bookedAt: new Date().toISOString(),
      interestRate,
      termMonths,
      remainingBalance: opp.dealSize,
      nextPaymentNum: 1
    };

    // 1. Add to loans list
    loans.update(current => [...current, newLoan]);

    // 2. Mark opportunity as booked
    opportunities.update(list => 
      list.map(o => o.id === opp.id ? { ...o, booked: true, loanId: customLoanId } : o)
    );

    // 3. Generate Simulated API Payload logs
    const apiPayload = {
      event: 'LOAN_BOOKING_SYNC',
      system: 'Margill Integration Service',
      timestamp: new Date().toISOString(),
      payload: {
        margill_loan_id: customLoanId,
        borrower_entity: opp.companyName,
        contract_amount: opp.dealSize,
        annual_rate: interestRate,
        amortization_period_months: termMonths,
        esg_impact_rating: opp.esgRating || 'N/A'
      }
    };
    apiLogs = [apiPayload, ...apiLogs];

    // 4. Generate Double-entry accounting entries (Disbursement)
    const dateStr = new Date().toLocaleDateString();
    const debitsCredits = [
      { date: dateStr, desc: `Disburse ${customLoanId}`, acctCode: '1200-Asset', acctName: 'Loans Receivable (Assets)', type: 'DR', amount: opp.dealSize },
      { date: dateStr, desc: `Disburse ${customLoanId}`, acctCode: '1010-Asset', acctName: 'Operational Checking Cash', type: 'CR', amount: opp.dealSize },
      { date: dateStr, desc: `Disburse ${customLoanId}`, acctCode: '3100-Equity', acctName: 'Facility Capital Reserves (Allocated)', type: 'DR', amount: opp.dealSize * 0.1 },
      { date: dateStr, desc: `Disburse ${customLoanId}`, acctCode: '3200-Equity', acctName: 'Facility Unallocated Funds', type: 'CR', amount: opp.dealSize * 0.1 }
    ];
    ledgerLogs = [...debitsCredits, ...ledgerLogs];

    // 5. Audit logs
    addAuditLog($userRole, `Booked Loan "${opp.companyName}" (Margill ID: ${customLoanId}, Amount: £${opp.dealSize.toLocaleString()})`);
    addAuditLog($userRole, `Ledger records committed to double-entry journals for ${opp.companyName}.`);

    statusMsg = `✅ Successfully booked Loan: ${customLoanId} for ${opp.companyName}!`;
    
    // Select the newly booked loan to show its servicing panel
    selectedLoanId = customLoanId;

    // Reset inputs
    selectedOppId = '';
    customLoanId = '';
    interestRate = '5.50%';
    termMonths = 60;

    setTimeout(() => { statusMsg = ''; }, 5000);
  }

  function postPayment() {
    if (!selectedLoan) return;

    const sched = generateSchedule(selectedLoan.amount, selectedLoan.interestRate, selectedLoan.termMonths);
    const payNum = selectedLoan.nextPaymentNum || 1;
    const currentPeriod = sched.find(s => s.num === payNum);

    if (!currentPeriod) {
      statusMsg = '⚠️ This loan is already fully paid!';
      setTimeout(() => { statusMsg = ''; }, 3000);
      return;
    }

    const dateStr = new Date().toLocaleDateString();
    
    // Create payment transaction journal logs
    const transactionJournals = [
      { date: dateStr, desc: `Pmt #${payNum} ${selectedLoan.loanId}`, acctCode: '1010-Asset', acctName: 'Operational Checking Cash', type: 'DR', amount: currentPeriod.payment },
      { date: dateStr, desc: `Pmt #${payNum} ${selectedLoan.loanId}`, acctCode: '1200-Asset', acctName: 'Loans Receivable (Assets)', type: 'CR', amount: currentPeriod.principalPaid },
      { date: dateStr, desc: `Pmt #${payNum} ${selectedLoan.loanId}`, acctCode: '4100-Revenue', acctName: 'Interest Revenue', type: 'CR', amount: currentPeriod.interest }
    ];

    // Update loan state in store
    loans.update(currentList => 
      currentList.map(l => {
        if (l.loanId === selectedLoan.loanId) {
          return {
            ...l,
            remainingBalance: currentPeriod.ending,
            nextPaymentNum: payNum + 1,
            status: currentPeriod.ending <= 0.01 ? 'Fully Paid' : 'Active'
          };
        }
        return l;
      })
    );

    ledgerLogs = [...transactionJournals, ...ledgerLogs];
    addAuditLog($userRole, `Processed payment #${payNum} for ${selectedLoan.companyName} (£${currentPeriod.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})})`);
    
    statusMsg = `💸 Posted payment #${payNum} for ${selectedLoan.companyName}: £${currentPeriod.payment.toLocaleString(undefined, {maximumFractionDigits:2})}`;
    setTimeout(() => { statusMsg = ''; }, 4000);
  }

  function simulateExcelDrop() {
    isDragging = false;
    
    excelSyncResults = {
      filename: 'Margill_04-26_Month_end_Report_Cleaned.xlsx',
      syncedRows: 3,
      totalHoldingsUpdated: '£9,820,000',
      timestamp: new Date().toLocaleTimeString()
    };

    addAuditLog($userRole, `Excel Daily Sync completed. Sync file "Margill_04-26_Month_end_Report_Cleaned.xlsx" processed. 3 entries reconciled.`);
  }
</script>

<div class="loans-page">
  <div class="header-container">
    <div class="title-section">
      <span class="badge-tag">OPERATIONS</span>
      <h1>Loan Booking & Servicing</h1>
      <p class="description">Review approved deals, sync schemas to the Margill portfolio management API, and confirm double-entry accounting ledger entries.</p>
    </div>
    {#if statusMsg}
      <div class="toast-alert">{statusMsg}</div>
    {/if}
  </div>

  {#if $userRole !== 'Operations' && $userRole !== 'Admin' && $userRole !== 'Management Team'}
    <div class="restricted-warning glass-card">
      <span class="warning-icon">⚠️</span>
      <div class="warning-text">
        <h3>Role Restricted View</h3>
        <p>Operations and Admin credentials are required to book active loans and execute API syncing. Current role is: <strong>{$userRole}</strong>. Swapping role in top panel recommended for testing.</p>
      </div>
    </div>
  {/if}

  <div class="ops-layout" class:read-only={$userRole !== 'Operations' && $userRole !== 'Admin' && $userRole !== 'Management Team'}>
    
    <!-- Top Row: Booking Engine & excel Sync -->
    <div class="grid-2col">
      
      <!-- Booking Engine -->
      <div class="glass-card">
        <div class="card-header">
          <h2>Margill Booking Engine</h2>
          <p>Commit Won opportunities to Margill loan servicing databases.</p>
        </div>

        {#if pendingBookings.length === 0}
          <div class="no-bookings-box">
            <span class="box-icon">🎉</span>
            <p>All won deals are booked. To simulate, promote active leads in the Leads panel, drag them to "Won" in the Kanban board, and return here.</p>
          </div>
        {:else}
          <form on:submit|preventDefault={executeBooking} class="ops-form">
            <div class="form-group">
              <label for="oppSelect">Select Approved Deal</label>
              <select id="oppSelect" bind:value={selectedOppId} required>
                <option value="">-- Choose a Won Opportunity --</option>
                {#each pendingBookings as opp}
                  <option value={opp.id}>{opp.companyName} (£{opp.dealSize.toLocaleString()})</option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label for="margillId">Margill System Loan ID</label>
              <input type="text" id="margillId" bind:value={customLoanId} placeholder="e.g. LN-2026-0045" required />
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="rate">Interest Rate</label>
                <input type="text" id="rate" bind:value={interestRate} required />
              </div>
              <div class="form-group">
                <label for="term">Term (Months)</label>
                <input type="number" id="term" bind:value={termMonths} required />
              </div>
            </div>

            <button type="submit" class="btn-primary w-full">Confirm Booking & Sync API</button>
          </form>
        {/if}
      </div>

      <!-- Excel daily sync -->
      <div class="glass-card flex-col">
        <div class="card-header">
          <h2>Daily Sync Simulator</h2>
          <p>Sync portfolios using spreadsheets uploaded by external managers.</p>
        </div>

        <div 
          class="drag-drop-zone" 
          class:dragging={isDragging}
          on:dragover|preventDefault={() => isDragging = true}
          on:dragleave={() => isDragging = false}
          on:drop|preventDefault={simulateExcelDrop}
          on:click={simulateExcelDrop}
        >
          <div class="drop-icon">📊</div>
          <h3>Drag Excel sheets or Click to Upload</h3>
          <p>Supports Margill / Ledger Excel extracts</p>
          <span class="file-hint">Simulate dropping: Margill_04-26_Month_end_Report_Cleaned.xlsx</span>
        </div>

        {#if excelSyncResults}
          <div class="sync-results fade-in">
            <h4>Reconciliation Summary:</h4>
            <div class="res-row">
              <span class="res-lbl">File:</span>
              <span class="res-val mono">{excelSyncResults.filename}</span>
            </div>
            <div class="res-row">
              <span class="res-lbl">Holdings Updated:</span>
              <span class="res-val green">{excelSyncResults.syncedRows} accounts ({excelSyncResults.totalHoldingsUpdated})</span>
            </div>
            <div class="res-row">
              <span class="res-lbl">Sync Completed:</span>
              <span class="res-val">{excelSyncResults.timestamp}</span>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Active Loan Bookings -->
    <div class="glass-card active-bookings-card">
      <div class="card-header">
        <h2>Servicing Loan Ledger Book</h2>
        <p>Active disbursements tracked in system. <strong>Click a card to select and simulate loan processing payments.</strong></p>
      </div>

      <div class="loans-grid">
        {#each $loans as loan}
          <div class="loan-card" class:selected={selectedLoanId === loan.loanId} on:click={() => selectedLoanId = loan.loanId}>
            <div class="loan-card-top">
              <span class="loan-co">{loan.companyName}</span>
              <span class="loan-status" class:paid={loan.status === 'Fully Paid'}>{loan.status}</span>
            </div>
            <div class="loan-id-row">
              <span class="lbl">Loan ID:</span>
              <span class="val mono">{loan.loanId}</span>
            </div>
            <div class="loan-meta-grid">
              <div>
                <span class="lbl">Principal Amt:</span>
                <span class="val bold">£{loan.amount.toLocaleString()}</span>
              </div>
              <div>
                <span class="lbl">Interest Rate:</span>
                <span class="val">{loan.interestRate}</span>
              </div>
              <div>
                <span class="lbl">Remaining Bal:</span>
                <span class="val green bold">£{(loan.remainingBalance ?? loan.amount).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
              </div>
              <div>
                <span class="lbl">Next Payment:</span>
                <span class="val">Pmt #{loan.nextPaymentNum ?? 1}</span>
              </div>
            </div>
            <div class="loan-footer">
              <span class="lbl">Amortization Term:</span>
              <span class="val">{loan.termMonths} months</span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Amortization & Servicing Simulator Section (renders when a loan is selected) -->
    {#if selectedLoan}
      <div class="glass-card servicing-simulator-card fade-in">
        <div class="servicing-header-row">
          <div class="card-header">
            <h2>Amortization & Servicing Simulator: {selectedLoan.companyName} ({selectedLoan.loanId})</h2>
            <p>Calculate amortization matrices and post scheduled payments to checking ledger journals in real time.</p>
          </div>

          <div class="servicing-actions">
            <button class="btn-primary" on:click={postPayment} disabled={selectedLoan.status === 'Fully Paid'}>
                            💸 Post Payment #{selectedLoan.nextPaymentNum || 1} (£{calculatePMT(selectedLoan.amount, selectedLoan.interestRate, selectedLoan.termMonths).toLocaleString(undefined, {maximumFractionDigits: 2})})
            </button>
          </div>
        </div>

        <div class="servicing-grid">
          <!-- Amortization stats summary -->
          <div class="servicing-stats">
            <div class="stat-box">
              <span class="stat-lbl">Contract Principal</span>
              <span class="stat-val">£{selectedLoan.amount.toLocaleString()}</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Calculated Monthly PMT</span>
              <span class="stat-val blue">£{calculatePMT(selectedLoan.amount, selectedLoan.interestRate, selectedLoan.termMonths).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Outstanding Balance</span>
              <span class="stat-val green">£{(selectedLoan.remainingBalance ?? selectedLoan.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Progress Period</span>
              <span class="stat-val">Month {(selectedLoan.nextPaymentNum || 1) - 1} / {selectedLoan.termMonths}</span>
            </div>
          </div>

          <!-- Amortization schedule table -->
          <div class="schedule-table-wrapper">
            <table class="schedule-table">
              <thead>
                <tr>
                  <th>Pmt #</th>
                  <th>Beginning Bal</th>
                  <th>Total Payment</th>
                  <th>Principal Paid</th>
                  <th>Interest Component</th>
                  <th>Ending Bal</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each generateSchedule(selectedLoan.amount, selectedLoan.interestRate, selectedLoan.termMonths) as row}
                  <tr class="sched-row" class:processed={row.num < (selectedLoan.nextPaymentNum || 1)} class:current-pmt={row.num === (selectedLoan.nextPaymentNum || 1)}>
                    <td>{row.num}</td>
                    <td class="mono">£{row.beginning.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td class="mono font-bold">£{row.payment.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td class="mono text-green">£{row.principalPaid.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td class="mono text-orange">£{row.interest.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td class="mono">£{row.ending.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td>
                      {#if row.num < (selectedLoan.nextPaymentNum || 1)}
                        <span class="tag-processed">Paid ✓</span>
                      {:else if row.num === (selectedLoan.nextPaymentNum || 1)}
                        <span class="tag-current">Pending</span>
                      {:else}
                        <span class="tag-future">Scheduled</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}

    <!-- Middle Row: REST API JSON payload vs Ledger Double-Entry journal logs -->
    <div class="grid-2col">
      <!-- API logs -->
      <div class="glass-card code-card">
        <div class="card-header">
          <h3>🔌 API Webhook Payload Inspector</h3>
          <p>Real-time POST body sent to Margill integration endpoints.</p>
        </div>
        <div class="console-box">
          {#each apiLogs as log}
            <pre class="json-code"><code>{JSON.stringify(log, null, 2)}</code></pre>
          {:else}
            <div class="empty-code-console">No API logs yet. Perform a loan booking above to view.</div>
          {/each}
        </div>
      </div>

      <!-- Ledger logs -->
      <div class="glass-card ledger-card">
        <div class="card-header">
          <h3>📖 Double-Entry Accounting Ledger</h3>
          <p>Committed journals matching portfolio allocations and payment receipts.</p>
        </div>
        
        <div class="ledger-box">
          {#if ledgerLogs.length > 0}
            <table class="ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Acct Code</th>
                  <th>Account Name</th>
                  <th>DR/CR</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {#each ledgerLogs as entry}
                  <tr class="ledger-row" class:credit={entry.type === 'CR'}>
                    <td>{entry.date}</td>
                    <td class="desc-cell">{entry.desc || 'Journal Entry'}</td>
                    <td class="mono">{entry.acctCode}</td>
                    <td>{entry.acctName}</td>
                    <td class="bold">{entry.type}</td>
                    <td class="mono numeric-ledger">£{entry.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <div class="empty-code-console">No double-entry journals committed yet.</div>
          {/if}
        </div>
      </div>
    </div>

  </div>
</div>

<style>
  .loans-page {
    animation: fadeIn 0.4s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
  }

  .badge-tag {
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-blue);
    background: rgba(51, 153, 255, 0.1);
    border: 1px solid rgba(51, 153, 255, 0.2);
    padding: 3px 8px;
    border-radius: 4px;
    letter-spacing: 1px;
    text-transform: uppercase;
    display: inline-block;
    margin-bottom: 8px;
  }

  h1 {
    font-size: 28px;
    font-weight: 800;
    margin-bottom: 6px;
    background: linear-gradient(120deg, var(--text-primary) 70%, var(--accent-blue));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .description {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .toast-alert {
    background: rgba(51, 153, 255, 0.15);
    border: 1px solid rgba(51, 153, 255, 0.3);
    color: var(--text-primary);
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes slideIn {
    from { transform: translateX(30px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .restricted-warning {
    display: flex;
    align-items: center;
    gap: 16px;
    border-color: rgba(231, 76, 60, 0.25);
    background: rgba(231, 76, 60, 0.04);
    margin-bottom: 24px;
  }

  .warning-icon {
    font-size: 32px;
  }

  .warning-text h3 {
    font-size: 15px;
    color: var(--accent-red);
    margin-bottom: 4px;
  }

  .warning-text p {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .ops-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .ops-layout.read-only {
    pointer-events: none;
    opacity: 0.75;
  }

  .grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .card-header {
    margin-bottom: 20px;
  }

  .card-header h2, .card-header h3 {
    font-size: 18px;
    margin-bottom: 4px;
  }

  .card-header p {
    font-size: 12px;
    color: var(--text-secondary);
  }

  /* Booking engine box */
  .no-bookings-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    background: rgba(255,255,255,0.01);
  }

  .box-icon {
    font-size: 36px;
    margin-bottom: 12px;
  }

  .no-bookings-box p {
    font-size: 13px;
    color: var(--text-secondary);
    max-width: 320px;
    line-height: 1.5;
  }

  .ops-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .ops-form select, .ops-form input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-primary);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .w-full {
    width: 100%;
    margin-top: 8px;
  }

  /* Drag Drop zone */
  .flex-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .drag-drop-zone {
    flex: 1;
    border: 2px dashed rgba(51, 153, 255, 0.2);
    background: rgba(51, 153, 255, 0.01);
    border-radius: var(--border-radius);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px;
    text-align: center;
    cursor: pointer;
    transition: var(--transition-smooth);
    min-height: 180px;
  }

  .drag-drop-zone:hover, .drag-drop-zone.dragging {
    border-color: var(--accent-blue);
    background: rgba(51, 153, 255, 0.04);
  }

  .drop-icon {
    font-size: 36px;
    margin-bottom: 12px;
  }

  .drag-drop-zone h3 {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .drag-drop-zone p {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 10px;
  }

  .file-hint {
    font-size: 10px;
    background: rgba(255,255,255,0.06);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: var(--font-code);
    color: var(--text-muted);
  }

  .sync-results {
    background: rgba(46, 204, 113, 0.05);
    border: 1px solid rgba(46, 204, 113, 0.2);
    border-radius: 8px;
    padding: 12px;
    margin-top: 14px;
  }

  .sync-results h4 {
    font-size: 12px;
    color: var(--accent-green);
    margin-bottom: 8px;
  }

  .res-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    margin-bottom: 4px;
  }

  .res-lbl {
    color: var(--text-secondary);
  }

  .res-val {
    font-weight: 600;
  }

  .res-val.mono {
    font-family: var(--font-code);
  }

  .res-val.green {
    color: var(--accent-green);
  }

  /* Loans List */
  .active-bookings-card {
    padding: 24px;
  }

  .loans-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }

  .loan-card {
    background: rgba(255,255,255,0.015);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    cursor: pointer;
    transition: var(--transition-smooth);
  }

  .loan-card:hover {
    background: rgba(255,255,255,0.035);
    border-color: rgba(255,255,255,0.15);
    transform: translateY(-2px);
  }

  .loan-card.selected {
    background: rgba(51, 153, 255, 0.05);
    border-color: rgba(51, 153, 255, 0.3);
    box-shadow: 0 4px 16px rgba(51, 153, 255, 0.15);
  }

  .loan-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .loan-co {
    font-weight: 700;
    font-size: 14px;
  }

  .loan-status {
    font-size: 10px;
    font-weight: 700;
    background: rgba(51, 153, 255, 0.1);
    color: var(--accent-blue);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(51, 153, 255, 0.2);
  }

  .loan-status.paid {
    background: rgba(46, 204, 113, 0.1);
    color: var(--accent-green);
    border: 1px solid rgba(46, 204, 113, 0.2);
  }

  .loan-id-row {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .loan-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 11px;
    border-top: 1px dashed var(--border-color);
    padding-top: 10px;
  }

  .lbl {
    color: var(--text-secondary);
    display: block;
    margin-bottom: 2px;
  }

  .val {
    font-weight: 500;
  }

  .val.bold {
    font-weight: 700;
  }

  .val.green {
    color: var(--accent-green);
  }

  .loan-footer {
    border-top: 1px solid var(--border-color);
    padding-top: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
  }

  /* Servicing Simulator Panel */
  .servicing-simulator-card {
    padding: 24px;
  }

  .servicing-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 16px;
    margin-bottom: 20px;
  }

  .servicing-grid {
    display: grid;
    grid-template-columns: 0.3fr 0.7fr;
    gap: 24px;
  }

  .servicing-stats {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .stat-box {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .stat-lbl {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
  }

  .stat-val {
    font-size: 18px;
    font-weight: 800;
    font-family: var(--font-heading);
    margin-top: 4px;
  }

  .stat-val.blue {
    color: var(--accent-blue);
  }

  .stat-val.green {
    color: var(--accent-green);
  }

  .schedule-table-wrapper {
    max-height: 340px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .schedule-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
  }

  .schedule-table th, .schedule-table td {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-color);
  }

  .schedule-table th {
    background: rgba(255,255,255,0.02);
    color: var(--text-secondary);
    font-weight: 600;
  }

  .sched-row {
    transition: var(--transition-smooth);
    opacity: 0.8;
  }

  .sched-row.processed {
    background: rgba(46, 204, 113, 0.03);
    opacity: 0.55;
  }

  .sched-row.current-pmt {
    background: rgba(51, 153, 255, 0.06);
    opacity: 1;
    font-weight: 700;
    border-left: 3px solid var(--accent-blue);
  }

  .mono {
    font-family: var(--font-code);
  }

  .font-bold {
    font-weight: 700;
  }

  .text-green {
    color: var(--accent-green);
  }

  .text-orange {
    color: var(--accent-orange);
  }

  .tag-processed {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-green);
  }

  .tag-current {
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-blue);
    background: rgba(51, 153, 255, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .tag-future {
    font-size: 10px;
    color: var(--text-muted);
  }

  /* API Console */
  .console-box, .ledger-box {
    background: #020408;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    height: 280px;
    overflow-y: auto;
    padding: 16px;
  }

  .json-code {
    font-family: var(--font-code);
    font-size: 11px;
    color: var(--accent-purple);
    background: transparent;
    margin-bottom: 14px;
    white-space: pre-wrap;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding-bottom: 10px;
  }

  .empty-code-console {
    font-family: var(--font-code);
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    padding-top: 100px;
  }

  /* Ledger Table */
  .ledger-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    text-align: left;
  }

  .ledger-table th, .ledger-table td {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .ledger-table th {
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
  }

  .desc-cell {
    color: var(--text-secondary);
  }

  .ledger-row {
    color: var(--accent-green);
  }

  .ledger-row.credit {
    color: var(--accent-orange);
  }

  .bold {
    font-weight: 700;
  }

  .numeric-ledger {
    text-align: right;
  }

  .fade-in {
    animation: fadeIn 0.3s ease-out;
  }
</style>
