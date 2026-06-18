<script>
  import { onMount } from 'svelte';
  let feedback = [];
  let loading = true;

  async function load() {
    loading = true;
    try {
      const res = await fetch('/api/feedback');
      feedback = await res.json();
    } catch (e) {
      feedback = [];
    } finally {
      loading = false;
    }
  }

  onMount(load);

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
    // lazy-import jsPDF (optional dependency)
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
    doc.text('Consolidated Feedback', margin, y);
    y += 24;

    doc.setFontSize(10);

    feedback.forEach((fb, idx) => {
      const header = `${idx + 1}. ${fb.path || 'unknown'} — ${fb.ts || ''}`;
      doc.text(header, margin, y);
      y += lineHeight;
      if (fb.generic) {
        const lines = doc.splitTextToSize('Generic: ' + fb.generic, 520);
        doc.text(lines, margin, y);
        y += lines.length * lineHeight;
      }
      if (fb.pageSpecific) {
        const lines = doc.splitTextToSize('Page: ' + (fb.pageSpecific || ''), 520);
        doc.text(lines, margin, y);
        y += lines.length * lineHeight;
      }
      y += 8;
      if (y > 750) { doc.addPage(); y = margin; }
    });

    doc.save('feedback_consolidated.pdf');
  }
</script>

<style>
  .wrap { padding: 24px; }
  .card { background: rgba(255,255,255,0.03); padding:12px; border-radius:8px; margin-bottom:12px; }
  .meta { font-size:12px; color:rgba(255,255,255,0.6); }
</style>

<div class="wrap">
  <h1>Admin — Feedback</h1>
  <div style="margin-bottom:12px">
    <button on:click={load} class="btn">Refresh</button>
    <button on:click={downloadJSON} class="btn" style="margin-left:8px">Download JSON</button>
    <button on:click={downloadPDF} class="btn" style="margin-left:8px">Download PDF</button>
  </div>

  {#if loading}
    <div>Loading…</div>
  {:else}
    {#if feedback.length === 0}
      <div>No feedback yet.</div>
    {:else}
      <div>
        {#each feedback as fb, i}
          <div class="card">
            <div class="meta">{i+1}. {fb.path} — {fb.ts}</div>
            {#if fb.generic}
              <div><strong>Generic:</strong> {fb.generic}</div>
            {/if}
            {#if fb.pageSpecific}
              <div><strong>Page:</strong> {fb.pageSpecific}</div>
            {/if}
            <div class="meta">Agent: {fb.userAgent}</div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>
