# Embedded HTML mock workflow inside Paseo

**Status:** Future idea / product direction, captured 2026-10-18. **Not implemented.** This is a separate production capability to investigate after the current standalone UI mock and native shell redesign. It does not expand [the existing mock-only Task 01](../tasks/paseo-native-html-prototype-01.md).

## Problem and intended experience

Today: prompt in a web chat -> receive/download HTML -> open a separate browser -> screenshot/comment in chat -> repeat. The file, feedback and active agent are disconnected.

**Target:** A live HTML/React prototype is a first-class **Preview pane in the existing Paseo workspace**. Keep the agent, preview, files/diff and review/annotation inspector alongside each other using Paseo's current tabs, splits, pinning and saved layouts. No separate browser or manual download/re-upload loop is required for normal iteration.

```text
Agent changes project prototype -> Paseo Preview refreshes live
          ^                                |
          |                                v
  Submit element feedback <- select / annotate in the preview
          |
   See agent status, changed files, checks and refreshed result
          |
   Explicitly accept a versioned design -> optional Shiori Task plan
```

## Proposed workflow

1. From a Project, agent session or produced HTML file, choose **Open in Preview**. Paseo uses the real project checkout/artifact and connected execution host, not a chat attachment copy. Start from static HTML, then support Vite/React dev servers where useful. The prototype remains versionable in Git.
2. The preview appears **inside the existing workspace pane tree** next to the working agent. Offer viewport/device presets and open-source/open-diff actions without building another tab manager. Preserve preview URL/path, scroll/selection where feasible, and pane layout across refreshes.
3. Select a rendered element, region or text and add **Ask / Comment / Change** using an Agentation-style overlay or other validated component. Store project, artifact, revision, stable target hint/selector, viewport and optional screenshot crop. Make stale/orphaned anchors explicit after edits.
4. **Submit feedback** routes a bounded bundle to the selected agent or an authorized follow-up task. After submission, permitted agents can edit the prototype automatically and Paseo shows working/queued/blocked/failed/done status and a delivery receipt. Distinguish a question from a request to modify files; avoid unintended interrupt or duplicate execution.
5. Local file watching/HMR updates the in-app preview as the agent writes files. Show build/runtime errors and source changes instead of claiming a successful visual update. Let the user continue annotating and comparing revisions without new downloads.
6. **Accept reference** explicitly pins a particular source revision, viewport screenshots, verified interactions and decisions. Only then hand approved scope to Shiori for planning/implementation if needed. A refreshed page, sent comment or completed agent turn is **not** design approval.

## Ownership and safety

- **Paseo** owns the preview panel, authenticated host routing, pane/session lifecycle, annotation UX, and agent feedback/delivery state. Reuse native Browser/Files/Diff/Agent panels and review controls where possible.
- **Project checkout/Git** owns prototype source and revisions. **Shiori** remains authoritative for its Tasks, queue and approvals if the work becomes an implementation task; do not create another task database or scheduler.
- Never expose an unauthenticated dev server publicly as the default. A remote daemon needs a trusted authenticated preview channel; sandbox or restrict untrusted HTML and external resources. Keep credentials, local paths, screenshots and comments private by default. Handle dirty Git state, conflicting writers, failed builds and disconnected hosts visibly.
- Make **Open externally** an escape hatch for sites/features an embedded preview cannot render; it is not the primary review loop.

## First research / proof slice (future, not authorized by this note)

Inspect the actual Paseo Browser panel, remote-host connectivity, app/WebView constraints, source-file observation and Agentation APIs. Prove one static HTML or Vite preview with live reload **inside a native split**, one element-anchored comment and one explicit agent edit/refresh cycle. Test refresh survival, stale anchors, host reconnects, keyboard access and rejected/malicious content. If successful, design narrowly scoped implementation tasks; do not replace the existing mock-only deliverable or add an independent browser/editor framework prematurely.

**Success test:** Open a project's mock in Paseo, click one element, write “move this action here,” submit, watch the agent edit the real prototype and see the new UI in the same pane—without saving, opening or re-uploading HTML manually.

Related: [Product direction](paseo-product-direction-2026-10.md) · [Prototype contract](../design/paseo-next-prototype-contract.md) · [Existing mock task](../tasks/paseo-native-html-prototype-01.md).
