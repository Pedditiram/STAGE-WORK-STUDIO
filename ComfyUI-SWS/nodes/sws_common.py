"""Shared helpers for ComfyUI-SWS. No API keys in returned workflow fields."""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request


BYTEPLUS_HOST = os.environ.get(
    "BYTEPLUS_API_HOST", "https://ark.ap-southeast.bytepluses.com/api/v3"
).rstrip("/")


def dumps(value):
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False)
    except TypeError:
        return str(value)


def loads_maybe(value):
    if not isinstance(value, str):
        return value
    text = value.strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"text": value}


def env_api_key():
    return (
        os.environ.get("BYTEPLUS_API_KEY")
        or os.environ.get("SPS_BYTEPLUS_API_KEY")
        or ""
    ).strip()


def http_json(method, url, body=None, headers=None, timeout=60):
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(raw) if raw else {}
            except json.JSONDecodeError:
                parsed = {"raw": raw}
            return {"ok": True, "status": res.status, "data": parsed}
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        return {
            "ok": False,
            "status": err.code,
            "error": parsed.get("error", {}).get("message")
            or parsed.get("message")
            or raw[:400]
            or str(err),
            "data": parsed,
        }
    except Exception as err:
        return {"ok": False, "status": 0, "error": str(err), "data": {}}


def byteplus_create_video(prompt, model, duration, ratio, first_frame_url=""):
    key = env_api_key()
    if not key:
        return {
            "ok": False,
            "error": "BYTEPLUS_API_KEY / SPS_BYTEPLUS_API_KEY is not set on the ComfyUI host. Keys are never stored in workflow JSON.",
        }
    content = [{"type": "text", "text": str(prompt or "")[:2500]}]
    frame = str(first_frame_url or "").strip()
    if frame.startswith("http"):
        content.append(
            {"type": "image_url", "image_url": {"url": frame}, "role": "first_frame"}
        )
    sec = max(4, min(12, int(duration or 5)))
    created = http_json(
        "POST",
        f"{BYTEPLUS_HOST}/contents/generations/tasks",
        {
            "model": model,
            "content": content,
            "ratio": ratio or "16:9",
            "duration": sec,
        },
        {"Authorization": f"Bearer {key}"},
        timeout=90,
    )
    if not created.get("ok"):
        return created
    task_id = (
        created["data"].get("id")
        or created["data"].get("task_id")
        or (created["data"].get("data") or {}).get("id")
        or ""
    )
    if not task_id:
        return {"ok": False, "error": "BytePlus did not return a task id.", "data": created["data"]}
    deadline = time.time() + 300
    while time.time() < deadline:
        polled = http_json(
            "GET",
            f"{BYTEPLUS_HOST}/contents/generations/tasks/{task_id}",
            None,
            {"Authorization": f"Bearer {key}"},
            timeout=60,
        )
        if not polled.get("ok"):
            return polled
        data = polled["data"]
        status = str(data.get("status") or (data.get("data") or {}).get("status") or "").lower()
        url = (
            (data.get("content") or {}).get("video_url")
            or data.get("video_url")
            or ((data.get("output") or {}).get("video_url"))
            or ""
        )
        if url or status in ("succeeded", "success", "completed"):
            return {"ok": True, "task_id": task_id, "status": status or "succeeded", "url": url, "data": data}
        if status in ("failed", "error", "cancelled", "canceled"):
            return {"ok": False, "task_id": task_id, "error": f"BytePlus task {status}", "data": data}
        time.sleep(3)
    return {"ok": False, "task_id": task_id, "error": "BytePlus task timed out after 5 minutes."}


def byteplus_create_image(prompt, model, width, height):
    key = env_api_key()
    if not key:
        return {
            "ok": False,
            "error": "BYTEPLUS_API_KEY / SPS_BYTEPLUS_API_KEY is not set on the ComfyUI host. Keys are never stored in workflow JSON.",
        }
    created = http_json(
        "POST",
        f"{BYTEPLUS_HOST}/images/generations",
        {
            "model": model,
            "prompt": str(prompt or "")[:2500],
            "size": f"{int(width or 1920)}x{int(height or 1080)}",
        },
        {"Authorization": f"Bearer {key}"},
        timeout=120,
    )
    if not created.get("ok"):
        return created
    data = created["data"]
    url = ""
    items = data.get("data") or []
    if items and isinstance(items, list):
        url = (items[0] or {}).get("url") or ""
    url = url or data.get("url") or ""
    return {"ok": True, "url": url, "data": data}
