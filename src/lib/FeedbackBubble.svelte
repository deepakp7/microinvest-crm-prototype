<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';

  let show = false;
  let showThanks = false;
  let generic = '';
  let pageSpecific = '';
  let submitting = false;

  const feedbackKey = 'prototype_feedback_entries_v1';
  const entries = writable([]);

  $: currentPath = $page.url.pathname;

  onMount(() => {
    const raw = localStorage.getItem(feedbackKey);
    if (raw) {
      try { entries.set(JSON.parse(raw)); } catch(e) { entries.set([]); }
    }
  });

  function saveLocal(entry) {
    entries.update(list => {
      const next = [...list, entry];
      try { localStorage.setItem(feedbackKey, JSON.stringify(next)); } catch(e) {}
      return next;
    });
  }

  async function submitFeedback() {
    if (!generic && !pageSpecific) return;
    submitting = true;
    const payload = {
      id: Date.now(),
      path: currentPath,
      generic: generic || null,
      pageSpecific: pageSpecific || null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      ts: new Date().toISOString()
    };

    // save locally first
    saveLocal(payload);

    // attempt to post to server; ignore failures (fallback to localStorage)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      // swallow - local copy exists
    }

    generic = '';
    pageSpecific = '';
    submitting = false;
    show = false;
    showThanks = true;
    setTimeout(() => showThanks = false, 2500);
  }

  function openBubble() { show = true; showThanks = false; }
  function closeBubble() { show = false; }
</script>

<style>
  .floating {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2000;
  }
  .btn {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg,#3366ff,#7b61ff);
    color: white;
    display:flex;
    align-items:center;
    justify-content:center;
    box-shadow: 0 8px 24px rgba(51,102,255,0.24);
    border: none;
  }
  .panel {
    width: 360px;
    max-width: calc(100vw - 40px);
    background: rgba(10,12,16,0.96);
    border: 1px solid rgba(255,255,255,0.06);
    color: var(--text-primary, #fff);
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 12px 40px rgba(2,6,23,0.6);
  }
  .header { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  textarea { width:100%; min-height:64px; resize:vertical; padding:8px; border-radius:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.04); color:inherit; }
  .row { display:flex; gap:8px; margin-top:8px; }
  .small { font-size:12px; color:rgba(255,255,255,0.6); }
</style>

<div class="floating">
  {#if show}
    <div class="panel">
      <div class="header">
        <div>
          <strong>Send feedback</strong>
          <div class="small">Page: {currentPath}</div>
        </div>
        <button class="btn" on:click={closeBubble} aria-label="Close">✕</button>
      </div>

      <div style="margin-top:8px">
        <div class="small">Generic feedback (visible across app)</div>
        <textarea placeholder="General comment or idea" bind:value={generic} />
      </div>

      <div style="margin-top:8px">
        <div class="small">Feedback specific to this page</div>
        <textarea placeholder="What would you change on this page?" bind:value={pageSpecific} />
      </div>

      <div class="row" style="justify-content:space-between; margin-top:12px">
        <div class="small">Your feedback is stored locally and sent to the server when possible.</div>
        <div style="display:flex; gap:8px">
          <button class="btn" on:click={submitFeedback} disabled={submitting} aria-label="Submit">{submitting? '…' : 'Send'}</button>
        </div>
      </div>
    </div>
  {:else}
    <div style="display:flex;align-items:center;gap:8px">
      <button class="btn" on:click={openBubble} aria-label="Open feedback">💬</button>
    </div>
  {/if}

  {#if showThanks}
    <div style="margin-top:8px; text-align:center; color:#b9f; font-weight:700">Thanks — feedback saved</div>
  {/if}
</div>
