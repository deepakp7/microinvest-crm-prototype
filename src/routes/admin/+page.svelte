<script>
  import { onMount } from 'svelte';
  import { auditLogs, notifications, customFields } from '$lib/store.js';

  let feedback = [];
  let loading = true;
  let activeTab = 'feedback'; // 'feedback', 'audit', 'kyc', 'config'
  let savingId = null;
  let showDeleted = false; // Filter state

  // Filter feedback reactively
  $: filteredFeedback = feedback.filter(fb => showDeleted || !fb.deleted);

  async function loadFeedback() {
    loading = true;
    try {
      const res = await fetch('/api/feedback');
      const data = await res.json();
      // Add local ui states
      feedback = data.map(item => ({
        ...item,
        isSaving: false,
        saveSuccess: false
      }));
    } catch (e) {
      console.error('Failed to load feedback', e);
      feedback = [];
    } finally {
      loading = false;
    }
  }

  onMount(loadFeedback);

  async function toggleIncorporated(fb) {
    fb.isSaving = true;
    feedback = [...feedback];
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fb.id,
          incorporated: fb.incorporated,
          comment: fb.comment || ''
        })
      });
      if (res.ok) {
        fb.saveSuccess = true;
        setTimeout(() => {
          fb.saveSuccess = false;
          feedback = [...feedback];
        }, 1500);
      }
    } catch (e) {
      console.error('Failed to update incorporated status', e);
    } finally {
      fb.isSaving = false;
      feedback = [...feedback];
    }
  }

  async function saveComment(fb) {
    fb.isSaving = true;
    feedback = [...feedback];
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fb.id,
          incorporated: fb.incorporated,
          comment: fb.comment || ''
        })
      });
      if (res.ok) {
        fb.saveSuccess = true;
        setTimeout(() => {
          fb.saveSuccess = false;
          feedback = [...feedback];
        }, 1500);
      }
    } catch (e) {
      console.error('Failed to save comment justification', e);
    } finally {
      fb.isSaving = false;
      feedback = [...feedback];
    }
  }

  async function toggleSoftDelete(fb) {
    fb.isSaving = true;
    fb.deleted = !fb.deleted; // Toggle locally immediately
    feedback = [...feedback];
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fb.id,
          deleted: fb.deleted
        })
      });
      if (res.ok) {
        fb.saveSuccess = true;
        setTimeout(() => {
          fb.saveSuccess = false;
          feedback = [...feedback];
        }, 1500);
      }
    } catch (e) {
      console.error('Failed to toggle soft delete', e);
      fb.deleted = !fb.deleted; // Rollback on failure
    } finally {
      fb.isSaving = false;
      feedback = [...feedback];
    }
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(feedback, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feedback_consolidated.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPDF() {
    let jsPDF;
    try {
      const mod = await import('jspdf');
      jsPDF = mod.jsPDF;
    } catch (e) {
      alert('PDF generation requires the jspdf package. Run `npm install jspdf` in the prototype folder.');
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    const lineHeight = 14;
    let y = margin;

    doc.setFontSize(14);
    doc.text('Consolidated Feedback & Justifications', margin, y);
    y += 24;

    doc.setFontSize(10);

    feedback.forEach((fb, idx) => {
      const header = `${idx + 1}. [${fb.incorporated ? 'INCORPORATED' : 'OPEN'}] ${fb.path || 'unknown'} — ${fb.ts || ''}`;
      doc.text(header, margin, y);
      y += lineHeight;

      if (fb.generic) {
        const lines = doc.splitTextToSize('Generic Feedback: ' + fb.generic, 520);
        doc.text(lines, margin, y);
        y += lines.length * lineHeight;
      }
      if (fb.pageSpecific) {
        const lines = doc.splitTextToSize('Page-Specific Feedback: ' + fb.pageSpecific, 520);
        doc.text(lines, margin, y);
        y += lines.length * lineHeight;
      }
      if (fb.comment) {
        const lines = doc.splitTextToSize('Justification/Comment: ' + fb.comment, 520);
        doc.setTextColor(0, 102, 204); // Blue text for justifications
        doc.text(lines, margin, y);
        doc.setTextColor(0, 0, 0); // Reset to black
        y += lines.length * lineHeight;
      }
      y += 12;
      if (y > 750) { doc.addPage(); y = margin; }
    });

    doc.save('feedback_consolidated.pdf');
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return date.toLocaleString();
  }
</script>

<div class="admin-wrapper">
  <!-- Header Title -->
  <div class="admin-header">
    <div class="header-text-block">
      <span class="badge-tag">SYSTEM PANEL</span>
      <h1>Admin Control Center</h1>
      <p class="subtitle">Manage system operations, configurations, telemetry logs, and feedback loops.</p>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <div class="tabs-nav">
    <button class="tab-btn" class:active={activeTab === 'feedback'} on:click={() => activeTab = 'feedback'}>
      <span class="tab-icon">💬</span> Feedback Checklist
    </button>
    <button class="tab-btn" class:active={activeTab === 'audit'} on:click={() => activeTab = 'audit'}>
      <span class="tab-icon">📋</span> Audit Trail
    </button>
    <button class="tab-btn" class:active={activeTab === 'kyc'} on:click={() => activeTab = 'kyc'}>
      <span class="tab-icon">🔔</span> KYC Alert Tasks
    </button>
    <button class="tab-btn" class:active={activeTab === 'config'} on:click={() => activeTab = 'config'}>
      <span class="tab-icon">⚙️</span> Config Fields
    </button>
  </div>

  <!-- Tab Content Body -->
  <div class="tab-content glass-card">
    
    <!-- 1. FEEDBACK TAB -->
    {#if activeTab === 'feedback'}
      <div class="section-header">
        <div>
          <h2>Feedback & Incorporation Justifications</h2>
          <p class="section-sub">Track feedback tickets, toggle incorporation status, and store implementation logs.</p>
          <div class="filter-section" style="margin-top:12px;">
            <label class="filter-checkbox-wrapper">
              <input type="checkbox" bind:checked={showDeleted} />
              <span class="filter-checkbox-text">Show Soft-Deleted Feedback Items</span>
            </label>
          </div>
        </div>
        <div class="action-buttons">
          <button on:click={loadFeedback} class="btn-secondary" disabled={loading}>
            {loading ? 'Refreshing…' : '🔄 Refresh'}
          </button>
          <button on:click={downloadJSON} class="btn-secondary">💾 Download JSON</button>
          <button on:click={downloadPDF} class="btn-primary">📄 Download PDF</button>
        </div>
      </div>

      {#if loading}
        <div class="loading-state">
          <div class="spinner"></div>
          <span>Loading feedback logs from Supabase...</span>
        </div>
      {:else if filteredFeedback.length === 0}
        <div class="empty-state">
          <span class="empty-icon">📂</span>
          <h3>No feedback items match your filter</h3>
          <p>Try checking "Show Soft-Deleted Feedback Items" or check back later.</p>
        </div>
      {:else}
        <div class="feedback-list">
          {#each filteredFeedback as fb (fb.id)}
            <div class="feedback-item-card" class:incorporated={fb.incorporated} class:deleted={fb.deleted}>
              <!-- Checklist Checkbox Area -->
              <div class="checkbox-area">
                <label class="custom-checkbox">
                  <input type="checkbox" bind:checked={fb.incorporated} on:change={() => toggleIncorporated(fb)} disabled={fb.deleted} />
                  <span class="checkmark"></span>
                </label>
              </div>

              <!-- Content Area -->
              <div class="feedback-main-content">
                <div class="feedback-meta">
                  <span class="path-badge">{fb.path || '/'}</span>
                  <span class="time-stamp">{formatDate(fb.ts)}</span>
                  {#if fb.isSaving}
                    <span class="saving-indicator">Saving...</span>
                  {:else if fb.saveSuccess}
                    <span class="saved-indicator">✓ Saved to Database</span>
                  {/if}
                  
                  {#if fb.deleted}
                    <span class="deleted-badge">DELETED</span>
                  {/if}
                  
                  <div style="margin-left: auto;">
                    <button class="btn-delete" on:click={() => toggleSoftDelete(fb)} aria-label={fb.deleted ? 'Restore feedback' : 'Delete feedback'}>
                      {fb.deleted ? '🔄 Restore' : '🗑️ Delete'}
                    </button>
                  </div>
                </div>

                <div class="feedback-texts">
                  {#if fb.generic}
                    <div class="text-bubble">
                      <span class="bubble-label">General Feedback</span>
                      <p>{fb.generic}</p>
                    </div>
                  {/if}
                  
                  {#if fb.pageSpecific}
                    <div class="text-bubble page-specific">
                      <span class="bubble-label">Page Specific Feedback</span>
                      <p>{fb.pageSpecific}</p>
                    </div>
                  {/if}
                </div>

                <!-- Justification Comments Section -->
                <div class="justification-wrapper">
                  <label for="comment-{fb.id}" class="comment-label">Justification / Comment on Incorporation</label>
                  <div class="comment-input-row">
                    <textarea 
                      id="comment-{fb.id}"
                      bind:value={fb.comment} 
                      placeholder="Justify why this feedback is/isn't being incorporated, or explain the solution implemented..."
                      disabled={fb.deleted}
                    />
                    <button class="btn-save-comment" on:click={() => saveComment(fb)} disabled={fb.deleted}>
                      Save Justification
                    </button>
                  </div>
                </div>

                <div class="client-footer">
                  <span>Client Browser: {fb.userAgent || 'Unknown'}</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}

    <!-- 2. AUDIT TRAIL TAB -->
    {:else if activeTab === 'audit'}
      <div class="section-header">
        <div>
          <h2>System Audit Trail</h2>
          <p class="section-sub">Immutable log of operations, webhook captures, lifecycle transitions, and API synchronization.</p>
        </div>
      </div>

      <div class="audit-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor Role</th>
              <th>Action Executed</th>
            </tr>
          </thead>
          <tbody>
            {#each $auditLogs as log}
              <tr>
                <td class="font-mono text-secondary">{formatDate(log.timestamp)}</td>
                <td>
                  <span class="role-pill {log.role.toLowerCase().replace(' ', '-')}">
                    {log.role}
                  </span>
                </td>
                <td>{log.action}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

    <!-- 3. KYC TASKS TAB -->
    {:else if activeTab === 'kyc'}
      <div class="section-header">
        <div>
          <h2>Active KYC Task Alerts</h2>
          <p class="section-sub">Immediate action required compliance flags, AML validation issues, and operational tasks.</p>
        </div>
      </div>

      <div class="notifications-grid">
        {#each $notifications as notif}
          <div class="notif-card" class:urgent={notif.urgent}>
            <div class="notif-header">
              <span class="notif-type">{notif.type}</span>
              {#if notif.urgent}
                <span class="urgent-badge">CRITICAL</span>
              {:else}
                <span class="info-badge">ROUTINE</span>
              {/if}
            </div>
            <h4 class="notif-client">{notif.client}</h4>
            <p class="notif-msg">{notif.message}</p>
          </div>
        {/each}
      </div>

    <!-- 4. CONFIG FIELDS TAB -->
    {:else if activeTab === 'config'}
      <div class="section-header">
        <div>
          <h2>Low-Code Fields Schema Config</h2>
          <p class="section-sub">Registered metadata schemas mapping dynamic onboarding questionnaire parameters for client capture.</p>
        </div>
      </div>

      <div class="config-grid">
        {#each $customFields as field}
          <div class="config-card">
            <div class="config-card-header">
              <span class="field-id font-mono">{field.id}</span>
              <span class="field-type">{field.type}</span>
            </div>
            <div class="field-details">
              <strong>{field.label}</strong>
              {#if field.placeholder}
                <p class="placeholder">Placeholder: <em>"{field.placeholder}"</em></p>
              {/if}
              <div class="field-flags">
                {#if field.required}
                  <span class="flag-badge required">Required</span>
                {/if}
                {#if field.options}
                  <span class="flag-badge options-count">{field.options.length} Options</span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  </div>
</div>

<style>
  .admin-wrapper {
    max-width: 1200px;
    margin: 0 auto;
    padding-bottom: 40px;
  }

  .admin-header {
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

  .admin-header h1 {
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

  /* Tabs menu */
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

  /* Content area styling */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 16px;
    margin-bottom: 24px;
    gap: 20px;
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

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  /* Checklist Styles */
  .feedback-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .feedback-item-card {
    display: flex;
    gap: 16px;
    background: rgba(255, 255, 255, 0.015);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 18px;
    transition: var(--transition-smooth);
  }

  .feedback-item-card:hover {
    border-color: var(--border-color-hover);
    background: rgba(255, 255, 255, 0.03);
  }

  .feedback-item-card.incorporated {
    border-color: rgba(46, 204, 113, 0.2);
    background: rgba(46, 204, 113, 0.02);
  }

  /* Checklist Checkbox */
  .checkbox-area {
    padding-top: 4px;
  }

  .custom-checkbox {
    display: block;
    position: relative;
    width: 22px;
    height: 22px;
    cursor: pointer;
    user-select: none;
  }

  .custom-checkbox input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
    height: 0;
    width: 0;
  }

  .checkmark {
    position: absolute;
    top: 0;
    left: 0;
    height: 22px;
    width: 22px;
    background-color: rgba(255,255,255,0.05);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    transition: var(--transition-smooth);
  }

  .custom-checkbox:hover input ~ .checkmark {
    background-color: rgba(255,255,255,0.1);
    border-color: var(--border-color-hover);
  }

  .custom-checkbox input:checked ~ .checkmark {
    background-color: var(--accent-green);
    border-color: var(--accent-green);
    box-shadow: 0 0 8px rgba(46, 204, 113, 0.4);
  }

  .checkmark:after {
    content: "";
    position: absolute;
    display: none;
  }

  .custom-checkbox input:checked ~ .checkmark:after {
    display: block;
  }

  .custom-checkbox .checkmark:after {
    left: 7px;
    top: 3px;
    width: 6px;
    height: 11px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  /* Main content layout of feedback items */
  .feedback-main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .feedback-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .path-badge {
    font-size: 11px;
    font-family: var(--font-code);
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border-color);
    padding: 2px 8px;
    border-radius: 4px;
    color: var(--accent-blue);
  }

  .time-stamp {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .saving-indicator {
    font-size: 11px;
    color: var(--accent-orange);
    animation: flash 1.5s infinite;
  }

  .saved-indicator {
    font-size: 11px;
    color: var(--accent-green);
    font-weight: 600;
  }

  @keyframes flash {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .feedback-texts {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .text-bubble {
    background: rgba(255, 255, 255, 0.02);
    border-left: 3px solid var(--accent-blue);
    padding: 8px 12px;
    border-radius: 0 8px 8px 0;
  }

  .text-bubble.page-specific {
    border-left-color: var(--accent-purple);
  }

  .bubble-label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    margin-bottom: 2px;
    letter-spacing: 0.5px;
  }

  .text-bubble p {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
  }

  /* Justification input style */
  .justification-wrapper {
    margin-top: 8px;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid var(--border-color);
    padding: 12px;
    border-radius: 8px;
  }

  .comment-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .comment-input-row {
    display: flex;
    gap: 8px;
  }

  .comment-input-row textarea {
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    font-size: 12px;
    background: rgba(0,0,0,0.2);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px;
    color: var(--text-primary);
    resize: vertical;
  }

  .comment-input-row textarea::placeholder {
    color: var(--text-muted);
  }

  .comment-input-row textarea:focus {
    border-color: rgba(51, 153, 255, 0.4);
  }

  .btn-save-comment {
    background: rgba(51, 153, 255, 0.1);
    border: 1px solid rgba(51, 153, 255, 0.2);
    color: var(--accent-blue);
    font-size: 12px;
    font-weight: 600;
    padding: 0 16px;
    border-radius: 6px;
    height: 40px;
    transition: var(--transition-smooth);
    align-self: flex-end;
  }

  .btn-save-comment:hover {
    background: rgba(51, 153, 255, 0.2);
    color: #fff;
    border-color: var(--accent-blue);
  }

  .client-footer {
    font-size: 10px;
    color: var(--text-muted);
  }

  /* Audit Trail Table */
  .audit-table-wrapper {
    overflow-x: auto;
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

  .font-mono {
    font-family: var(--font-code);
  }

  .text-secondary {
    color: var(--text-secondary);
  }

  /* Roles Pills */
  .role-pill {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .role-pill.sales-rep { background: rgba(52, 152, 219, 0.15); color: #3498db; }
  .role-pill.relationship-manager { background: rgba(155, 89, 182, 0.15); color: #9b59b6; }
  .role-pill.compliance-officer { background: rgba(241, 196, 15, 0.15); color: #f1c40f; }
  .role-pill.operations { background: rgba(230, 126, 34, 0.15); color: #e67e22; }
  .role-pill.management-team { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
  .role-pill.admin { background: rgba(231, 76, 60, 0.15); color: #e74c3c; }

  /* Notifications Cards */
  .notifications-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }

  .notif-card {
    background: rgba(255,255,255,0.015);
    border: 1px solid var(--border-color);
    padding: 16px;
    border-radius: 10px;
    transition: var(--transition-smooth);
  }

  .notif-card:hover {
    border-color: var(--border-color-hover);
    transform: translateY(-2px);
  }

  .notif-card.urgent {
    border-color: rgba(231, 76, 60, 0.3);
    background: rgba(231, 76, 60, 0.02);
  }

  .notif-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .notif-type {
    font-size: 11px;
    color: var(--accent-blue);
    font-weight: 600;
  }

  .urgent-badge {
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    background: var(--accent-red);
    padding: 2px 6px;
    border-radius: 4px;
    box-shadow: 0 0 8px rgba(231, 76, 60, 0.4);
  }

  .info-badge {
    font-size: 9px;
    color: var(--text-secondary);
    background: rgba(255,255,255,0.05);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .notif-client {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .notif-msg {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  /* Custom Config Grid */
  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 14px;
  }

  .config-card {
    background: rgba(255,255,255,0.01);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px;
  }

  .config-card-header {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    margin-bottom: 8px;
  }

  .field-id {
    color: var(--accent-blue);
  }

  .field-type {
    color: var(--text-secondary);
    text-transform: uppercase;
  }

  .field-details strong {
    display: block;
    font-size: 13px;
    color: var(--text-primary);
  }

  .placeholder {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }

  .field-flags {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }

  .flag-badge {
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .flag-badge.required {
    background: rgba(231, 76, 60, 0.1);
    color: var(--accent-red);
  }

  .flag-badge.options-count {
    background: rgba(155, 89, 182, 0.1);
    color: var(--accent-purple);
  }

  /* General Loading & Empty States */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 60px 0;
    color: var(--text-secondary);
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    border-top-color: var(--accent-blue);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    text-align: center;
    padding: 60px 0;
  }

  .empty-icon {
    font-size: 40px;
    display: block;
    margin-bottom: 12px;
  }

  .empty-state h3 {
    font-size: 16px;
    font-weight: 600;
  }

  .empty-state p {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  /* Soft Delete & Filter Styles */
  .feedback-item-card.deleted {
    opacity: 0.4;
    border-color: rgba(255, 255, 255, 0.04);
    background: rgba(0, 0, 0, 0.2);
  }

  .feedback-item-card.deleted .text-bubble p {
    text-decoration: line-through;
    color: var(--text-muted);
  }

  .feedback-item-card.deleted .justification-wrapper {
    opacity: 0.6;
    pointer-events: none;
  }

  .filter-checkbox-wrapper {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .filter-checkbox-wrapper input {
    width: 14px;
    height: 14px;
    accent-color: var(--accent-blue);
    cursor: pointer;
  }

  .filter-checkbox-text {
    transition: var(--transition-smooth);
  }

  .filter-checkbox-wrapper:hover .filter-checkbox-text {
    color: var(--text-primary);
  }

  .deleted-badge {
    font-size: 9px;
    font-weight: 700;
    color: #fff;
    background: var(--text-muted);
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }

  .btn-delete {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 6px;
    transition: var(--transition-smooth);
  }

  .btn-delete:hover {
    background: rgba(231, 76, 60, 0.15);
    border-color: var(--accent-red);
    color: #fff;
    box-shadow: 0 0 8px rgba(231, 76, 60, 0.2);
  }

  .feedback-item-card.deleted .btn-delete:hover {
    background: rgba(51, 153, 255, 0.15);
    border-color: var(--accent-blue);
    color: #fff;
    box-shadow: 0 0 8px rgba(51, 153, 255, 0.2);
  }
</style>
