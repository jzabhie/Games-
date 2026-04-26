"""
ARIA — Autonomous Replying & Intelligent Agent
Core agent: wires tools together and exposes a .run(task) interface.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

from aria.tools import build_email_tools, build_search_tool

if TYPE_CHECKING:
    from aria.config import Config


SYSTEM_PROMPT = """\
You are ARIA — Autonomous Replying & Intelligent Agent.
You are a helpful, efficient, and friendly AI assistant that can automate everyday tasks.

You have access to the following tools:
{tools}

Use the following format strictly:

Question: the input task you must complete
Thought: think step-by-step about what to do
Action: the tool to use — must be one of [{tool_names}]
Action Input: the input to the tool (JSON matching the tool's schema)
Observation: the result of the tool call
... (repeat Thought / Action / Action Input / Observation as needed)
Thought: I now know the final answer
Final Answer: the complete, human-readable result

Begin!

Question: {input}
Thought: {agent_scratchpad}"""


def build_agent(cfg: "Config") -> AgentExecutor:
    """Construct and return a ready-to-use ARIA AgentExecutor."""
    llm = ChatOpenAI(
        model=cfg.openai_model,
        temperature=cfg.agent_temperature,
        openai_api_key=cfg.openai_api_key,
    )

    tools = [*build_email_tools(cfg), build_search_tool(cfg)]

    prompt = PromptTemplate.from_template(SYSTEM_PROMPT)

    agent = create_react_agent(llm=llm, tools=tools, prompt=prompt)

    return AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True,
        max_iterations=cfg.agent_max_iterations,
        handle_parsing_errors=True,
        return_intermediate_steps=False,
    )
