"""HTTP + websocket bridge so SWS can load a frontend workflow onto the ComfyUI canvas."""
from __future__ import annotations

import time

_pending = {"id": None, "workflow": None, "fit": True, "loaded": False, "updated_at": 0, "name": None, "autoQueue": False}


def _is_frontend(workflow):
    if not isinstance(workflow, dict):
        return False
    nodes = workflow.get("nodes")
    links = workflow.get("links")
    if not isinstance(nodes, list) or not isinstance(links, list):
        return False
    if not nodes:
        return False
    if workflow.get("version") is None:
        return False
    if workflow.get("last_node_id") is None or workflow.get("last_link_id") is None:
        return False
    return True


def _cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


def setup_routes():
    try:
        from aiohttp import web
        from server import PromptServer
    except Exception:
        return

    routes = PromptServer.instance.routes

    @routes.options("/sws/load_workflow")
    @routes.options("/sws/pending_workflow")
    async def sws_options(_request):
        return _cors(web.Response(status=204))

    @routes.post("/sws/load_workflow")
    async def sws_load_workflow(request):
        try:
            data = await request.json()
        except Exception:
            return _cors(web.json_response({"ok": False, "error": "Body must be JSON."}, status=400))
        workflow = data.get("workflow")
        if _is_frontend(workflow) is False:
            return _cors(
                web.json_response(
                    {
                        "ok": False,
                        "error": "Not a ComfyUI frontend workflow JSON (need nodes, links, version, last_node_id, last_link_id). API /prompt JSON cannot be loaded onto the canvas.",
                    },
                    status=400,
                )
            )
        if any(not isinstance(n, dict) or n.get("type") is None or n.get("pos") is None for n in workflow.get("nodes") or []):
            return _cors(
                web.json_response(
                    {"ok": False, "error": "Every node needs type and pos so the editor can draw the graph."},
                    status=400,
                )
            )
        load_id = str(data.get("id") or f"sws_{int(time.time() * 1000)}")
        display_name = str(data.get("name") or "").strip()
        if not display_name:
            sws = (workflow.get("extra") or {}).get("sws") or {}
            project_id = str(sws.get("projectId") or "").strip()
            shot_id = str(sws.get("shotId") or "").strip()
            if project_id and shot_id:
                display_name = f"{project_id} {shot_id}"
            elif shot_id:
                display_name = shot_id
            elif project_id:
                display_name = project_id
            else:
                display_name = "SWS Workflow"
        _pending["id"] = load_id
        _pending["workflow"] = workflow
        _pending["fit"] = data.get("fit", True)
        _pending["loaded"] = False
        _pending["updated_at"] = time.time()
        _pending["name"] = display_name
        _pending["autoQueue"] = bool(data.get("autoQueue") or data.get("auto_queue"))
        try:
            PromptServer.instance.send_sync(
                "sws.load_workflow",
                {
                    "id": load_id,
                    "fit": _pending["fit"],
                    "workflow": workflow,
                    "name": display_name,
                    "autoQueue": _pending["autoQueue"],
                },
            )
        except Exception:
            pass
        return _cors(
            web.json_response(
                {
                    "ok": True,
                    "id": load_id,
                    "nodes": len(workflow.get("nodes") or []),
                    "name": display_name,
                }
            )
        )

    @routes.get("/sws/pending_workflow")
    async def sws_pending_workflow(_request):
        return _cors(
            web.json_response(
                {
                    "ok": True,
                    "id": _pending["id"],
                    "fit": _pending["fit"],
                    "loaded": _pending["loaded"],
                    "name": _pending.get("name"),
                    "autoQueue": bool(_pending.get("autoQueue")),
                    "workflow": None if _pending["loaded"] else _pending["workflow"],
                }
            )
        )

    @routes.post("/sws/pending_workflow/ack")
    async def sws_pending_ack(request):
        try:
            data = await request.json()
        except Exception:
            data = {}
        if not data.get("id") or data.get("id") == _pending["id"]:
            _pending["loaded"] = True
        return _cors(web.json_response({"ok": True}))


setup_routes()
