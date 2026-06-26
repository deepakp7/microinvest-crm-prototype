<script>
  import { 
    leads, 
    opportunities, 
    loans, 
    auditLogs, 
    notifications, 
    userRole,
    covenants,
    ncmFunds,
    requestCovenantData,
    toggleChecklistItem
  } from '$lib/store.js';

  // Compute stats reactively
  $: activeLeadsCount = $leads.filter(l => l.status === 'active').length;
  $: activeOppsCount = $opportunities.filter(o => !o.booked).length;
  
  // Total Portfolio Size = Booked loans total from Margill
  $: totalPortfolioSize = $loans.filter(l => l.status === 'Active').reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  
  // Return Profile: calculate weighted average interest rate
  $: averageReturnRate = (() => {
    if ($loans.length === 0) return '0.0%';
    let totalWeightedRate = 0;
    let totalAmount = 0;
    
    $loans.forEach(l => {
      const rateNum = parseFloat(l.interestRate) || 0;
      const amt = Number(l.amount) || 0;
      totalWeightedRate += rateNum * amt;
      totalAmount += amt;
    });

    if (totalAmount === 0) return '0.0%';
    return (totalWeightedRate / totalAmount).toFixed(2) + '%';
  })();

  // NCM total managed assets
  $: ncmTotalAssets = $ncmFunds.reduce((acc, f) => acc + f.totalFundValue, 0);

  // NCM unallocated cash reserves (Dry Powder)
  $: ncmUnallocatedCash = ncmTotalAssets - totalPortfolioSize;

  // Deployed vs Cash Dry Powder per Fund
  $: ncmReservesPerFund = (() => {
    const result = [];
    $ncmFunds.forEach(f => {
      const deployed = $loans.filter(l => l.status === 'Active' && l.fund === f.fundCode)
                            .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
      result.push({
        fundCode: f.fundCode,
        name: f.name,
        deployed,
        dryPowder: Math.max(0, f.totalFundValue - deployed),
        total: f.totalFundValue
      });
    });
    return result;
  })();

  // Covenants statistics
  $: pendingCovenants = $covenants.filter(c => c.status !== 'Collected');
  $: overdueCovenantsCount = $covenants.filter(c => c.status === 'Overdue').length;

  // Compliance Alerts count
  $: urgentAlertsCount = $notifications.filter(n => n.urgent).length;

  function clearNotification(id) {
    notifications.update(list => list.filter(n => n.id !== id));
  }

  // Origination tasks: Active leads needing Intro calls + early opportunities in pre_dd stage
  $: originationTasks = (() => {
    const list = [];
    
    $leads.filter(l => l.status === 'active').forEach(l => {
      const dueDays = l.id === 'ld-2' ? 2 : 4;
      list.push({
        id: l.id,
        type: 'intro_call',
        title: `Introduction Call: ${l.contactName}`,
        company: l.companyName,
        dueText: `Due in ${dueDays} days`,
        status: 'Pending',
        details: `Facility: ${l.investmentFacility || 'N/A'} | Size: £${l.dealSize?.toLocaleString()}`
      });
    });

    $opportunities.filter(o => o.stage === 'pre_dd').forEach(o => {
      const preDdItems = o.checklist?.pre_dd || [];
      const pendingItems = preDdItems.filter(i => !i.completed);
      pendingItems.forEach(item => {
        list.push({
          id: `${o.id}-pre_dd-${item.id}`,
          type: 'compliance',
          title: `Pre-DD: ${item.label}`,
          company: o.companyName,
          dueText: 'Action Required',
          status: 'Pending',
          details: `KYC compliance gating underwriting`
        });
      });
    });

    return list;
  })();

  // Execution tasks: Incomplete checklist items for stages dd, ic, approved, signed
  $: executionTasks = (() => {
    const list = [];
    const executionStages = ['dd', 'ic', 'approved', 'signed'];
    const stageLabels = {
      dd: 'Due Diligence',
      ic: 'IC Review',
      approved: 'Approved',
      signed: 'Deal Signed'
    };

    $opportunities.forEach(opp => {
      if (opp.stage === 'won' || opp.stage === 'lost') return;
      
      executionStages.forEach(stageId => {
        const items = opp.checklist?.[stageId] || [];
        items.forEach(item => {
          if (!item.completed) {
            list.push({
              oppId: opp.id,
              oppName: opp.companyName,
              stageId,
              stageLabel: stageLabels[stageId] || stageId,
              itemId: item.id,
              label: item.label
            });
          }
        });
      });
    });
    return list;
  })();

  // Portfolio Management tasks: covenants pending/overdue + bad debt loans
  $: portfolioTasks = (() => {
    const list = [];

    $covenants.filter(c => c.status !== 'Collected').forEach(c => {
      list.push({
        id: c.id,
        type: 'covenant',
        title: c.title,
        company: c.companyName,
        status: c.status,
        dueText: c.status === 'Overdue' ? '⚠️ Overdue' : `Due: ${c.dueDate}`,
        details: c.description
      });
    });

    $loans.filter(l => l.status === 'Bad debt' || l.status === 'Arrears').forEach(l => {
      list.push({
        id: l.id,
        type: 'arrears',
        title: `Client in Arrears (${l.status})`,
        company: l.companyName,
        status: 'Critical',
        dueText: 'Immediate Action',
        details: `Servicing Balance: £${l.remainingBalance?.toLocaleString()} | Facility: ${l.facility}`
      });
    });

    return list;
  })();
</script>

<div class="dashboard-page">
  <div class="dashboard-header">
    <div class="title-section">
      <span class="badge-tag">OVERVIEW</span>
      <h1>MicroInvest Executive Dashboard</h1>
      <p class="description">Live portfolio summary, returns profile, ESG impact matrix, and KYC compliance controls. Role views customize automatically.</p>
    </div>

    <!-- Active Role Indicator Badge -->
    <div class="active-persona-badge glass-card">
      <span class="role-dot"></span>
      <span class="role-name">Viewing as: <strong>{$userRole}</strong></span>
    </div>
  </div>

  <!-- KPI Metrics Grid -->
  <div class="kpi-grid">
    <div class="kpi-card glass-card">
      <div class="kpi-content">
        <span class="kpi-label">Margill Deployed Loans</span>
        <span class="kpi-value">£{totalPortfolioSize.toLocaleString()}</span>
        <span class="kpi-sub green">↑ Active Servicing Ledger</span>
      </div>
      <div class="kpi-icon blue">💰</div>
    </div>

    <div class="kpi-card glass-card">
      <div class="kpi-content">
        <span class="kpi-label">NCM Administered Pool</span>
        <span class="kpi-value">£{ncmTotalAssets.toLocaleString()}</span>
        <span class="kpi-sub orange">Dry Powder: £{ncmUnallocatedCash.toLocaleString()}</span>
      </div>
      <div class="kpi-icon purple">🏦</div>
    </div>

    <div class="kpi-card glass-card">
      <div class="kpi-content">
        <span class="kpi-label">Weighted Return Profile</span>
        <span class="kpi-value">{averageReturnRate}</span>
        <span class="kpi-sub">Active interest yield average</span>
      </div>
      <div class="kpi-icon green">📈</div>
    </div>

    <div class="kpi-card glass-card" class:urgent-alert={overdueCovenantsCount > 0 || urgentAlertsCount > 0}>
      <div class="kpi-content">
        <span class="kpi-label">Covenant Compliance</span>
        <span class="kpi-value">{overdueCovenantsCount > 0 ? `${overdueCovenantsCount} Overdue` : 'Passing'}</span>
        <span class="kpi-sub">{overdueCovenantsCount > 0 ? 'Urgent covenants missing' : 'All CS/covenants clear'}</span>
      </div>
      <div class="kpi-icon orange">📋</div>
    </div>
  </div>

  <!-- Main Dashboard Layout Grid -->
  <div class="dashboard-layout-grid">
    
    <!-- LEFT SIDE: Role Specific Widgets & Graphs -->
    <div class="left-pane">
      
      <!-- Premium Workspace Dealflow & Task Center Widget -->
      <div class="glass-card section-card dealflow-workspace fade-in">
        <div class="section-header">
          <h3>📋 Dealflow Workspace & Task Center</h3>
          <p>Consolidated pipeline oversight: track early origination, execution milestones, and portfolio compliance servicing in real time.</p>
        </div>

        <div class="dealflow-grid">
          <!-- Column 1: Origination -->
          <div class="dealflow-column">
            <div class="column-title-box">
              <h4>🎯 1. Origination & Leads</h4>
              <span class="task-count-badge">{originationTasks.length}</span>
            </div>
            <div class="column-task-list">
              {#each originationTasks as task}
                <div class="task-mini-card">
                  <div class="task-meta">
                    <span class="task-type-badge">{task.type.replace('_', ' ')}</span>
                    <span class="task-due">{task.dueText}</span>
                  </div>
                  <div class="task-title">{task.title}</div>
                  <div class="task-co-name">{task.company}</div>
                  <div class="task-details">{task.details}</div>
                </div>
              {/each}
              {#if originationTasks.length === 0}
                <div class="empty-tasks-txt">No origination tasks flagged.</div>
              {/if}
            </div>
          </div>

          <!-- Column 2: Execution -->
          <div class="dealflow-column">
            <div class="column-title-box">
              <h4>⚡ 2. Execution & Underwriting</h4>
              <span class="task-count-badge">{executionTasks.length}</span>
            </div>
            <div class="column-task-list">
              {#each executionTasks as task}
                <div class="task-mini-card">
                  <div class="task-meta">
                    <span class="task-type-badge">{task.stageLabel}</span>
                    <span class="task-due">Outstanding</span>
                  </div>
                  <label class="task-checkbox-row">
                    <input 
                      type="checkbox" 
                      checked={false} 
                      on:change={() => toggleChecklistItem(task.oppId, task.stageId, task.itemId)}
                    />
                    <div class="task-text-col">
                      <div class="task-title">{task.label}</div>
                      <div class="task-co-name">{task.oppName}</div>
                    </div>
                  </label>
                </div>
              {/each}
              {#if executionTasks.length === 0}
                <div class="empty-tasks-txt">All underwriting checklists completed!</div>
              {/if}
            </div>
          </div>

          <!-- Column 3: Portfolio Management -->
          <div class="dealflow-column">
            <div class="column-title-box">
              <h4>🌿 3. Portfolio Management</h4>
              <span class="task-count-badge">{portfolioTasks.length}</span>
            </div>
            <div class="column-task-list">
              {#each portfolioTasks as task}
                <div class="task-mini-card">
                  <div class="task-meta">
                    <span class="task-type-badge" class:overdue={task.status === 'Overdue' || task.status === 'Critical'}>
                      {task.type}
                    </span>
                    <span class="task-due" class:red={task.status === 'Overdue' || task.status === 'Critical'}>{task.dueText}</span>
                  </div>
                  <div class="task-title">{task.title}</div>
                  <div class="task-co-name">{task.company}</div>
                  <div class="task-details">{task.details}</div>
                  {#if task.type === 'covenant'}
                    <div class="task-card-actions">
                      <button class="action-link-btn" on:click={() => requestCovenantData(task.id)}>
                        📧 Send Reminder
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
              {#if portfolioTasks.length === 0}
                <div class="empty-tasks-txt">No covenants or servicing flags pending.</div>
              {/if}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Management Team Portfolio Details (Visible to Management, Admin, Ops) -->
      {#if $userRole === 'Management Team' || $userRole === 'Admin' || $userRole === 'Operations'}
        <div class="glass-card section-card">
          <div class="section-header">
            <h3>🏦 NCM Fund Allocations: Margill Deployments vs Cash Reserves</h3>
            <p>Compares active loans (Margill Ledger) against unallocated dry powder cash (NCM Administered).</p>
          </div>

          <div class="facility-chart-box">
            {#each ncmReservesPerFund as fund}
              {@const deployedPct = (fund.deployed / fund.total) * 100}
              {@const dryPct = (fund.dryPowder / fund.total) * 100}
              <div class="chart-row">
                <div class="chart-info">
                  <span class="chart-fac-name" style="font-weight: 700;">{fund.name} ({fund.fundCode})</span>
                  <span class="chart-fac-val">
                    <span class="text-blue">£{fund.deployed.toLocaleString()} Deployed</span>
                    <span class="text-muted"> / </span>
                    <span class="text-green">£{fund.dryPowder.toLocaleString()} Cash</span>
                  </span>
                </div>
                <div class="chart-bar-bg" style="display: flex;">
                  {#if fund.deployed > 0}
                    <div class="chart-bar-fill-deployed" style="width: {deployedPct}%; height: 100%; background: linear-gradient(90deg, var(--accent-blue), #1a73e8);" title="Margill Deployed: £{fund.deployed.toLocaleString()}"></div>
                  {/if}
                  {#if fund.dryPowder > 0}
                    <div class="chart-bar-fill-dry" style="width: {dryPct}%; height: 100%; background: linear-gradient(90deg, var(--accent-green), #27ae60);" title="NCM Dry Powder: £{fund.dryPowder.toLocaleString()}"></div>
                  {/if}
                </div>
                <div class="chart-footer-info" style="display: flex; justify-content: space-between; font-size: 9px; color: var(--text-muted); margin-top: 2px;">
                  <span>Total committed: £{fund.total.toLocaleString()}</span>
                  <span>Fee rate: {$ncmFunds.find(f => f.fundCode === fund.fundCode)?.adminFeeRate}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Compliance KYC Alerts View (Visible to Compliance, Admin, RM) -->
      {#if $userRole === 'Compliance Officer' || $userRole === 'Admin' || $userRole === 'Relationship Manager'}
        <div class="glass-card section-card">
          <div class="section-header">
            <h3>🛡️ KYC/AML Task Board</h3>
            <p>Annual compliance checks and risk alerts linked to active profiles.</p>
          </div>

          <div class="alerts-list">
            {#each $notifications as alert}
              <div class="alert-item" class:urgent={alert.urgent}>
                <div class="alert-meta">
                  <span class="alert-badge" class:urgent={alert.urgent}>
                    {alert.urgent ? 'URGENT' : 'KYC CHECK'}
                  </span>
                  <span class="alert-co">{alert.client}</span>
                </div>
                <p class="alert-msg">{alert.message}</p>
                <div class="alert-footer-row">
                  <span class="alert-action-required">AD API Access Required</span>
                  <button class="resolve-btn" on:click={() => clearNotification(alert.id)}>Clear ✓</button>
                </div>
              </div>
            {/each}

            {#if $notifications.length === 0}
              <div class="no-loans-placeholder green-txt">All client files verified. No flags active.</div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Portfolio Covenants & CS Board (Visible to Relationship Manager, Admin, Management Team) -->
      {#if $userRole === 'Relationship Manager' || $userRole === 'Admin' || $userRole === 'Management Team'}
        <div class="glass-card section-card">
          <div class="section-header">
            <h3>📋 Portfolio Covenants & CS Control</h3>
            <p>Track post-deal conditions subsequent and management accounts collection.</p>
          </div>

          <div class="alerts-list">
            {#each pendingCovenants as cov}
              <div class="alert-item" class:urgent={cov.status === 'Overdue'}>
                <div class="alert-meta">
                  <span class="alert-badge" class:urgent={cov.status === 'Overdue'}>
                    {cov.type} - {cov.status}
                  </span>
                  <span class="alert-co">{cov.companyName}</span>
                </div>
                <p class="alert-msg"><strong>{cov.title}</strong>: {cov.description}</p>
                <div class="alert-footer-row">
                  <span class="alert-action-required">Due: {cov.dueDate} | IM: {cov.manager}</span>
                  <div style="display: flex; gap: 8px;">
                    <button class="resolve-btn" on:click={() => requestCovenantData(cov.id)} style="border-color: rgba(51, 153, 255, 0.2); color: var(--accent-blue);">Request Email</button>
                    <a href="/covenants" class="resolve-btn" style="text-decoration: none; display: inline-block;">Collect</a>
                  </div>
                </div>
              </div>
            {/each}

            {#if pendingCovenants.length === 0}
              <div class="no-loans-placeholder green-txt">All covenants and conditions subsequent collected.</div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Quick Actions Shortcut Panel -->
      <div class="glass-card section-card">
        <div class="section-header">
          <h3>Quick System Navigation</h3>
          <p>Common operation workflows for active sessions.</p>
        </div>
        <div class="shortcuts-grid">
          <a href="/leads" class="shortcut-item">
            <span class="sc-icon">🎯</span>
            <span class="sc-title">Capture New Lead</span>
            <span class="sc-desc">Dynamic web forms</span>
          </a>
          <a href="/opportunities" class="shortcut-item">
            <span class="sc-icon">📈</span>
            <span class="sc-title">Pipeline Kanban</span>
            <span class="sc-desc">Opportunity drag-drop</span>
          </a>
          <a href="/loans" class="shortcut-item">
            <span class="sc-icon">💸</span>
            <span class="sc-title">Ops Loan Servicing</span>
            <span class="sc-desc">Margill Sync & Ledger</span>
          </a>
          <a href="/config" class="shortcut-item">
            <span class="sc-icon">⚙️</span>
            <span class="sc-title">Config Studio</span>
            <span class="sc-desc">Edit schemas & stages</span>
          </a>
        </div>
      </div>

    </div>

    <!-- RIGHT SIDE: System Audit Trail Feed -->
    <div class="right-pane">
      <div class="glass-card audit-card">
        <div class="section-header">
          <h3>📖 Immutable Audit Logs</h3>
          <p>Log of platform changes, SSO verification, and Margill data sync events.</p>
        </div>

        <div class="timeline-feed">
          {#each $auditLogs as log}
            <div class="timeline-log-item">
              <div class="timeline-time">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div class="timeline-body">
                <span class="timeline-role" class:ops={log.role==='Operations'} class:admin={log.role==='Admin'} class:sales={log.role==='Sales Rep'}>
                  {log.role}
                </span>
                <p class="timeline-desc">{log.action}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

  </div>
</div>

<style>
  .dashboard-page {
    animation: fadeIn 0.4s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
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

  .active-persona-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.02);
  }

  .role-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--accent-blue);
    box-shadow: 0 0 8px var(--accent-blue);
  }

  .role-name {
    font-size: 12px;
    color: var(--text-primary);
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

  .kpi-sub.green {
    color: var(--accent-green);
  }

  .kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    background: rgba(255, 255, 255, 0.03);
  }

  .kpi-icon.blue { color: var(--accent-blue); background: rgba(51, 153, 255, 0.08); }
  .kpi-icon.green { color: var(--accent-green); background: rgba(46, 204, 113, 0.08); }
  .kpi-icon.purple { color: var(--accent-purple); background: rgba(155, 89, 182, 0.08); }
  .kpi-icon.orange { color: var(--accent-orange); background: rgba(243, 156, 18, 0.08); }

  .urgent-alert {
    border-color: rgba(231, 76, 60, 0.3);
    background: rgba(231, 76, 60, 0.03);
  }

  /* Layout grids */
  .dashboard-layout-grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 24px;
    align-items: flex-start;
  }

  .left-pane {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-card {
    padding: 24px;
  }

  .section-header {
    margin-bottom: 20px;
  }

  .section-header h3 {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 2px;
  }

  .section-header p {
    font-size: 11px;
    color: var(--text-secondary);
  }

  /* Facility allocations chart */
  .facility-chart-box {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .chart-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .chart-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .chart-fac-name {
    font-weight: 600;
  }

  .chart-fac-val {
    font-family: var(--font-code);
    color: var(--accent-blue);
    font-weight: 700;
  }

  .chart-bar-bg {
    height: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    overflow: hidden;
  }

  .chart-bar-fill {
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));
    transition: var(--transition-smooth);
  }

  .no-loans-placeholder {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    padding: 24px 0;
    border: 1px dashed var(--border-color);
    border-radius: 6px;
  }

  .no-loans-placeholder.green-txt {
    color: var(--accent-green);
    border-color: rgba(46, 204, 113, 0.15);
    background: rgba(46, 204, 113, 0.02);
  }

  /* Alert boxes list */
  .alerts-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 280px;
    overflow-y: auto;
  }

  .alert-item {
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: var(--transition-smooth);
  }

  .alert-item.urgent {
    background: rgba(231, 76, 60, 0.03);
    border-color: rgba(231, 76, 60, 0.2);
  }

  .alert-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .alert-badge {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    background: var(--bg-glass);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  .alert-badge.urgent {
    background: rgba(231,76,60,0.15);
    color: var(--accent-red);
    border-color: rgba(231,76,60,0.3);
  }

  .alert-co {
    font-size: 12px;
    font-weight: 700;
  }

  .alert-msg {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .alert-footer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    margin-top: 4px;
    border-top: 1px dashed var(--border-color);
    padding-top: 8px;
  }

  .alert-action-required {
    color: var(--text-muted);
    font-family: var(--font-code);
  }

  .resolve-btn {
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-green);
    background: rgba(46, 204, 113, 0.1);
    border: 1px solid rgba(46, 204, 113, 0.2);
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
  }

  .resolve-btn:hover {
    background: var(--accent-green);
    color: #fff;
  }

  /* Shortcuts widget */
  .shortcuts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .shortcut-item {
    display: flex;
    flex-direction: column;
    padding: 14px;
    background: rgba(255,255,255,0.015);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    transition: var(--transition-smooth);
  }

  .shortcut-item:hover {
    background: var(--bg-glass-hover);
    border-color: var(--border-color-hover);
    transform: translateY(-1px);
  }

  .sc-icon {
    font-size: 20px;
    margin-bottom: 6px;
  }

  .sc-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .sc-desc {
    font-size: 10px;
    color: var(--text-muted);
  }

  /* Right Pane: Audit trail */
  .audit-card {
    padding: 24px;
  }

  .timeline-feed {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-height: 560px;
    overflow-y: auto;
    padding-right: 6px;
  }

  .timeline-log-item {
    display: flex;
    gap: 16px;
    font-size: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    padding-bottom: 10px;
  }

  .timeline-time {
    font-family: var(--font-code);
    color: var(--text-muted);
    min-width: 65px;
  }

  .timeline-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .timeline-role {
    font-size: 9px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    align-self: flex-start;
    text-transform: uppercase;
  }

  .timeline-role.ops { background: rgba(51, 153, 255, 0.08); color: var(--accent-blue); }
  .timeline-role.admin { background: rgba(155, 89, 182, 0.08); color: var(--accent-purple); }
  .timeline-role.sales { background: rgba(243, 156, 18, 0.08); color: var(--accent-orange); }

  .timeline-desc {
    color: var(--text-secondary);
    line-height: 1.4;
  }

  /* Dealflow Workspace Styles */
  .dealflow-workspace {
    margin-bottom: 28px;
  }

  .dealflow-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
    margin-top: 16px;
  }

  .dealflow-column {
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .column-title-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
    margin-bottom: 4px;
  }

  .column-title-box h4 {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .task-count-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .column-task-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 340px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .task-mini-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 12px;
    transition: var(--transition-smooth);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .task-mini-card:hover {
    background: var(--bg-glass-hover);
    border-color: var(--border-color-hover);
    transform: translateY(-1px);
  }

  .task-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .task-type-badge {
    font-size: 8px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(51, 153, 255, 0.1);
    color: var(--accent-blue);
    text-transform: uppercase;
  }

  .task-type-badge.overdue {
    background: rgba(231, 76, 60, 0.1);
    color: var(--accent-red);
  }

  .task-due {
    font-size: 9px;
    color: var(--text-muted);
  }

  .task-due.red {
    color: var(--accent-red);
    font-weight: 600;
  }

  .task-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .task-co-name {
    font-size: 10px;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .task-details {
    font-size: 10px;
    color: var(--text-muted);
    line-height: 1.3;
  }

  .task-checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;
    margin-top: 2px;
  }

  .task-checkbox-row input {
    margin-top: 3px;
    cursor: pointer;
    accent-color: var(--accent-blue);
  }

  .task-text-col {
    display: flex;
    flex-direction: column;
  }

  .task-card-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .action-link-btn {
    font-size: 9px;
    font-weight: 700;
    color: var(--accent-blue);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: var(--transition-smooth);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(51, 153, 255, 0.2);
  }

  .action-link-btn:hover {
    background: rgba(51, 153, 255, 0.1);
    border-color: var(--accent-blue);
  }

  .empty-tasks-txt {
    font-size: 11px;
    color: var(--text-muted);
    font-style: italic;
    padding: 20px 0;
    text-align: center;
  }
</style>
