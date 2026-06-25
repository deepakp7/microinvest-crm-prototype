<script>
  import { loans, auditLogs, userRole, addAuditLog } from '$lib/store.js';

  // Date selection states
  let selectedMonth = '6'; // June
  let selectedYear = '2026';

  let bulkSelectedRows = {}; // maps loanId -> boolean
  let bulkPaymentAmounts = {}; // maps loanId -> amount

  let statusMsg = '';
  let ledgerPreview = [];
  let webhookPreview = [];

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const years = ['2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030'];

  // Helper date functions
  function getDaysBetween(d1, d2) {
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  function parseDateStr(str) {
    if (!str) return new Date();
    if (str.includes('/')) {
      const parts = str.split('/');
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(str);
  }

  function formatDateStr(date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function getNextPaymentDate(origDate, firstPmtDate, index, loanId) {
    if (index === 0) return new Date(origDate);
    if (index === 1) return new Date(firstPmtDate);

    const d = new Date(firstPmtDate);
    d.setMonth(d.getMonth() + (index - 1));

    if (loanId === '1101' && index >= 2) {
      d.setDate(18);
    }
    return d;
  }

  function calculatePMT(principal, annualRate, term) {
    const rateVal = parseFloat(annualRate) / 100;
    const monthlyRate = rateVal / 12;
    if (monthlyRate === 0) return principal / term;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1);
  }

  // Unified Amortization generator handling mid-way modifications
  function generateAmortization(loan) {
    if (!loan) return { schedule: [], accumulatedInterest: 0 };
    const amount = loan.amount;
    const rateStr = loan.interestRate || '6.00%';
    let rate = parseFloat(rateStr) / 100;
    const term = loan.termMonths || 60;

    const origDate = parseDateStr(loan.originationDate || loan.bookedAt);
    const firstPmtDate = parseDateStr(loan.firstPaymentDate || loan.bookedAt);

    const schedule = [];
    let balance = amount;
    let accumulatedInterest = 0;

    schedule.push({
      num: 1,
      date: origDate,
      status: 'Information',
      payment: 0,
      rate: rate * 100,
      principalPaid: 0,
      interestPaid: 0,
      balance: balance,
      comment: loan.loanId === '1101' ? '6k grant' : 'Origination'
    });

    let defaultPmtAmount = loan.paymentAmount || calculatePMT(amount, rateStr, term);
    if (loan.loanId === '1101') {
      defaultPmtAmount = 559.00;
    }

    let prevDate = origDate;

    for (let i = 1; i <= term; i++) {
      const lineNum = i + 1;
      const pmtDate = getNextPaymentDate(origDate, firstPmtDate, i, loan.loanId);
      const days = getDaysBetween(prevDate, pmtDate);

      let isHoliday = false;
      let activeRate = rate;
      let activePaymentAmount = defaultPmtAmount;
      let holidayComment = '';

      // Process mid-way modifications if any
      if (loan.modifications && loan.modifications.length > 0) {
        const holidayMod = loan.modifications.find(m => 
          m.type === 'holiday' && 
          lineNum >= m.effectiveMonthNum && 
          lineNum < m.effectiveMonthNum + m.duration
        );
        if (holidayMod) {
          isHoliday = true;
          holidayComment = `Repayment Holiday (${lineNum - holidayMod.effectiveMonthNum + 1}/${holidayMod.duration})`;
        }

        const rateMod = loan.modifications
          .filter(m => m.type === 'rate_change' && lineNum >= m.effectiveMonthNum)
          .sort((a, b) => b.effectiveMonthNum - a.effectiveMonthNum)[0];
        if (rateMod) {
          activeRate = parseFloat(rateMod.newValue) / 100;
        }

        const pmtMod = loan.modifications
          .filter(m => m.type === 'payment_change' && lineNum >= m.effectiveMonthNum)
          .sort((a, b) => b.effectiveMonthNum - a.effectiveMonthNum)[0];
        if (pmtMod) {
          activePaymentAmount = parseFloat(pmtMod.newValue);
        }
      }

      let interest = balance * activeRate * (days / 365);
      interest = Math.round(interest * 100) / 100;

      let paymentAmount = isHoliday ? 0 : activePaymentAmount;
      let principal = isHoliday ? 0 : (paymentAmount - interest);
      principal = Math.round(principal * 100) / 100;

      let endingBalance = balance - principal;
      if (isHoliday) {
        endingBalance = balance + interest;
      }
      endingBalance = Math.round(endingBalance * 100) / 100;

      if (endingBalance < 0 && !isHoliday) {
        principal = balance;
        endingBalance = 0;
        paymentAmount = principal + interest;
      }

      accumulatedInterest += interest;

      schedule.push({
        num: lineNum,
        date: pmtDate,
        status: (lineNum < (loan.nextPaymentNum || 1)) ? 'Paid Pmt' : (isHoliday ? 'Repayment Holiday' : 'Due Pmt'),
        payment: paymentAmount,
        rate: activeRate * 100,
        principalPaid: principal,
        interestPaid: interest,
        balance: Math.max(0, endingBalance),
        comment: holidayComment || (rateStr !== (activeRate * 100).toFixed(2) + '%' ? `Rate: ${(activeRate * 100).toFixed(2)}%` : '')
      });

      balance = endingBalance;
      prevDate = pmtDate;

      if (balance <= 0 && !isHoliday) break;
    }

    return { schedule, accumulatedInterest };
  }

  // Reactive parsing of month/year
  $: targetMonth = parseInt(selectedMonth);
  $: targetYear = parseInt(selectedYear);

  // Compute due repayments in target month across all active loans
  $: targetMonthRepayments = (() => {
    const list = [];
    $loans.forEach(loan => {
      if (loan.status !== 'Active') return;
      const amort = generateAmortization(loan);
      
      // Find the specific schedule row that falls in selected month & year
      amort.schedule.forEach(row => {
        if (row.status !== 'Due Pmt') return;
        const d = new Date(row.date);
        if (d.getMonth() === targetMonth - 1 && d.getFullYear() === targetYear) {
          list.push({
            loanId: loan.loanId,
            companyName: loan.companyName,
            fileNo: loan.fileNo,
            lineNum: row.num,
            dueDate: row.date,
            expectedPayment: row.payment,
            expectedPrincipal: row.principalPaid,
            expectedInterest: row.interestPaid,
            expectedBalance: row.balance,
            loanRef: loan
          });
        }
      });
    });
    return list;
  })();

  // Synchronize checklist and input states when target month changes
  $: {
    targetMonthRepayments.forEach(item => {
      const key = `${item.loanId}-${item.lineNum}`;
      if (bulkSelectedRows[key] === undefined) {
        bulkSelectedRows[key] = true;
      }
      if (bulkPaymentAmounts[key] === undefined) {
        bulkPaymentAmounts[key] = item.expectedPayment;
      }
    });
  }

  // Totals calculations
  $: selectedItemsCount = targetMonthRepayments.filter(item => bulkSelectedRows[`${item.loanId}-${item.lineNum}`]).length;
  
  $: selectedTotalPayment = targetMonthRepayments.reduce((sum, item) => {
    const key = `${item.loanId}-${item.lineNum}`;
    return sum + (bulkSelectedRows[key] ? (bulkPaymentAmounts[key] || 0) : 0);
  }, 0);

  $: selectedTotalPrincipal = targetMonthRepayments.reduce((sum, item) => {
    const key = `${item.loanId}-${item.lineNum}`;
    if (bulkSelectedRows[key]) {
      const actualPmtVal = bulkPaymentAmounts[key] || item.expectedPayment;
      const ratio = actualPmtVal / item.expectedPayment;
      return sum + Math.round(item.expectedPrincipal * ratio * 100) / 100;
    }
    return sum;
  }, 0);

  $: selectedTotalInterest = targetMonthRepayments.reduce((sum, item) => {
    const key = `${item.loanId}-${item.lineNum}`;
    if (bulkSelectedRows[key]) {
      const actualPmtVal = bulkPaymentAmounts[key] || item.expectedPayment;
      const ratio = actualPmtVal / item.expectedPayment;
      return sum + Math.round(item.expectedInterest * ratio * 100) / 100;
    }
    return sum;
  }, 0);

  // Generate Ledger & Webhook Previews dynamically
  $: {
    const dateStr = formatDateStr(new Date());
    const tempLedger = [];
    const tempWebhook = [];

    targetMonthRepayments.forEach(item => {
      const key = `${item.loanId}-${item.lineNum}`;
      if (bulkSelectedRows[key]) {
        const actualPmtVal = bulkPaymentAmounts[key] || item.expectedPayment;
        const ratio = actualPmtVal / item.expectedPayment;
        const adjustedPrincipal = Math.round(item.expectedPrincipal * ratio * 100) / 100;
        const adjustedInterest = Math.round(item.expectedInterest * ratio * 100) / 100;

        tempLedger.push(
          { date: dateStr, desc: `DD Bulk Pmt #${item.lineNum} ${item.loanId}`, acctCode: '1010-Asset', acctName: 'Operational Checking Cash', type: 'DR', amount: actualPmtVal },
          { date: dateStr, desc: `DD Bulk Pmt #${item.lineNum} ${item.loanId}`, acctCode: '1200-Asset', acctName: 'Loans Receivable (Assets)', type: 'CR', amount: adjustedPrincipal },
          { date: dateStr, desc: `DD Bulk Pmt #${item.lineNum} ${item.loanId}`, acctCode: '4100-Revenue', acctName: 'Interest Revenue', type: 'CR', amount: adjustedInterest }
        );

        tempWebhook.push({
          loan_id: item.loanId,
          payment_number: item.lineNum,
          amount_received: actualPmtVal,
          applied_principal: adjustedPrincipal,
          applied_interest: adjustedInterest,
          scheduled_payment: item.expectedPayment
        });
      }
    });

    ledgerPreview = tempLedger;
    webhookPreview = tempWebhook;
  }

  function handleSelectAll(e) {
    const checked = e.target.checked;
    targetMonthRepayments.forEach(item => {
      bulkSelectedRows[`${item.loanId}-${item.lineNum}`] = checked;
    });
  }

  function applyBulkPayments() {
    let commitCount = 0;
    let totalCollected = 0;

    targetMonthRepayments.forEach(item => {
      const key = `${item.loanId}-${item.lineNum}`;
      if (bulkSelectedRows[key]) {
        const actualPmtVal = bulkPaymentAmounts[key] || item.expectedPayment;
        const ratio = actualPmtVal / item.expectedPayment;
        const adjustedPrincipal = Math.round(item.expectedPrincipal * ratio * 100) / 100;
        const endBal = Math.max(0, Math.round((item.loanRef.remainingBalance - adjustedPrincipal) * 100) / 100);

        commitCount++;
        totalCollected += actualPmtVal;

        // Perform updates to local stores
        loans.update(list =>
          list.map(old => old.loanId === item.loanId ? {
            ...old,
            remainingBalance: endBal,
            nextPaymentNum: item.lineNum + 1,
            status: endBal <= 0.05 ? 'Closed' : 'Active'
          } : old)
        );
      }
    });

    if (commitCount > 0) {
      addAuditLog($userRole, `Processed batch Direct-Debit payments. Reconciled ${commitCount} active loans. Total cleared: £${totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}`);
      statusMsg = `✅ Successfully posted ${commitCount} repayments totaling £${totalCollected.toLocaleString()}!`;
      
      // Clear checkbox states for processed items
      bulkSelectedRows = {};
      bulkPaymentAmounts = {};
    } else {
      statusMsg = '⚠️ No repayments were selected.';
    }
    setTimeout(() => { statusMsg = ''; }, 4000);
  }
</script>

<div class="post-payments-page">
  <div class="header-container">
    <div class="title-section">
      <span class="badge-tag">LEDGER SERVICING</span>
      <h1>Bulk Post Payments Workspace</h1>
      <p class="description">Select a due month to display all active client repayments. Audit expected distributions, apply custom values, and commit ledger sheets.</p>
    </div>
    {#if statusMsg}
      <div class="toast-alert">{statusMsg}</div>
    {/if}
  </div>

  {#if $userRole !== 'Operations' && $userRole !== 'Admin' && $userRole !== 'Management Team'}
    <div class="restricted-warning glass-card">
      <span class="warning-icon">⚠️</span>
      <div class="warning-text">
        <h3>Restricted View</h3>
        <p>Operations and Admin credentials are required to post ledger batches. Current role: <strong>{$userRole}</strong>.</p>
      </div>
    </div>
  {/if}

  <div class="grid-layout" class:read-only={$userRole !== 'Operations' && $userRole !== 'Admin' && $userRole !== 'Management Team'}>
    
    <!-- Filter Selection Banner -->
    <div class="filters-card glass-card">
      <div class="filter-header">
        <h4>📅 Repayments Calendar Filter</h4>
      </div>
      <div class="filter-flex">
        <div class="filter-group">
          <label for="month-select">Calendar Month</label>
          <select id="month-select" bind:value={selectedMonth}>
            {#each months as m}
              <option value={m.value}>{m.label}</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <label for="year-select">Calendar Year</label>
          <select id="year-select" bind:value={selectedYear}>
            {#each years as y}
              <option value={y}>{y}</option>
            {/each}
          </select>
        </div>

        <div class="filter-summary-info">
          <span>Active Loans Due: <strong>{targetMonthRepayments.length}</strong></span>
          <span>Selected for Batch: <strong>{selectedItemsCount}</strong></span>
        </div>
      </div>
    </div>

    <!-- Main Workspace Layout -->
    <div class="workspace-grid">
      
      <!-- Payments List Card -->
      <div class="records-card glass-card">
        <div class="card-header">
          <h3>Reconciliation Batch List: {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</h3>
          <p>Verify Expected Principal/Interest, check box to select, and edit paid amounts inline.</p>
        </div>

        <div class="table-wrapper">
          <table class="post-table">
            <thead>
              <tr>
                <th width="40">
                  <input type="checkbox" on:change={handleSelectAll} checked={selectedItemsCount === targetMonthRepayments.length && targetMonthRepayments.length > 0} />
                </th>
                <th>Margill ID</th>
                <th>Borrower Business</th>
                <th>File No</th>
                <th>Pmt #</th>
                <th>Expected Date</th>
                <th>Expected Pmt</th>
                <th>Actual Paid (£)</th>
                <th>Expected Principal</th>
                <th>Expected Interest</th>
              </tr>
            </thead>
            <tbody>
              {#each targetMonthRepayments as item}
                {@const key = `${item.loanId}-${item.lineNum}`}
                <tr class="record-row" class:selected={bulkSelectedRows[key]}>
                  <td>
                    <input type="checkbox" bind:checked={bulkSelectedRows[key]} />
                  </td>
                  <td class="mono font-bold text-blue">{item.loanId}</td>
                  <td class="font-bold">{item.companyName}</td>
                  <td class="mono">{item.fileNo || 'F-2021'}</td>
                  <td class="mono">{item.lineNum}</td>
                  <td class="mono">{formatDateStr(item.dueDate)}</td>
                  <td class="mono text-muted">£{item.expectedPayment.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td>
                    <input type="number" class="inline-table-num" bind:value={bulkPaymentAmounts[key]} />
                  </td>
                  <td class="mono text-green">£{item.expectedPrincipal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td class="mono text-orange">£{item.expectedInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              {:else}
                <tr>
                  <td colspan="10" class="no-records-placeholder">
                    No active loan payments are scheduled or due in {months.find(m => m.value === selectedMonth)?.label} {selectedYear}.
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Totals Panel -->
        <div class="reconciliation-totals-bar">
          <div class="metric">
            <span class="lbl">Reconciled Payments Count</span>
            <span class="val">{selectedItemsCount} / {targetMonthRepayments.length}</span>
          </div>
          <div class="metric">
            <span class="lbl">Total Collected Amount</span>
            <span class="val text-blue">£{selectedTotalPayment.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div class="metric">
            <span class="lbl">Allocated Principal Portion</span>
            <span class="val text-green">£{selectedTotalPrincipal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div class="metric">
            <span class="lbl">Allocated Interest Portion</span>
            <span class="val text-orange">£{selectedTotalInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
        </div>

        <!-- Apply Button -->
        <div class="bulk-actions-footer">
          <button class="btn-primary" on:click={applyBulkPayments} disabled={selectedItemsCount === 0}>
            ✔️ Confirm & Post Reconciled Payments
          </button>
        </div>
      </div>

      <!-- Previews Grid -->
      <div class="previews-row">
        <!-- Live Ledger Preview -->
        <div class="glass-card ledger-card">
          <div class="card-header">
            <h3>📖 Simulated Double-Entry Journal Preview</h3>
            <p>Ledger operations committed upon submitting the batch.</p>
          </div>
          
          <div class="console-box">
            {#if ledgerPreview.length > 0}
              <table class="ledger-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Account Code</th>
                    <th>DR/CR</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {#each ledgerPreview as entry}
                    <tr class="ledger-row" class:credit={entry.type === 'CR'}>
                      <td class="desc-cell">{entry.desc}</td>
                      <td class="mono">{entry.acctCode}</td>
                      <td class="bold">{entry.type}</td>
                      <td class="mono numeric-ledger">£{entry.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {:else}
              <div class="empty-console">No payments selected for ledger generation.</div>
            {/if}
          </div>
        </div>

        <!-- API webhook payload preview -->
        <div class="glass-card code-card">
          <div class="card-header">
            <h3>🔌 API Webhook Sync payload</h3>
            <p>HTTP POST body sent to fund admin reconciliation services.</p>
          </div>
          <div class="console-box">
            {#if webhookPreview.length > 0}
              <pre class="json-code"><code>{JSON.stringify({
                event: 'BULK_DEBIT_POSTED_SYNC',
                posted_by_role: $userRole,
                timestamp: new Date().toISOString(),
                batch_total: selectedTotalPayment,
                items: webhookPreview
              }, null, 2)}</code></pre>
            {:else}
              <div class="empty-console">No payments selected for payload preview.</div>
            {/if}
          </div>
        </div>
      </div>

    </div>
  </div>
</div>

<style>
  .post-payments-page {
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
    position: fixed;
    top: 80px;
    right: 28px;
    background: rgba(51, 153, 255, 0.95);
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
    z-index: 999;
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

  .grid-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .grid-layout.read-only {
    pointer-events: none;
    opacity: 0.75;
  }

  .filters-card {
    padding: 16px 24px;
  }

  .filter-header h4 {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent-blue);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  .filter-flex {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-group label {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .filter-group select {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 13px;
    color: var(--text-primary);
  }

  .filter-summary-info {
    display: flex;
    gap: 16px;
    font-size: 13px;
    margin-left: auto;
    color: var(--text-secondary);
  }

  .filter-summary-info strong {
    color: var(--text-primary);
  }

  .workspace-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .card-header {
    margin-bottom: 20px;
  }

  .card-header h3 {
    font-size: 18px;
    margin-bottom: 4px;
  }

  .card-header p {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.15);
  }

  .post-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
  }

  .post-table th, .post-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .post-table th {
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
  }

  .record-row {
    transition: var(--transition-smooth);
  }

  .record-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .record-row.selected {
    background: rgba(51, 153, 255, 0.04);
  }

  .inline-table-num {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px 8px;
    color: #fff;
    width: 90px;
    font-family: var(--font-code);
  }

  .no-records-placeholder {
    text-align: center;
    padding: 36px !important;
    color: var(--text-muted);
    font-size: 13px;
  }

  .reconciliation-totals-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(255, 255, 255, 0.01);
    padding: 10px 14px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
  }

  .metric .lbl {
    font-size: 10px;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: 600;
  }

  .metric .val {
    font-size: 18px;
    font-weight: 800;
    font-family: var(--font-code);
  }

  .bulk-actions-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }

  .previews-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .console-box {
    background: #020408;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    height: 250px;
    overflow-y: auto;
    padding: 16px;
  }

  .empty-console {
    font-family: var(--font-code);
    font-size: 11px;
    color: var(--text-muted);
    text-align: center;
    padding-top: 90px;
  }

  .json-code {
    font-family: var(--font-code);
    font-size: 11px;
    color: var(--accent-purple);
    background: transparent;
    white-space: pre-wrap;
  }

  .ledger-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    text-align: left;
  }

  .ledger-table th, .ledger-table td {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .ledger-table th {
    color: var(--text-secondary);
    font-weight: 600;
  }

  .ledger-row {
    color: var(--accent-green);
  }

  .ledger-row.credit {
    color: var(--accent-orange);
  }

  .desc-cell {
    color: var(--text-secondary);
  }

  .bold {
    font-weight: 700;
  }

  .numeric-ledger {
    text-align: right;
  }

  .mono {
    font-family: var(--font-code);
  }

  .font-bold {
    font-weight: 700;
  }

  .text-blue {
    color: var(--accent-blue);
  }

  .text-orange {
    color: var(--accent-orange);
  }

  .text-green {
    color: var(--accent-green);
  }
</style>
