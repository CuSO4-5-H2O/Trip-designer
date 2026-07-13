(() => {
  "use strict";

  const editorSelector = ".inline-activity-input,.inline-budget-editor,.inline-transport-editor,.inline-day-input";

  function install() {
    if (document.querySelector("#inlinePolishStyles")) return;
    const style = document.createElement("style");
    style.id = "inlinePolishStyles";
    style.textContent = `
      .day-card .day-meta{display:none!important}.activity-row{display:grid!important;grid-template-columns:76px minmax(0,1fr) 112px!important;gap:12px!important;align-items:start!important;min-height:66px!important;padding:14px 16px!important;border-color:rgba(18,38,34,.12)!important;background:#fff!important;transition:border-color 140ms var(--ease),box-shadow 140ms var(--ease),background 140ms var(--ease)!important}.activity-row.selected-context,.activity-row.inline-editing-row{outline:1px solid rgba(15,143,131,.35)!important;outline-offset:1px!important;box-shadow:0 8px 20px rgba(15,143,131,.06)!important;background:#fbfffd!important}.activity-time{font-size:16px!important;font-weight:850!important;color:var(--teal-dark)!important;line-height:1.35!important;min-width:62px!important}.activity-body{display:flex!important;align-items:center!important;align-content:flex-start!important;gap:6px 8px!important;flex-wrap:wrap!important;min-width:0!important}.activity-body strong{flex:1 1 100%!important;min-width:160px!important;font-size:17px!important;line-height:1.3!important;color:var(--ink)!important;margin:0 0 1px!important}.activity-body>span:not(.inline-transport-editor):not(.inline-budget-editor),.activity-body>p{flex:1 1 100%!important;margin:0!important;color:var(--muted)!important;line-height:1.35!important}.activity-row .inline-field-chip,.activity-transport-add,.activity-transport-chip{min-height:26px!important;border:0!important;border-radius:999px!important;background:#f4f8f6!important;color:#60716d!important;padding:3px 9px!important;font-size:13px!important;font-weight:780!important;box-shadow:none!important;line-height:1.2!important}.activity-row .inline-field-chip:hover,.activity-transport-add:hover,.activity-transport-chip:hover{background:#e8f6f2!important;color:var(--teal-dark)!important}.activity-row .inline-budget-chip{background:#fff2ee!important;color:#a73d2e!important}.activity-actions{justify-content:flex-end!important;gap:8px!important}.activity-actions button{opacity:.82!important}.inline-activity-input{height:30px!important;min-height:30px!important;border-radius:999px!important;border-color:rgba(15,143,131,.28)!important;box-shadow:0 0 0 2px rgba(15,143,131,.06)!important;padding:3px 10px!important;font-size:14px!important;line-height:1.2!important}.activity-time+.inline-activity-input{width:92px!important}.activity-body textarea.inline-activity-input{width:min(360px,100%)!important;height:56px!important;border-radius:10px!important;resize:vertical!important}.inline-budget-editor,.inline-transport-editor{width:auto!important;display:inline-flex!important;grid-template-columns:none!important;align-items:center!important;gap:6px!important;flex-wrap:wrap!important;vertical-align:middle!important}.inline-budget-editor .budget-amount{width:88px!important}.inline-budget-editor .budget-currency{width:76px!important}.inline-transport-editor .transport-type{width:92px!important;grid-column:auto!important}.inline-transport-editor .transport-from,.inline-transport-editor .transport-to{width:116px!important}.inline-empty-add{border-style:dashed!important;background:#fbfffd!important;color:#7a8985!important;min-height:54px!important}.inline-empty-add::after{content:'点击添加事项';font-weight:850;color:var(--teal-dark)}.inline-empty-add{font-size:0!important}@media(max-width:780px){.activity-row{grid-template-columns:56px minmax(0,1fr) 78px!important;gap:8px!important;padding:12px!important;min-height:62px!important}.activity-body strong{font-size:16px!important}.inline-budget-editor,.inline-transport-editor{display:flex!important;width:100%!important}.inline-budget-editor .inline-activity-input,.inline-transport-editor .inline-activity-input{flex:1 1 92px!important;width:auto!important}.activity-actions{gap:5px!important}.activity-row .inline-field-chip,.activity-transport-add,.activity-transport-chip{min-height:28px!important}}
    `;
    document.head.append(style);
    installRestoreGuard();
  }

  function installRestoreGuard() {
    if (window.__TripInlineRestoreGuard) return;
    window.__TripInlineRestoreGuard = true;
    const restoreSoon = () => window.setTimeout(restoreClosedAnchors, 50);
    document.addEventListener("focusout", restoreSoon, true);
    document.addEventListener("keyup", restoreSoon, true);
    document.addEventListener("pointerup", restoreSoon, true);
    if (window.MutationObserver) {
      const observer = new MutationObserver(restoreClosedAnchors);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function restoreClosedAnchors() {
    document.querySelectorAll("[data-inline-original-display]").forEach((node) => {
      if (!node.isConnected) return;
      if (hasAdjacentEditor(node)) return;
      node.style.display = node.dataset.inlineOriginalDisplay || "";
      delete node.dataset.inlineOriginalDisplay;
    });
  }

  function hasAdjacentEditor(node) {
    const next = node.nextElementSibling;
    if (!next) return false;
    return Boolean(next.matches?.(editorSelector) || next.querySelector?.(editorSelector));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
