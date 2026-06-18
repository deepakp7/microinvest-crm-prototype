<script>
  import { opportunities, pipelineStages, addAuditLog, userRole } from '$lib/store.js';

  let selectedOpportunity = null;
  let showDetailModal = false;
  let newNote = '';

  let draggedOppId = null;
  let hoverStageId = null;

  function handleDragStart(event, oppId) {
    draggedOppId = oppId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', oppId);
  }

  function handleDragOver(event, stageId) {
    event.preventDefault();
    hoverStageId = stageId;
  }

  function handleDragLeave() {
    hoverStageId = null;
  }

  function handleDrop(event, stageId) {
    event.preventDefault();
    if (draggedOppId) {
      moveOpportunity(draggedOppId, stageId);
    }
    draggedOppId = null;
    hoverStageId = null;
  }

  // Calculate dynamic forecast totals
  $: totalPipelineValue = $opportunities.reduce((acc, o) => acc + (Number(o.dealSize) || 0), 0);
  $: weightedForecast = $opportunities.reduce((acc, o) => {
    const prob = Number(o.probability) || 0;
    const size = Number(o.dealSize) || 0;
    return acc + (size * prob / 100);
  }, 0);

  function moveOpportunity(oppId, targetStageId) {
    const targetStage = $pipelineStages.find(s => s.id === targetStageId);
    if (!targetStage) return;

    opportunities.update(list => 
      list.map(o => {
        if (o.id === oppId) {
          const prevStage = o.stage;
          const emails = [...(o.emailsTriggered || [])];

          // Trigger email logic based on lifecycle state changes
          if (targetStageId === 'qualified' && prevStage === 'prospect') {
            emails.push({
              date: new Date().toISOString(),
              subject: 'Opportunity Stage Updated: Qualified Verification',
              recipient: o.email
            });
          } else if (targetStageId === 'proposal') {
            emails.push({
              date: new Date().toISOString(),
              subject: 'Investment Proposal Request - MicroInvest',
              recipient: o.email
            });
          } else if (targetStageId === 'won') {
            emails.push({
              date: new Date().toISOString(),
              subject: 'Loan Booking Confirmation Notification',
              recipient: o.email
            });
          }

          addAuditLog($userRole, `Moved Opportunity "${o.companyName}" from [${prevStage}] to [${targetStage.label}] (Forecasting Probability: ${targetStage.probability}%)`);

          return {
            ...o,
            stage: targetStageId,
            probability: targetStage.probability,
            emailsTriggered: emails
          };
        }
        return o;
      })
    );

    // Update the local modal view state if currently open
    if (selectedOpportunity && selectedOpportunity.id === oppId) {
      selectedOpportunity = $opportunities.find(o => o.id === oppId);
    }
  }

  function addNote(oppId) {
    if (!newNote.trim()) return;

    opportunities.update(list => 
      list.map(o => {
        if (o.id === oppId) {
          const notesText = o.notes ? `${o.notes}\n---\n[Note added on ${new Date().toLocaleDateString()}]: ${newNote}` : newNote;
          addAuditLog($userRole, `Added note to Opportunity "${o.companyName}": "${newNote.substring(0, 30)}..."`);
          return { ...o, notes: notesText };
        }
        return o;
      })
    );

    newNote = '';
    selectedOpportunity = $opportunities.find(o => o.id === oppId);
  }

  function openDetails(opp) {
    selectedOpportunity = opp;
    showDetailModal = true;
  }
</script>

<div class="opportunities-page">
  <div class="header-container">
    <div class="title-section">
      <span class="badge-tag">SALES PIPELINE</span>
      <h1>Deals Underwriting Pipeline</h1>
      <p class="description">Track investment deal stages, dynamic probability weighing, and automatic lifecycle email triggers. Drag/shift deals as analysis progresses.</p>
    </div>

    <!-- Live Weighted Forecast Metrics -->
    <div class="metrics-row">
      <div class="metric-card glass-card">
        <span class="m-label">Total Value</span>
        <span class="m-value">£{totalPipelineValue.toLocaleString()}</span>
      </div>
      <div class="metric-card glass-card">
        <span class="m-label">Weighted Forecast</span>
        <span class="m-value text-blue">£{weightedForecast.toLocaleString()}</span>
      </div>
    </div>
  </div>

  <!-- Kanban Board Layout -->
  <div class="kanban-board">
    {#each $pipelineStages as stage}
      <div 
        class="kanban-column" 
        style="border-top: 3px solid {stage.color}"
        class:drag-over={hoverStageId === stage.id}
        on:dragover={(e) => handleDragOver(e, stage.id)}
        on:dragleave={handleDragLeave}
        on:drop={(e) => handleDrop(e, stage.id)}
      >
        <div class="column-header">
          <div class="column-title-row">
            <span class="color-dot" style="background-color: {stage.color}"></span>
            <h3>{stage.label}</h3>
          </div>
          <span class="stage-count">
            {$opportunities.filter(o => o.stage === stage.id).length}
          </span>
        </div>

        <div class="cards-list">
          {#each $opportunities.filter(o => o.stage === stage.id) as opp}
            <div 
              class="opp-card glass-card" 
              class:dragging={draggedOppId === opp.id}
              draggable="true"
              on:dragstart={(e) => handleDragStart(e, opp.id)}
              on:click={() => openDetails(opp)}
            >
              <div class="card-top">
                <span class="card-co-name">{opp.companyName}</span>
                <span class="esg-tiny" class:aaa={opp.esgRating?.includes('AAA')}>{opp.esgRating?.split(' ')[0] || 'A'}</span>
              </div>
              
              <div class="card-contact">{opp.contactName}</div>
              
              <div class="card-bottom">
                <span class="deal-value">£{opp.dealSize.toLocaleString()}</span>
                <span class="facility-type">{opp.investmentFacility?.substring(0, 16)}...</span>
              </div>

              <!-- Quick Move Controls -->
              <div class="quick-move-row" on:click|stopPropagation>
                <span class="move-lbl">Shift:</span>
                {#each $pipelineStages.filter(s => s.id !== opp.stage) as nextStage}
                  <button 
                    class="shift-btn" 
                    style="border-color: {nextStage.color}30; color: {nextStage.color}"
                    on:click={() => moveOpportunity(opp.id, nextStage.id)}
                    title="Move to {nextStage.label}"
                  >
                    {nextStage.label.substring(0, 2)}
                  </button>
                {/each}
              </div>
            </div>
          {/each}

          {#if $opportunities.filter(o => o.stage === stage.id).length === 0}
            <div class="empty-column-placeholder">No deals in this stage</div>
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <!-- Detail Modal -->
  {#if showDetailModal && selectedOpportunity}
    <div class="modal-overlay" on:click={() => showDetailModal = false}>
      <div class="modal-content glass-card" on:click|stopPropagation>
        <div class="modal-header">
          <div>
            <span class="badge-tag">Deal Details</span>
            <h2>{selectedOpportunity.companyName}</h2>
          </div>
          <button class="close-btn" on:click={() => showDetailModal = false}>✕</button>
        </div>

        <div class="modal-body-grid">
          <!-- Main Details -->
          <div class="details-left">
            <div class="detail-group">
              <span class="grp-label">Primary Contact:</span>
              <span class="grp-val">{selectedOpportunity.contactName} ({selectedOpportunity.email})</span>
            </div>

            <div class="detail-group">
              <span class="grp-label">Investment Facility:</span>
              <span class="grp-val">{selectedOpportunity.investmentFacility}</span>
            </div>

            <div class="detail-group">
              <span class="grp-label">ESG Rating:</span>
              <span class="grp-val">{selectedOpportunity.esgRating || 'N/A'}</span>
            </div>

            <div class="detail-group">
              <span class="grp-label">Deal Size / Value:</span>
              <span class="grp-val highlight-val">£{selectedOpportunity.dealSize.toLocaleString()}</span>
            </div>

            <!-- Stage Management inside modal -->
            <div class="detail-group stage-changer">
              <span class="grp-label">Underwriting Stage:</span>
              <div class="select-stage-row">
                <select 
                  value={selectedOpportunity.stage} 
                  on:change={(e) => moveOpportunity(selectedOpportunity.id, e.target.value)}
                >
                  {#each $pipelineStages as s}
                    <option value={s.id}>{s.label} ({s.probability}% Forecast)</option>
                  {/each}
                </select>
              </div>
            </div>

            <!-- Notes Section -->
            <div class="notes-section">
              <span class="grp-label">Audit Notes Log:</span>
              <div class="notes-display">
                {selectedOpportunity.notes || 'No notes saved.'}
              </div>
              <div class="add-note-row">
                <input type="text" placeholder="Add an analysis note..." bind:value={newNote} />
                <button class="btn-primary" on:click={() => addNote(selectedOpportunity.id)}>Add</button>
              </div>
            </div>

            <!-- Operations Promotion Prompt -->
            {#if selectedOpportunity.stage === 'won' && !selectedOpportunity.booked}
              <div class="ops-prompt-box">
                <div class="prompt-icon">💸</div>
                <div class="prompt-details">
                  <h4>Approved Deal Awaiting Booking</h4>
                  <p>This deal has been successfully closed. Operations can now book the loan, generate Margill IDs, and populate the double-entry ledger journals.</p>
                  <a href="/loans" class="btn-primary inline-btn">Proceed to Loan Booking</a>
                </div>
              </div>
            {/if}
          </div>

          <!-- Email Trigger Log History -->
          <div class="details-right">
            <h3>📬 Automated Email History</h3>
            <p class="section-desc">Emails triggered automatically by pipeline lifecycle transitions:</p>

            <div class="email-timeline">
              {#each selectedOpportunity.emailsTriggered || [] as email}
                <div class="email-timeline-item">
                  <div class="email-dot"></div>
                  <div class="email-card">
                    <div class="email-meta">
                      <span class="email-date">{new Date(email.date).toLocaleDateString()}</span>
                      <span class="email-to">To: {email.recipient}</span>
                    </div>
                    <div class="email-subject">{email.subject}</div>
                    <div class="email-preview">Simulated SMTP dispatch completed successfully.</div>
                  </div>
                </div>
              {/each}

              {#if !(selectedOpportunity.emailsTriggered && selectedOpportunity.emailsTriggered.length > 0)}
                <div class="empty-timeline-placeholder">No emails generated yet.</div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .opportunities-page {
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
    max-width: 580px;
  }

  /* Metrics Panel */
  .metrics-row {
    display: flex;
    gap: 16px;
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    padding: 12px 24px;
    min-width: 160px;
  }

  .m-label {
    font-size: 11px;
    color: var(--text-secondary);
    text-transform: uppercase;
    font-weight: 600;
  }

  .m-value {
    font-size: 20px;
    font-family: var(--font-heading);
    font-weight: 800;
  }

  .text-blue {
    color: var(--accent-blue);
  }

  /* Kanban Board columns */
  .kanban-board {
    display: flex;
    gap: 20px;
    overflow-x: auto;
    padding-bottom: 20px;
    align-items: flex-start;
  }

  .kanban-column {
    flex: 1;
    min-width: 250px;
    background: rgba(13, 17, 23, 0.4);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 16px 12px;
  }

  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 0 4px;
  }

  .column-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .column-header h3 {
    font-size: 15px;
    font-weight: 700;
  }

  .stage-count {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    background: var(--bg-glass);
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--border-color);
  }

  .cards-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 400px;
  }

  .opp-card {
    padding: 14px 16px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.02);
    border-color: var(--border-color);
    transition: var(--transition-smooth);
  }

  .opp-card.dragging {
    opacity: 0.4;
    border: 1px dashed var(--accent-blue);
  }

  .kanban-column.drag-over {
    background: rgba(51, 153, 255, 0.08);
    border-color: rgba(51, 153, 255, 0.3);
    box-shadow: inset 0 0 10px rgba(51, 153, 255, 0.1);
  }

  .opp-card:hover {
    transform: translateY(-2px);
    border-color: var(--border-color-hover);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    background: var(--bg-glass-hover);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 6px;
  }

  .card-co-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .esg-tiny {
    font-size: 8px;
    font-weight: 800;
    padding: 1px 4px;
    border-radius: 3px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
  }

  .esg-tiny.aaa {
    background: rgba(46, 204, 113, 0.1);
    color: var(--accent-green);
    border-color: rgba(46, 204, 113, 0.2);
  }

  .card-contact {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .card-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px dashed var(--border-color);
    padding-bottom: 10px;
    margin-bottom: 10px;
  }

  .deal-value {
    font-size: 14px;
    font-weight: 700;
    color: var(--accent-blue);
    font-family: var(--font-code);
  }

  .facility-type {
    font-size: 10px;
    color: var(--text-muted);
  }

  /* Quick move buttons */
  .quick-move-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .move-lbl {
    font-size: 10px;
    color: var(--text-muted);
    font-weight: 600;
    margin-right: 4px;
  }

  .shift-btn {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid transparent;
    cursor: pointer;
    background: var(--bg-glass);
    transition: var(--transition-smooth);
  }

  .shift-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    transform: scale(1.05);
  }

  .empty-column-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80px;
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
  }

  /* Detail Modal */
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
    width: 880px;
    max-width: 90vw;
    background: rgba(13, 17, 23, 0.92);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
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

  .modal-body-grid {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 32px;
  }

  /* Modal left pane */
  .details-left {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .detail-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .grp-label {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
  }

  .grp-val {
    font-size: 14px;
    font-weight: 500;
  }

  .highlight-val {
    font-size: 20px;
    font-weight: 800;
    color: var(--accent-blue);
    font-family: var(--font-code);
  }

  .stage-changer select {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    width: 280px;
  }

  .stage-changer select option {
    background: var(--bg-secondary);
  }

  /* Notes */
  .notes-display {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 12px;
    color: var(--text-secondary);
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
    margin-bottom: 10px;
  }

  .add-note-row {
    display: flex;
    gap: 10px;
  }

  .add-note-row input {
    flex: 1;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
  }

  /* Ops callout box */
  .ops-prompt-box {
    display: flex;
    gap: 16px;
    background: rgba(51, 153, 255, 0.05);
    border: 1px solid rgba(51, 153, 255, 0.2);
    padding: 16px;
    border-radius: 8px;
    margin-top: 10px;
  }

  .prompt-icon {
    font-size: 32px;
  }

  .prompt-details h4 {
    font-size: 14px;
    color: var(--accent-blue);
    margin-bottom: 4px;
  }

  .prompt-details p {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .inline-btn {
    padding: 6px 12px;
    font-size: 11px;
    border-radius: 4px;
  }

  /* Timeline */
  .details-right {
    border-left: 1px solid var(--border-color);
    padding-left: 28px;
    max-height: 480px;
    overflow-y: auto;
  }

  .details-right h3 {
    font-size: 16px;
    margin-bottom: 4px;
  }

  .section-desc {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 20px;
  }

  .email-timeline {
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    padding-left: 12px;
  }

  .email-timeline::before {
    content: '';
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: 4px;
    width: 1px;
    background: var(--border-color);
  }

  .email-timeline-item {
    display: flex;
    gap: 16px;
    position: relative;
  }

  .email-dot {
    position: absolute;
    left: -11px;
    top: 6px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent-blue);
    box-shadow: 0 0 6px var(--accent-blue);
  }

  .email-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 14px;
    flex: 1;
  }

  .email-meta {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--text-muted);
    margin-bottom: 4px;
  }

  .email-subject {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .email-preview {
    font-size: 11px;
    color: var(--text-secondary);
    font-family: var(--font-code);
  }

  .empty-timeline-placeholder {
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
    padding: 40px 0;
  }
</style>
