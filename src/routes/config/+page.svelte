<script>
  import { customFields, pipelineStages, addAuditLog, userRole } from '$lib/store.js';

  // Forms dynamic properties
  let newFieldId = '';
  let newFieldLabel = '';
  let newFieldType = 'text';
  let newFieldRequired = false;
  let newFieldPlaceholder = '';
  let newFieldOptionsString = '';

  // Stages dynamic properties
  let newStageId = '';
  let newStageLabel = '';
  let newStageProbability = 50;
  let newStageColor = '#3498db';

  let notification = '';
  let activeTab = 'fields'; // 'fields' | 'stages'

  function showMessage(msg) {
    notification = msg;
    setTimeout(() => {
      notification = '';
    }, 3000);
  }

  function addCustomField() {
    if (!newFieldId || !newFieldLabel) {
      showMessage('⚠️ Field ID and Label are required.');
      return;
    }
    
    // Normalize field ID to camelCase
    let idClean = newFieldId.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    idClean = idClean.charAt(0).toLowerCase() + idClean.slice(1);

    if ($customFields.some(f => f.id === idClean)) {
      showMessage('⚠️ A field with this ID already exists.');
      return;
    }

    let options = [];
    if (newFieldType === 'select' && newFieldOptionsString) {
      options = newFieldOptionsString.split(',').map(s => s.trim()).filter(Boolean);
    }

    const newField = {
      id: idClean,
      label: newFieldLabel,
      type: newFieldType,
      required: newFieldRequired,
      placeholder: newFieldPlaceholder || `Enter ${newFieldLabel}...`,
      options: newFieldType === 'select' ? options : undefined
    };

    customFields.update(fields => [...fields, newField]);
    addAuditLog($userRole, `Added custom dynamic field: "${newFieldLabel}" (ID: ${idClean}, Type: ${newFieldType})`);
    
    // Reset form
    newFieldId = '';
    newFieldLabel = '';
    newFieldType = 'text';
    newFieldRequired = false;
    newFieldPlaceholder = '';
    newFieldOptionsString = '';
    
    showMessage(`✅ Created field "${newFieldLabel}" successfully!`);
  }

  function removeCustomField(id, label) {
    customFields.update(fields => fields.filter(f => f.id !== id));
    addAuditLog($userRole, `Removed dynamic field: "${label}" (ID: ${id})`);
    showMessage(`🗑️ Removed field "${label}"`);
  }

  function addStage() {
    if (!newStageLabel) {
      showMessage('⚠️ Stage label is required.');
      return;
    }

    let idClean = newStageLabel.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    if ($pipelineStages.some(s => s.id === idClean)) {
      showMessage('⚠️ A stage with this label/ID already exists.');
      return;
    }

    const newStage = {
      id: idClean,
      label: newStageLabel,
      probability: newStageProbability,
      color: newStageColor
    };

    pipelineStages.update(stages => [...stages, newStage]);
    addAuditLog($userRole, `Created new pipeline stage: "${newStageLabel}" (${newStageProbability}% forecast weight)`);

    // Reset form
    newStageLabel = '';
    newStageProbability = 50;
    newStageColor = '#3498db';

    showMessage(`✅ Created stage "${newStage.label}" successfully!`);
  }

  function removeStage(id, label) {
    if (id === 'won' || id === 'lost' || id === 'prospect') {
      showMessage('⚠️ Core stages (Prospect, Won, Lost) cannot be deleted.');
      return;
    }
    pipelineStages.update(stages => stages.filter(s => s.id !== id));
    addAuditLog($userRole, `Removed pipeline stage: "${label}" (ID: ${id})`);
    showMessage(`🗑️ Removed stage "${label}"`);
  }
</script>

<div class="config-page">
  <div class="header-container">
    <div class="title-section">
      <span class="badge-tag">ADMIN ENGINE</span>
      <h1>Low-Code Configuration Studio</h1>
      <p class="description">Define custom schema attributes and pipeline stages. Modifications propagate reactively across all databases, inputs, and boards.</p>
    </div>
    {#if notification}
      <div class="toast-alert">{notification}</div>
    {/if}
  </div>

  {#if $userRole !== 'Admin'}
    <div class="restricted-warning glass-card">
      <span class="warning-icon">⚠️</span>
      <div class="warning-text">
        <h3>Restricted Configuration Access</h3>
        <p>Your current role is set to <strong>{$userRole}</strong>. Only <strong>Admin</strong> users have compile-level write authority over CRM configurations. Switching to Admin via the header bar is recommended to modify forms and stages.</p>
      </div>
    </div>
  {/if}

  <div class="studio-layout" class:read-only={$userRole !== 'Admin'}>
    <!-- Navigation Tabs -->
    <div class="tabs-row">
      <button class="tab-btn" class:active={activeTab === 'fields'} on:click={() => activeTab = 'fields'}>
        📝 Lead Form Fields Configuration
      </button>
      <button class="tab-btn" class:active={activeTab === 'stages'} on:click={() => activeTab = 'stages'}>
        🛣️ Sales Pipeline Stages
      </button>
    </div>

    {#if activeTab === 'fields'}
      <div class="grid-2col">
        <!-- Field List Card -->
        <div class="glass-card">
          <div class="card-header">
            <h2>Active CRM Field Configuration</h2>
            <p>Standard & Custom properties currently embedded in the lead capture system.</p>
          </div>

          <div class="fields-list">
            {#each $customFields as field}
              <div class="field-item">
                <div class="field-info">
                  <div class="field-name-row">
                    <span class="field-label-text">{field.label}</span>
                    <span class="field-id-tag">{field.id}</span>
                    {#if field.required}
                      <span class="req-indicator">Required</span>
                    {/if}
                  </div>
                  <div class="field-meta">
                    <span class="meta-badge">{field.type}</span>
                    {#if field.options}
                      <span class="meta-options">Options: {field.options.join(', ')}</span>
                    {/if}
                  </div>
                </div>
                {#if $userRole === 'Admin'}
                  <button class="remove-btn" on:click={() => removeCustomField(field.id, field.label)} title="Delete custom field">
                    🗑️
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Add Field Configurator -->
        {#if $userRole === 'Admin'}
          <div class="glass-card">
            <div class="card-header">
              <h2>Add Dynamic Custom Field</h2>
              <p>Inject new inputs into forms and opportunity records.</p>
            </div>

            <form on:submit|preventDefault={addCustomField} class="config-form">
              <div class="form-group">
                <label for="fieldId">Unique Field ID (camelCase)</label>
                <input type="text" id="fieldId" bind:value={newFieldId} placeholder="e.g. esgImpactScore" required />
              </div>

              <div class="form-group">
                <label for="fieldLabel">Display Label</label>
                <input type="text" id="fieldLabel" bind:value={newFieldLabel} placeholder="e.g. ESG Impact Score" required />
              </div>

              <div class="form-group">
                <label for="fieldType">Data Type</label>
                <select id="fieldType" bind:value={newFieldType}>
                  <option value="text">Short Text</option>
                  <option value="number">Number</option>
                  <option value="email">Email</option>
                  <option value="tel">Phone Number</option>
                  <option value="select">Dropdown Select</option>
                </select>
              </div>

              {#if newFieldType === 'select'}
                <div class="form-group fade-in">
                  <label for="fieldOptions">Dropdown Options (Comma-separated)</label>
                  <input type="text" id="fieldOptions" bind:value={newFieldOptionsString} placeholder="e.g. Low, Medium, High" required />
                  <span class="helper-text">Enter values separated by commas.</span>
                </div>
              {/if}

              <div class="form-group">
                <label for="fieldPlaceholder">Input Placeholder (Optional)</label>
                <input type="text" id="fieldPlaceholder" bind:value={newFieldPlaceholder} placeholder="e.g. Enter ESG value..." />
              </div>

              <div class="form-group checkbox-row">
                <input type="checkbox" id="fieldRequired" bind:value={newFieldRequired} />
                <label for="fieldRequired">Enforce validation (Required field)</label>
              </div>

              <button type="submit" class="btn-primary">Deploy Dynamic Field</button>
            </form>
          </div>
        {/if}
      </div>
    {:else if activeTab === 'stages'}
      <div class="grid-2col">
        <!-- Stage List Card -->
        <div class="glass-card">
          <div class="card-header">
            <h2>Active Deal Pipeline Stages</h2>
            <p>Current sales path. Moving deals into these stages updates forecasting and email webhooks.</p>
          </div>

          <div class="stages-list">
            {#each $pipelineStages as stage}
              <div class="stage-item" style="border-left: 4px solid {stage.color}">
                <div class="stage-info">
                  <span class="stage-label-text">{stage.label}</span>
                  <div class="stage-meta">
                    <span class="prob-badge" style="background-color: {stage.color}15; color: {stage.color}">
                      Probability: {stage.probability}%
                    </span>
                    <span class="stage-id-txt">ID: {stage.id}</span>
                  </div>
                </div>
                {#if $userRole === 'Admin' && stage.id !== 'won' && stage.id !== 'lost' && stage.id !== 'prospect'}
                  <button class="remove-btn" on:click={() => removeStage(stage.id, stage.label)} title="Delete stage">
                    🗑️
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </div>

        <!-- Add Stage Configurator -->
        {#if $userRole === 'Admin'}
          <div class="glass-card">
            <div class="card-header">
              <h2>Add Custom Pipeline Stage</h2>
              <p>Expand or customize lifecycle transitions for investment proposals.</p>
            </div>

            <form on:submit|preventDefault={addStage} class="config-form">
              <div class="form-group">
                <label for="stageLabel">Stage Name</label>
                <input type="text" id="stageLabel" bind:value={newStageLabel} placeholder="e.g. Due Diligence" required />
              </div>

              <div class="form-group">
                <label for="stageProbability">Deal Forecast Probability (%)</label>
                <div class="range-slider-wrapper">
                  <input type="range" id="stageProbability" min="0" max="100" step="5" bind:value={newStageProbability} />
                  <span class="range-value">{newStageProbability}%</span>
                </div>
              </div>

              <div class="form-group">
                <label for="stageColor">Visual Color Theme</label>
                <div class="color-picker-row">
                  <input type="color" id="stageColor" bind:value={newStageColor} />
                  <input type="text" bind:value={newStageColor} placeholder="#3498db" class="color-text-input" />
                </div>
              </div>

              <button type="submit" class="btn-primary">Deploy Pipeline Stage</button>
            </form>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .config-page {
    animation: fadeIn 0.4s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .header-container {
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

  .toast-alert {
    background: rgba(51, 153, 255, 0.15);
    border: 1px solid rgba(51, 153, 255, 0.3);
    color: var(--text-primary);
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
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

  .studio-layout {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .studio-layout.read-only {
    pointer-events: none;
    opacity: 0.75;
  }

  /* Tabs Navigation */
  .tabs-row {
    display: flex;
    gap: 12px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 8px;
  }

  .tab-btn {
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    transition: var(--transition-smooth);
  }

  .tab-btn:hover {
    color: var(--text-primary);
  }

  .tab-btn.active {
    color: var(--accent-blue);
    border-bottom-color: var(--accent-blue);
  }

  /* Grids */
  .grid-2col {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 24px;
  }

  .card-header {
    margin-bottom: 20px;
  }

  .card-header h2 {
    font-size: 18px;
    margin-bottom: 4px;
  }

  .card-header p {
    font-size: 12px;
    color: var(--text-secondary);
  }

  /* Fields List Styling */
  .fields-list, .stages-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 480px;
    overflow-y: auto;
    padding-right: 6px;
  }

  .field-item, .stage-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    transition: var(--transition-smooth);
  }

  .field-item:hover, .stage-item:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--border-color-hover);
  }

  .field-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .field-label-text {
    font-size: 14px;
    font-weight: 600;
  }

  .field-id-tag {
    font-size: 10px;
    font-family: var(--font-code);
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 6px;
    border-radius: 4px;
  }

  .req-indicator {
    font-size: 9px;
    color: var(--accent-orange);
    border: 1px solid rgba(243, 156, 18, 0.2);
    background: rgba(243, 156, 18, 0.05);
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .field-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .meta-badge {
    font-size: 11px;
    color: var(--accent-blue);
    background: rgba(51, 153, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: capitalize;
  }

  .meta-options {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 250px;
  }

  .remove-btn {
    font-size: 14px;
    opacity: 0.4;
    transition: var(--transition-smooth);
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
  }

  .remove-btn:hover {
    opacity: 1;
    color: var(--accent-red);
    transform: scale(1.1);
  }

  /* Stage Item styling */
  .stage-item {
    background: rgba(255, 255, 255, 0.015);
  }

  .stage-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stage-label-text {
    font-size: 14px;
    font-weight: 600;
  }

  .stage-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .prob-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .stage-id-txt {
    font-size: 10px;
    color: var(--text-muted);
    font-family: var(--font-code);
  }

  /* Configurator Forms */
  .config-form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-group input[type="text"],
  .form-group input[type="email"],
  .form-group select {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-primary);
    transition: var(--transition-smooth);
  }

  .form-group input:focus,
  .form-group select:focus {
    border-color: var(--accent-blue);
    background: rgba(51, 153, 255, 0.02);
  }

  .helper-text {
    font-size: 10px;
    color: var(--text-muted);
  }

  .checkbox-row {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    margin: 4px 0;
  }

  .checkbox-row input {
    cursor: pointer;
    width: 15px;
    height: 15px;
  }

  .checkbox-row label {
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .range-slider-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .range-slider-wrapper input[type="range"] {
    flex: 1;
    accent-color: var(--accent-blue);
  }

  .range-value {
    font-size: 13px;
    font-weight: 700;
    color: var(--accent-blue);
    background: rgba(51, 153, 255, 0.1);
    padding: 3px 8px;
    border-radius: 4px;
    min-width: 45px;
    text-align: center;
  }

  .color-picker-row {
    display: flex;
    gap: 10px;
  }

  .color-picker-row input[type="color"] {
    width: 40px;
    height: 38px;
    border-radius: 6px;
    border: 1px solid var(--border-color);
    background: transparent;
    cursor: pointer;
  }

  .color-text-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-primary);
    font-family: var(--font-code);
  }

  .fade-in {
    animation: fadeIn 0.3s ease-out;
  }
</style>
