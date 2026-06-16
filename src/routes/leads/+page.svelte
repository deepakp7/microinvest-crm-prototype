<script>
  import { customFields, leads, opportunities, addAuditLog, userRole } from '$lib/store.js';

  let formData = {};
  let duplicateWarning = null;
  let showModal = false;
  let successMessage = '';

  // Initialize form empty structure from fields
  $: {
    $customFields.forEach(f => {
      if (formData[f.id] === undefined) {
        if (f.type === 'select' || f.type === 'text' || f.type === 'email' || f.type === 'tel' || f.type === 'textarea') {
          formData[f.id] = '';
        } else if (f.type === 'number') {
          formData[f.id] = null;
        } else if (f.type === 'checkbox') {
          formData[f.id] = false;
        } else if (f.type === 'file') {
          formData[f.id] = f.multiple ? [] : null;
        } else {
          formData[f.id] = '';
        }
      }
    });
  }

  function checkDuplicates() {
    duplicateWarning = null;
    const emailToCheck = (formData.email || '').trim().toLowerCase();
    const phoneToCheck = (formData.phone || '').trim();

    if (!emailToCheck && !phoneToCheck) return;

    const match = $leads.find(l => {
      const matchEmail = emailToCheck && l.email && l.email.toLowerCase() === emailToCheck;
      const matchPhone = phoneToCheck && l.phone && l.phone === phoneToCheck;
      return matchEmail || matchPhone;
    });

    if (match) {
      duplicateWarning = {
        companyName: match.companyName,
        contactName: match.contactName,
        email: match.email,
        status: match.status
      };
    }
  }

  function handleInput(fieldId) {
    if (fieldId === 'email' || fieldId === 'phone') {
      checkDuplicates();
    }
  }

  function handleFileChange(e, fieldId) {
    const files = e.target.files || [];
    if (files.length === 0) {
      formData[fieldId] = null;
      return;
    }

    if (files.length === 1) {
      formData[fieldId] = files[0].name;
      return;
    }

    // multiple files
    formData[fieldId] = Array.from(files).map(f => f.name);
  }

  function handleSubmit() {
    // Basic validation check
    for (let field of $customFields) {
      if (field.required && !formData[field.id]) {
        alert(`Field "${field.label}" is required.`);
        return;
      }
    }
    // Ensure we have a contactName for display (use first + last if provided)
    if (!formData.contactName) {
      const fn = (formData.firstName || '').trim();
      const ln = (formData.lastName || '').trim();
      formData.contactName = (fn || ln) ? `${fn} ${ln}`.trim() : '';
    }
    const newLeadId = 'ld-' + Math.random().toString(36).substr(2, 9);
    const newLead = {
      id: newLeadId,
      createdAt: new Date().toISOString(),
      status: 'active',
      ...formData
    };

    leads.update(currentLeads => [newLead, ...currentLeads]);
    addAuditLog($userRole, `Captured new lead: "${formData.companyName || 'Unknown'}" (Contact: ${formData.contactName || 'None'}, Value: £${formData.dealSize || '0'})`);

    successMessage = `Lead for "${formData.companyName}" successfully saved!`;
    setTimeout(() => { successMessage = ''; }, 4000);

    // Reset Form
    formData = {};
    duplicateWarning = null;
    showModal = false;
  }

  function simulateZohoWebhook() {
    const dummyNames = ['NeoGrid Utilities', 'Horizon BioPharma', 'Cascade Hydro', 'Civic Housing Co'];
    const contacts = ['Julian Vance', 'Sarah Jenkins', 'Marcus Thorne', 'Amina Patel'];
    const emails = ['julian@neogrid.com', 's.jenkins@horizon.com', 'mthorne@cascade.org', 'apatel@civichousing.org'];
    const facilities = ['Renewable Energy Dev Loan', 'Tech Innovation Venture', 'Renewable Energy Dev Loan', 'Urban Housing Fund'];
    const sizes = [1500000, 950000, 2400000, 3100000];
    const ratings = ['AAA (Exceptional)', 'A (Moderate)', 'AA (High Impact)', 'AA (High Impact)'];

    const idx = Math.floor(Math.random() * dummyNames.length);

    const zohoLeadId = 'ld-zoho-' + Math.random().toString(36).substr(2, 5);
    const dynamicLead = {
      id: zohoLeadId,
      companyName: dummyNames[idx],
      contactName: contacts[idx],
      email: emails[idx],
      phone: '+1 800-555-' + Math.floor(1000 + Math.random() * 9000),
      investmentFacility: facilities[idx],
      dealSize: sizes[idx],
      esgRating: ratings[idx],
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    leads.update(currentLeads => [dynamicLead, ...currentLeads]);
    addAuditLog('System Webhook (Zoho)', `Zoho Form submission Webhook triggered. Captured lead "${dynamicLead.companyName}"`);
    
    successMessage = `⚡ Zoho Webhook simulation triggered. Captured "${dynamicLead.companyName}"`;
    setTimeout(() => { successMessage = ''; }, 4000);
  }

  function convertToOpportunity(lead) {
    // Check if opportunity already exists
    if ($opportunities.some(o => o.email === lead.email)) {
      alert('An opportunity with this contact email already exists in the pipeline.');
      return;
    }

    const newOpp = {
      id: 'opp-' + Math.random().toString(36).substr(2, 9),
      companyName: lead.companyName,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      investmentFacility: lead.investmentFacility,
      dealSize: lead.dealSize,
      esgRating: lead.esgRating,
      stage: 'prospect',
      probability: 10,
      emailsTriggered: [
        { date: new Date().toISOString(), subject: 'Welcome to MicroInvest Lead Portal', recipient: lead.email }
      ],
      notes: `Promoted from lead capture database. Initial deal size set to £${lead.dealSize}.`
    };

    // Update lead status to converted
    leads.update(currentLeads => 
      currentLeads.map(l => l.id === lead.id ? { ...l, status: 'converted' } : l)
    );

    opportunities.update(opps => [newOpp, ...opps]);
    addAuditLog($userRole, `Promoted Lead "${lead.companyName}" to Opportunity pipeline (Stage: Prospect)`);
    successMessage = `📈 Promoted "${lead.companyName}" to Sales Pipeline!`;
    setTimeout(() => { successMessage = ''; }, 4000);
  }
</script>

<div class="leads-page">
  <div class="header-container">
    <div class="title-section">
      <span class="badge-tag">CRM INTAKE</span>
      <h1>Leads Intake Database</h1>
      <p class="description">Capture and inspect incoming leads. Forms automatically adjust to the schema configured in the Admin Configuration studio.</p>
    </div>

    <div class="header-buttons">
      <button class="btn-secondary" on:click={simulateZohoWebhook}>
        ⚡ Simulate Zoho Form Webhook
      </button>
      <button class="btn-primary" on:click={() => showModal = true}>
        ➕ Create Manual Lead
      </button>
    </div>
  </div>

  {#if successMessage}
    <div class="success-banner">{successMessage}</div>
  {/if}

  <!-- Modal Form -->
  {#if showModal}
    <div class="modal-overlay">
      <div class="modal-content glass-card">
        <div class="modal-header">
          <h2>Create New Lead Record</h2>
          <button class="close-btn" on:click={() => showModal = false}>✕</button>
        </div>

        <form on:submit|preventDefault={handleSubmit} class="capture-form">
          <div class="dynamic-inputs-grid">
            {#each $customFields as field}
              <div class="form-group">
                <label for={field.id}>
                  {field.label}
                  {#if field.required}<span class="req">*</span>{/if}
                </label>

                {#if field.type === 'textarea'}
                  <textarea id={field.id} bind:value={formData[field.id]} placeholder={field.placeholder} required={field.required} on:input={() => handleInput(field.id)} rows="4"></textarea>
                {:else if field.type === 'file'}
                  <input type="file" id={field.id} on:change={(e) => handleFileChange(e, field.id)} required={field.required} multiple={field.multiple} />
                  {#if formData[field.id]}
                    <div class="file-list">
                      {#if Array.isArray(formData[field.id])}
                        <ul>
                          {#each formData[field.id] as fname}
                            <li>{fname}</li>
                          {/each}
                        </ul>
                      {:else}
                        <div class="file-single">{formData[field.id]}</div>
                      {/if}
                    </div>
                  {/if}
                {:else if field.type === 'checkbox'}
                  <div class="checkbox-row">
                    <input type="checkbox" id={field.id} bind:checked={formData[field.id]} on:change={() => handleInput(field.id)} />
                  </div>
                {:else if field.type === 'select'}
                  <select id={field.id} bind:value={formData[field.id]} required={field.required} on:change={() => handleInput(field.id)}>
                    <option value="">{field.placeholder}</option>
                    {#each field.options || [] as opt}
                      <option value={opt}>{opt}</option>
                    {/each}
                  </select>
                {:else if field.type === 'number'}
                  <input 
                    type="number" 
                    id={field.id} 
                    bind:value={formData[field.id]} 
                    placeholder={field.placeholder} 
                    required={field.required}
                    on:input={() => handleInput(field.id)}
                  />
                {:else if field.type === 'email'}
                  <input 
                    type="email" 
                    id={field.id} 
                    bind:value={formData[field.id]} 
                    placeholder={field.placeholder} 
                    required={field.required}
                    on:input={() => handleInput(field.id)}
                  />
                {:else if field.type === 'tel'}
                  <input 
                    type="tel" 
                    id={field.id} 
                    bind:value={formData[field.id]} 
                    placeholder={field.placeholder} 
                    required={field.required}
                    on:input={() => handleInput(field.id)}
                  />
                {:else}
                  <input 
                    type="text" 
                    id={field.id} 
                    bind:value={formData[field.id]} 
                    placeholder={field.placeholder} 
                    required={field.required}
                    on:input={() => handleInput(field.id)}
                  />
                {/if}
              </div>
            {/each}
          </div>

          <!-- Live Duplicate Checker Alert -->
          {#if duplicateWarning}
            <div class="duplicate-alert fade-in">
              <span class="alert-icon">⚠️</span>
              <div class="alert-info">
                <strong>Potential Duplicate Detected:</strong>
                <p>An active record for <strong>{duplicateWarning.companyName}</strong> ({duplicateWarning.contactName}) already exists with status: <span class="status-tag {duplicateWarning.status}">{duplicateWarning.status}</span>.</p>
              </div>
            </div>
          {/if}

          <div class="modal-actions">
            <button type="button" class="btn-secondary" on:click={() => showModal = false}>Cancel</button>
            <button type="submit" class="btn-primary">Save Lead Record</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Leads List -->
  <div class="glass-card table-card">
    <div class="table-header">
      <h2>Intake Records ({$leads.length})</h2>
      <p>Audit trail captures all lead insertions. Convert active leads to initiate the underwriting pipeline.</p>
    </div>

    <div class="table-wrapper">
      <table class="leads-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Primary Contact</th>
            <th>Email</th>
            <th>Facility</th>
            <th>Proposed Deal Size</th>
            <th>ESG Rating</th>
            <th>Intake Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {#each $leads as lead}
            <tr class:converted-row={lead.status === 'converted'}>
              <td class="company-name-cell">
                <span class="co-icon">🏢</span>
                <span class="co-name">{lead.companyName || 'N/A'}</span>
              </td>
              <td>{lead.contactName || 'N/A'}</td>
              <td class="mono-txt">{lead.email || 'N/A'}</td>
              <td>
                <span class="facility-badge">{lead.investmentFacility || 'N/A'}</span>
              </td>
              <td class="numeric-txt">
                {#if lead.dealSize}
                  £{Number(lead.dealSize).toLocaleString()}
                {:else}
                  -
                {/if}
              </td>
              <td>
                {#if lead.esgRating}
                  <span class="esg-badge" class:aaa={lead.esgRating.includes('AAA')} class:aa={lead.esgRating.includes('AA')}>
                    {lead.esgRating.split(' ')[0]}
                  </span>
                {:else}
                  -
                {/if}
              </td>
              <td class="date-txt">
                {new Date(lead.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}
              </td>
              <td>
                <span class="status-tag {lead.status}">
                  {lead.status}
                </span>
              </td>
              <td>
                {#if lead.status === 'active'}
                  <button class="btn-action-promote" on:click={() => convertToOpportunity(lead)}>
                    Promote 📈
                  </button>
                {:else}
                  <span class="converted-txt">In Pipeline ✓</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>

<style>
  .leads-page {
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

  .header-buttons {
    display: flex;
    gap: 12px;
  }

  .success-banner {
    background: rgba(46, 204, 113, 0.15);
    border: 1px solid rgba(46, 204, 113, 0.3);
    color: var(--accent-green);
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 24px;
    animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /* Modal Form styling */
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
    width: 680px;
    max-width: 90vw;
    background: rgba(13, 17, 23, 0.9);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /* Make modal content scrollable when the form is tall */
  .modal-content {
    box-sizing: border-box;
    padding: 20px 24px;
    max-height: 90vh;
    overflow-y: auto;
  }

  @keyframes scaleUp {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 12px;
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

  .capture-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .dynamic-inputs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  /* Stack fields in a single column on narrow viewports */
  @media (max-width: 800px) {
    .dynamic-inputs-grid {
      grid-template-columns: 1fr;
    }
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

  .form-group .req {
    color: var(--accent-red);
    margin-left: 2px;
  }

  .form-group input,
  .form-group select {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-primary);
    transition: var(--transition-smooth);
    width: 100%;
  }

  .form-group input:focus,
  .form-group select:focus {
    border-color: var(--accent-blue);
    background: rgba(51, 153, 255, 0.02);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    border-top: 1px solid var(--border-color);
    padding-top: 16px;
  }

  /* Duplicate warning */
  .duplicate-alert {
    display: flex;
    gap: 12px;
    background: rgba(243, 156, 18, 0.08);
    border: 1px solid rgba(243, 156, 18, 0.25);
    padding: 12px;
    border-radius: 8px;
    margin-top: 8px;
  }

  .alert-icon {
    font-size: 20px;
  }

  .alert-info strong {
    font-size: 12px;
    color: var(--accent-orange);
    display: block;
    margin-bottom: 2px;
  }

  .alert-info p {
    font-size: 11px;
    color: var(--text-secondary);
  }

  /* Tables */
  .table-card {
    padding: 0;
    overflow: hidden;
  }

  .table-header {
    padding: 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .table-header h2 {
    font-size: 18px;
    margin-bottom: 4px;
  }

  .table-header p {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .table-wrapper {
    overflow-x: auto;
    width: 100%;
  }

  .leads-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
  }

  .leads-table th,
  .leads-table td {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);
  }

  .leads-table th {
    font-family: var(--font-heading);
    font-weight: 600;
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.01);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .leads-table tbody tr {
    transition: var(--transition-smooth);
  }

  .leads-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.015);
  }

  .converted-row {
    opacity: 0.6;
  }

  .company-name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .co-icon {
    font-size: 16px;
  }

  .co-name {
    color: var(--text-primary);
  }

  .mono-txt {
    font-family: var(--font-code);
    color: var(--text-secondary);
  }

  .facility-badge {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border-color);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
  }

  .numeric-txt {
    font-family: var(--font-code);
    text-align: right;
  }

  .date-txt {
    color: var(--text-muted);
  }

  /* ESG Badges */
  .esg-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    color: #fff;
    background: var(--text-muted);
  }

  .esg-badge.aaa {
    background-color: var(--accent-green);
    box-shadow: 0 0 6px rgba(46, 204, 113, 0.3);
  }

  .esg-badge.aa {
    background-color: var(--accent-blue);
    box-shadow: 0 0 6px rgba(51, 153, 255, 0.3);
  }

  /* Status Tags */
  .status-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: inline-block;
  }

  .status-tag.active {
    background: rgba(51, 153, 255, 0.1);
    color: var(--accent-blue);
    border: 1px solid rgba(51, 153, 255, 0.2);
  }

  .status-tag.converted {
    background: rgba(46, 204, 113, 0.1);
    color: var(--accent-green);
    border: 1px solid rgba(46, 204, 113, 0.2);
  }

  .btn-action-promote {
    background: rgba(51, 153, 255, 0.1);
    border: 1px solid rgba(51, 153, 255, 0.25);
    color: var(--accent-blue);
    padding: 4px 10px;
    border-radius: 6px;
    font-weight: 600;
    font-size: 11px;
    transition: var(--transition-smooth);
    cursor: pointer;
  }

  .btn-action-promote:hover {
    background: var(--accent-blue);
    color: #fff;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(51, 153, 255, 0.3);
  }

  .converted-txt {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .fade-in {
    animation: fadeIn 0.3s ease-out;
  }
</style>
