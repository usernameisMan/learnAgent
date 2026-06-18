import "dotenv/config";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import chalk from "chalk";
import {
  SystemMessage,
  HumanMessage,
  ToolMessage,
} from "@langchain/core/messages";

const model = new ChatOpenAI({
  modelName: "qwen3.7-plus",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "amap-maps-streamableHTTP": {
      url: "https://mcp.amap.com/mcp?key=6011726674849fc3b305db338121571f",
    },
    "chrome-devtools": {
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest"],
    },
    filesystem: {
      command: "npx",
      args: [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        ...(process.env.ALLOWED_PATHS.split(",") || ""),
      ],
    },
    "my-mcp-server": {
      command: "/Users/aaxis/.nvm/versions/node/v22.18.0/bin/node",
      args: [
        "/Users/aaxis/Documents/code/agent/learnAgent/src/my-mcp-server.mjs",
      ],
    },
  },
});

const tools = await mcpClient.getTools();
const modelWithTools = model.bindTools(tools);

async function runAgentWithTools(query, maxIteration = 30) {
  const messages = [new HumanMessage(query)];

  for (let i = 0; i < maxIteration; i++) {
    console.log(chalk.bgGreen(`⏳ 正在等待 AI 思考...第${i + 1}轮`));
    const response = await modelWithTools.invoke(messages);
    messages.push(response); // 检查是否有工具调用

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }

    console.log(
      chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`),
    );
    console.log(
      chalk.bgBlue(
        `🔍 工具调用: ${response.tool_calls.map((t) => t.name).join(", ")}`,
      ),
    ); // 执行工具调用
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        try {
          // try catch error 处理很关键不然ai不知道tool调用错误的内容并且修正,并且程序会崩溃
          const toolResult = await foundTool.invoke(toolCall.args);
          messages.push(
            new ToolMessage({
              content:
                typeof toolResult === "string"
                  ? toolResult
                  : toolResult?.text || JSON.stringify(toolResult) || "",
              tool_call_id: toolCall.id,
            }),
          );
        } catch (error) {
          console.error(
            chalk.red(`❌ 工具调用失败 [${toolCall.name}]: ${error.message}`),
          );
          messages.push(
            new ToolMessage({
              content: `工具调用错误: ${error.message}`,
              tool_call_id: toolCall.id,
            }),
          );
        }
      }
    }
  }
  return messages[messages.length - 1].content;
}

await runAgentWithTools(process.argv.slice(2).join(""));

await mcpClient.close();
