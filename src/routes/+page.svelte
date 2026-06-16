<script>
  import { 
    leads, 
    opportunities, 
    loans, 
    auditLogs, 
    notifications, 
    userRole 
  } from '$lib/store.js';

  // Compute stats reactively
  $: activeLeadsCount = $leads.filter(l => l.status === 'active').length;
  $: activeOppsCount = $opportunities.filter(o => !o.booked).length;
  
  // Total Portfolio Size = Booked loans total
  $: totalPortfolioSize = $loans.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);
  
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

  // Dynamic charts ratios: Facility deployment ratios
  $: facilityDeployment = (() => {
    const counts = {};
    $loans.forEach(l => {
      counts[l.facility] = (counts[l.facility] || 0) + Number(l.amount);
    });
    return counts;
  })();

  // Compliance Alerts count
  $: urgentAlertsCount = $notifications.filter(n => n.urgent).length;

  function clearNotification(id) {
    notifications.update(list => list.filter(n => n.id !== id));
  }
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
        <span class="kpi-label">Active Portfolio Size</span>
        <span class="kpi-value">£{totalPortfolioSize.toLocaleString()}</span>
        <span class="kpi-sub green">↑ 100% synced to Margill</span>
      </div>
      <div class="kpi-icon blue">💰</div>
    </div>

    <div class="kpi-card glass-card">
      <div class="kpi-content">
        <span class="kpi-label">Weighted Return Profile</span>
        <span class="kpi-value">{averageReturnRate}</span>
        <span class="kpi-sub">Portfolio interest average</span>
      </div>
      <div class="kpi-icon green">📈</div>
    </div>

    <div class="kpi-card glass-card">
      <div class="kpi-content">
        <span class="kpi-label">Pipeline Opportunities</span>
        <span class="kpi-value">{activeOppsCount} Deals</span>
        <span class="kpi-sub font-code">{activeLeadsCount} active lead intakes</span>
      </div>
      <div class="kpi-icon purple">🎯</div>
    </div>

    <div class="kpi-card glass-card" class:urgent-alert={urgentAlertsCount > 0}>
      <div class="kpi-content">
        <span class="kpi-label">Compliance Status</span>
        <span class="kpi-value">{urgentAlertsCount > 0 ? `${urgentAlertsCount} Alerts` : 'Secured'}</span>
        <span class="kpi-sub">{urgentAlertsCount > 0 ? 'Urgent AML flags pending' : 'KYC audit logs passing'}</span>
      </div>
      <div class="kpi-icon orange">🛡️</div>
    </div>
  </div>

  <!-- Main Dashboard Layout Grid -->
  <div class="dashboard-layout-grid">
    
    <!-- LEFT SIDE: Role Specific Widgets & Graphs -->
    <div class="left-pane">
      
      <!-- Management Team Portfolio Details (Visible to Management, Admin, Ops) -->
      {#if $userRole === 'Management Team' || $userRole === 'Admin' || $userRole === 'Operations'}
        <div class="glass-card section-card">
          <div class="section-header">
            <h3>Facility Allocations & Targets</h3>
            <p>Aggregate investment sizing by active facility product.</p>
          </div>

          <div class="facility-chart-box">
            {#each Object.entries(facilityDeployment) as [fac, val]}
              <div class="chart-row">
                <div class="chart-info">
                  <span class="chart-fac-name">{fac}</span>
                  <span class="chart-fac-val">£{val.toLocaleString()}</span>
                </div>
                <div class="chart-bar-bg">
                  <div class="chart-bar-fill" style="width: {(val / totalPortfolioSize * 100) || 0}%"></div>
                </div>
              </div>
            {/each}

            {#if Object.keys(facilityDeployment).length === 0}
              <div class="no-loans-placeholder">No loans active in ledger yet. Defer to Operations to book.</div>
            {/if}
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
</style>
