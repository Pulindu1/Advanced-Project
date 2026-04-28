import json
from types import SimpleNamespace
from unittest.mock import MagicMock

from lib.models import AnthropicClient, GoogleClient, OpenAIClient, ToolResult
from lib.tools import TOOL_SCHEMAS


# ---- Anthropic fixtures ----


def anthropic_text_response(
    text: str = "hello",
    input_tokens: int = 100,
    output_tokens: int = 50,
    cache_read: int = 0,
):
    usage = SimpleNamespace(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_read_input_tokens=cache_read,
    )
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        stop_reason="end_turn",
        usage=usage,
    )


def anthropic_tool_response(
    tool_id: str = "toolu_1",
    name: str = "http_request",
    args: dict | None = None,
):
    args = args or {"method": "GET", "url": "http://localhost:3001/"}
    content = [
        SimpleNamespace(type="text", text="Let me try"),
        SimpleNamespace(type="tool_use", id=tool_id, name=name, input=args),
    ]
    usage = SimpleNamespace(
        input_tokens=100,
        output_tokens=50,
        cache_read_input_tokens=0,
    )
    return SimpleNamespace(content=content, stop_reason="tool_use", usage=usage)


def anthropic_thinking_response():
    content = [
        SimpleNamespace(
            type="thinking",
            thinking="step by step...",
            signature="sig123",
        ),
        SimpleNamespace(type="text", text="final answer"),
    ]
    usage = SimpleNamespace(
        input_tokens=100, output_tokens=50, cache_read_input_tokens=0
    )
    return SimpleNamespace(content=content, stop_reason="end_turn", usage=usage)


class TestAnthropic:
    def _make(self, thinking=None):
        fake = MagicMock()
        c = AnthropicClient(
            model_id="claude-sonnet-4-6",
            system_prompt="You are an auditor.",
            tools=TOOL_SCHEMAS,
            extended_thinking_budget=thinking,
            client=fake,
        )
        return c, fake

    def test_system_prompt_wrapped_with_cache_control(self):
        c, _ = self._make()
        assert isinstance(c.system, list)
        assert c.system[0]["cache_control"] == {"type": "ephemeral"}
        assert c.system[0]["text"] == "You are an auditor."

    def test_tools_translated_to_anthropic_schema(self):
        c, _ = self._make()
        names = [t["name"] for t in c.tools]
        assert set(names) == {
            "http_request", "shell", "read_local",
            "submit_flag", "give_up",
        }
        for t in c.tools:
            assert "description" in t and "input_schema" in t

    def test_first_user_message_is_cached(self):
        c, _ = self._make()
        c.set_user("hello")
        msg = c.messages[-1]
        assert msg["role"] == "user"
        assert msg["content"][0]["text"] == "hello"
        assert msg["content"][0]["cache_control"] == {"type": "ephemeral"}

    def test_subsequent_user_message_not_cached(self):
        c, _ = self._make()
        c.set_user("first")
        c.set_user("second")  # unusual but defensive
        assert "cache_control" in c.messages[0]["content"][0]
        assert "cache_control" not in c.messages[1]["content"][0]

    def test_send_passes_expected_kwargs(self):
        c, fake = self._make()
        fake.messages.create.return_value = anthropic_text_response()
        c.set_user("hi")
        c.send()
        kwargs = fake.messages.create.call_args.kwargs
        assert kwargs["model"] == "claude-sonnet-4-6"
        assert kwargs["system"] is c.system
        assert kwargs["tools"] is c.tools
        assert kwargs["max_tokens"] == 4096
        assert kwargs["temperature"] == 0.0
        assert "thinking" not in kwargs

    def test_extended_thinking_swaps_temperature_for_budget(self):
        c, fake = self._make(thinking=4096)
        fake.messages.create.return_value = anthropic_text_response()
        c.set_user("hi")
        c.send()
        kwargs = fake.messages.create.call_args.kwargs
        assert kwargs["thinking"] == {
            "type": "enabled", "budget_tokens": 4096,
        }
        assert "temperature" not in kwargs

    def test_response_parsing_plain_text(self):
        c, fake = self._make()
        fake.messages.create.return_value = anthropic_text_response(text="hi")
        c.set_user("hi")
        r = c.send()
        assert r.text == "hi"
        assert r.reasoning is None
        assert r.tool_uses == []
        assert r.stop_reason == "end_turn"
        assert r.tokens_input == 100
        assert r.tokens_output == 50

    def test_response_parsing_tool_use(self):
        c, fake = self._make()
        fake.messages.create.return_value = anthropic_tool_response()
        c.set_user("hi")
        r = c.send()
        assert r.tool_uses == [
            {
                "id": "toolu_1",
                "name": "http_request",
                "arguments": {
                    "method": "GET", "url": "http://localhost:3001/",
                },
            }
        ]
        assert r.stop_reason == "tool_use"

    def test_response_parsing_thinking(self):
        c, fake = self._make(thinking=4096)
        fake.messages.create.return_value = anthropic_thinking_response()
        c.set_user("hi")
        r = c.send()
        assert r.reasoning == "step by step..."
        assert r.text == "final answer"

    def test_tool_results_appended_as_user_message(self):
        c, _ = self._make()
        c.set_tool_results(
            [ToolResult(tool_use_id="toolu_1", content='{"ok":true}')]
        )
        msg = c.messages[-1]
        assert msg["role"] == "user"
        assert msg["content"][0]["type"] == "tool_result"
        assert msg["content"][0]["tool_use_id"] == "toolu_1"

    def test_assistant_raw_content_preserved_in_history(self):
        c, fake = self._make()
        fake.messages.create.return_value = anthropic_tool_response()
        c.set_user("hi")
        c.send()
        assistant = c.messages[-1]
        assert assistant["role"] == "assistant"
        types = [b["type"] for b in assistant["content"]]
        assert types == ["text", "tool_use"]

    def test_thinking_signature_preserved_in_history(self):
        c, fake = self._make(thinking=4096)
        fake.messages.create.return_value = anthropic_thinking_response()
        c.set_user("hi")
        c.send()
        thinking_block = c.messages[-1]["content"][0]
        assert thinking_block["type"] == "thinking"
        assert thinking_block["signature"] == "sig123"

    def test_cache_hit_tokens_reported(self):
        c, fake = self._make()
        fake.messages.create.return_value = anthropic_text_response(
            cache_read=250
        )
        c.set_user("hi")
        r = c.send()
        assert r.cache_hit_tokens == 250


# ---- OpenAI fixtures ----


def openai_text_response(
    text: str = "hi",
    prompt_tokens: int = 100,
    completion_tokens: int = 50,
    cached: int = 0,
):
    msg = SimpleNamespace(content=text, tool_calls=None)
    choice = SimpleNamespace(message=msg, finish_reason="stop")
    ptd = SimpleNamespace(cached_tokens=cached)
    usage = SimpleNamespace(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        prompt_tokens_details=ptd,
    )
    return SimpleNamespace(choices=[choice], usage=usage)


def openai_tool_response(
    tool_id: str = "call_1",
    name: str = "http_request",
    args: dict | None = None,
):
    args = args or {"method": "GET", "url": "http://localhost:3001/"}
    fn = SimpleNamespace(name=name, arguments=json.dumps(args))
    tc = SimpleNamespace(id=tool_id, function=fn)
    msg = SimpleNamespace(content="reasoning", tool_calls=[tc])
    choice = SimpleNamespace(message=msg, finish_reason="tool_calls")
    ptd = SimpleNamespace(cached_tokens=0)
    usage = SimpleNamespace(
        prompt_tokens=100, completion_tokens=50, prompt_tokens_details=ptd
    )
    return SimpleNamespace(choices=[choice], usage=usage)


class TestOpenAI:
    def _make(self):
        fake = MagicMock()
        c = OpenAIClient(
            model_id="gpt-5-mini",
            system_prompt="You are an auditor.",
            tools=TOOL_SCHEMAS,
            client=fake,
        )
        return c, fake

    def test_system_is_first_message(self):
        c, _ = self._make()
        assert c.messages[0] == {
            "role": "system", "content": "You are an auditor."
        }

    def test_tools_translated_to_openai_schema(self):
        c, _ = self._make()
        for t in c.tools:
            assert t["type"] == "function"
            assert "name" in t["function"]
            assert "parameters" in t["function"]
        names = [t["function"]["name"] for t in c.tools]
        assert "submit_flag" in names

    def test_set_user_adds_plain_message(self):
        c, _ = self._make()
        c.set_user("hello")
        assert c.messages[-1] == {"role": "user", "content": "hello"}

    def test_set_tool_results_adds_tool_role_messages(self):
        c, _ = self._make()
        c.set_tool_results(
            [
                ToolResult(tool_use_id="call_1", content='{"a":1}'),
                ToolResult(tool_use_id="call_2", content='{"b":2}'),
            ]
        )
        assert c.messages[-2] == {
            "role": "tool", "tool_call_id": "call_1", "content": '{"a":1}'
        }
        assert c.messages[-1] == {
            "role": "tool", "tool_call_id": "call_2", "content": '{"b":2}'
        }

    def test_send_passes_expected_kwargs(self):
        c, fake = self._make()
        fake.chat.completions.create.return_value = openai_text_response()
        c.set_user("hi")
        c.send()
        kwargs = fake.chat.completions.create.call_args.kwargs
        assert kwargs["model"] == "gpt-5-mini"
        assert kwargs["tool_choice"] == "auto"
        assert kwargs["max_completion_tokens"] == 4096
        # gpt-5 family rejects custom temperature; harness must omit it.
        assert "temperature" not in kwargs

    def test_response_parsing_plain_text(self):
        c, fake = self._make()
        fake.chat.completions.create.return_value = openai_text_response(
            text="hi"
        )
        c.set_user("hi")
        r = c.send()
        assert r.text == "hi"
        assert r.tool_uses == []
        assert r.stop_reason == "stop"

    def test_response_parsing_tool_calls(self):
        c, fake = self._make()
        fake.chat.completions.create.return_value = openai_tool_response()
        c.set_user("hi")
        r = c.send()
        assert len(r.tool_uses) == 1
        tu = r.tool_uses[0]
        assert tu["id"] == "call_1"
        assert tu["name"] == "http_request"
        assert tu["arguments"]["url"] == "http://localhost:3001/"
        assert r.stop_reason == "tool_calls"

    def test_assistant_history_preserved_with_tool_calls(self):
        c, fake = self._make()
        fake.chat.completions.create.return_value = openai_tool_response()
        c.set_user("hi")
        c.send()
        assistant = c.messages[-1]
        assert assistant["role"] == "assistant"
        assert "tool_calls" in assistant
        assert assistant["tool_calls"][0]["function"]["name"] == "http_request"

    def test_cache_hit_tokens_reported(self):
        c, fake = self._make()
        fake.chat.completions.create.return_value = openai_text_response(
            cached=250
        )
        c.set_user("hi")
        r = c.send()
        assert r.cache_hit_tokens == 250

    def test_malformed_tool_args_preserved_as_raw(self):
        c, fake = self._make()
        fn = SimpleNamespace(name="http_request", arguments="not-json")
        tc = SimpleNamespace(id="call_1", function=fn)
        msg = SimpleNamespace(content="", tool_calls=[tc])
        choice = SimpleNamespace(message=msg, finish_reason="tool_calls")
        ptd = SimpleNamespace(cached_tokens=0)
        usage = SimpleNamespace(
            prompt_tokens=10, completion_tokens=5, prompt_tokens_details=ptd
        )
        fake.chat.completions.create.return_value = SimpleNamespace(
            choices=[choice], usage=usage
        )
        c.set_user("hi")
        r = c.send()
        assert r.tool_uses[0]["arguments"] == {"_raw": "not-json"}

    def test_seed_passed_through(self):
        fake = MagicMock()
        c = OpenAIClient(
            model_id="gpt-5-mini",
            system_prompt="sys",
            tools=TOOL_SCHEMAS,
            seed=42,
            client=fake,
        )
        fake.chat.completions.create.return_value = openai_text_response()
        c.set_user("hi")
        c.send()
        kwargs = fake.chat.completions.create.call_args.kwargs
        assert kwargs["seed"] == 42


# ---- Google (Gemini) fixtures ----


class FakeTypes:
    """Minimal stand-in for `google.genai.types`. Each class records
    the kwargs it was constructed with so the test can assert on the
    shape of the outbound request."""

    class Content:
        def __init__(self, role=None, parts=None):
            self.role = role
            self.parts = parts or []

    class Part:
        def __init__(self, text=None, function_call=None, function_response=None):
            self.text = text
            self.function_call = function_call
            self.function_response = function_response

    class FunctionDeclaration:
        def __init__(self, name=None, description=None, parameters=None):
            self.name = name
            self.description = description
            self.parameters = parameters

    class Tool:
        def __init__(self, function_declarations=None):
            self.function_declarations = function_declarations or []

    class FunctionResponse:
        def __init__(self, name=None, response=None):
            self.name = name
            self.response = response

    class GenerateContentConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs


def google_text_response(
    text: str = "hi",
    prompt_tokens: int = 100,
    candidates_tokens: int = 50,
    cached: int = 0,
    finish_reason: str = "STOP",
):
    part = SimpleNamespace(text=text, function_call=None)
    content = FakeTypes.Content(role="model", parts=[part])
    candidate = SimpleNamespace(content=content, finish_reason=finish_reason)
    usage = SimpleNamespace(
        prompt_token_count=prompt_tokens,
        candidates_token_count=candidates_tokens,
        cached_content_token_count=cached,
    )
    return SimpleNamespace(candidates=[candidate], usage_metadata=usage)


def google_tool_response(
    name: str = "http_request",
    args: dict | None = None,
):
    args = args or {"method": "GET", "url": "http://localhost:3001/"}
    fc = SimpleNamespace(name=name, args=args)
    text_part = SimpleNamespace(text="let me try", function_call=None)
    tool_part = SimpleNamespace(text=None, function_call=fc)
    content = FakeTypes.Content(role="model", parts=[text_part, tool_part])
    candidate = SimpleNamespace(content=content, finish_reason="STOP")
    usage = SimpleNamespace(
        prompt_token_count=100,
        candidates_token_count=50,
        cached_content_token_count=0,
    )
    return SimpleNamespace(candidates=[candidate], usage_metadata=usage)


class TestGoogle:
    def _make(self, seed=None):
        fake = MagicMock()
        c = GoogleClient(
            model_id="gemini-2.5-pro",
            system_prompt="You are an auditor.",
            tools=TOOL_SCHEMAS,
            seed=seed,
            client=fake,
            types_module=FakeTypes,
        )
        return c, fake

    def test_tools_translated_to_gemini_schema(self):
        c, _ = self._make()
        assert c.tool_config is not None
        decls = c.tool_config[0].function_declarations
        names = [d.name for d in decls]
        assert set(names) == {
            "http_request", "shell", "read_local", "submit_flag", "give_up",
        }

    def test_set_user_appends_user_content(self):
        c, _ = self._make()
        c.set_user("hello")
        assert len(c.contents) == 1
        msg = c.contents[-1]
        assert msg.role == "user"
        assert msg.parts[0].text == "hello"

    def test_send_passes_expected_config(self):
        c, fake = self._make()
        fake.models.generate_content.return_value = google_text_response()
        c.set_user("hi")
        c.send()
        kwargs = fake.models.generate_content.call_args.kwargs
        assert kwargs["model"] == "gemini-2.5-pro"
        assert kwargs["contents"] is c.contents
        cfg_kwargs = kwargs["config"].kwargs
        assert cfg_kwargs["system_instruction"] == "You are an auditor."
        assert cfg_kwargs["temperature"] == 0.0
        assert cfg_kwargs["max_output_tokens"] == 4096
        assert "tools" in cfg_kwargs
        assert "seed" not in cfg_kwargs

    def test_seed_threaded_into_config(self):
        c, fake = self._make(seed=7)
        fake.models.generate_content.return_value = google_text_response()
        c.set_user("hi")
        c.send()
        cfg_kwargs = fake.models.generate_content.call_args.kwargs["config"].kwargs
        assert cfg_kwargs["seed"] == 7

    def test_response_parsing_plain_text(self):
        c, fake = self._make()
        fake.models.generate_content.return_value = google_text_response(
            text="hi there"
        )
        c.set_user("hi")
        r = c.send()
        assert r.text == "hi there"
        assert r.tool_uses == []
        assert r.tokens_input == 100
        assert r.tokens_output == 50

    def test_response_parsing_tool_use(self):
        c, fake = self._make()
        fake.models.generate_content.return_value = google_tool_response()
        c.set_user("hi")
        r = c.send()
        assert len(r.tool_uses) == 1
        tu = r.tool_uses[0]
        assert tu["name"] == "http_request"
        assert tu["arguments"] == {
            "method": "GET", "url": "http://localhost:3001/",
        }
        assert tu["id"].startswith("gemini_")

    def test_cache_hit_tokens_reported(self):
        c, fake = self._make()
        fake.models.generate_content.return_value = google_text_response(
            cached=250
        )
        c.set_user("hi")
        r = c.send()
        assert r.cache_hit_tokens == 250

    def test_tool_results_round_trip(self):
        c, fake = self._make()
        fake.models.generate_content.return_value = google_tool_response()
        c.set_user("hi")
        r = c.send()
        tu_id = r.tool_uses[0]["id"]

        c.set_tool_results(
            [ToolResult(tool_use_id=tu_id, content='{"status":200}')]
        )
        # Last content is the tool-result user message with a
        # function_response part whose name is the original function.
        last = c.contents[-1]
        assert last.role == "user"
        fr = last.parts[0].function_response
        assert fr.name == "http_request"
        assert fr.response == {"content": '{"status":200}'}

    def test_model_content_appended_to_history(self):
        c, fake = self._make()
        fake.models.generate_content.return_value = google_text_response(
            text="first"
        )
        c.set_user("hi")
        c.send()
        # Before send: just the user message (len=1). After send: user +
        # model message (len=2).
        assert len(c.contents) == 2
        assert c.contents[0].role == "user"
        assert c.contents[1].role == "model"
