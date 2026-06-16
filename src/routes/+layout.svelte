<script>
  import { userRole, notifications } from '$lib/store.js';
  import { page } from '$app/stores';

  let roles = ['Sales Rep', 'Relationship Manager', 'Compliance Officer', 'Operations', 'Management Team', 'Admin'];

  function handleRoleChange(event) {
    userRole.set(event.target.value);
  }

  $: activePath = $page.url.pathname;
  $: activeNotifsCount = $notifications.length;
  $: urgentNotifsCount = $notifications.filter(n => n.urgent).length;
</script>

<div class="app-container">
  <!-- Sidebar Navigation -->
  <aside class="sidebar">
    <div class="logo-area">
      <div class="logo-icon">💼</div>
      <div class="logo-text">
        <span class="logo-title">MICROINVEST</span>
        <span class="logo-subtitle">CRM Platform</span>
      </div>
    </div>

    <nav class="nav-links">
      <a href="/" class="nav-item" class:active={activePath === '/'}>
        <span class="icon">📊</span> Dashboard
      </a>
      <a href="/config" class="nav-item" class:active={activePath.startsWith('/config')}>
        <span class="icon">⚙️</span> Low-Code Builder
      </a>
      <a href="/leads" class="nav-item" class:active={activePath.startsWith('/leads')}>
        <span class="icon">🎯</span> Leads
      </a>
      <a href="/opportunities" class="nav-item" class:active={activePath.startsWith('/opportunities')}>
        <span class="icon">📈</span> Opportunities
      </a>
      <a href="/loans" class="nav-item" class:active={activePath.startsWith('/loans')}>
        <span class="icon">💸</span> Loan Booking
      </a>
    </nav>

    <div class="footer-status">
      <div class="status-indicator"></div>
      <div class="status-txt">
        <span class="status-title">System Active</span>
        <span class="status-env">Prototype v1.0.0</span>
      </div>
    </div>
  </aside>

  <!-- Main Work Area -->
  <main class="main-content">
    <header class="top-header">
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Fuzzy search leads, accounts, contracts..." disabled />
        <span class="search-kbd">⌘K</span>
      </div>

      <div class="header-actions">
        <!-- Live Persona Selector -->
        <div class="role-selector-wrapper">
          <span class="role-label">Current Role:</span>
          <select class="role-select" value={$userRole} on:change={handleRoleChange}>
            {#each roles as r}
              <option value={r}>{r}</option>
            {/each}
          </select>
        </div>

        <!-- Notification Bell -->
        <div class="notification-bell">
          <span class="bell-icon">🔔</span>
          {#if activeNotifsCount > 0}
            <span class="badge" class:urgent={urgentNotifsCount > 0}>
              {activeNotifsCount}
            </span>
          {/if}
        </div>

        <div class="user-avatar">
          <div class="avatar-img">👤</div>
          <div class="avatar-info">
            <span class="user-name">Office 365 User</span>
            <span class="user-role-label">{$userRole}</span>
          </div>
        </div>
      </div>
    </header>

    <div class="page-body">
      <slot />
    </div>
  </main>
</div>

<style>
  :global(:root) {
    --bg-primary: #07090e;
    --bg-secondary: #0d1117;
    --bg-glass: rgba(255, 255, 255, 0.03);
    --bg-glass-hover: rgba(255, 255, 255, 0.07);
    --bg-glass-active: rgba(255, 255, 255, 0.12);
    
    --border-color: rgba(255, 255, 255, 0.08);
    --border-color-hover: rgba(255, 255, 255, 0.16);

    --text-primary: #f0f3f6;
    --text-secondary: #8b949e;
    --text-muted: #5f6672;

    --accent-blue: hsl(210, 100%, 60%);
    --accent-blue-rgb: 51, 153, 255;
    --accent-green: hsl(155, 80%, 50%);
    --accent-purple: hsl(270, 80%, 65%);
    --accent-orange: hsl(35, 100%, 60%);
    --accent-red: hsl(355, 85%, 60%);

    --font-heading: 'Outfit', sans-serif;
    --font-body: 'Plus Jakarta Sans', sans-serif;
    --font-code: 'JetBrains Mono', monospace;

    --sidebar-width: 260px;
    --header-height: 70px;
    --border-radius: 12px;
    --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: var(--font-body);
    background-color: var(--bg-primary);
    color: var(--text-primary);
    overflow: hidden;
    height: 100vh;
    width: 100vw;
    background-image: 
      radial-gradient(circle at 10% 20%, rgba(51, 153, 255, 0.04) 0%, transparent 40%),
      radial-gradient(circle at 90% 80%, rgba(155, 89, 182, 0.04) 0%, transparent 40%);
  }

  :global(h1, h2, h3, h4, h5, h6) {
    font-family: var(--font-heading);
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  :global(a) {
    color: inherit;
    text-decoration: none;
  }

  :global(input, select, textarea, button) {
    font-family: inherit;
    color: inherit;
    background: transparent;
    border: none;
    outline: none;
  }

  :global(button) {
    cursor: pointer;
  }

  /* Main Container Layout */
  .app-container {
    display: flex;
    height: 100vh;
    width: 100vw;
  }

  /* Sidebar styling */
  .sidebar {
    width: var(--sidebar-width);
    background-color: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    padding: 24px 16px;
    z-index: 10;
  }

  .logo-area {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 36px;
    padding-left: 8px;
  }

  .logo-icon {
    font-size: 28px;
    filter: drop-shadow(0 0 8px rgba(51, 153, 255, 0.3));
  }

  .logo-text {
    display: flex;
    flex-direction: column;
  }

  .logo-title {
    font-family: var(--font-heading);
    font-size: 18px;
    font-weight: 800;
    letter-spacing: 2px;
    background: linear-gradient(120deg, var(--text-primary), var(--accent-blue));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .logo-subtitle {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--text-secondary);
    letter-spacing: 1px;
    font-weight: 500;
  }

  .nav-links {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--border-radius);
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 14px;
    transition: var(--transition-smooth);
    border: 1px solid transparent;
  }

  .nav-item .icon {
    font-size: 18px;
    transition: var(--transition-smooth);
  }

  .nav-item:hover {
    color: var(--text-primary);
    background-color: var(--bg-glass-hover);
    padding-left: 20px;
  }

  .nav-item.active {
    color: var(--text-primary);
    background-color: rgba(51, 153, 255, 0.08);
    border-color: rgba(51, 153, 255, 0.2);
    font-weight: 600;
  }

  .nav-item.active .icon {
    filter: drop-shadow(0 0 6px var(--accent-blue));
  }

  .footer-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: var(--bg-glass);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--accent-green);
    box-shadow: 0 0 10px var(--accent-green);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.5; }
    100% { transform: scale(1); opacity: 1; }
  }

  .status-txt {
    display: flex;
    flex-direction: column;
  }

  .status-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .status-env {
    font-size: 9px;
    color: var(--text-secondary);
  }

  /* Main Workspace */
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  /* Header */
  .top-header {
    height: var(--header-height);
    border-bottom: 1px solid var(--border-color);
    background-color: rgba(13, 17, 23, 0.6);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 28px;
    z-index: 9;
  }

  .search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-glass);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    padding: 6px 16px;
    width: 320px;
    opacity: 0.6; /* Simulated */
  }

  .search-bar input {
    font-size: 13px;
    color: var(--text-primary);
    width: 100%;
  }

  .search-bar input::placeholder {
    color: var(--text-muted);
  }

  .search-kbd {
    font-size: 10px;
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--text-secondary);
    font-family: var(--font-code);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .role-selector-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(51, 153, 255, 0.05);
    border: 1px solid rgba(51, 153, 255, 0.15);
    border-radius: 8px;
    padding: 6px 12px;
  }

  .role-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--accent-blue);
    letter-spacing: 0.5px;
  }

  .role-select {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
    background: transparent;
    border: none;
    outline: none;
    padding-right: 4px;
  }

  .role-select option {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
  }

  .notification-bell {
    position: relative;
    cursor: pointer;
    font-size: 18px;
    color: var(--text-secondary);
    transition: var(--transition-smooth);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--bg-glass);
    border: 1px solid var(--border-color);
  }

  .notification-bell:hover {
    color: var(--text-primary);
    background: var(--bg-glass-hover);
  }

  .badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background-color: var(--accent-blue);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 6px var(--accent-blue);
  }

  .badge.urgent {
    background-color: var(--accent-red);
    box-shadow: 0 0 6px var(--accent-red);
  }

  .user-avatar {
    display: flex;
    align-items: center;
    gap: 10px;
    border-left: 1px solid var(--border-color);
    padding-left: 20px;
  }

  .avatar-img {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }

  .avatar-info {
    display: flex;
    flex-direction: column;
  }

  .user-name {
    font-size: 12px;
    font-weight: 600;
  }

  .user-role-label {
    font-size: 10px;
    color: var(--text-secondary);
  }

  /* Page Body Wrapper */
  .page-body {
    flex: 1;
    overflow-y: auto;
    padding: 28px;
    background: transparent;
  }

  /* Global Premium UI Helper Classes */
  :global(.glass-card) {
    background: var(--bg-glass);
    backdrop-filter: blur(16px);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: 24px;
    transition: var(--transition-smooth);
  }

  :global(.glass-card:hover) {
    border-color: var(--border-color-hover);
    background: var(--bg-glass-hover);
  }

  :global(.btn-primary) {
    background: linear-gradient(135deg, var(--accent-blue), #1a73e8);
    color: #fff;
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
    transition: var(--transition-smooth);
    border: none;
    box-shadow: 0 4px 12px rgba(51, 153, 255, 0.2);
  }

  :global(.btn-primary:hover) {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(51, 153, 255, 0.35);
  }

  :global(.btn-secondary) {
    background: var(--bg-glass);
    color: var(--text-primary);
    padding: 10px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 13px;
    border: 1px solid var(--border-color);
    transition: var(--transition-smooth);
  }

  :global(.btn-secondary:hover) {
    background: var(--bg-glass-hover);
    border-color: var(--border-color-hover);
  }
</style>
