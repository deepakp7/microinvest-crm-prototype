<script>
  import { opportunities, loans, auditLogs, addAuditLog, userRole, toggleChecklistItem } from '$lib/store.js';

  // Active tab selection
  let activeTab = 'database'; // 'database', 'bulk', 'integrations'

  // Margill Database filtering states
  let filterStatus = 'All';
  let filterBorrower = 'All';
  let filterFund = 'All';
  let filterRateType = 'All';
  let filterInvestmentManager = 'All';

  // Selected Loan Inspector state
  let selectedLoanId = '1101'; // Default pre-select
  $: selectedLoan = $loans.find(l => l.loanId === selectedLoanId);

  // Inspector tab
  let inspectorTab = 'schedule'; // 'schedule', 'data', 'borrower', 'creditor', 'apr', 'alerts', 'advanced'
  let dataSubTab = 'data_fields'; // 'data_fields', 'general', 'other_data'
  let borrowerSubTab = 'borrower_fields'; // 'borrower_fields', 'borrower_other', 'notes', 'employer'
  let borrowerTypeTab = 'borrower_tab'; // 'borrower_tab', 'co_borrower', 'guarantor'

  // Edit states for forms
  let editLoan = null;
  $: {
    if (selectedLoan && (!editLoan || editLoan.loanId !== selectedLoan.loanId)) {
      editLoan = JSON.parse(JSON.stringify(selectedLoan));
    }
  }

  // Booking Engine inputs
  let selectedOppId = '';
  let customLoanId = '';
  let interestRate = '6.00%';
  let termMonths = 60;
  let chosenFund = 'ACCESS2';
  let chosenCreditor = 'Big Issue Invest';
  let chosenManager = 'Linda Wickstrom';

  // Simulator operational logs
  let apiLogs = [];
  let ledgerLogs = [];
  let statusMsg = '';

  // Excel daily sync
  let isDragging = false;
  let excelSyncResults = null;

  // Bulk repayments tab variables
  let bulkRepaymentDate = '18/06/2026';
  let bulkSelectAll = true;
  let bulkSelectedRows = {}; // maps loanId -> boolean
  let bulkPaymentAmounts = {}; // maps loanId -> amount

  // Filter signed or won opportunities not yet booked
  $: pendingBookings = $opportunities.filter(o => (o.stage === 'signed' || o.stage === 'won') && !o.booked);

  $: selectedOpp = $opportunities.find(o => o.id === selectedOppId);
  $: checklistStages = ['pre_dd', 'dd', 'ic', 'approved', 'signed'];
  $: selectedOppChecklistStatus = (() => {
    if (!selectedOpp) return { allCompleted: true, total: 0, completed: 0, items: [] };
    const itemsList = [];
    let completedCount = 0;
    let totalCount = 0;
    
    const stageLabels = {
      pre_dd: 'Pre-Due Diligence',
      dd: 'Due Diligence',
      ic: 'Ready for Investment Committee',
      approved: 'Loan Approved',
      signed: 'Deal Signed'
    };

    for (const stageId of checklistStages) {
      const stageItems = selectedOpp.checklist?.[stageId] || [];
      for (const item of stageItems) {
        totalCount++;
        if (item.completed) {
          completedCount++;
        }
        itemsList.push({
          stageId,
          stageLabel: stageLabels[stageId] || stageId,
          ...item
        });
      }
    }
    
    return {
      allCompleted: completedCount === totalCount,
      total: totalCount,
      completed: completedCount,
      items: itemsList
    };
  })();

  // Auto-generate Margill ID preview
  $: {
    if (selectedOppId && !customLoanId) {
      customLoanId = '11' + Math.floor(10 + Math.random() * 89);
    }
  }

  // Unique lists of funds/borrowers for filtering
  $: statuses = ['All', 'Active', 'Closed', 'Bad debt'];
  $: fundsList = ['All', 'ACCESS2', 'PFP', 'ESM', 'BIIGLA', 'RGFBII2'];
  $: managersList = ['All', 'Linda Wickstrom', 'Alice Vane', 'Bob Miller'];
  $: borrowersList = ['All', ...new Set($loans.map(l => l.companyName))];

  // Apply filters to loans
  $: filteredLoans = $loans.filter(l => {
    if (filterStatus !== 'All' && l.status !== filterStatus) return false;
    if (filterBorrower !== 'All' && l.companyName !== filterBorrower) return false;
    if (filterFund !== 'All' && l.fund !== filterFund) return false;
    if (filterRateType !== 'All' && (l.customFields?.rateType || 'Fixed') !== filterRateType) return false;
    if (filterInvestmentManager !== 'All' && (l.customFields?.investmentManager || 'Linda Wickstrom') !== filterInvestmentManager) return false;
    return true;
  });

  // Calculate totals of filtered loans for Record Selection Metrics (Slide 2 bottom)
  $: totalOriginalPrincipal = filteredLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
  $: totalAccruedInterestAll = filteredLoans.reduce((sum, l) => {
    const amort = generateAmortization(l);
    return sum + amort.accumulatedInterest;
  }, 0);
  $: totalPaymentsAll = filteredLoans.reduce((sum, l) => {
    const amort = generateAmortization(l);
    return sum + amort.schedule.reduce((s, row) => s + (row.payment || 0), 0);
  }, 0);
  $: totalRemainingBalanceAll = filteredLoans.reduce((sum, l) => sum + (l.remainingBalance || 0), 0);

  // Day count calculation helpers
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

    // For Loan 1101, Slide 3 shows payment 3+ on the 18th
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

  // Generates amortization schedule precisely mimicking Slide 3 with mid-way modifications
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

    // Row 1: Information
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
      defaultPmtAmount = 559.00; // Slide 3 exact PMT
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

      // Check modifications active for this lineNum
      if (loan.modifications && loan.modifications.length > 0) {
        // 1. Check for repayment holidays
        const holidayMod = loan.modifications.find(m => 
          m.type === 'holiday' && 
          lineNum >= m.effectiveMonthNum && 
          lineNum < m.effectiveMonthNum + m.duration
        );
        if (holidayMod) {
          isHoliday = true;
          holidayComment = `Repayment Holiday (${lineNum - holidayMod.effectiveMonthNum + 1}/${holidayMod.duration})`;
        }

        // 2. Check for rate changes
        const rateMod = loan.modifications
          .filter(m => m.type === 'rate_change' && lineNum >= m.effectiveMonthNum)
          .sort((a, b) => b.effectiveMonthNum - a.effectiveMonthNum)[0];
        if (rateMod) {
          activeRate = parseFloat(rateMod.newValue) / 100;
        }

        // 3. Check for payment changes
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

  // Triggered when clicking "Save Loan Info" in Data/Borrower panels
  function saveLoanDetails() {
    if (!editLoan) return;
    loans.update(list =>
      list.map(l => l.loanId === editLoan.loanId ? editLoan : l)
    );
    addAuditLog($userRole, `Saved updated profile for borrower "${editLoan.companyName}" (Loan ID: ${editLoan.loanId})`);
    statusMsg = `✅ Successfully updated loan details for Margill ID: ${editLoan.loanId}!`;
    setTimeout(() => { statusMsg = ''; }, 3000);
  }

  // Simulate individual payment postings from the inspector
  function postPayment() {
    if (!selectedLoan) return;
    const amort = generateAmortization(selectedLoan);
    const payNum = selectedLoan.nextPaymentNum || 1;
    const currentPeriod = amort.schedule.find(s => s.num === payNum);

    if (!currentPeriod || currentPeriod.status === 'Information') {
      statusMsg = '⚠️ Fully paid loan or invalid period!';
      setTimeout(() => { statusMsg = ''; }, 3000);
      return;
    }

    const dateStr = formatDateStr(new Date());

    // Double-entry ledger commits
    const transactionJournals = [
      { date: dateStr, desc: `Pmt #${payNum} ${selectedLoan.loanId}`, acctCode: '1010-Asset', acctName: 'Operational Checking Cash', type: 'DR', amount: currentPeriod.payment },
      { date: dateStr, desc: `Pmt #${payNum} ${selectedLoan.loanId}`, acctCode: '1200-Asset', acctName: 'Loans Receivable (Assets)', type: 'CR', amount: currentPeriod.principalPaid },
      { date: dateStr, desc: `Pmt #${payNum} ${selectedLoan.loanId}`, acctCode: '4100-Revenue', acctName: 'Interest Revenue', type: 'CR', amount: currentPeriod.interestPaid }
    ];
    ledgerLogs = [...transactionJournals, ...ledgerLogs];

    // Outbound API webhook simulator payload
    const apiPayload = {
      event: 'REPAYMENT_POSTED_SYNC',
      system: 'Margill Integration Service',
      timestamp: new Date().toISOString(),
      payload: {
        loan_id: selectedLoan.loanId,
        payment_number: payNum,
        paid_amount: currentPeriod.payment,
        principal_portion: currentPeriod.principalPaid,
        interest_portion: currentPeriod.interestPaid,
        outstanding_balance: currentPeriod.balance
      }
    };
    apiLogs = [apiPayload, ...apiLogs];

    // Store update
    loans.update(currentList =>
      currentList.map(l => {
        if (l.loanId === selectedLoan.loanId) {
          return {
            ...l,
            remainingBalance: currentPeriod.balance,
            nextPaymentNum: payNum + 1,
            status: currentPeriod.balance <= 0.05 ? 'Closed' : 'Active'
          };
        }
        return l;
      })
    );

    addAuditLog($userRole, `Processed payment #${payNum} for ${selectedLoan.companyName} (£${currentPeriod.payment.toLocaleString()})`);
    statusMsg = `💸 Posted payment #${payNum} of £${currentPeriod.payment} for ${selectedLoan.companyName}`;
    setTimeout(() => { statusMsg = ''; }, 4000);
  }

  // Populate bulk checklist for Slide 8 view
  $: {
    if (activeTab === 'bulk') {
      const activeLns = $loans.filter(l => l.status === 'Active');
      activeLns.forEach(l => {
        if (bulkSelectedRows[l.loanId] === undefined) {
          bulkSelectedRows[l.loanId] = true;
        }
        if (bulkPaymentAmounts[l.loanId] === undefined) {
          const amort = generateAmortization(l);
          const currentPmt = amort.schedule.find(s => s.num === (l.nextPaymentNum || 1));
          bulkPaymentAmounts[l.loanId] = currentPmt ? currentPmt.payment : 0;
        }
      });
    }
  }

  function handleBulkSelectAllChange() {
    const activeLns = $loans.filter(l => l.status === 'Active');
    activeLns.forEach(l => {
      bulkSelectedRows[l.loanId] = bulkSelectAll;
    });
  }

  // Execute bulk posting of selected repayments (Slide 8 Apply Action)
  function applyBulkPayments() {
    const activeLns = $loans.filter(l => l.status === 'Active');
    let commitCount = 0;
    let totalCollected = 0;

    activeLns.forEach(l => {
      if (bulkSelectedRows[l.loanId]) {
        const amort = generateAmortization(l);
        const payNum = l.nextPaymentNum || 1;
        const currentPeriod = amort.schedule.find(s => s.num === payNum);

        if (currentPeriod) {
          const actualPmtVal = bulkPaymentAmounts[l.loanId] || currentPeriod.payment;
          const ratio = actualPmtVal / currentPeriod.payment;
          const adjustedPrincipal = Math.round(currentPeriod.principalPaid * ratio * 100) / 100;
          const adjustedInterest = Math.round(currentPeriod.interestPaid * ratio * 100) / 100;
          const endBal = Math.max(0, Math.round((l.remainingBalance - adjustedPrincipal) * 100) / 100);

          commitCount++;
          totalCollected += actualPmtVal;

          // Double-entry accounting updates
          const transactionJournals = [
            { date: bulkRepaymentDate, desc: `DD Bulk Pmt #${payNum} ${l.loanId}`, acctCode: '1010-Asset', acctName: 'Operational Checking Cash', type: 'DR', amount: actualPmtVal },
            { date: bulkRepaymentDate, desc: `DD Bulk Pmt #${payNum} ${l.loanId}`, acctCode: '1200-Asset', acctName: 'Loans Receivable (Assets)', type: 'CR', amount: adjustedPrincipal },
            { date: bulkRepaymentDate, desc: `DD Bulk Pmt #${payNum} ${l.loanId}`, acctCode: '4100-Revenue', acctName: 'Interest Revenue', type: 'CR', amount: adjustedInterest }
          ];
          ledgerLogs = [...transactionJournals, ...ledgerLogs];

          // Store update
          loans.update(list =>
            list.map(old => old.loanId === l.loanId ? {
              ...old,
              remainingBalance: endBal,
              nextPaymentNum: payNum + 1,
              status: endBal <= 0.05 ? 'Closed' : 'Active'
            } : old)
          );

          // Webhook logs
          apiLogs = [{
            event: 'BULK_DEBIT_POSTED',
            system: 'DirectDebit Portal Integration',
            timestamp: new Date().toISOString(),
            payload: {
              loan_id: l.loanId,
              payment_number: payNum,
              amount: actualPmtVal,
              adjusted_principal: adjustedPrincipal,
              adjusted_interest: adjustedInterest,
              remaining_balance: endBal
            }
          }, ...apiLogs];
        }
      }
    });

    if (commitCount > 0) {
      addAuditLog($userRole, `DD Bulk Payment processing committed. ${commitCount} accounts reconciled. Total collected: £${totalCollected.toLocaleString()}`);
      statusMsg = `✅ Successfully posted ${commitCount} repayments totaling £${totalCollected.toLocaleString()}!`;
    } else {
      statusMsg = '⚠️ No repayments were selected.';
    }
    setTimeout(() => { statusMsg = ''; }, 4000);
  }

  // Create new active loan from sales pipeline opportunity
  function executeBooking() {
    if (!selectedOppId) return;

    const opp = $opportunities.find(o => o.id === selectedOppId);
    if (!opp) return;

    const newLoan = {
      id: 'loan-' + customLoanId,
      opportunityId: opp.id,
      companyName: opp.companyName,
      loanId: customLoanId,
      facility: opp.investmentFacility,
      amount: opp.dealSize,
      esgRating: opp.esgRating || 'A (Moderate)',
      status: 'Active',
      bookedAt: new Date().toISOString(),
      interestRate,
      termMonths,
      remainingBalance: opp.dealSize,
      nextPaymentNum: 1,
      originationDate: formatDateStr(new Date()),
      firstPaymentDate: formatDateStr(new Date(new Date().setMonth(new Date().getMonth() + 1))),
      fund: chosenFund,
      creditor: chosenCreditor,
      compoundingPeriod: 'Annually',
      paymentFrequency: 'Monthly',
      paymentMethod: 'Normal (Principal + Interest)',
      subStatus: 'AUTO',
      accountingId: 'ACC-' + customLoanId,
      fileNo: 'F-2026-' + customLoanId,
      maxCredit: opp.dealSize * 1.2,
      uniqueIdentifier1: 'LN-' + customLoanId + '-M',
      uniqueIdentifier2: 'CO-' + Math.floor(100000 + Math.random() * 900000),
      otherInfo: 'Imported from pipeline opportunity.',
      borrower: {
        firstName: opp.contactName ? opp.contactName.split(' ')[0] : 'N/A',
        lastName: opp.contactName ? opp.contactName.split(' ')[1] || 'N/A' : 'N/A',
        businessName: opp.companyName,
        email: opp.email,
        phone: opp.phone,
        ownerCreator: chosenManager
      },
      customFields: {
        investmentManager: chosenManager,
        grant: 0,
        rateType: 'Fixed'
      }
    };

    loans.update(current => [...current, newLoan]);

    opportunities.update(list =>
      list.map(o => o.id === opp.id ? { ...o, stage: 'won', booked: true, loanId: customLoanId } : o)
    );

    // Simulated API Payload logs
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
        fund: chosenFund,
        investment_manager: chosenManager
      }
    };
    apiLogs = [apiPayload, ...apiLogs];

    // Double-entry accounting entries (Disbursement)
    const dateStr = formatDateStr(new Date());
    const debitsCredits = [
      { date: dateStr, desc: `Disburse ${customLoanId}`, acctCode: '1200-Asset', acctName: 'Loans Receivable (Assets)', type: 'DR', amount: opp.dealSize },
      { date: dateStr, desc: `Disburse ${customLoanId}`, acctCode: '1010-Asset', acctName: 'Operational Checking Cash', type: 'CR', amount: opp.dealSize }
    ];
    ledgerLogs = [...debitsCredits, ...ledgerLogs];

    addAuditLog($userRole, `Booked Loan "${opp.companyName}" (Margill ID: ${customLoanId}, Amount: £${opp.dealSize.toLocaleString()})`);
    statusMsg = `✅ Successfully booked Loan: ${customLoanId} for ${opp.companyName}!`;

    selectedLoanId = customLoanId;
    activeTab = 'database';

    selectedOppId = '';
    customLoanId = '';
    setTimeout(() => { statusMsg = ''; }, 5000);
  }

  // Excel reconciliation dropper
  function simulateExcelDrop() {
    isDragging = false;
    excelSyncResults = {
      filename: 'Margill_YTD_Reconciliation_Report.xlsx',
      syncedRows: 6,
      totalHoldingsUpdated: '£10,134,800',
      timestamp: new Date().toLocaleTimeString()
    };
    addAuditLog($userRole, `Excel Daily Sync completed. "Margill_YTD_Reconciliation_Report.xlsx" processed. 6 accounts updated.`);
  }

  // Restructuring input states
  let holidayStartMonth = 12;
  let holidayDuration = 3;

  let newRateValue = '7.50%';
  let rateChangeMonth = 15;

  let newTermValue = 72;
  let termChangeMonth = 20;

  let newPmtValue = 600.00;
  let pmtChangeMonth = 15;

  function addModification(type) {
    if (!selectedLoan) return;

    let mod = { type };

    if (type === 'holiday') {
      mod.effectiveMonthNum = holidayStartMonth;
      mod.duration = holidayDuration;
      addAuditLog($userRole, `Applied ${holidayDuration}-month Repayment Holiday starting at Month ${holidayStartMonth} for ${selectedLoan.companyName} (Loan ID: ${selectedLoan.loanId})`);
    } else if (type === 'rate_change') {
      mod.effectiveMonthNum = rateChangeMonth;
      mod.newValue = newRateValue;
      addAuditLog($userRole, `Modified interest rate mid-way to ${newRateValue} starting at Month ${rateChangeMonth} for ${selectedLoan.companyName} (Loan ID: ${selectedLoan.loanId})`);
    } else if (type === 'term_extension') {
      mod.effectiveMonthNum = termChangeMonth;
      mod.newValue = newTermValue;
      addAuditLog($userRole, `Restructured total term to ${newTermValue} months starting at Month ${termChangeMonth} for ${selectedLoan.companyName} (Loan ID: ${selectedLoan.loanId})`);
    } else if (type === 'payment_change') {
      mod.effectiveMonthNum = pmtChangeMonth;
      mod.newValue = newPmtValue;
      addAuditLog($userRole, `Adjusted custom monthly payment to £${newPmtValue} starting at Month ${pmtChangeMonth} for ${selectedLoan.companyName} (Loan ID: ${selectedLoan.loanId})`);
    }

    loans.update(list =>
      list.map(l => {
        if (l.loanId === selectedLoan.loanId) {
          const mods = [...(l.modifications || []), mod];
          return {
            ...l,
            modifications: mods
          };
        }
        return l;
      })
    );

    statusMsg = `🔧 Applied ${type.replace('_', ' ')} restructuring to schedule!`;
    setTimeout(() => { statusMsg = ''; }, 3000);
  }

  function clearAllModifications() {
    if (!selectedLoan) return;
    loans.update(list =>
      list.map(l => l.loanId === selectedLoan.loanId ? { ...l, modifications: [] } : l)
    );
    addAuditLog($userRole, `Reset all mid-way modifications for ${selectedLoan.companyName} (Loan ID: ${selectedLoan.loanId})`);
    statusMsg = `🔄 Reset loan modifications!`;
    setTimeout(() => { statusMsg = ''; }, 3000);
  }
</script>

<div class="loans-page">
  <!-- Top Navigation & Title -->
  <div class="header-container">
    <div class="title-section">
      <span class="badge-tag">PORTFOLIO SERVICING</span>
      <h1>Margill Loan Management Console</h1>
      <p class="description">High-fidelity interface mirroring real-time amortization schedules, borrower forms, and bulk repayment direct-debit updates.</p>
    </div>
    <div class="action-tabs">
      <button class="nav-tab" class:active={activeTab === 'database'} on:click={() => activeTab = 'database'}>📁 Margill Database</button>
      <button class="nav-tab" class:active={activeTab === 'bulk'} on:click={() => activeTab = 'bulk'}>💸 DD Bulk Repayments</button>
      <button class="nav-tab" class:active={activeTab === 'integrations'} on:click={() => activeTab = 'integrations'}>🔌 Sync & Book Engine</button>
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
        <p>Operations and Admin credentials are required to post payments and book active loans. Current role is: <strong>{$userRole}</strong>. Swapping role in top panel recommended for testing.</p>
      </div>
    </div>
  {/if}

  <div class="ops-layout" class:read-only={$userRole !== 'Operations' && $userRole !== 'Admin' && $userRole !== 'Management Team'}>

    <!-- TAB 1: MARGILL DATABASE VIEW -->
    {#if activeTab === 'database'}
      <div class="database-container fade-in">
        <!-- Top filters based on Slide 2 -->
        <div class="filters-card glass-card">
          <div class="filter-header">
            <h4>🔍 Margill Record Search Filters</h4>
          </div>
          <div class="filter-grid">
            <div class="filter-group">
              <label>Status</label>
              <select bind:value={filterStatus}>
                {#each statuses as s}
                  <option value={s}>{s}</option>
                {/each}
              </select>
            </div>
            <div class="filter-group">
              <label>Borrower</label>
              <select bind:value={filterBorrower}>
                {#each borrowersList as b}
                  <option value={b}>{b}</option>
                {/each}
              </select>
            </div>
            <div class="filter-group">
              <label>Fund</label>
              <select bind:value={filterFund}>
                {#each fundsList as f}
                  <option value={f}>{f}</option>
                {/each}
              </select>
            </div>
            <div class="filter-group">
              <label>Investment Manager</label>
              <select bind:value={filterInvestmentManager}>
                {#each managersList as m}
                  <option value={m}>{m}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <!-- Main Records Grid -->
        <div class="records-card glass-card">
          <div class="card-header">
            <h3>Margill Loan Manager - Record Summary</h3>
            <p>Select a loan to open details forms and amortization matrices.</p>
          </div>
          <div class="table-wrapper">
            <table class="margill-table">
              <thead>
                <tr>
                  <th>Loan ID</th>
                  <th>Record Type</th>
                  <th>Record Status</th>
                  <th>Fund</th>
                  <th>Creditor</th>
                  <th>Borrower Business</th>
                  <th>Origination Date</th>
                  <th>Principal (Original)</th>
                  <th>Interest Accrued</th>
                  <th>Total Payments</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredLoans as loan}
                  <tr class="record-row" class:selected={selectedLoanId === loan.loanId} on:click={() => selectedLoanId = loan.loanId}>
                    <td class="mono font-bold text-blue">{loan.loanId}</td>
                    <td>Loan</td>
                    <td>
                      <span class="status-badge {loan.status.toLowerCase().replace(' ', '-')}">
                        {loan.status}
                      </span>
                    </td>
                    <td class="mono">{loan.fund || 'ACCESS2'}</td>
                    <td>{loan.creditor || 'Big Issue Invest'}</td>
                    <td class="font-bold">{loan.companyName}</td>
                    <td class="mono">{loan.originationDate || formatDateStr(loan.bookedAt)}</td>
                    <td class="mono font-bold">£{loan.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td class="mono text-orange">£{generateAmortization(loan).accumulatedInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td class="mono text-green">£{(loan.amount - (loan.remainingBalance || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Bottom Selection Metrics (Slide 2 bottom) -->
          <div class="record-metrics-bar">
            <div class="metric-col">
              <span class="m-lbl">Total Principal (Original):</span>
              <span class="m-val">£{totalOriginalPrincipal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div class="metric-col">
              <span class="m-lbl">Total Accrued Interest:</span>
              <span class="m-val text-orange">£{totalAccruedInterestAll.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div class="metric-col">
              <span class="m-lbl">Total Repayments Cleared:</span>
              <span class="m-val text-green">£{totalPaymentsAll.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div class="metric-col">
              <span class="m-lbl">Total Outstanding Balance:</span>
              <span class="m-val text-blue">£{totalRemainingBalanceAll.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>
        </div>

        <!-- SELECTED LOAN INSPECTOR (Slide 3-7 layout) -->
        {#if selectedLoan}
          <div class="inspector-card glass-card fade-in">
            <div class="inspector-header">
              <h2>🔎 Margill Loan Workspace: {selectedLoan.companyName} ({selectedLoan.loanId})</h2>
              <div class="inspector-meta-capsules">
                <span class="capsule">Fund: {selectedLoan.fund || 'ACCESS2'}</span>
                <span class="capsule">Manager: {selectedLoan.customFields?.investmentManager || 'Linda Wickstrom'}</span>
                <span class="capsule">Status: {selectedLoan.status}</span>
              </div>
            </div>

            <div class="inspector-layout">
              <!-- Left Vertical Tabs -->
              <div class="v-tabs-column">
                <button class="v-tab" class:active={inspectorTab === 'schedule'} on:click={() => inspectorTab = 'schedule'}>📊 Amortization Schedule</button>
                <button class="v-tab" class:active={inspectorTab === 'data'} on:click={() => inspectorTab = 'data'}>⚙️ Loan Data Sheets</button>
                <button class="v-tab" class:active={inspectorTab === 'borrower'} on:click={() => inspectorTab = 'borrower'}>👤 Borrower Info</button>
                <button class="v-tab" class:active={inspectorTab === 'restructuring'} on:click={() => inspectorTab = 'restructuring'}>🔧 Restructure & Holidays</button>
                <button class="v-tab" class:disabled={true}>📈 APR Analysis</button>
                <button class="v-tab" class:disabled={true}>🔔 System Alerts</button>
              </div>

              <!-- Right Content Area -->
              <div class="inspector-content-pane">

                <!-- SUB-TAB: PAYMENT SCHEDULE (Slide 3) -->
                {#if inspectorTab === 'schedule'}
                  <div class="schedule-view fade-in">
                    <!-- Top Summary Stats (Slide 3 top) -->
                    <div class="schedule-summary-grid">
                      <div class="ss-box">
                        <span class="ss-lbl">Origination Date</span>
                        <span class="ss-val mono">{selectedLoan.originationDate || '09/09/2021'}</span>
                      </div>
                      <div class="ss-box">
                        <span class="ss-lbl">Amount Financed</span>
                        <span class="ss-val">£{selectedLoan.amount.toLocaleString()}</span>
                      </div>
                      <div class="ss-box">
                        <span class="ss-lbl">Total Accrued Interest</span>
                        <span class="ss-val text-orange">£{generateAmortization(selectedLoan).accumulatedInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                      <div class="ss-box">
                        <span class="ss-lbl">Outstanding Balance</span>
                        <span class="ss-val text-blue">£{selectedLoan.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                      </div>
                    </div>

                    <div class="panel-header-actions">
                      <h4>Amortization Payments Log</h4>
                      <button class="btn-primary" on:click={postPayment} disabled={selectedLoan.status === 'Closed'}>
                        💸 Post Payment #{selectedLoan.nextPaymentNum || 1}
                      </button>
                    </div>

                    <!-- Amortization Table -->
                    <div class="scroll-table-wrapper">
                      <table class="amort-schedule-table">
                        <thead>
                          <tr>
                            <th>Line</th>
                            <th>Line Status</th>
                            <th>Pmt Date</th>
                            <th>Payment</th>
                            <th>Rate</th>
                            <th>Mathematical Principal</th>
                            <th>Accrued Interest</th>
                            <th>True Balance</th>
                            <th>Comment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each generateAmortization(selectedLoan).schedule as row}
                            <tr class="schedule-row" 
                                class:processed={row.num < (selectedLoan.nextPaymentNum || 1)} 
                                class:current-pmt={row.num === (selectedLoan.nextPaymentNum || 1)}
                                class:holiday-row={row.status === 'Repayment Holiday'}>
                              <td class="mono">{row.num}</td>
                              <td>
                                <span class="tag-{row.status.toLowerCase().replace(' ', '-')}">
                                  {row.status}
                                </span>
                              </td>
                              <td class="mono">{formatDateStr(row.date)}</td>
                              <td class="mono font-bold">£{row.payment.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td class="mono">{row.rate.toFixed(3)}%</td>
                              <td class="mono text-green">£{row.principalPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td class="mono text-orange">£{row.interestPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td class="mono font-bold text-blue">£{row.balance.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                              <td class="desc-cell text-muted">{row.comment || ''}</td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
                {/if}

                <!-- SUB-TAB: LOAN DATA (Slide 4, 5, 6) -->
                {#if inspectorTab === 'data'}
                  <div class="loan-data-view fade-in">
                    <!-- Horizontal tabs for Data sub-tab -->
                    <div class="horizontal-sub-tabs">
                      <button class="sub-tab" class:active={dataSubTab === 'data_fields'} on:click={() => dataSubTab = 'data_fields'}>Data (Terms)</button>
                      <button class="sub-tab" class:active={dataSubTab === 'general'} on:click={() => dataSubTab = 'general'}>General Info</button>
                      <button class="sub-tab" class:active={dataSubTab === 'other_data'} on:click={() => dataSubTab = 'other_data'}>Other Custom Fields</button>
                    </div>

                    <form on:submit|preventDefault={saveLoanDetails} class="inspector-form">
                      <!-- Data Sub-tab Fields (Slide 4) -->
                      {#if dataSubTab === 'data_fields'}
                        <div class="form-grid-2col fade-in">
                          <div class="form-card-section">
                            <h5>Left parameters</h5>
                            <div class="input-group">
                              <label>Record Status</label>
                              <select bind:value={editLoan.status}>
                                <option value="Active">Active</option>
                                <option value="Closed">Closed</option>
                                <option value="Bad debt">Bad debt</option>
                              </select>
                            </div>
                            <div class="input-group">
                              <label>Origination Date</label>
                              <input type="text" bind:value={editLoan.originationDate} placeholder="DD/MM/YYYY" />
                            </div>
                            <div class="input-group">
                              <label>First Payment Date</label>
                              <input type="text" bind:value={editLoan.firstPaymentDate} placeholder="DD/MM/YYYY" />
                            </div>
                            <div class="input-group">
                              <label>Compounding Period</label>
                              <select bind:value={editLoan.compoundingPeriod}>
                                <option value="Annually">Annually</option>
                                <option value="Semi-annually">Semi-annually</option>
                                <option value="Monthly">Monthly</option>
                              </select>
                            </div>
                            <div class="input-group">
                              <label>Payment Frequency</label>
                              <select bind:value={editLoan.paymentFrequency}>
                                <option value="Monthly">Monthly</option>
                                <option value="Weekly">Weekly</option>
                                <option value="Quarterly">Quarterly</option>
                              </select>
                            </div>
                            <div class="input-group">
                              <label>Payment Method</label>
                              <select bind:value={editLoan.paymentMethod}>
                                <option value="Normal (Principal + Interest)">Normal (Principal + Interest)</option>
                                <option value="Interest Only">Interest Only</option>
                                <option value="Principal Only">Principal Only</option>
                              </select>
                            </div>
                          </div>

                          <div class="form-card-section">
                            <h5>Right parameters</h5>
                            <div class="input-group">
                              <label>Sub-status</label>
                              <select bind:value={editLoan.subStatus}>
                                <option value="AUTO">AUTO</option>
                                <option value="MANUAL">MANUAL</option>
                              </select>
                            </div>
                            <div class="input-group">
                              <label>Principal (Original)</label>
                              <input type="number" bind:value={editLoan.amount} />
                            </div>
                            <div class="input-group">
                              <label>Annual Nominal Rate (%)</label>
                              <input type="text" bind:value={editLoan.interestRate} />
                            </div>
                            <div class="input-group">
                              <label>Number of Payments (Amort.)</label>
                              <input type="number" bind:value={editLoan.termMonths} />
                            </div>
                            <div class="input-group">
                              <label>Payment Amount</label>
                              <input type="number" bind:value={editLoan.paymentAmount} placeholder="e.g. 559.00" />
                            </div>
                            <div class="input-group">
                              <label>Current Balance</label>
                              <input type="number" bind:value={editLoan.remainingBalance} disabled />
                            </div>
                          </div>
                        </div>
                      {/if}

                      <!-- General Sub-tab Fields (Slide 5) -->
                      {#if dataSubTab === 'general'}
                        <div class="form-grid-2col fade-in">
                          <div class="form-card-section">
                            <div class="input-group">
                              <label>File (Label)</label>
                              <input type="text" bind:value={editLoan.companyName} />
                            </div>
                            <div class="input-group">
                              <label>Type</label>
                              <select>
                                <option>Loan</option>
                                <option>Mortgage</option>
                                <option>Lease</option>
                              </select>
                            </div>
                            <div class="input-group">
                              <label>Accounting ID</label>
                              <input type="text" bind:value={editLoan.accountingId} />
                            </div>
                          </div>

                          <div class="form-card-section">
                            <div class="input-group">
                              <label>File Number</label>
                              <input type="text" bind:value={editLoan.fileNo} />
                            </div>
                            <div class="input-group">
                              <label>Maximum Credit Limit</label>
                              <input type="number" bind:value={editLoan.maxCredit} />
                            </div>
                            <div class="input-group">
                              <label>Unique Identifier 1 (Manually Allocated Loan No)</label>
                              <input type="text" bind:value={editLoan.uniqueIdentifier1} />
                            </div>
                            <div class="input-group">
                              <label>Unique Identifier 2</label>
                              <input type="text" bind:value={editLoan.uniqueIdentifier2} />
                            </div>
                          </div>

                          <div class="full-width-group">
                            <label>Other Info</label>
                            <textarea bind:value={editLoan.otherInfo} rows="4"></textarea>
                          </div>
                        </div>
                      {/if}

                      <!-- Other Data Custom Fields (Slide 6) -->
                      {#if dataSubTab === 'other_data'}
                        <div class="custom-fields-table-wrapper fade-in">
                          <table class="custom-fields-table">
                            <thead>
                              <tr>
                                <th>Custom Field Name</th>
                                <th>Value</th>
                                <th>Order</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td class="font-bold">Fund</td>
                                <td>
                                  <select class="table-inline-input" bind:value={editLoan.fund}>
                                    <option value="ACCESS2">ACCESS2</option>
                                    <option value="PFP">PFP</option>
                                    <option value="ESM">ESM</option>
                                  </select>
                                </td>
                                <td>1</td>
                              </tr>
                              <tr>
                                <td class="font-bold">Investment Manager</td>
                                <td>
                                  <input type="text" class="table-inline-input" bind:value={editLoan.customFields.investmentManager} />
                                </td>
                                <td>2</td>
                              </tr>
                              <tr>
                                <td class="font-bold">Original Payment Date</td>
                                <td>
                                  <input type="text" class="table-inline-input" bind:value={editLoan.firstPaymentDate} />
                                </td>
                                <td>3</td>
                              </tr>
                              <tr>
                                <td class="font-bold">Grant</td>
                                <td>
                                  <input type="number" class="table-inline-input" bind:value={editLoan.customFields.grant} />
                                </td>
                                <td>4</td>
                              </tr>
                              <tr>
                                <td class="font-bold">Rate Type</td>
                                <td>
                                  <input type="text" class="table-inline-input" bind:value={editLoan.customFields.rateType} />
                                </td>
                                <td>5</td>
                              </tr>
                              <tr>
                                <td class="font-bold">Original Loan Amount</td>
                                <td>
                                  <input type="number" class="table-inline-input" bind:value={editLoan.amount} />
                                </td>
                                <td>6</td>
                              </tr>
                              <tr>
                                <td class="font-bold">Original Origination Date</td>
                                <td>
                                  <input type="text" class="table-inline-input" bind:value={editLoan.originationDate} />
                                </td>
                                <td>7</td>
                              </tr>
                              <tr>
                                <td class="font-bold">Original Amortization (months)</td>
                                <td>
                                  <input type="number" class="table-inline-input" bind:value={editLoan.termMonths} />
                                </td>
                                <td>8</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      {/if}

                      <div class="form-actions">
                        <button type="submit" class="btn-primary">💾 Save Loan Info</button>
                      </div>
                    </form>
                  </div>
                {/if}

                <!-- SUB-TAB: BORROWER INFO (Slide 7) -->
                {#if inspectorTab === 'borrower'}
                  <div class="borrower-view fade-in">
                    <!-- Top hierarchy tab -->
                    <div class="horizontal-sub-tabs">
                      <button class="sub-tab" class:active={borrowerTypeTab === 'borrower_tab'} on:click={() => borrowerTypeTab = 'borrower_tab'}>Borrower</button>
                      <button class="sub-tab" class:disabled={true}>Co-Borrower (Inactive)</button>
                      <button class="sub-tab" class:disabled={true}>Guarantor (Inactive)</button>
                    </div>

                    <!-- Inner subtabs -->
                    <div class="horizontal-sub-tabs sub-nested">
                      <button class="sub-tab" class:active={borrowerSubTab === 'borrower_fields'} on:click={() => borrowerSubTab = 'borrower_fields'}>Borrower Details</button>
                      <button class="sub-tab" class:disabled={true}>Borrower - Other Data</button>
                      <button class="sub-tab" class:disabled={true}>Notes +</button>
                      <button class="sub-tab" class:disabled={true}>Employer</button>
                    </div>

                    <form on:submit|preventDefault={saveLoanDetails} class="inspector-form">
                      {#if borrowerSubTab === 'borrower_fields'}
                        <div class="form-grid-2col fade-in">
                          <div class="form-card-section">
                            <div class="input-group">
                              <label>Social Sec.</label>
                              <input type="text" bind:value={editLoan.borrower.socialSec} placeholder="e.g. QQ 12 34 56 A" />
                            </div>
                            <div class="input-group">
                              <label>Birth Date</label>
                              <input type="text" bind:value={editLoan.borrower.birthDate} placeholder="YYYY-MM-DD" />
                            </div>
                            <div class="input-group">
                              <label>Marital Status</label>
                              <select bind:value={editLoan.borrower.maritalStatus}>
                                <option value="Single">Single</option>
                                <option value="Married">Married</option>
                                <option value="Divorced">Divorced</option>
                              </select>
                            </div>
                            <div class="input-group">
                              <label>Business Name (Organisation)</label>
                              <input type="text" bind:value={editLoan.borrower.businessName} />
                            </div>
                            <div class="form-row">
                              <div class="input-group">
                                <label>First Name</label>
                                <input type="text" bind:value={editLoan.borrower.firstName} />
                              </div>
                              <div class="input-group">
                                <label>Last Name</label>
                                <input type="text" bind:value={editLoan.borrower.lastName} />
                              </div>
                            </div>
                          </div>

                          <div class="form-card-section">
                            <div class="input-group">
                              <label>Address Line 1</label>
                              <input type="text" bind:value={editLoan.borrower.address} />
                            </div>
                            <div class="input-group">
                              <label>City</label>
                              <input type="text" bind:value={editLoan.borrower.city} />
                            </div>
                            <div class="input-group">
                              <label>State/Prov.</label>
                              <input type="text" bind:value={editLoan.borrower.stateProv} />
                            </div>
                            <div class="input-group">
                              <label>Zip/Postal Code</label>
                              <input type="text" bind:value={editLoan.borrower.postcode} />
                            </div>
                            <div class="input-group">
                              <label>Country</label>
                              <input type="text" bind:value={editLoan.borrower.country} />
                            </div>
                          </div>

                          <div class="form-card-section">
                            <div class="input-group">
                              <label>Phone</label>
                              <input type="text" bind:value={editLoan.borrower.phone} />
                            </div>
                            <div class="input-group">
                              <label>Mobile</label>
                              <input type="text" bind:value={editLoan.borrower.mobile} />
                            </div>
                            <div class="input-group">
                              <label>Email</label>
                              <input type="email" bind:value={editLoan.borrower.email} />
                            </div>
                          </div>

                          <div class="form-card-section">
                            <div class="input-group">
                              <label>Unique Identifier 1 (Customer ID)</label>
                              <input type="text" bind:value={editLoan.borrower.uniqueIdentifier1} />
                            </div>
                            <div class="input-group">
                              <label>Unique Identifier 2 (Company Registration No)</label>
                              <input type="text" bind:value={editLoan.borrower.uniqueIdentifier2} />
                            </div>
                            <div class="input-group">
                              <label>Borrower Owner/Creator</label>
                              <input type="text" bind:value={editLoan.borrower.ownerCreator} />
                            </div>
                          </div>
                        </div>
                      {/if}

                      <div class="form-actions">
                        <button type="submit" class="btn-primary">💾 Save Borrower Info</button>
                      </div>
                    </form>
                  </div>
                {/if}

                <!-- SUB-TAB: RESTRUCTURING & HOLIDAYS -->
                {#if inspectorTab === 'restructuring'}
                  <div class="restructuring-view fade-in">
                    <div class="panel-header-actions" style="margin-bottom: 20px;">
                      <div>
                        <h4 style="font-size: 16px;">🔧 Mid-Way Loan Restructuring & Holidays</h4>
                        <p class="description" style="font-size: 12px; margin-top: 4px; color: var(--text-secondary);">Dynamically configure repayment holidays, modify interest rates, alter term lengths, or set custom payments for this active loan.</p>
                      </div>
                      <button class="btn-secondary" style="border-color: var(--accent-red); color: var(--accent-red); padding: 6px 12px; font-size: 11px;" on:click={clearAllModifications}>
                        🔄 Reset All Modifications
                      </button>
                    </div>

                    <div class="form-grid-2col" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px;">
                      
                      <!-- Section 1: Repayment Holiday -->
                      <div class="form-card-section">
                        <h5>🏖️ Repayment Holiday Deferral</h5>
                        <p class="description" style="font-size: 11px; margin-bottom: 12px; color: var(--text-secondary);">Applies a 0-payment period. Unpaid interest is capitalized into the remaining balance.</p>
                        
                        <div class="input-group">
                          <label for="holiday-start">Start Payment Month #</label>
                          <input type="number" id="holiday-start" min="2" max="60" bind:value={holidayStartMonth} />
                        </div>
                        <div class="input-group">
                          <label for="holiday-dur">Duration (Months)</label>
                          <input type="number" id="holiday-dur" min="1" max="12" bind:value={holidayDuration} />
                        </div>
                        
                        <button class="btn-primary" style="margin-top: 12px;" on:click={() => addModification('holiday')}>
                          Apply Deferral Holiday
                        </button>
                      </div>

                      <!-- Section 2: Rate Adjustment -->
                      <div class="form-card-section">
                        <h5>📈 Mid-Term Rate Change</h5>
                        <p class="description" style="font-size: 11px; margin-bottom: 12px; color: var(--text-secondary);">Alters the nominal annual interest rate starting from a specific repayment month.</p>
                        
                        <div class="input-group">
                          <label for="rate-start">Effective Payment Month #</label>
                          <input type="number" id="rate-start" min="2" max="60" bind:value={rateChangeMonth} />
                        </div>
                        <div class="input-group">
                          <label for="rate-val">New Interest Rate (%)</label>
                          <input type="text" id="rate-val" bind:value={newRateValue} />
                        </div>
                        
                        <button class="btn-primary" style="margin-top: 12px;" on:click={() => addModification('rate_change')}>
                          Apply Rate Modification
                        </button>
                      </div>

                      <!-- Section 3: Term Modification -->
                      <div class="form-card-section">
                        <h5>📅 Term Length Adjustment</h5>
                        <p class="description" style="font-size: 11px; margin-bottom: 12px; color: var(--text-secondary);">Changes the total number of amortization payments (extends or reduces remaining months).</p>
                        
                        <div class="input-group">
                          <label for="term-start">Effective Payment Month #</label>
                          <input type="number" id="term-start" min="2" max="60" bind:value={termChangeMonth} />
                        </div>
                        <div class="input-group">
                          <label for="term-val">New Total Term (Months)</label>
                          <input type="number" id="term-val" min="10" max="120" bind:value={newTermValue} />
                        </div>
                        
                        <button class="btn-primary" style="margin-top: 12px;" on:click={() => addModification('term_extension')}>
                          Apply Term Adjustment
                        </button>
                      </div>

                      <!-- Section 4: Custom Monthly Payment -->
                      <div class="form-card-section">
                        <h5>💸 Custom Monthly Payment</h5>
                        <p class="description" style="font-size: 11px; margin-bottom: 12px; color: var(--text-secondary);">Overrides the calculated PMT value with a custom fixed payment amount starting from month X.</p>
                        
                        <div class="input-group">
                          <label for="pmt-start">Effective Payment Month #</label>
                          <input type="number" id="pmt-start" min="2" max="60" bind:value={pmtChangeMonth} />
                        </div>
                        <div class="input-group">
                          <label for="pmt-val">New Monthly Payment Amount (£)</label>
                          <input type="number" id="pmt-val" min="10" bind:value={newPmtValue} />
                        </div>
                        
                        <button class="btn-primary" style="margin-top: 12px;" on:click={() => addModification('payment_change')}>
                          Apply Payment Override
                        </button>
                      </div>

                    </div>

                    <!-- Modifications list summary -->
                    {#if selectedLoan.modifications && selectedLoan.modifications.length > 0}
                      <div class="custom-fields-table-wrapper" style="margin-top: 24px; border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden;">
                        <table class="custom-fields-table" style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                          <thead>
                            <tr style="background: rgba(255,255,255,0.02); color: var(--text-secondary);">
                              <th style="padding: 10px 14px;">Applied Restructure Item</th>
                              <th style="padding: 10px 14px;">Effective Month</th>
                              <th style="padding: 10px 14px;">Duration</th>
                              <th style="padding: 10px 14px;">Value / Setting</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each selectedLoan.modifications as mod}
                              <tr style="border-top: 1px solid var(--border-color);">
                                <td class="font-bold" style="text-transform: uppercase; padding: 10px 14px;">{mod.type.replace('_', ' ')}</td>
                                <td style="padding: 10px 14px;">Month #{mod.effectiveMonthNum}</td>
                                <td style="padding: 10px 14px;">{mod.duration ? mod.duration + ' months' : 'Permanent'}</td>
                                <td class="mono" style="padding: 10px 14px; font-family: var(--font-code); color: var(--accent-blue);">{mod.newValue || 'N/A'}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    {/if}
                  </div>
                {/if}

              </div>
            </div>
          </div>
        {/if}

      </div>
    {/if}

    <!-- TAB 2: BULK POST REPAYMENTS (Slide 8) -->
    {#if activeTab === 'bulk'}
      <div class="bulk-container fade-in">
        <!-- Top selection configurations -->
        <div class="bulk-config-card glass-card">
          <div class="panel-header">
            <h3>Post Payments - Reconcile Direct Debits</h3>
            <p>Select due repayments downloaded from direct-debit portal files to update active loan accounts in bulk.</p>
          </div>
          <div class="bulk-config-grid">
            <div class="input-group">
              <label>Reconciliation Payment Date</label>
              <input type="text" bind:value={bulkRepaymentDate} placeholder="DD/MM/YYYY" />
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="selectAllDue" bind:checked={bulkSelectAll} on:change={handleBulkSelectAllChange} />
              <label for="selectAllDue">Select all Due payments at, or before this date</label>
            </div>
            <div class="radio-source-group">
              <span class="lbl-source">Active Records from:</span>
              <label><input type="radio" name="source" checked /> Main window</label>
              <label><input type="radio" name="source" /> Spreadsheet Import</label>
            </div>
          </div>
        </div>

        <!-- Payments list grid -->
        <div class="bulk-table-card glass-card">
          <div class="table-wrapper">
            <table class="bulk-payments-table">
              <thead>
                <tr>
                  <th width="40"><input type="checkbox" bind:checked={bulkSelectAll} on:change={handleBulkSelectAllChange} /></th>
                  <th>Seq.</th>
                  <th>MLM Record ID</th>
                  <th>Orig Line</th>
                  <th>Line Status</th>
                  <th>File No.</th>
                  <th>Unique Loan ID</th>
                  <th>Company Business</th>
                  <th>Expected Date</th>
                  <th>Expected Payment</th>
                  <th>Expected Principal</th>
                  <th>Expected Interest</th>
                </tr>
              </thead>
              <tbody>
                {#each $loans.filter(l => l.status === 'Active') as loan, i}
                  {@const amort = generateAmortization(loan)}
                  {@const curPmtNum = loan.nextPaymentNum || 1}
                  {@const rowData = amort.schedule.find(s => s.num === curPmtNum)}
                  {#if rowData}
                    <tr class="bulk-payment-row" class:selected={bulkSelectedRows[loan.loanId]}>
                      <td>
                        <input type="checkbox" bind:checked={bulkSelectedRows[loan.loanId]} />
                      </td>
                      <td class="mono">{i + 1}</td>
                      <td class="mono text-blue">{10020 + i * 3}</td>
                      <td class="mono">{curPmtNum}</td>
                      <td>
                        <span class="badge-due">Due Pmt</span>
                      </td>
                      <td class="mono">{loan.fileNo || 'F-2021'}</td>
                      <td class="mono font-bold text-blue">{loan.loanId}</td>
                      <td class="font-bold">{loan.companyName}</td>
                      <td class="mono">{formatDateStr(rowData.date)}</td>
                      <td class="mono font-bold">
                        £<input type="number" class="inline-table-num" bind:value={bulkPaymentAmounts[loan.loanId]} />
                      </td>
                      <td class="mono text-green">£{rowData.principalPaid.toLocaleString()}</td>
                      <td class="mono text-orange">£{rowData.interestPaid.toLocaleString()}</td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Bottom Summary Metrics (Slide 8 bottom) -->
          <div class="bulk-totals-panel">
            <div class="bulk-totals-table">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>On Date</th>
                    <th>Global Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total 'Payment' Column:</td>
                    <td class="mono font-bold">£{Object.keys(bulkSelectedRows).reduce((sum, key) => sum + (bulkSelectedRows[key] ? (bulkPaymentAmounts[key] || 0) : 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td class="mono text-blue">£{Object.keys(bulkSelectedRows).reduce((sum, key) => sum + (bulkSelectedRows[key] ? (bulkPaymentAmounts[key] || 0) : 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                  <tr>
                    <td>Due Payments:</td>
                    <td class="mono">£{Object.keys(bulkSelectedRows).reduce((sum, key) => sum + (bulkSelectedRows[key] ? (bulkPaymentAmounts[key] || 0) : 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td class="mono">£{Object.keys(bulkSelectedRows).reduce((sum, key) => sum + (bulkSelectedRows[key] ? (bulkPaymentAmounts[key] || 0) : 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                  <tr>
                    <td>Outstanding Balance Reconciliation:</td>
                    <td class="mono text-green">£0.00</td>
                    <td class="mono text-green">£0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Apply actions -->
            <div class="bulk-post-actions">
              <button class="btn-primary" on:click={applyBulkPayments}>
                ✔️ Apply Bulk Direct-Debit Payments
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- TAB 3: INTEGRATIONS, BOOKING & CODES -->
    {#if activeTab === 'integrations'}
      <div class="integrations-container fade-in">
        <div class="grid-2col">
          <!-- Margill Booking Engine -->
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
                    <option value="">-- Choose a Deal to Book --</option>
                    {#each pendingBookings as opp}
                      <option value={opp.id}>{opp.companyName} (£{opp.dealSize.toLocaleString()})</option>
                    {/each}
                  </select>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="margillId">Margill Loan ID</label>
                    <input type="text" id="margillId" bind:value={customLoanId} placeholder="e.g. 1108" required />
                  </div>
                  <div class="form-group">
                    <label for="fundSelect">Portfolio Fund</label>
                    <select id="fundSelect" bind:value={chosenFund}>
                      <option value="ACCESS2">ACCESS2</option>
                      <option value="PFP">PFP</option>
                      <option value="ESM">ESM</option>
                    </select>
                  </div>
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

                <div class="form-row">
                  <div class="form-group">
                    <label for="managerSelect">Investment Manager</label>
                    <select id="managerSelect" bind:value={chosenManager}>
                      <option value="Linda Wickstrom">Linda Wickstrom</option>
                      <option value="Alice Vane">Alice Vane</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="creditorSelect">Creditor Entity</label>
                    <select id="creditorSelect" bind:value={chosenCreditor}>
                      <option value="Big Issue Invest">Big Issue Invest</option>
                      <option value="Key Fund">Key Fund</option>
                    </select>
                  </div>
                </div>

                {#if selectedOpp}
                  <div class="compliance-audit-card" class:non-compliant={!selectedOppChecklistStatus.allCompleted} class:compliant={selectedOppChecklistStatus.allCompleted}>
                    <div class="compliance-header">
                      <span class="compliance-shield">🛡️</span>
                      <h3>Pre-Disbursement Compliance Checklist Audit</h3>
                    </div>

                    {#if !selectedOppChecklistStatus.allCompleted}
                      <div class="compliance-banner warn-banner">
                        <span class="banner-icon">⚠️</span>
                        <div>
                          <strong>Pre-Disbursement Audit Failed</strong>
                          <p>{selectedOppChecklistStatus.total - selectedOppChecklistStatus.completed} outstanding compliance items must be completed before funding.</p>
                        </div>
                      </div>
                    {:else}
                      <div class="compliance-banner success-banner">
                        <span class="banner-icon">✅</span>
                        <div>
                          <strong>Pre-Disbursement Audit Passed</strong>
                          <p>All checklist tasks are completed. Ready for funding.</p>
                        </div>
                      </div>
                    {/if}

                    <div class="compliance-stages-list">
                      {#each checklistStages as stageId}
                        {@const stageItems = selectedOpp.checklist?.[stageId] || []}
                        {@const completedCount = stageItems.filter(i => i.completed).length}
                        {@const totalCount = stageItems.length}
                        {@const stageLabel = {
                          pre_dd: 'Pre-Due Diligence',
                          dd: 'Due Diligence',
                          ic: 'Ready for IC',
                          approved: 'Loan Approved',
                          signed: 'Deal Signed'
                        }[stageId]}
                        {@const isStageDone = completedCount === totalCount && totalCount > 0}

                        <div class="compliance-stage-row" class:stage-done={isStageDone}>
                          <div class="stage-meta-row">
                            <span class="compliance-dot" class:dot-done={isStageDone}></span>
                            <span class="compliance-stage-name">{stageLabel}</span>
                            <span class="compliance-fraction">{completedCount}/{totalCount}</span>
                          </div>
                          
                          {#if stageItems.length > 0}
                            <div class="compliance-item-details">
                              {#each stageItems as item}
                                <label class="compliance-item-line" class:item-pending={!item.completed}>
                                  <input 
                                    type="checkbox" 
                                    checked={item.completed} 
                                    on:change={() => {
                                      toggleChecklistItem(selectedOpp.id, stageId, item.id);
                                    }}
                                  />
                                  <span class="item-label-txt">{item.label}</span>
                                  <span class="item-status-tag">{item.completed ? 'Completed' : 'Pending'}</span>
                                </label>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}

                <button type="submit" class="btn-primary w-full" disabled={!selectedOppChecklistStatus.allCompleted}>Confirm Booking & Sync API</button>
              </form>
            {/if}
          </div>

          <!-- Excel daily sync -->
          <div class="glass-card flex-col">
            <div class="card-header">
              <h2>Excel Daily Reconciliations</h2>
              <p>Reconcile portfolios using spreadsheet extracts downloaded from external managers (Slide 9).</p>
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
              <p>Supports Margill / Ledger Excel extracts containing Capital / Interest components</p>
              <span class="file-hint">Simulate dropping: Margill_YTD_Reconciliation_Report.xlsx</span>
            </div>

            {#if excelSyncResults}
              <div class="sync-results fade-in">
                <h4>Reconciliation Summary:</h4>
                <div class="res-row">
                  <span class="res-lbl">File Name:</span>
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

        <!-- Webhooks & Double-Entry journals -->
        <div class="grid-2col" style="margin-top: 24px;">
          <!-- API logs -->
          <div class="glass-card code-card">
            <div class="card-header">
              <h3>🔌 API Webhook Payload Inspector</h3>
              <p>Real-time POST body synced to Margill integration endpoints.</p>
            </div>
            <div class="console-box">
              {#each apiLogs as log}
                <pre class="json-code"><code>{JSON.stringify(log, null, 2)}</code></pre>
              {:else}
                <div class="empty-code-console">No API payloads generated. Book a loan or post repayments to test.</div>
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
                        <td class="desc-cell">{entry.desc}</td>
                        <td class="mono">{entry.acctCode}</td>
                        <td>{entry.acctName}</td>
                        <td class="bold">{entry.type}</td>
                        <td class="mono numeric-ledger">£{entry.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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
    {/if}

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

  .action-tabs {
    display: flex;
    gap: 8px;
    background: rgba(255, 255, 255, 0.02);
    padding: 4px;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }

  .nav-tab {
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    border-radius: 6px;
    transition: var(--transition-smooth);
  }

  .nav-tab:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.03);
  }

  .nav-tab.active {
    color: #fff;
    background: var(--accent-blue);
    box-shadow: 0 2px 8px rgba(51, 153, 255, 0.3);
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

  /* Filters styling */
  .filters-card {
    padding: 16px 24px;
    margin-bottom: 16px;
  }

  .filter-header h4 {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent-blue);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
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
    padding: 8px 12px;
    font-size: 12px;
    color: var(--text-primary);
  }

  /* Margill Database Table */
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.15);
  }

  .margill-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
  }

  .margill-table th, .margill-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .margill-table th {
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.5px;
  }

  .record-row {
    cursor: pointer;
    transition: var(--transition-smooth);
  }

  .record-row:hover {
    background: rgba(255, 255, 255, 0.025);
  }

  .record-row.selected {
    background: rgba(51, 153, 255, 0.08);
    border-left: 3px solid var(--accent-blue);
  }

  .status-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .status-badge.active {
    background: rgba(46, 204, 113, 0.15);
    color: var(--accent-green);
    border: 1px solid rgba(46, 204, 113, 0.25);
  }

  .status-badge.closed {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  .status-badge.bad-debt {
    background: rgba(231, 76, 60, 0.15);
    color: var(--accent-red);
    border: 1px solid rgba(231, 76, 60, 0.25);
  }

  /* Slide 2 Bottom Metrics Bar */
  .record-metrics-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .metric-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(255, 255, 255, 0.01);
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.03);
  }

  .m-lbl {
    font-size: 10px;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: 600;
  }

  .m-val {
    font-size: 15px;
    font-weight: 800;
    font-family: var(--font-code);
  }

  /* Selected Loan Inspector (Slide 3-7) */
  .inspector-card {
    margin-top: 24px;
    padding: 24px;
    border-color: rgba(51, 153, 255, 0.15);
  }

  .inspector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 16px;
    margin-bottom: 20px;
  }

  .inspector-meta-capsules {
    display: flex;
    gap: 8px;
  }

  .capsule {
    font-size: 11px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    padding: 4px 10px;
    border-radius: 20px;
  }

  .inspector-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 24px;
  }

  /* Left Vertical Tabs */
  .v-tabs-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-right: 1px solid var(--border-color);
    padding-right: 16px;
  }

  .v-tab {
    text-align: left;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    border-radius: 6px;
    transition: var(--transition-smooth);
  }

  .v-tab:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.02);
  }

  .v-tab.active {
    color: #fff;
    background: rgba(51, 153, 255, 0.1);
    border-left: 3px solid var(--accent-blue);
    padding-left: 17px;
  }

  .v-tab.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .inspector-content-pane {
    min-height: 400px;
  }

  /* Amortization Schedule View (Slide 3) */
  .schedule-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }

  .ss-box {
    display: flex;
    flex-direction: column;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .ss-lbl {
    font-size: 9px;
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
  }

  .ss-val {
    font-size: 15px;
    font-weight: 800;
    margin-top: 4px;
  }

  .ss-val.text-orange { color: var(--accent-orange); }
  .ss-val.text-blue { color: var(--accent-blue); }

  .panel-header-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .scroll-table-wrapper {
    max-height: 350px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: 8px;
  }

  .amort-schedule-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    text-align: left;
  }

  .amort-schedule-table th, .amort-schedule-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .amort-schedule-table th {
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-secondary);
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .schedule-row.processed {
    background: rgba(46, 204, 113, 0.02);
    opacity: 0.6;
  }

  .schedule-row.current-pmt {
    background: rgba(51, 153, 255, 0.08);
    font-weight: 700;
    border-left: 3px solid var(--accent-blue);
  }

  .tag-information {
    color: var(--accent-purple);
    font-weight: 700;
  }

  .tag-paid-pmt {
    color: var(--accent-green);
    font-weight: 600;
  }

  .tag-due-pmt {
    color: var(--accent-blue);
    font-weight: 600;
  }

  .tag-repayment-holiday {
    color: var(--accent-orange);
    font-weight: 700;
    text-transform: uppercase;
    background: rgba(243, 156, 18, 0.1);
    border: 1px solid rgba(243, 156, 18, 0.2);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 9px;
    display: inline-block;
  }

  .schedule-row.holiday-row {
    background: rgba(243, 156, 18, 0.04);
  }

  /* Form layouts (Slide 4, 5, 7) */
  .horizontal-sub-tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }

  .sub-tab {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    border-radius: 4px;
    transition: var(--transition-smooth);
  }

  .sub-tab.active {
    color: #fff;
    background: rgba(255,255,255,0.06);
  }

  .sub-tab.disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .horizontal-sub-tabs.sub-nested {
    border-bottom: none;
    margin-bottom: 20px;
    padding-bottom: 0;
  }

  .horizontal-sub-tabs.sub-nested .sub-tab {
    background: transparent;
    border: 1px solid var(--border-color);
  }

  .horizontal-sub-tabs.sub-nested .sub-tab.active {
    border-color: var(--accent-blue);
    color: var(--accent-blue);
  }

  .inspector-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .form-card-section {
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-card-section h5 {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--accent-blue);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
    margin-bottom: 4px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-group select, .input-group input, .full-width-group textarea {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 8px 10px;
    font-size: 12px;
    color: #fff;
    width: 100%;
  }

  .full-width-group {
    grid-column: span 2;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 12px;
    border-top: 1px solid var(--border-color);
  }

  /* Custom fields table (Slide 6) */
  .custom-fields-table-wrapper {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
  }

  .custom-fields-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
  }

  .custom-fields-table th, .custom-fields-table td {
    padding: 10px 14px;
    border-bottom: 1px solid var(--border-color);
  }

  .custom-fields-table th {
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-secondary);
    font-weight: 600;
  }

  .table-inline-input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 12px;
    width: 100%;
    color: #fff;
  }

  /* TAB 2: BULK PAYMENTS (Slide 8) */
  .bulk-config-card {
    padding: 16px 24px;
    margin-bottom: 16px;
  }

  .bulk-config-grid {
    display: grid;
    grid-template-columns: 240px 1fr 1fr;
    align-items: center;
    gap: 24px;
    margin-top: 16px;
  }

  .checkbox-group {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .radio-source-group {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 12px;
  }

  .lbl-source {
    color: var(--text-secondary);
  }

  .bulk-payments-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    text-align: left;
  }

  .bulk-payments-table th, .bulk-payments-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-color);
  }

  .bulk-payments-table th {
    background: rgba(255, 255, 255, 0.02);
    color: var(--text-secondary);
  }

  .bulk-payment-row {
    transition: var(--transition-smooth);
    opacity: 0.8;
  }

  .bulk-payment-row.selected {
    background: rgba(51, 153, 255, 0.04);
    opacity: 1;
  }

  .badge-due {
    font-size: 9px;
    font-weight: 700;
    color: var(--accent-orange);
    background: rgba(243, 156, 18, 0.1);
    border: 1px solid rgba(243, 156, 18, 0.2);
    padding: 1px 4px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .inline-table-num {
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    padding: 2px 4px;
    color: #fff;
    width: 80px;
    font-family: var(--font-code);
  }

  .bulk-totals-panel {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
  }

  .bulk-totals-table {
    width: 450px;
  }

  .bulk-totals-table table {
    width: 100%;
    font-size: 11px;
  }

  .bulk-totals-table th {
    text-align: left;
    color: var(--text-secondary);
    padding-bottom: 8px;
  }

  .bulk-totals-table td {
    padding: 4px 0;
  }

  .bulk-post-actions {
    display: flex;
    gap: 12px;
  }

  /* Booking & Integrations */
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

  /* API & Ledger consoles */
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

  .fade-in {
    animation: fadeIn 0.3s ease-out;
  }

  /* Compliance Audit Panel styles */
  .compliance-audit-card {
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    margin: 20px 0;
    transition: var(--transition-smooth);
  }

  .compliance-audit-card.non-compliant {
    border-color: rgba(231, 76, 60, 0.2);
    background: rgba(231, 76, 60, 0.02);
  }

  .compliance-audit-card.compliant {
    border-color: rgba(46, 204, 113, 0.2);
    background: rgba(46, 204, 113, 0.02);
  }

  .compliance-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .compliance-header h3 {
    font-size: 14px;
    font-weight: 700;
    margin: 0;
  }

  .compliance-shield {
    font-size: 16px;
  }

  .compliance-banner {
    display: flex;
    gap: 12px;
    padding: 12px;
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 16px;
    align-items: center;
  }

  .compliance-banner.warn-banner {
    background: rgba(231, 76, 60, 0.1);
    border: 1px solid rgba(231, 76, 60, 0.2);
    color: #f19086;
  }

  .compliance-banner.success-banner {
    background: rgba(46, 204, 113, 0.1);
    border: 1px solid rgba(46, 204, 113, 0.2);
    color: #a3e4d7;
  }

  .compliance-banner p {
    margin: 2px 0 0 0;
    font-size: 11px;
    opacity: 0.8;
  }

  .compliance-stages-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .compliance-stage-row {
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
  }

  .compliance-stage-row.stage-done {
    border-color: rgba(46, 204, 113, 0.15);
  }

  .stage-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .compliance-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
  }

  .compliance-dot.dot-done {
    background: var(--accent-green);
    box-shadow: 0 0 6px var(--accent-green);
  }

  .compliance-stage-name {
    font-size: 11px;
    font-weight: 700;
    flex: 1;
  }

  .compliance-fraction {
    font-size: 10px;
    color: var(--text-muted);
  }

  .compliance-item-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 14px;
    border-left: 1px dashed var(--border-color);
    margin-top: 4px;
  }

  .compliance-item-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-secondary);
    padding: 2px 0;
    cursor: pointer;
  }

  .compliance-item-line input[type="checkbox"] {
    cursor: pointer;
    width: 12px;
    height: 12px;
    accent-color: var(--accent-blue);
  }

  .item-label-txt {
    flex: 1;
  }

  .item-status-tag {
    font-size: 9px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(46, 204, 113, 0.15);
    color: var(--accent-green);
  }

  .item-pending .item-status-tag {
    background: rgba(231, 76, 60, 0.15);
    color: var(--accent-red);
  }

  .btn-primary:disabled {
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid var(--border-color) !important;
    color: var(--text-muted) !important;
    box-shadow: none !important;
    cursor: not-allowed;
    transform: none !important;
  }
</style>
