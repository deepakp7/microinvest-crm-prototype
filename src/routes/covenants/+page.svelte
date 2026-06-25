<script>
  import { loans, covenants, userRole, addCovenant, collectCovenant, requestCovenantData } from '$lib/store.js';

  // Filters
  let searchQuery = '';
  let selectedType = 'All'; // 'All', 'Covenant', 'Condition Subsequent'
  let selectedStatus = 'All'; // 'All', 'Pending', 'Overdue', 'Collected'
  let selectedManager = 'All';

  // Modal / Add covenant form state
  let showAddForm = false;
  let newLoanId = '';
  let newType = 'Covenant';
  let newTitle = '';
  let newDescription = '';
  let newDueDate = '2026-07-31';
  let newManager = 'Linda Wickstrom';

  // Modal / Collection form state
  let collectingCovId = null;
  let uploadFileName = '';
  let collectionNotes = '';

  $: activeLoans = $loans.filter(l => l.status === 'Active');
  $: managersList = ['All', 'Linda Wickstrom', 'Alice Vane', 'Bob Miller'];

  // Stats Calculations
  $: totalCount = $covenants.length;
  $: overdueCount = $covenants.filter(c => c.status === 'Overdue').length;
  $: collectedCount = $covenants.filter(c => c.status === 'Collected').length;
  $: pendingCount = $covenants.filter(c => c.status === 'Pending').length;
  $: completionRate = totalCount > 0 ? Math.round((collectedCount / totalCount) * 100) : 0;

  // Filtered List
  $: filteredCovenants = $covenants.filter(c => {
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inCompany = c.companyName.toLowerCase().includes(q);
      const inTitle = c.title.toLowerCase().includes(q);
      const inDesc = c.description.toLowerCase().includes(q);
      const inLoanId = c.loanId.includes(q);
      if (!inCompany && !inTitle && !inDesc && !inLoanId) return false;
    }
    // Type filter
    if (selectedType !== 'All' && c.type !== selectedType) return false;
    // Status filter
    if (selectedStatus !== 'All' && c.status !== selectedStatus) return false;
    // Manager filter
    if (selectedManager !== 'All' && c.manager !== selectedManager) return false;

    return true;
  });

  function handleAddCovenant() {
    if (!newLoanId || !newTitle) return;

    const matchedLoan = $loans.find(l => l.loanId === newLoanId);
    const companyName = matchedLoan ? matchedLoan.companyName : 'Unknown Borrower';

    // Set initial status to Pending unless date is already past
    const isPast = new Date(newDueDate) < new Date();
    const status = isPast ? 'Overdue' : 'Pending';

    addCovenant({
      loanId: newLoanId,
      companyName,
      type: newType,
      title: newTitle,
      description: newDescription,
      dueDate: newDueDate,
      manager: newManager,
      status
    });

    // Reset form
    newLoanId = '';
    newTitle = '';
    newDescription = '';
    newDueDate = '2026-07-31';
    showAddForm = false;
  }

  function openCollectModal(id) {
    collectingCovId = id;
    const cov = $covenants.find(c => c.id === id);
    uploadFileName = cov ? `${cov.companyName.replace(/\s+/g, '_')}_${cov.title.replace(/\s+/g, '_')}.pdf` : '';
    collectionNotes = '';
  }

  function handleCollect() {
    if (!collectingCovId) return;
    collectCovenant(collectingCovId, uploadFileName || 'uploaded_document.pdf', collectionNotes);
    collectingCovId = null;
  }

  function handleSimulatedUploadClick() {
    const filenames = [
      'Laing_Q1_26_Mgmt_Accounts.xlsx',
      'SolarTech_CompaniesHouse_Charge_MR01.pdf',
      'NextGen_RBS_Account_Confirmation.pdf',
      'Newton_Signed_Board_Resolution.pdf',
      'ESG_Environmental_Impact_Q2.xlsx'
    ];
    uploadFileName = filenames[Math.floor(Math.random() * filenames.length)];
  }
</script>

<div class="covenants-page">
  <div class="header-container">
    <div class="title-section">
      <span class="badge-tag">PORTFOLIO ASSURANCE</span>
      <h1>Portfolio Covenants & CS Control Center</h1>
      <p class="description">Monitor post-disbursement client deliverables: check financial covenants, collect Conditions Subsequent (CS) agreed at signing, upload evidence, and dispatch email queries.</p>
    </div>

    <button class="btn-primary" on:click={() => showAddForm = true}>
      ➕ Add New Requirement
    </button>
  </div>

  <!-- Stats Grid -->
  <div class="kpi-grid">
    <div class="kpi-card glass-card">
      <div class="kpi-content">
        <span class="kpi-label">Active Requirements</span>
        <span class="kpi-value">{totalCount} items</span>
        <span class="kpi-sub">{pendingCount} pending review</span>
      </div>
      <div class="kpi-icon blue">📋</div>
    </div>

    <div class="kpi-card glass-card" class:urgent-alert={overdueCount > 0}>
      <div class="kpi-content">
        <span class="kpi-label">Overdue Covenants / CS</span>
        <span class="kpi-value" class:text-orange={overdueCount > 0}>{overdueCount} items</span>
        <span class="kpi-sub">{overdueCount > 0 ? 'Urgent follow-up required' : 'All schedules on track'}</span>
      </div>
      <div class="kpi-icon orange">⚠️</div>
    </div>

    <div class="kpi-card glass-card">
      <div class="kpi-content">
        <span class="kpi-label">Collected Requirements</span>
        <span class="kpi-value text-green">{collectedCount} satisfied</span>
        <span class="kpi-sub">Document files reconciled</span>
      </div>
      <div class="kpi-icon green">✓</div>
    </div>

    <div class="kpi-card glass-card">
      <div class="kpi-content">
        <span class="kpi-label">Portfolio Completion Rate</span>
        <span class="kpi-value text-blue">{completionRate}%</span>
        <div class="progress-bar-bg" style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; margin-top: 6px; overflow: hidden;">
          <div class="progress-bar-fill" style="width: {completionRate}%; height: 100%; background: var(--accent-blue);"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters Row -->
  <div class="filters-card glass-card">
    <div class="filter-grid">
      <div class="filter-group">
        <label for="search">Fuzzy Search</label>
        <input type="text" id="search" placeholder="Search borrower, covenant..." bind:value={searchQuery} />
      </div>

      <div class="filter-group">
        <label for="type">Requirement Type</label>
        <select id="type" bind:value={selectedType}>
          <option value="All">All Types</option>
          <option value="Covenant">Covenants (Financial)</option>
          <option value="Condition Subsequent">Conditions Subsequent (Signing)</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="status">Deliverable Status</label>
        <select id="status" bind:value={selectedStatus}>
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
          <option value="Collected">Collected</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="manager">Portfolio Manager</label>
        <select id="manager" bind:value={selectedManager}>
          {#each managersList as m}
            <option value={m}>{m === 'All' ? 'All Managers' : m}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Main Covenants Workspace Table -->
  <div class="records-card glass-card" style="margin-top: 24px;">
    <div class="card-header">
      <h3>Active Compliance Schedule Log</h3>
      <p>Displays all ongoing covenant and conditions subsequent timelines. Click Collect to upload reports or Request Data to query the client.</p>
    </div>

    <div class="table-wrapper">
      <table class="covenants-table">
        <thead>
          <tr>
            <th>Borrower</th>
            <th>Loan Ref</th>
            <th>Type</th>
            <th>Deliverable Title</th>
            <th>Requirements Specification</th>
            <th>Due Date</th>
            <th>Responsible Manager</th>
            <th>Status</th>
            <th style="text-align: right;">Action Control</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredCovenants as cov}
            <tr class="record-row" class:collected={cov.status === 'Collected'}>
              <td class="font-bold">{cov.companyName}</td>
              <td class="mono text-blue">{cov.loanId}</td>
              <td>
                <span class="type-badge" class:cs={cov.type === 'Condition Subsequent'}>
                  {cov.type === 'Condition Subsequent' ? 'CS' : 'Covenant'}
                </span>
              </td>
              <td class="font-bold">{cov.title}</td>
              <td class="desc-cell text-muted">{cov.description}</td>
              <td class="mono" class:text-red={cov.status === 'Overdue'}>{cov.dueDate}</td>
              <td>{cov.manager}</td>
              <td>
                <span class="status-badge {cov.status.toLowerCase()}">
                  {cov.status}
                </span>
              </td>
              <td style="text-align: right;">
                <div class="actions-group">
                  {#if cov.status !== 'Collected'}
                    <button class="action-btn collect" on:click={() => openCollectModal(cov.id)}>
                      📥 Collect
                    </button>
                    <button class="action-btn query" on:click={() => requestCovenantData(cov.id)}>
                      ✉️ Request Data
                    </button>
                  {:else}
                    <div class="evidence-pill" title="Collected: {new Date(cov.collectedDate).toLocaleDateString()}. Notes: {cov.notes}">
                      📎 {cov.attachedFile}
                    </div>
                  {/if}
                </div>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="9" class="no-records-placeholder">
                No matching requirements found. Use filters above or click "Add New Requirement" to create one.
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- MODAL: ADD COVENANT / CS -->
  {#if showAddForm}
    <div class="modal-overlay" on:click={() => showAddForm = false}>
      <div class="modal-content glass-card" on:click|stopPropagation>
        <div class="modal-header">
          <div>
            <span class="badge-tag">SETUP REQUIREMENTS</span>
            <h2>Create Deliverable Requirement</h2>
          </div>
          <button class="close-btn" on:click={() => showAddForm = false}>✕</button>
        </div>

        <form on:submit|preventDefault={handleAddCovenant} class="modal-form">
          <div class="form-grid">
            <div class="input-group">
              <label for="loan">Linked Active Loan</label>
              <select id="loan" bind:value={newLoanId} required>
                <option value="">-- Select Active Loan Borrower --</option>
                {#each activeLoans as l}
                  <option value={l.loanId}>{l.companyName} (Loan ID: {l.loanId})</option>
                {/each}
              </select>
            </div>

            <div class="input-group">
              <label for="cov-type">Requirement Type</label>
              <select id="cov-type" bind:value={newType} required>
                <option value="Covenant">Covenant (Financial Reporting)</option>
                <option value="Condition Subsequent">Condition Subsequent (Signing Action)</option>
              </select>
            </div>

            <div class="input-group full-width">
              <label for="title">Deliverable Title</label>
              <input type="text" id="title" placeholder="e.g. Q3 2026 Management Accounts" bind:value={newTitle} required />
            </div>

            <div class="input-group full-width">
              <label for="desc">Requirements Specification</label>
              <textarea id="desc" rows="3" placeholder="Detail specific files, balances, ratios, or legal filings required." bind:value={newDescription}></textarea>
            </div>

            <div class="input-group">
              <label for="due">Target Due Date</label>
              <input type="date" id="due" bind:value={newDueDate} required />
            </div>

            <div class="input-group">
              <label for="cov-manager">Portfolio Manager</label>
              <select id="cov-manager" bind:value={newManager}>
                <option value="Linda Wickstrom">Linda Wickstrom</option>
                <option value="Alice Vane">Alice Vane</option>
                <option value="Bob Miller">Bob Miller</option>
              </select>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" on:click={() => showAddForm = false}>Cancel</button>
            <button type="submit" class="btn-primary">Add Deliverable Requirement</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- MODAL: COLLECT EVIDENCE / FILE UPLOAD -->
  {#if collectingCovId !== null}
    <div class="modal-overlay" on:click={() => collectingCovId = null}>
      <div class="modal-content glass-card" style="width: 500px;" on:click|stopPropagation>
        <div class="modal-header">
          <div>
            <span class="badge-tag">DELIVERABLE COMPLIANCE</span>
            <h2>Reconcile & Collect Deliverable</h2>
          </div>
          <button class="close-btn" on:click={() => collectingCovId = null}>✕</button>
        </div>

        <form on:submit|preventDefault={handleCollect} class="modal-form">
          <div class="form-grid" style="grid-template-columns: 1fr;">
            
            <div class="drag-drop-zone" style="min-height: 120px; padding: 16px;" on:click={handleSimulatedUploadClick}>
              <div class="drop-icon" style="font-size: 24px; margin-bottom: 6px;">📥</div>
              <h3>Click to select or drop document files</h3>
              {#if uploadFileName}
                <div class="file-hint" style="background: rgba(46, 204, 113, 0.1); color: var(--accent-green); border: 1px solid rgba(46, 204, 113, 0.2); font-weight: 700; margin-top: 6px; padding: 4px 8px;">
                  Selected: {uploadFileName}
                </div>
              {:else}
                <span class="file-hint">Simulate document upload: PDF / XLSX</span>
              {/if}
            </div>

            <div class="input-group">
              <label for="evidence-file">Evidence File Name</label>
              <input type="text" id="evidence-file" bind:value={uploadFileName} required placeholder="Laing_Project_Accounts_Q1_26.xlsx" />
            </div>

            <div class="input-group">
              <label for="notes">Verification Audit Notes</label>
              <textarea id="notes" rows="4" placeholder="Enter comments regarding ratio check, balance sheet verification, or legal document checks." bind:value={collectionNotes}></textarea>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" on:click={() => collectingCovId = null}>Cancel</button>
            <button type="submit" class="btn-primary" disabled={!uploadFileName}>Confirm Deliverable Satisfied</button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .covenants-page {
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

  /* KPI Grid */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-bottom: 28px;
  }

  .kpi-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
  }

  .kpi-content {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .kpi-label {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .kpi-value {
    font-size: 24px;
    font-weight: 800;
    font-family: var(--font-heading);
    margin-bottom: 4px;
  }

  .kpi-sub {
    font-size: 10px;
    color: var(--text-muted);
  }

  .kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }

  .kpi-icon.blue { color: var(--accent-blue); background: rgba(51, 153, 255, 0.08); }
  .kpi-icon.green { color: var(--accent-green); background: rgba(46, 204, 113, 0.08); }
  .kpi-icon.orange { color: var(--accent-orange); background: rgba(243, 156, 18, 0.08); }

  .urgent-alert {
    border-color: rgba(231, 76, 60, 0.3);
    background: rgba(231, 76, 60, 0.03);
  }

  /* Filters */
  .filters-card {
    padding: 16px 24px;
  }

  .filter-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
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

  .filter-group select, .filter-group input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-primary);
  }

  /* Covenants Table styling */
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

  .covenants-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
  }

  .covenants-table th, .covenants-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }

  .covenants-table th {
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
    background: rgba(255, 255, 255, 0.015);
  }

  .record-row.collected {
    opacity: 0.7;
    background: rgba(46, 204, 113, 0.01);
  }

  .type-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    background: rgba(51, 153, 255, 0.1);
    color: var(--accent-blue);
    border: 1px solid rgba(51, 153, 255, 0.2);
  }

  .type-badge.cs {
    background: rgba(155, 89, 182, 0.1);
    color: var(--accent-purple);
    border: 1px solid rgba(155, 89, 182, 0.2);
  }

  .status-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .status-badge.pending {
    background: rgba(243, 156, 18, 0.12);
    color: var(--accent-orange);
    border: 1px solid rgba(243, 156, 18, 0.2);
  }

  .status-badge.overdue {
    background: rgba(231, 76, 60, 0.15);
    color: var(--accent-red);
    border: 1px solid rgba(231, 76, 60, 0.25);
  }

  .status-badge.collected {
    background: rgba(46, 204, 113, 0.15);
    color: var(--accent-green);
    border: 1px solid rgba(46, 204, 113, 0.25);
  }

  .desc-cell {
    max-width: 250px;
    white-space: normal;
    word-break: break-word;
    line-height: 1.4;
  }

  .actions-group {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .action-btn {
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: var(--transition-smooth);
  }

  .action-btn.collect {
    background: rgba(46, 204, 113, 0.12);
    color: var(--accent-green);
    border-color: rgba(46, 204, 113, 0.2);
  }

  .action-btn.collect:hover {
    background: var(--accent-green);
    color: #fff;
  }

  .action-btn.query {
    background: rgba(51, 153, 255, 0.12);
    color: var(--accent-blue);
    border-color: rgba(51, 153, 255, 0.2);
  }

  .action-btn.query:hover {
    background: var(--accent-blue);
    color: #fff;
  }

  .evidence-pill {
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-green);
    background: rgba(46, 204, 113, 0.08);
    border: 1px dashed rgba(46, 204, 113, 0.3);
    padding: 4px 10px;
    border-radius: 20px;
    display: inline-block;
    cursor: help;
  }

  .no-records-placeholder {
    text-align: center;
    padding: 36px !important;
    color: var(--text-muted);
    font-size: 13px;
  }

  /* Modal Dialogs */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal-content {
    width: 650px;
    max-width: 90vw;
    background: rgba(13, 17, 23, 0.95);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    animation: scaleUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.2);
    padding: 28px;
  }

  @keyframes scaleUp {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 16px;
  }

  .modal-header h2 {
    font-size: 20px;
    margin-top: 4px;
  }

  .close-btn {
    font-size: 16px;
    opacity: 0.5;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: var(--transition-smooth);
  }

  .close-btn:hover {
    opacity: 1;
    color: var(--accent-red);
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .input-group.full-width {
    grid-column: span 2;
  }

  .input-group label {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .modal-form select, .modal-form input, .modal-form textarea {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-primary);
    width: 100%;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
    margin-top: 8px;
  }

  /* File upload zone */
  .drag-drop-zone {
    border: 2px dashed rgba(51, 153, 255, 0.2);
    background: rgba(51, 153, 255, 0.01);
    border-radius: var(--border-radius);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    cursor: pointer;
    transition: var(--transition-smooth);
  }

  .drag-drop-zone:hover {
    border-color: var(--accent-blue);
    background: rgba(51, 153, 255, 0.04);
  }

  .file-hint {
    font-size: 10px;
    background: rgba(255,255,255,0.06);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: var(--font-code);
    color: var(--text-muted);
  }

  .mono {
    font-family: var(--font-code);
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

  .text-red {
    color: var(--accent-red);
  }
</style>
