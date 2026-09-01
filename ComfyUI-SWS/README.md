# ComfyUI-SWS

Custom node pack for Stage Work Studio (SWS) generated workflows.

Install: copy or clone this folder into `ComfyUI/custom_nodes/ComfyUI-SWS`.
SWS will **not** download or install this pack for you.

## Environment (BytePlus keys never belong in workflow JSON)

- `BYTEPLUS_API_KEY` or `SPS_BYTEPLUS_API_KEY`
- Optional: `BYTEPLUS_API_HOST` (default `https://ark.ap-southeast.bytepluses.com/api/v3`)

## Node class_types (must match SWS JSON)

- SWS Shot Context
- SWS Character Context
- SWS Location Context
- SWS Camera Context
- SWS Lighting Context
- SWS Prompt
- SWS Reference Loader
- SWS Video Provider
- SWS Image Provider
- SWS Output
- SWS Metadata

Stable node IDs from SWS: 100 context, 110 character, 120 location, 130 camera, 140 lighting, 150 prompt, 160 reference, 170 metadata, 200 provider, 300 output.

## Send to ComfyUI (canvas load)

SWS posts **frontend workflow JSON** (nodes, links, positions) to `POST /sws/load_workflow`.
The web extension in `web/sws_open_workflow.js` receives `sws.load_workflow` over ComfyUI’s websocket and calls `app.loadGraphData`, then fits the view.

Restart ComfyUI after installing this pack. API `/prompt` JSON is not loaded onto the canvas.
