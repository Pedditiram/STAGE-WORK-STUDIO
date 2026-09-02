
from .sws_common import dumps, loads_maybe, byteplus_create_video, byteplus_create_image


def _string_inputs(spec):
    required = {}
    for name, default in spec:
        required[name] = ("STRING", {"default": default, "multiline": True if len(str(default)) > 40 or name in ("prompt", "negative_prompt", "description", "character_description", "continuity_data", "extra_json", "system_instruction", "reference_images") else False})
    return {"required": required}


class SWSShotContext:
    @classmethod
    def INPUT_TYPES(cls):
        return _string_inputs([
            ("project_id", ""),
            ("scene_id", ""),
            ("shot_id", ""),
            ("character", ""),
            ("location", ""),
            ("action", ""),
            ("camera", ""),
            ("lighting", ""),
        ])

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("shot_context",)
    FUNCTION = "run"
    CATEGORY = "SWS"

    def run(self, **kwargs):
        return (dumps(kwargs),)


class SWSCharacterContext:
    @classmethod
    def INPUT_TYPES(cls):
        return _string_inputs([
            ("character_id", ""),
            ("character_name", ""),
            ("character_reference", ""),
            ("character_description", ""),
            ("costume", ""),
            ("appearance", ""),
            ("continuity_data", ""),
        ])

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("character_context",)
    FUNCTION = "run"
    CATEGORY = "SWS"

    def run(self, **kwargs):
        return (dumps(kwargs),)


class SWSLocationContext:
    @classmethod
    def INPUT_TYPES(cls):
        return _string_inputs([
            ("location_id", ""),
            ("location_name", ""),
            ("description", ""),
            ("reference_images", ""),
            ("continuity_data", ""),
        ])

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("location_context",)
    FUNCTION = "run"
    CATEGORY = "SWS"

    def run(self, **kwargs):
        return (dumps(kwargs),)


class SWSCameraContext:
    @classmethod
    def INPUT_TYPES(cls):
        return _string_inputs([
            ("shot_type", ""),
            ("camera_angle", ""),
            ("lens", ""),
            ("focal_length", ""),
            ("camera_movement", ""),
            ("framing", ""),
            ("composition", ""),
        ])

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("camera_context",)
    FUNCTION = "run"
    CATEGORY = "SWS"

    def run(self, **kwargs):
        return (dumps(kwargs),)


class SWSLightingContext:
    @classmethod
    def INPUT_TYPES(cls):
        return _string_inputs([
            ("lighting", ""),
            ("time_of_day", ""),
            ("weather", ""),
            ("color_temperature", ""),
            ("contrast", ""),
        ])

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("lighting_context",)
    FUNCTION = "run"
    CATEGORY = "SWS"

    def run(self, **kwargs):
        return (dumps(kwargs),)


class SWSPrompt:
    @classmethod
    def INPUT_TYPES(cls):
        return _string_inputs([
            ("prompt", ""),
            ("negative_prompt", ""),
            ("system_instruction", ""),
        ])

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("prompt", "negative_prompt", "system_instruction")
    FUNCTION = "run"
    CATEGORY = "SWS"

    def run(self, prompt, negative_prompt, system_instruction=""):
        return (prompt, negative_prompt, system_instruction)


class SWSReferenceLoader:
    @classmethod
    def INPUT_TYPES(cls):
        return _string_inputs([
            ("asset_id", ""),
            ("asset_url", ""),
            ("local_path", ""),
            ("last_frame_url", ""),
        ])

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("reference",)
    FUNCTION = "run"
    CATEGORY = "SWS"

    def run(self, **kwargs):
        return (dumps(kwargs),)


class SWSMetadata:
    @classmethod
    def INPUT_TYPES(cls):
        return _string_inputs([
            ("project_id", ""),
            ("scene_id", ""),
            ("shot_id", ""),
            ("workflow_id", ""),
            ("template_id", ""),
            ("template_version", ""),
            ("sws_workflow_version", "1.0"),
            ("provider", ""),
            ("model", ""),
        ])

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("metadata",)
    FUNCTION = "run"
    CATEGORY = "SWS"

    def run(self, **kwargs):
        return (dumps(kwargs),)


class _ProviderBase:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "shot_context": ("STRING", {"default": ""}),
                "prompt": ("STRING", {"default": "", "multiline": True}),
                "negative_prompt": ("STRING", {"default": "", "multiline": True}),
                "character_context": ("STRING", {"default": ""}),
                "location_context": ("STRING", {"default": ""}),
                "camera_context": ("STRING", {"default": ""}),
                "lighting_context": ("STRING", {"default": ""}),
                "reference": ("STRING", {"default": ""}),
                "provider": ("STRING", {"default": "byteplus"}),
                "provider_account_id": ("STRING", {"default": ""}),
                "model": ("STRING", {"default": ""}),
                "duration": ("INT", {"default": 5, "min": 1, "max": 12}),
                "width": ("INT", {"default": 1920, "min": 64, "max": 4096}),
                "height": ("INT", {"default": 1080, "min": 64, "max": 4096}),
                "fps": ("INT", {"default": 24, "min": 1, "max": 60}),
                "seed": ("INT", {"default": -1, "min": -1, "max": 2147483647}),
                "workflow_type": ("STRING", {"default": ""}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("provider_result",)
    FUNCTION = "run"
    CATEGORY = "SWS"

    FAMILY = "video"

    def run(self, **kwargs):
        provider = str(kwargs.get("provider") or "byteplus").lower()
        ref = loads_maybe(kwargs.get("reference"))
        first = ""
        if isinstance(ref, dict):
            first = ref.get("asset_url") or ref.get("local_path") or ""
        if provider not in ("byteplus", "local_comfy"):
            return (dumps({
                "ok": False,
                "error": f'Provider "{provider}" is reserved but not implemented in ComfyUI-SWS.',
            }),)
        if self.FAMILY == "video":
            result = byteplus_create_video(
                kwargs.get("prompt"),
                kwargs.get("model"),
                kwargs.get("duration"),
                "9:16" if int(kwargs.get("width") or 0) < int(kwargs.get("height") or 1) else "16:9",
                first,
            )
        else:
            result = byteplus_create_image(
                kwargs.get("prompt"),
                kwargs.get("model"),
                kwargs.get("width"),
                kwargs.get("height"),
            )
        result["provider"] = "byteplus"
        result["model"] = kwargs.get("model")
        result["seed"] = kwargs.get("seed")
        result["fps"] = kwargs.get("fps")
        result["workflow_type"] = kwargs.get("workflow_type")
        return (dumps(result),)


class SWSVideoProvider(_ProviderBase):
    FAMILY = "video"


class SWSImageProvider(_ProviderBase):
    FAMILY = "image"


class SWSOutput:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "provider_result": ("STRING", {"default": ""}),
                "shot_context": ("STRING", {"default": ""}),
                "project_id": ("STRING", {"default": ""}),
                "scene_id": ("STRING", {"default": ""}),
                "shot_id": ("STRING", {"default": ""}),
                "generation_id": ("STRING", {"default": ""}),
                "workflow_id": ("STRING", {"default": ""}),
                "provider": ("STRING", {"default": ""}),
                "model": ("STRING", {"default": ""}),
                "extra_json": ("STRING", {"default": "", "multiline": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("sws_result",)
    FUNCTION = "run"
    CATEGORY = "SWS"
    OUTPUT_NODE = True

    def run(self, provider_result, shot_context, project_id, scene_id, shot_id, generation_id, workflow_id, provider, model, extra_json=""):
        payload = {
            "provider_result": loads_maybe(provider_result),
            "shot_context": loads_maybe(shot_context),
            "project_id": project_id,
            "scene_id": scene_id,
            "shot_id": shot_id,
            "generation_id": generation_id,
            "workflow_id": workflow_id,
            "provider": provider,
            "model": model,
            "extra": loads_maybe(extra_json),
        }
        return {"ui": {"text": [dumps(payload)]}, "result": (dumps(payload),)}


NODE_CLASS_MAPPINGS = {
    "SWS Shot Context": SWSShotContext,
    "SWS Character Context": SWSCharacterContext,
    "SWS Location Context": SWSLocationContext,
    "SWS Camera Context": SWSCameraContext,
    "SWS Lighting Context": SWSLightingContext,
    "SWS Prompt": SWSPrompt,
    "SWS Reference Loader": SWSReferenceLoader,
    "SWS Video Provider": SWSVideoProvider,
    "SWS Image Provider": SWSImageProvider,
    "SWS Output": SWSOutput,
    "SWS Metadata": SWSMetadata,
}

NODE_DISPLAY_NAME_MAPPINGS = {k: k for k in NODE_CLASS_MAPPINGS}
