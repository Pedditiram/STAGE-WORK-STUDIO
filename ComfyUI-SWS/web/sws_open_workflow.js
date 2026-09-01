import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const SWS_EVENT = "sws.load_workflow";
let lastLoadedKey = "";
let pendingPollTimer = null;

function nodeCount(workflow) {
  return Array.isArray(workflow?.nodes) ? workflow.nodes.length : 0;
}

function graphNodeCount() {
  try {
    const g = app.graph;
    if (!g) return 0;
    if (Array.isArray(g._nodes)) return g._nodes.length;
    if (typeof g.nodes === "function") return g.nodes().length;
  } catch (_err) {
    /* ignore */
  }
  return 0;
}

async function waitForGraphReady(maxMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (app.graph && app.canvas) return true;
    await new Promise((r) => setTimeout(r, 80));
  }
  return Boolean(app.graph);
}

function isFrontendWorkflow(workflow) {
  return (
    workflow &&
    typeof workflow === "object" &&
    Array.isArray(workflow.nodes) &&
    workflow.nodes.length > 0 &&
    Array.isArray(workflow.links) &&
    typeof workflow.version === "number" &&
    workflow.last_node_id != null &&
    workflow.last_link_id != null
  );
}

/** Prefer "MVK SC01_SH09" from payload / workflow.extra.sws */
function resolveDisplayName(workflow, explicitName) {
  const fromPayload = String(explicitName || "").trim();
  if (fromPayload) return fromPayload.replace(/\.json$/i, "");
  const sws = workflow?.extra?.sws || {};
  const fromExtra = String(sws.displayName || "").trim();
  if (fromExtra) return fromExtra.replace(/\.json$/i, "");
  const projectId = String(sws.projectId || "").trim();
  const shotId = String(sws.shotId || "").trim();
  if (projectId && shotId) return `${projectId} ${shotId}`;
  if (shotId) return shotId;
  if (projectId) return projectId;
  return "SWS Workflow";
}

function asWorkflowFilename(displayName) {
  const clean = String(displayName || "SWS Workflow")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/\.json$/i, "");
  return `${clean || "SWS Workflow"}.json`;
}

function stemName(displayName) {
  return asWorkflowFilename(displayName).replace(/\.json$/i, "");
}

function getWorkflowStore() {
  return app.extensionManager?.workflow || app.workflowManager || null;
}

function getActiveWorkflow() {
  const store = getWorkflowStore();
  return store?.activeWorkflow || app.workflowManager?.activeWorkflow || null;
}

function isUnsavedLabel(value) {
  return /unsaved\s*workflow/i.test(String(value || ""));
}

async function forceWorkflowTabName(tabName) {
  const filename = asWorkflowFilename(tabName);
  const store = getWorkflowStore();
  const wf = getActiveWorkflow();
  if (!wf) return false;

  const label = String(wf.filename || wf.fullFilename || wf.key || wf.path || "");
  if (label && !isUnsavedLabel(label)) {
    const stem = stemName(tabName).toLowerCase();
    if (label.toLowerCase().includes(stem)) return true;
  }

  try {
    if (typeof store?.renameWorkflow === "function") {
      await store.renameWorkflow(wf, filename);
      return true;
    }
  } catch (err) {
    console.warn("[ComfyUI-SWS] renameWorkflow failed:", err);
  }

  try {
    if (typeof wf.rename === "function") {
      await wf.rename(filename);
      return true;
    }
  } catch (err) {
    console.warn("[ComfyUI-SWS] workflow.rename failed:", err);
  }

  return false;
}

async function loadViaWorkflowStore(workflow, filename) {
  const store = getWorkflowStore();
  if (!store?.createNewTemporary || !store?.openWorkflow) return false;
  try {
    const temp = store.createNewTemporary(filename, workflow);
    if (!temp) return false;
    await store.openWorkflow(temp);
    return graphNodeCount() > 0;
  } catch (err) {
    console.warn("[ComfyUI-SWS] createNewTemporary/openWorkflow failed:", err);
    return false;
  }
}

async function loadViaGraphData(workflow, tabName) {
  const stem = stemName(tabName);
  const filename = asWorkflowFilename(tabName);
  const attempts = [
    () => app.loadGraphData(workflow, true, true, stem),
    () => app.loadGraphData(workflow, true, true, filename),
    () => app.loadGraphData(workflow, true, true)
  ];
  for (const run of attempts) {
    try {
      await run();
      if (graphNodeCount() > 0) return true;
    } catch (err) {
      console.warn("[ComfyUI-SWS] loadGraphData attempt failed:", err);
    }
  }
  return false;
}

function fitCanvas() {
  const canvas = app.canvas;
  if (!canvas) return;
  try {
    if (typeof canvas.fitToGraph === "function") {
      canvas.fitToGraph({ padding: 48 });
      canvas.setDirty?.(true, true);
      return;
    }
  } catch (_err) {
    /* fall through */
  }
  const nodes = app.graph?._nodes || [];
  if (!nodes.length || !canvas.ds) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const size = node.size || [240, 120];
    minX = Math.min(minX, node.pos[0]);
    minY = Math.min(minY, node.pos[1]);
    maxX = Math.max(maxX, node.pos[0] + size[0]);
    maxY = Math.max(maxY, node.pos[1] + size[1]);
  }
  const gw = Math.max(1, maxX - minX);
  const gh = Math.max(1, maxY - minY);
  const vw = canvas.canvas?.width || 1400;
  const vh = canvas.canvas?.height || 860;
  const scale = Math.max(0.2, Math.min(1, (vw - 96) / gw, (vh - 96) / gh));
  canvas.ds.scale = scale;
  canvas.ds.offset = [48 - minX * scale, 48 - minY * scale];
  canvas.setDirty?.(true, true);
}

async function ack(id) {
  try {
    await api.fetchApi("/sws/pending_workflow/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id || "" })
    });
  } catch (_err) {
    /* ignore */
  }
}

async function queueCurrentGraph() {
  if (graphNodeCount() === 0) {
    console.warn("[ComfyUI-SWS] Refusing to queue — canvas is empty.");
    return false;
  }
  try {
    if (typeof app.queuePrompt === "function") {
      await app.queuePrompt(0);
      return true;
    }
  } catch (err) {
    console.warn("[ComfyUI-SWS] app.queuePrompt failed:", err);
  }
  return false;
}

async function loadSwsWorkflow(workflow, id, fit, displayName, autoQueue) {
  if (!isFrontendWorkflow(workflow)) {
    console.warn("[ComfyUI-SWS] Refusing to load invalid or empty workflow onto the canvas.");
    return false;
  }

  await waitForGraphReady();

  const tabName = resolveDisplayName(workflow, displayName);
  const expected = nodeCount(workflow);
  const loadKey = `${id || ""}::${tabName}`;
  if (loadKey && loadKey === lastLoadedKey && graphNodeCount() >= expected) return true;

  let loaded = false;

  // 1) loadGraphData — most reliable across ComfyUI 0.3x / 0.34
  loaded = await loadViaGraphData(workflow, tabName);

  // 2) Named temporary via workflow store (new ComfyUI workflow tabs)
  if (!loaded) {
    loaded = await loadViaWorkflowStore(workflow, asWorkflowFilename(tabName));
  }

  // 3) One more graph load after store (store sometimes opens blank tab)
  if (!loaded || graphNodeCount() < expected) {
    loaded = await loadViaGraphData(workflow, tabName);
  }

  const onCanvas = graphNodeCount();
  if (onCanvas === 0) {
    console.warn(
      `[ComfyUI-SWS] Canvas still empty after load (expected ${expected} nodes). ` +
        "Install ComfyUI-SWS in custom_nodes and restart ComfyUI."
    );
    return false;
  }

  lastLoadedKey = loadKey || lastLoadedKey;
  await forceWorkflowTabName(tabName);

  try {
    document.title = `${tabName} — ComfyUI`;
  } catch (_err) {
    /* ignore */
  }

  if (fit !== false) {
    requestAnimationFrame(() => {
      fitCanvas();
      requestAnimationFrame(fitCanvas);
    });
  }
  await ack(id);

  if (autoQueue) {
    await new Promise((r) => setTimeout(r, 900));
    const queued = await queueCurrentGraph();
    if (!queued) {
      console.warn("[ComfyUI-SWS] autoQueue skipped — canvas empty or queuePrompt unavailable.");
    }
  }
  return true;
}

function subscribeSwsLoad(handler) {
  if (typeof api.addCustomEventListener === "function") {
    api.addCustomEventListener(SWS_EVENT, handler);
    return;
  }
  api.addEventListener(SWS_EVENT, handler);
}

async function pollPendingOnce() {
  try {
    const res = await api.fetchApi("/sws/pending_workflow");
    const data = await res.json();
    if (data?.ok && !data.loaded && nodeCount(data.workflow)) {
      await loadSwsWorkflow(
        data.workflow,
        data.id,
        data.fit !== false,
        data.name,
        Boolean(data.autoQueue)
      );
    }
  } catch (_err) {
    /* routes missing */
  }
}

function startPendingPoll() {
  if (pendingPollTimer) return;
  let ticks = 0;
  pendingPollTimer = setInterval(() => {
    ticks += 1;
    pollPendingOnce();
    if (ticks >= 60) {
      clearInterval(pendingPollTimer);
      pendingPollTimer = null;
    }
  }, 1000);
}

app.registerExtension({
  name: "ComfyUI-SWS.OpenWorkflow",
  async setup() {
    subscribeSwsLoad(async (event) => {
      const detail = event?.detail || {};
      await loadSwsWorkflow(
        detail.workflow,
        detail.id,
        detail.fit !== false,
        detail.name,
        Boolean(detail.autoQueue)
      );
    });
    await pollPendingOnce();
    startPendingPoll();
  }
});
