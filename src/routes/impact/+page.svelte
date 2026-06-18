<script>
  import { opportunities, loans, addAuditLog, addNotification } from '$lib/store.js';
  import { onMount } from 'svelte';

  // Active sub-tab in Impact Module
  let activeSubTab = 'charter'; // 'charter', 'monitoring', 'exit'

  // Charter form selection states
  let selectedOppId = '';
  let formVersion = 'regular'; // 'regular', 'short', 'repeat'
  
  // Interactive Charter Simulator fields
  let serviceUsers = '';
  let tradingActivities = '';
  let targetGroup = 'Employment & Training';
  let primaryKpi = 'Number of individuals supported into stable jobs';
  let targetLives = 150;
  
  // Status of the current simulated charter
  let charterStatus = 'pending'; // 'pending', 'submitted', 'scored'
  let impactScore = 7;
  let dataInaccuracies = '';
  let showSyncMessage = false;

  // Track simulated portfolio review submissions
  let reviewStatuses = {};
  
  // Initialize opportunities dropdown
  $: activeOpps = $opportunities;
  $: selectedOpp = $opportunities.find(o => o.id === selectedOppId);

  // Prepopulate charter fields based on selected opportunity and version
  function handleOppChange() {
    if (!selectedOpp) return;
    charterStatus = 'pending';
    showSyncMessage = false;
    
    // Default mock data based on company
    if (selectedOpp.companyName === 'SolarTech Solutions') {
      serviceUsers = 'Low-income households in off-grid rural communities.';
      tradingActivities = 'Distributing affordable solar microgrids to displace kerosene lanterns.';
      targetGroup = 'Environmental & Clean Energy';
      primaryKpi = 'Metric tons of CO2 avoided and households powered';
      targetLives = 800;
    } else if (selectedOpp.companyName === 'NextGen Bio') {
      serviceUsers = 'Healthcare clinics and patients in underserved medical deserts.';
      tradingActivities = 'Providing low-cost biodegradable diagnostic test kits.';
      targetGroup = 'Health & Wellbeing';
      primaryKpi = 'Diagnostic tests administered at subsidised rates';
      targetLives = 1200;
    } else {
      serviceUsers = 'Disadvantaged youth looking for career training pathways.';
      tradingActivities = 'Operating community kitchens and cafes providing trade apprenticeships.';
      targetGroup = 'Employment & Training';
      primaryKpi = 'Apprentices completing certified training programmes';
      targetLives = 250;
    }

    // Adjust for versions
    if (formVersion === 'repeat') {
      // Repeat version pre-fills with dummy prior data
      serviceUsers = `[PRE-FILLED FROM PRIOR REVIEW] ${serviceUsers}`;
      tradingActivities = `[PRE-FILLED FROM PRIOR REVIEW] ${tradingActivities}`;
    }
  }

  function handleVersionChange(version) {
    formVersion = version;
    handleOppChange();
  }

  function simulateSubmit() {
    charterStatus = 'submitted';
    // Add audit log
    addAuditLog('Sales Rep', `Investee "${selectedOpp ? selectedOpp.companyName : 'Unknown'}" submitted Impact Charter (${formVersion.toUpperCase()} version)`);
  }

  function submitScore() {
    if (!selectedOpp) return;
    charterStatus = 'scored';
    
    // Update local Svelte opportunities store with the score
    opportunities.update(opps => {
      return opps.map(o => {
        if (o.id === selectedOpp.id) {
          return {
            ...o,
            impactScore: impactScore,
            esgRating: impactScore >= 9 ? 'AAA (Exceptional)' : impactScore >= 7 ? 'AA (High Impact)' : 'A (Moderate)'
          };
        }
        return o;
      });
    });

    // Add Audit Log
    addAuditLog('Operations', `Scored impact charter for "${selectedOpp.companyName}": Score ${impactScore}/10. Synced to Zoho CRM.`);
    
    // Add compliance/task notification
    addNotification('Operations Task', selectedOpp.companyName, `Impact Score of ${impactScore}/10 uploaded to Zoho CRM successfully.`, false);
    
    showSyncMessage = true;
    setTimeout(() => {
      showSyncMessage = false;
    }, 3000);
  }

  // Pre-populate review submission list for active loans
  onMount(() => {
    // Default active opp selection
    if ($opportunities.length > 0) {
      selectedOppId = $opportunities[0].id;
      handleOppChange();
    }

    // Populate mock annual review statuses
    $loans.forEach(loan => {
      reviewStatuses[loan.id] = {
        annualReview: loan.id === 'loan-1' ? 'Submitted' : 'Pending',
        gifReporting: 'Not Applicable'
      };
    });
  });

  function triggerAnnualReviewRequest(loan) {
    reviewStatuses[loan.id].annualReview = 'Requested';
    reviewStatuses = { ...reviewStatuses };
    addAuditLog('Relationship Manager', `Triggered Annual Impact Review request for "${loan.companyName}"`);
    addNotification('KYC Check', loan.companyName, `Annual Impact Review email template queued for delivery.`, false);
  }
</script>

<div class="impact-wrapper">
  <!-- Top Title Area -->
  <div class="impact-header">
    <div class="header-text-block">
      <span class="badge-tag">PORTFOLIO IMPACT</span>
      <h1>Social Impact & ESG Module</h1>
      <p class="subtitle">Collect due diligence impact charters, monitor annual reviews, and track exit surveys.</p>
    </div>
  </div>

  <!-- Sub-navigation Tabs -->
  <div class="tabs-nav">
    <button class="tab-btn" class:active={activeSubTab === 'charter'} on:click={() => activeSubTab = 'charter'}>
      <span class="tab-icon">📝</span> Due Diligence Charters
    </button>
    <button class="tab-btn" class:active={activeSubTab === 'monitoring'} on:click={() => activeSubTab = 'monitoring'}>
      <span class="tab-icon">🌿</span> Impact Monitoring
    </button>
    <button class="tab-btn" class:active={activeSubTab === 'exit'} on:click={() => activeSubTab = 'exit'}>
      <span class="tab-icon">🚪</span> Exit Surveys
    </button>
  </div>

  <div class="tab-content glass-card">
    
    <!-- 1. DUE DILIGENCE CHARTERS -->
    {#if activeSubTab === 'charter'}
      <div class="section-header">
        <div>
          <h2>Impact Charter Workflow</h2>
          <p class="section-sub">Select an opportunity to simulate the client's questionnaire submission and score their social impact charter.</p>
        </div>
      </div>

      <div class="charter-selector-row">
        <div class="form-group select-wrapper">
          <label for="opp-select" class="field-label">Select Active Opportunity / Lead</label>
          <select id="opp-select" bind:value={selectedOppId} on:change={handleOppChange} class="custom-select">
            {#each activeOpps as opp}
              <option value={opp.id}>{opp.companyName} ({opp.stage})</option>
            {/each}
          </select>
        </div>

        <div class="form-group version-wrapper">
          <label class="field-label">Questionnaire Form Version</label>
          <div class="version-buttons">
            <button class="v-btn" class:active={formVersion === 'regular'} on:click={() => handleVersionChange('regular')}>
              Regular Version
            </button>
            <button class="v-btn" class:active={formVersion === 'short'} on:click={() => handleVersionChange('short')}>
              Short (Skip/Hide)
            </button>
            <button class="v-btn" class:active={formVersion === 'repeat'} on:click={() => handleVersionChange('repeat')}>
              Repeat Client
            </button>
          </div>
        </div>
      </div>

      <div class="split-workflow-grid">
        
        <!-- Left: Client Form Simulator -->
        <div class="workspace-column simulator-panel">
          <div class="col-header">
            <h3>Social Questionnaire Simulator</h3>
            <span class="badge-tag client">Investee Interface</span>
          </div>

          <div class="form-card investee-form">
            <div class="sim-brand">
              <span class="logo-icon">🌿</span>
              <span>MicroInvest Impact Charter</span>
            </div>

            <div class="sim-fields">
              <div class="sim-field">
                <label class="sim-label">Organisation Name</label>
                <input type="text" value={selectedOpp ? selectedOpp.companyName : ''} disabled />
              </div>

              <div class="sim-field">
                <label class="sim-label">Target Social Group / Focus Area</label>
                <select bind:value={targetGroup} disabled={charterStatus !== 'pending'}>
                  <option value="Employment & Training">Employment, Training & Skills</option>
                  <option value="Environmental & Clean Energy">Environmental, Green Energy & Asset Lock</option>
                  <option value="Health & Wellbeing">Health, Medical Deserts & Wellbeing</option>
                  <option value="Affordable Housing">Affordable Housing & Communities</option>
                  <option value="Social Enterprise Funding">Social Enterprise & Financial Inclusion</option>
                </select>
              </div>

              <!-- Long answer questions are conditionally displayed based on Version -->
              {#if formVersion !== 'short'}
                <div class="sim-field">
                  <label class="sim-label">Who are your primary service users / target demographics?</label>
                  <textarea 
                    bind:value={serviceUsers} 
                    placeholder="Describe demographics, challenges, and support mechanisms..." 
                    disabled={charterStatus !== 'pending'}
                  />
                  {#if formVersion === 'repeat'}
                    <span class="pref-badge">Pre-filled from Zoho CRM</span>
                  {/if}
                </div>

                <div class="sim-field">
                  <label class="sim-label">How do you generate social impact through trading activities?</label>
                  <textarea 
                    bind:value={tradingActivities} 
                    placeholder="Describe business model, trading volumes, and social outcomes..." 
                    disabled={charterStatus !== 'pending'}
                  />
                  {#if formVersion === 'repeat'}
                    <span class="pref-badge">Pre-filled from Zoho CRM</span>
                  {/if}
                </div>
              {:else}
                <div class="sim-field-hidden-alert">
                  <span>ℹ️ Long answer questions (Service Users & Trading Impact) are hidden for this Short Version.</span>
                </div>
              {/if}

              <div class="sim-field-row">
                <div class="sim-field">
                  <label class="sim-label">Primary Outcomes KPI</label>
                  <input type="text" bind:value={primaryKpi} disabled={charterStatus !== 'pending'} />
                </div>
                <div class="sim-field target-lives-field">
                  <label class="sim-label">Target Reached (Annual)</label>
                  <input type="number" bind:value={targetLives} disabled={charterStatus !== 'pending'} />
                </div>
              </div>
            </div>

            <div class="sim-actions">
              {#if charterStatus === 'pending'}
                <button class="btn-primary full-width" on:click={simulateSubmit}>
                  🚀 Submit Questionnaire to MicroInvest
                </button>
              {:else}
                <div class="status-confirmed">
                  <span>✓ Submitted successfully by Investee</span>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Right: Investment Manager Score Panel -->
        <div class="workspace-column manager-panel">
          <div class="col-header">
            <h3>Charter Evaluation & Scoring</h3>
            <span class="badge-tag manager">Investment Manager View</span>
          </div>

          {#if charterStatus === 'pending'}
            <div class="evaluation-placeholder">
              <span class="icon">⏳</span>
              <h4>Waiting for investee submission</h4>
              <p>Use the simulator panel on the left to submit the questionnaire first.</p>
            </div>
          {:else}
            <div class="evaluation-card">
              <div class="evaluation-summary">
                <div class="data-group">
                  <span class="eval-label">Organisation</span>
                  <strong>{selectedOpp ? selectedOpp.companyName : ''}</strong>
                </div>
                <div class="data-group">
                  <span class="eval-label">Investment Facility</span>
                  <span>{selectedOpp ? selectedOpp.investmentFacility : ''}</span>
                </div>
                <div class="data-group">
                  <span class="eval-label">Proposed Deal Size</span>
                  <span class="money">£{(selectedOpp && selectedOpp.dealSize ? selectedOpp.dealSize.toLocaleString() : '0')}</span>
                </div>
              </div>

              <!-- Scoring Slider -->
              <div class="scoring-section">
                <div class="scoring-header">
                  <label for="impact-slider">Overall Impact Score</label>
                  <span class="score-display badge-tag" class:high={impactScore >= 8} class:med={impactScore >= 5 && impactScore < 8}>
                    {impactScore} / 10
                  </span>
                </div>
                <input 
                  type="range" 
                  id="impact-slider" 
                  min="1" 
                  max="10" 
                  bind:value={impactScore} 
                  disabled={charterStatus === 'scored'} 
                  class="custom-slider" 
                />
                <div class="slider-ticks">
                  <span>1 (Low)</span>
                  <span>5 (Medium)</span>
                  <span>10 (Transformative)</span>
                </div>
              </div>

              <!-- Clean CRM Input -->
              <div class="form-field">
                <label for="inaccuracies-input" class="eval-label">Correct Data Inaccuracies (Updated in Zoho CRM)</label>
                <textarea 
                  id="inaccuracies-input"
                  bind:value={dataInaccuracies} 
                  placeholder="Record any spelling, volume targets, or address corrections to sync back to Zoho CRM..."
                  disabled={charterStatus === 'scored'}
                />
              </div>

              <div class="evaluation-actions">
                {#if charterStatus === 'submitted'}
                  <button class="btn-primary full-width" on:click={submitScore}>
                    📥 Publish Impact Score & Sync to Zoho CRM
                  </button>
                {:else}
                  <div class="scored-success-card">
                    <div class="success-icon">✓</div>
                    <h4>Impact Scoring Complete & Synced!</h4>
                    <p>Score <strong>{impactScore}/10</strong> uploaded to Zoho CRM. Audit log registered.</p>
                    {#if selectedOpp}
                      <p class="new-badge">New ESG Rating: {impactScore >= 9 ? 'AAA (Exceptional)' : impactScore >= 7 ? 'AA (High Impact)' : 'A (Moderate)'}</p>
                    {/if}
                  </div>
                {/if}
              </div>

              {#if showSyncMessage}
                <div class="sync-notification-bubble">
                  <span>🔄 Synced with Zoho CRM: Score = {impactScore}/10. Rerouting updates.</span>
                </div>
              {/if}
            </div>
          {/if}

        </div>

      </div>

    <!-- 2. ANNUAL IMPACT MONITORING -->
    {:else if activeSubTab === 'monitoring'}
      <div class="section-header">
        <div>
          <h2>Annual Portfolio Monitoring</h2>
          <p class="section-sub">Monitor live investments and review Annual Impact Questionnaires sent to existing investees.</p>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="monitoring-metrics-row">
        <div class="metric-card bg-glow-blue">
          <span class="m-label">Active Portfolio Loans</span>
          <span class="m-value">{$loans.length}</span>
          <span class="m-sub">Tracking impact targets</span>
        </div>
        <div class="metric-card bg-glow-green">
          <span class="m-label">Avg. Portfolio Impact Score</span>
          <span class="m-value">
            {($opportunities.filter(o => o.booked).reduce((acc, curr) => acc + (curr.impactScore || 8), 0) / Math.max(1, $opportunities.filter(o => o.booked).length)).toFixed(1)}/10
          </span>
          <span class="m-sub">Calculated from scored loans</span>
        </div>
        <div class="metric-card bg-glow-purple">
          <span class="m-label">Portfolio Total Target Lives</span>
          <span class="m-value">3,500+</span>
          <span class="m-sub">Social beneficiaries reached</span>
        </div>
      </div>

      <!-- Monitoring Links Panel -->
      <div class="monitoring-links-box">
        <h3>🔗 Official Impact Collection Forms</h3>
        <p class="sub-instructions">Use these external Zoho public forms to collect information or verify investee metrics in production.</p>
        
        <div class="links-button-grid">
          <a 
            href="https://forms.zohopublic.eu/bigissue/form/20252026InvesteeImpactReview/formperma/cIv4L_8dYWElVCYVXOqSSY6WNX3uom2qTOoqwQRryMk" 
            target="_blank" 
            class="external-form-btn bg-glow-blue"
          >
            <div class="btn-content">
              <strong>Annual Impact Review Form (2025/2026)</strong>
              <span>Open Investee Impact Review questionnaire ↗</span>
            </div>
          </a>

          <a 
            href="https://forms.zohopublic.eu/bigissue/form/AnnualImpactDataGrowthImpactFund/formperma/APh-8r66OOv0pZIZBrouwNTUzjcS94MjpT-XBRbSHvw" 
            target="_blank" 
            class="external-form-btn bg-glow-purple"
          >
            <div class="btn-content">
              <strong>Annual Reporting for GIF Fund</strong>
              <span>Open Growth Impact Fund KPI questionnaire ↗</span>
            </div>
          </a>
        </div>
      </div>

      <!-- Live Monitoring Table -->
      <div class="monitoring-table-section">
        <h3>Investee Submission Status</h3>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Investee Company</th>
              <th>Loan ID</th>
              <th>Facility</th>
              <th>Disbursed Amount</th>
              <th>Annual Review Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {#each $loans as loan}
              <tr>
                <td><strong>{loan.companyName}</strong></td>
                <td class="font-mono text-secondary">{loan.loanId}</td>
                <td>{loan.facility}</td>
                <td>£{loan.amount.toLocaleString()}</td>
                <td>
                  <span class="status-tag {reviewStatuses[loan.id]?.annualReview.toLowerCase()}">
                    {reviewStatuses[loan.id]?.annualReview || 'Pending'}
                  </span>
                </td>
                <td>
                  {#if reviewStatuses[loan.id]?.annualReview === 'Pending'}
                    <button class="btn-table-action" on:click={() => triggerAnnualReviewRequest(loan)}>
                      ✉️ Request Review
                    </button>
                  {:else}
                    <button class="btn-table-action disabled" disabled>
                      ✓ Sent
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- 3. EXIT IMPACT -->
    {:else if activeSubTab === 'exit'}
      <div class="section-header">
        <div>
          <h2>Impact at Exit Assessment</h2>
          <p class="section-sub">Distribute exit surveys to exiting portfolio organisations to capture lifetime performance details.</p>
        </div>
      </div>

      <div class="exit-layout-split">
        <!-- Exit Questionnaire Box -->
        <div class="exit-survey-card">
          <div class="exit-icon-box">🚪</div>
          <h3>Official Exit Survey Form</h3>
          <p>This survey is sent to organizations exiting the MicroInvest portfolio to map and understand the long-term impact on their trajectory.</p>
          
          <a 
            href="https://forms.zohopublic.eu/bigissue/form/BigIssueInvestExitSurvey/formperma/QhNc698XUBhLkmTKaKQXk990lC4BPn-3ahkBMqKOz-o" 
            target="_blank" 
            class="btn-primary inline-link"
          >
            📋 Open Exit Survey Form ↗
          </a>
        </div>

        <!-- Exiting Trackers List -->
        <div class="exiting-tracker-list">
          <h3>Exiting Portfolio Companies</h3>
          
          <div class="tracker-card">
            <div class="tracker-details">
              <strong>Greenfield Wind Farm</strong>
              <span class="facility-label">Renewable Energy Dev Loan</span>
              <span class="time-label">Status: Active Settlement Process</span>
            </div>
            <div class="tracker-status-checklist">
              <div class="checklist-item checked">
                <span class="check-icon">✓</span>
                <span>Final Loan Serviced</span>
              </div>
              <div class="checklist-item checked">
                <span class="check-icon">✓</span>
                <span>Exit Form Dispatched</span>
              </div>
              <div class="checklist-item pending">
                <span class="check-icon">○</span>
                <span>Awaiting Exit Survey Submission</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  .impact-wrapper {
    max-width: 1200px;
    margin: 0 auto;
    padding-bottom: 40px;
  }

  .impact-header {
    margin-bottom: 24px;
  }

  .badge-tag {
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-blue);
    background: rgba(51, 153, 255, 0.1);
    padding: 4px 8px;
    border-radius: 4px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  .badge-tag.client {
    color: var(--accent-purple);
    background: rgba(155, 89, 182, 0.1);
  }

  .badge-tag.manager {
    color: var(--accent-orange);
    background: rgba(230, 126, 34, 0.1);
  }

  .badge-tag.high {
    color: var(--accent-green);
    background: rgba(46, 204, 113, 0.15);
    font-size: 13px;
    padding: 6px 12px;
  }

  .badge-tag.med {
    color: var(--accent-orange);
    background: rgba(230, 126, 34, 0.15);
    font-size: 13px;
    padding: 6px 12px;
  }

  .impact-header h1 {
    font-size: 28px;
    font-weight: 700;
    margin-top: 8px;
    color: var(--text-primary);
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: 14px;
    margin-top: 4px;
  }

  /* Sub-tab Styling */
  .tabs-nav {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 14px;
    transition: var(--transition-smooth);
    border: 1px solid transparent;
  }

  .tab-btn:hover {
    color: var(--text-primary);
    background: var(--bg-glass-hover);
  }

  .tab-btn.active {
    color: var(--text-primary);
    background: rgba(51, 153, 255, 0.08);
    border-color: rgba(51, 153, 255, 0.2);
  }

  .section-header {
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 16px;
    margin-bottom: 24px;
  }

  .section-header h2 {
    font-size: 18px;
    font-weight: 600;
  }

  .section-sub {
    color: var(--text-secondary);
    font-size: 12px;
    margin-top: 2px;
  }

  /* Dropdown Selector Row */
  .charter-selector-row {
    display: flex;
    gap: 20px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .select-wrapper {
    flex: 1;
    min-width: 250px;
  }

  .version-wrapper {
    flex: 2;
    min-width: 350px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .custom-select {
    background: rgba(0,0,0,0.2);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 10px 16px;
    color: var(--text-primary);
    font-size: 13px;
    cursor: pointer;
  }

  .version-buttons {
    display: flex;
    background: rgba(0,0,0,0.2);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 4px;
    gap: 4px;
  }

  .v-btn {
    flex: 1;
    font-size: 12px;
    font-weight: 500;
    padding: 8px;
    border-radius: 6px;
    color: var(--text-secondary);
    transition: var(--transition-smooth);
  }

  .v-btn:hover {
    color: var(--text-primary);
    background: var(--bg-glass-hover);
  }

  .v-btn.active {
    color: var(--text-primary);
    background: rgba(51, 153, 255, 0.1);
    font-weight: 600;
  }

  /* Due Diligence Grid Layout */
  .split-workflow-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .workspace-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .col-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }

  .col-header h3 {
    font-size: 15px;
    font-weight: 600;
  }

  /* Simulator Form Styling */
  .form-card {
    background: rgba(255,255,255,0.01);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
    overflow: hidden;
  }

  .sim-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-heading);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 12px;
  }

  .sim-fields {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .sim-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
  }

  .sim-field-row {
    display: flex;
    gap: 12px;
  }

  .sim-field-row .sim-field {
    flex: 2;
  }

  .sim-field-row .sim-field.target-lives-field {
    flex: 1;
  }

  .sim-label {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .sim-field input, .sim-field textarea, .sim-field select {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--text-primary);
    font-size: 12px;
    width: 100%;
  }

  .sim-field textarea {
    min-height: 56px;
    resize: vertical;
  }

  .sim-field-hidden-alert {
    background: rgba(51, 153, 255, 0.05);
    border: 1px solid rgba(51, 153, 255, 0.15);
    padding: 12px;
    border-radius: 6px;
    font-size: 11px;
    color: var(--accent-blue);
    line-height: 1.4;
  }

  .pref-badge {
    position: absolute;
    right: 0;
    top: 0;
    font-size: 9px;
    color: var(--accent-green);
    background: rgba(46, 204, 113, 0.1);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .sim-actions {
    margin-top: 8px;
  }

  .full-width {
    width: 100%;
    display: block;
    text-align: center;
  }

  .status-confirmed {
    text-align: center;
    background: rgba(46, 204, 113, 0.1);
    border: 1px solid rgba(46, 204, 113, 0.2);
    color: var(--accent-green);
    padding: 10px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 13px;
  }

  /* Manager Panel Styling */
  .evaluation-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 60px 20px;
    border: 2px dashed var(--border-color);
    border-radius: 12px;
    color: var(--text-secondary);
    text-align: center;
  }

  .evaluation-placeholder .icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .evaluation-placeholder h4 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .evaluation-placeholder p {
    font-size: 12px;
    margin-top: 4px;
    max-width: 250px;
  }

  .evaluation-card {
    background: rgba(255,255,255,0.015);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    position: relative;
  }

  .evaluation-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    background: rgba(0,0,0,0.2);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
  }

  .data-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .eval-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .evaluation-summary strong {
    font-size: 13px;
    color: var(--text-primary);
  }

  .evaluation-summary span {
    font-size: 12px;
  }

  .evaluation-summary .money {
    font-weight: 600;
    color: var(--accent-blue);
  }

  /* Custom Slider Styling */
  .scoring-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .scoring-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .scoring-header label {
    font-weight: 600;
    font-size: 13px;
  }

  .custom-slider {
    width: 100%;
    height: 6px;
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
    outline: none;
    accent-color: var(--accent-blue);
    cursor: pointer;
  }

  .slider-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--text-muted);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-field textarea {
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--text-primary);
    font-size: 12px;
    min-height: 60px;
    resize: vertical;
  }

  .scored-success-card {
    background: rgba(46, 204, 113, 0.08);
    border: 1px solid rgba(46, 204, 113, 0.2);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }

  .success-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--accent-green);
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 18px;
    margin-bottom: 8px;
  }

  .scored-success-card h4 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .scored-success-card p {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .scored-success-card .new-badge {
    display: inline-block;
    margin-top: 8px;
    font-size: 11px;
    font-weight: 600;
    color: var(--accent-green);
  }

  .sync-notification-bubble {
    background: rgba(230, 126, 34, 0.1);
    border: 1px solid rgba(230, 126, 34, 0.2);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 11px;
    color: var(--accent-orange);
    text-align: center;
    animation: flash 1s infinite alternate;
  }

  /* 2. Monitoring Layout Styles */
  .monitoring-metrics-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }

  .metric-card {
    background: rgba(255,255,255,0.015);
    border: 1px solid var(--border-color);
    padding: 20px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
    overflow: hidden;
  }

  .m-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .m-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .m-sub {
    font-size: 11px;
    color: var(--text-muted);
  }

  .bg-glow-blue::before {
    content: '';
    position: absolute;
    top: -50px;
    right: -50px;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(51, 153, 255, 0.15) 0%, transparent 70%);
  }

  .bg-glow-green::before {
    content: '';
    position: absolute;
    top: -50px;
    right: -50px;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(46, 204, 113, 0.15) 0%, transparent 70%);
  }

  .bg-glow-purple::before {
    content: '';
    position: absolute;
    top: -50px;
    right: -50px;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(155, 89, 182, 0.15) 0%, transparent 70%);
  }

  .monitoring-links-box {
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .monitoring-links-box h3 {
    font-size: 15px;
    font-weight: 600;
  }

  .sub-instructions {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
    margin-bottom: 16px;
  }

  .links-button-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .external-form-btn {
    background: rgba(255,255,255,0.015);
    border: 1px solid var(--border-color);
    padding: 16px;
    border-radius: 8px;
    display: block;
    transition: var(--transition-smooth);
    position: relative;
    overflow: hidden;
  }

  .external-form-btn:hover {
    background: rgba(255,255,255,0.04);
    border-color: var(--border-color-hover);
    transform: translateY(-1px);
  }

  .btn-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .btn-content strong {
    font-size: 13px;
    color: var(--text-primary);
  }

  .btn-content span {
    font-size: 11px;
    color: var(--accent-blue);
  }

  .external-form-btn.bg-glow-purple .btn-content span {
    color: var(--accent-purple);
  }

  /* Table and statuses */
  .monitoring-table-section h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  .admin-table th, .admin-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  .admin-table th {
    font-weight: 600;
    color: var(--text-secondary);
    background: rgba(255,255,255,0.01);
  }

  .status-tag {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-tag.pending { background: rgba(230, 126, 34, 0.15); color: #e67e22; }
  .status-tag.submitted { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
  .status-tag.requested { background: rgba(51, 153, 255, 0.15); color: #3399ff; }

  .btn-table-action {
    background: rgba(51, 153, 255, 0.1);
    border: 1px solid rgba(51, 153, 255, 0.15);
    color: var(--accent-blue);
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 4px;
    transition: var(--transition-smooth);
  }

  .btn-table-action:hover {
    background: rgba(51, 153, 255, 0.2);
    color: white;
  }

  .btn-table-action.disabled {
    background: rgba(255,255,255,0.02);
    border-color: transparent;
    color: var(--text-muted);
    cursor: not-allowed;
  }

  /* 3. Exit Layout Styles */
  .exit-layout-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }

  .exit-survey-card {
    background: rgba(255,255,255,0.01);
    border: 1px solid var(--border-color);
    padding: 24px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .exit-icon-box {
    font-size: 36px;
  }

  .exit-survey-card h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .exit-survey-card p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .inline-link {
    margin-top: 8px;
  }

  .exiting-tracker-list h3 {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .tracker-card {
    background: rgba(255,255,255,0.015);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .tracker-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tracker-details strong {
    font-size: 14px;
    color: var(--text-primary);
  }

  .facility-label {
    font-size: 11px;
    color: var(--accent-blue);
  }

  .time-label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .tracker-status-checklist {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(0,0,0,0.15);
    padding: 12px;
    border-radius: 6px;
  }

  .checklist-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .checklist-item.checked {
    color: var(--accent-green);
  }

  .checklist-item.pending {
    color: var(--text-secondary);
  }

  .check-icon {
    font-family: var(--font-code);
    font-weight: 700;
  }

  .font-mono {
    font-family: var(--font-code);
  }

  .text-secondary {
    color: var(--text-secondary);
  }
</style>
