import json
from types import SimpleNamespace
from unittest.mock import MagicMock

from lib.models import AnthropicClient, OpenAIClient, ToolResult
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
        assert kwargs["temperature"] == 0.0

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
