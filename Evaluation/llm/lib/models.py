"""Vendor abstraction over Anthropic, OpenAI, and Google.

Design: each client owns a stateful message history. The harness loop
calls `set_user` (first turn only), then alternates `send` with
`set_tool_results`. Message shapes are vendor-native internally;
`ModelResponse` is the neutral view the harness uses.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ModelResponse:
    text: str
    reasoning: str | None
    tool_uses: list[dict[str, Any]]       # [{id, name, arguments}]
    stop_reason: str
    tokens_input: int
    tokens_output: int
    cache_hit_tokens: int = 0


@dataclass
class ToolResult:
    tool_use_id: str
    content: str


class ModelClient(ABC):
    @abstractmethod
    def set_user(self, text: str) -> None: ...

    @abstractmethod
    def set_tool_results(self, results: list[ToolResult]) -> None: ...

    @abstractmethod
    def send(self) -> ModelResponse: ...


# --------------------------------------------------------------------
# Anthropic
# --------------------------------------------------------------------


class AnthropicClient(ModelClient):
    def __init__(
        self,
        model_id: str,
        system_prompt: str,
        tools: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        extended_thinking_budget: int | None = None,
        cache_system: bool = True,
        seed: int | None = None,  # unused; Anthropic has no seed param
        client: Any = None,
    ) -> None:
        from anthropic import Anthropic

        self.client = client or Anthropic()
        self.model_id = model_id
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.extended_thinking_budget = extended_thinking_budget

        self.tools: list[dict[str, Any]] = [
            {
                "name": t["name"],
                "description": t["description"],
                "input_schema": t["input_schema"],
            }
            for t in tools
        ]

        if cache_system:
            self.system: Any = [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ]
        else:
            self.system = system_prompt

        self.messages: list[dict[str, Any]] = []

    def set_user(self, text: str) -> None:
        # Cache the large initial user message (doc pack + landing HTML)
        # so sibling runs of the same CTF hit the cache.
        cache_first_user = len(self.messages) == 0
        block: dict[str, Any] = {"type": "text", "text": text}
        if cache_first_user:
            block["cache_control"] = {"type": "ephemeral"}
        self.messages.append({"role": "user", "content": [block]})

    def set_tool_results(self, results: list[ToolResult]) -> None:
        self.messages.append(
            {
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": r.tool_use_id,
                        "content": r.content,
                    }
                    for r in results
                ],
            }
        )

    def send(self) -> ModelResponse:
        kwargs: dict[str, Any] = dict(
            model=self.model_id,
            system=self.system,
            messages=self.messages,
            tools=self.tools,
            max_tokens=self.max_tokens,
        )
        if self.extended_thinking_budget:
            kwargs["thinking"] = {
                "type": "enabled",
                "budget_tokens": self.extended_thinking_budget,
            }
            # temperature must default (1.0) when thinking is on
        else:
            kwargs["temperature"] = self.temperature

        resp = self.client.messages.create(**kwargs)

        text_parts: list[str] = []
        reasoning_parts: list[str] = []
        tool_uses: list[dict[str, Any]] = []
        raw_blocks: list[dict[str, Any]] = []

        for b in resp.content:
            btype = getattr(b, "type", None)
            if btype == "text":
                text_parts.append(b.text)
                raw_blocks.append({"type": "text", "text": b.text})
            elif btype == "thinking":
                thought = getattr(b, "thinking", "")
                reasoning_parts.append(thought)
                entry = {"type": "thinking", "thinking": thought}
                sig = getattr(b, "signature", None)
                if sig is not None:
                    entry["signature"] = sig
                raw_blocks.append(entry)
            elif btype == "tool_use":
                tool_uses.append(
                    {"id": b.id, "name": b.name, "arguments": dict(b.input)}
                )
                raw_blocks.append(
                    {
                        "type": "tool_use",
                        "id": b.id,
                        "name": b.name,
                        "input": dict(b.input),
                    }
                )

        self.messages.append({"role": "assistant", "content": raw_blocks})

        usage = resp.usage
        cache_hit = getattr(usage, "cache_read_input_tokens", 0) or 0

        return ModelResponse(
            text="\n".join(text_parts),
            reasoning=("\n".join(reasoning_parts) or None),
            tool_uses=tool_uses,
            stop_reason=resp.stop_reason,
            tokens_input=usage.input_tokens,
            tokens_output=usage.output_tokens,
            cache_hit_tokens=cache_hit,
        )


# --------------------------------------------------------------------
# OpenAI
# --------------------------------------------------------------------


class OpenAIClient(ModelClient):
    def __init__(
        self,
        model_id: str,
        system_prompt: str,
        tools: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        seed: int | None = None,
        client: Any = None,
    ) -> None:
        from openai import OpenAI

        self.client = client or OpenAI()
        self.model_id = model_id
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.seed = seed

        self.tools: list[dict[str, Any]] = [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": t["input_schema"],
                },
            }
            for t in tools
        ]

        self.messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt}
        ]

    def set_user(self, text: str) -> None:
        self.messages.append({"role": "user", "content": text})

    def set_tool_results(self, results: list[ToolResult]) -> None:
        for r in results:
            self.messages.append(
                {
                    "role": "tool",
                    "tool_call_id": r.tool_use_id,
                    "content": r.content,
                }
            )

    def send(self) -> ModelResponse:
        kwargs: dict[str, Any] = dict(
            model=self.model_id,
            messages=self.messages,
            tools=self.tools,
            tool_choice="auto",
            max_completion_tokens=self.max_tokens,
        )
        # Some newer models reject temperature; send it but tolerate rejection.
        kwargs["temperature"] = self.temperature
        if self.seed is not None:
            kwargs["seed"] = self.seed

        resp = self.client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        msg = choice.message

        text = msg.content or ""
        tool_uses: list[dict[str, Any]] = []
        if msg.tool_calls:
            for tc in msg.tool_calls:
                args_str = tc.function.arguments or "{}"
                try:
                    args = json.loads(args_str)
                except json.JSONDecodeError:
                    args = {"_raw": args_str}
                tool_uses.append(
                    {"id": tc.id, "name": tc.function.name, "arguments": args}
                )

        assistant_msg: dict[str, Any] = {"role": "assistant", "content": msg.content}
        if msg.tool_calls:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ]
        self.messages.append(assistant_msg)

        usage = resp.usage
        cache_hit = 0
        ptd = getattr(usage, "prompt_tokens_details", None)
        if ptd is not None:
            cache_hit = getattr(ptd, "cached_tokens", 0) or 0

        return ModelResponse(
            text=text,
            reasoning=None,
            tool_uses=tool_uses,
            stop_reason=choice.finish_reason,
            tokens_input=usage.prompt_tokens,
            tokens_output=usage.completion_tokens,
            cache_hit_tokens=cache_hit,
        )


# --------------------------------------------------------------------
# Google (Gemini)
# --------------------------------------------------------------------


class GoogleClient(ModelClient):
    """Wraps google-genai's `client.models.generate_content`.

    Gemini exposes a `contents` list that intermixes user and model
    turns, plus a per-call `config` that carries the system instruction,
    tools, and decoding parameters. Tool calls returned by the model do
    not carry ids, so we synthesize deterministic `tool_use_id` values
    so the neutral `ModelResponse.tool_uses` layout matches the other
    vendors.
    """

    def __init__(
        self,
        model_id: str,
        system_prompt: str,
        tools: list[dict[str, Any]],
        *,
        temperature: float = 0.0,
        max_tokens: int = 4096,
        seed: int | None = None,
        client: Any = None,
        types_module: Any = None,
    ) -> None:
        if types_module is None:
            from google.genai import types as types_module  # type: ignore
        if client is None:
            from google import genai  # type: ignore
            client = genai.Client()

        self._types = types_module
        self.client = client
        self.model_id = model_id
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.seed = seed
        self.system_prompt = system_prompt

        self.tool_config: list[Any] | None = None
        if tools:
            declarations = [
                types_module.FunctionDeclaration(
                    name=t["name"],
                    description=t["description"],
                    parameters=t["input_schema"],
                )
                for t in tools
            ]
            self.tool_config = [
                types_module.Tool(function_declarations=declarations)
            ]

        # Ordered list of google.genai.types.Content objects.
        self.contents: list[Any] = []
        # Map synthesized tool_use_id -> function name, used when the
        # harness echoes back tool results.
        self._pending_ids: dict[str, str] = {}

    def set_user(self, text: str) -> None:
        Content = self._types.Content
        Part = self._types.Part
        self.contents.append(
            Content(role="user", parts=[Part(text=text)])
        )

    def set_tool_results(self, results: list[ToolResult]) -> None:
        Content = self._types.Content
        Part = self._types.Part
        FunctionResponse = self._types.FunctionResponse
        parts = []
        for r in results:
            name = self._pending_ids.pop(r.tool_use_id, r.tool_use_id)
            parts.append(
                Part(
                    function_response=FunctionResponse(
                        name=name,
                        response={"content": r.content},
                    )
                )
            )
        self.contents.append(Content(role="user", parts=parts))

    def send(self) -> ModelResponse:
        GenerateContentConfig = self._types.GenerateContentConfig

        config_kwargs: dict[str, Any] = dict(
            system_instruction=self.system_prompt,
            temperature=self.temperature,
            max_output_tokens=self.max_tokens,
        )
        if self.tool_config:
            config_kwargs["tools"] = self.tool_config
        if self.seed is not None:
            config_kwargs["seed"] = self.seed

        resp = self.client.models.generate_content(
            model=self.model_id,
            contents=self.contents,
            config=GenerateContentConfig(**config_kwargs),
        )

        text_parts: list[str] = []
        tool_uses: list[dict[str, Any]] = []

        candidates = getattr(resp, "candidates", None) or []
        candidate = candidates[0] if candidates else None
        content_obj = getattr(candidate, "content", None) if candidate else None
        parts_list = getattr(content_obj, "parts", None) if content_obj else None

        turn_index = len(self.contents)
        if parts_list:
            for i, p in enumerate(parts_list):
                txt = getattr(p, "text", None)
                if txt:
                    text_parts.append(txt)
                fc = getattr(p, "function_call", None)
                if fc is not None:
                    tool_id = f"gemini_{turn_index}_{i}"
                    raw_args = getattr(fc, "args", None) or {}
                    args = dict(raw_args)
                    tool_uses.append(
                        {
                            "id": tool_id,
                            "name": fc.name,
                            "arguments": args,
                        }
                    )
                    self._pending_ids[tool_id] = fc.name

        # Append the model's content to history so subsequent turns see it.
        if content_obj is not None:
            self.contents.append(content_obj)

        usage = getattr(resp, "usage_metadata", None)
        tokens_input = int(getattr(usage, "prompt_token_count", 0) or 0)
        tokens_output = int(getattr(usage, "candidates_token_count", 0) or 0)
        cache_hit = int(getattr(usage, "cached_content_token_count", 0) or 0)

        raw_stop = getattr(candidate, "finish_reason", None) if candidate else None
        stop_reason = str(raw_stop) if raw_stop is not None else "stop"

        return ModelResponse(
            text="\n".join(text_parts),
            reasoning=None,
            tool_uses=tool_uses,
            stop_reason=stop_reason,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            cache_hit_tokens=cache_hit,
        )
