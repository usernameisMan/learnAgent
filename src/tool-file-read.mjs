// 1. 导入必要的模块和依赖
import "dotenv/config"; // 自动读取项目根目录下的 .env 环境变量文件
import { ChatOpenAI } from '@langchain/openai'; // 导入 LangChain 的 OpenAI 聊天模型封装
import { tool } from '@langchain/core/tools'; // 用于定义大模型可调用的工具
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'; // 导入消息类型：人类消息、系统消息、工具消息
import fs from "node:fs/promises" // 导入 Node.js 异步文件系统模块
import z from "zod" // 导入 schema 校验库，用于定义工具的输入参数结构

// 2. 初始化大模型实例
const model = new ChatOpenAI({
    modelName: "qwen-coder-turbo", // 使用的模型名称
    apiKey: process.env.ALIYUN_API_KEY, // 阿里云 API 密钥（从环境变量读取）
    temperature: 0, // 温度设为 0，保证模型输出的确定性和稳定性
    configuration: {
        baseURL: process.env.ALIYUN_BASE_URL, // 阿里云大模型 API 的 Base URL
    },
});

/**
 * API 解析：tool(...)
 * 作用：这是 LangChain 提供的一个辅助函数，用来创建一个“可被大模型调用的工具”。
 * 参数：
 *   - 第一个参数是工具的执行逻辑（异步函数）。
 *   - 第二个参数是工具的元数据，包括 name（工具名）、description（描述，极其重要，大模型靠这个描述来决定什么时候用这个工具）和 schema（参数类型限制）。
 */
const readFileTool = tool(async ({file_path}) => {
    // 这里是工具的实际执行逻辑：读取本地文件
    const content = await fs.readFile(file_path, 'utf8');
    console.log(`\n>>> [本地执行工具] 成功读取文件: "${file_path}" (${content.length} 字节)`);
    return `文件内容: ${content}`;
},{
    name: "read_file", // 工具名称，模型会通过这个名称指定调用它
    description: '用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入参数为文件路径（可以是相对路径或绝对路径）。', // 描述：大模型会阅读并判断何时该使用此工具
    schema: z.object({
        file_path: z.string().describe('要读取的文件路径'), // 限制输入参数的结构和含义
    }),
});

// 4. 将工具放入数组
const tools = [readFileTool];

/**
 * API 解析：model.bindTools(tools)
 * 作用：将我们定义好的工具“绑定”到大模型上。
 * 原理：它会将你的工具 schema（参数、名字、描述）自动转换成大模型 API 能够识别的格式（如 OpenAI 规范的 json schema），
 *      然后和模型进行绑定。绑定后，返回一个新的 `modelWithTools` 实例。后续我们调用这个实例时，
 *      大模型就会知道有这些工具可用，并且会主动决定是否要发起工具调用请求。
 */
const modelWithTools = model.bindTools(tools);

// 5. 初始化对话消息历史
const messages = [
    // 系统的角色设定和工作流程规范
    new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。

工作流程：
1. 用户要求读取文件时，立即调用 read_file 工具
2. 等待工具返回文件内容
3. 基于文件内容进行分析 and 解释

可用工具：
- read_file: 读取文件内容（使用此工具来获取文件内容）`),
    
    // 用户的请求提问
    new HumanMessage(`请读取 src/tool-file-read.mjs 文件内容，并解释代码。`),
];

console.log("=== 流程 1: 发送初始请求给大模型 ===");

/**
 * API 解析：invoke(input)
 * 作用：这是 LangChain 的核心概念 LCEL (LangChain Expression Language) 中的标准方法。
 *       所有的 LangChain 可运行组件 (Runnable)，包括大模型、工具、链等，都实现了 `invoke` 方法，表示“单次调用/执行”。
 * 
 * 在这里：
 *   - 对于 `modelWithTools` (大模型对象)：`invoke(messages)` 表示将消息历史发送给模型，让模型产生一次回复。
 *     它会返回一个 `AIMessage`（包含模型生成的文本，或者模型请求的工具调用参数）。
 */
let response = await modelWithTools.invoke(messages);

// 打印大模型的初始响应（此时 response 只有 tool_calls，没有正文 content）
console.log("\n[大模型初始响应]:");
console.log(JSON.stringify({
    content: response.content,
    tool_calls: response.tool_calls,
    finish_reason: response.response_metadata.finish_reason
}, null, 2));

// 7. 判断大模型是否提出了工具调用请求，如果是，则循环执行工具
if (response.tool_calls && response.tool_calls.length > 0) {
    console.log("\n=== 流程 2: 大模型请求调用工具，开始执行本地代码 ===");
    
    // 将大模型的这次包含 tool_calls 的 AIMessage 存入消息历史中
    messages.push(response);

    // 循环处理大模型要求调用的每一个工具
    for (const toolCall of response.tool_calls) {
        if (toolCall.name === "read_file") {
            try {
                /**
                 * API 解析：tool.invoke(args)
                 * 作用：对于“工具对象” (tool)，调用 `invoke` 方法意味着“运行该工具的代码逻辑”。
                 * 参数：
                 *   - 大模型在回复里提供好的参数对象（即 toolCall.args，例如 `{ file_path: "src/tool-file-read.mjs" }`）。
                 * 
                 * 在这里：
                 *   - `readFileTool.invoke(toolCall.args)` 会去异步执行上面定义的 fs.readFile 读取文件，并返回读取的内容。
                 */
                const toolResult = await readFileTool.invoke(toolCall.args);
                
                // 7.2 将工具的执行结果封装为 ToolMessage 存入消息历史
                // ToolMessage 是 LangChain 中专门用来装载工具返回值的消息类型，模型必须看到它才知道工具的运行结果。
                messages.push(new ToolMessage({
                    content: toolResult,
                    tool_call_id: toolCall.id, // 用 tool_call_id 与大模型的调用请求进行配对
                }));
            } catch (error) {
                messages.push(new ToolMessage({
                    content: `读取文件失败: ${error.message}`,
                    tool_call_id: toolCall.id,
                }));
            }
        }
    }

    console.log("\n=== 流程 3: 将工具执行结果传回大模型，获取最终回答 ===");
    // 8. 带着完整的消息历史（已包含工具返回的数据）再次 invoke 调用大模型
    const finalResponse = await modelWithTools.invoke(messages);
    
    console.log("\n====== 大模型最终回答 ======");
    console.log(finalResponse.content);
} else {
    // 如果大模型觉得不需要调用工具，则直接输出普通回复
    console.log("\n=== 流程 2: 大模型未请求调用工具 ===");
    console.log("\n====== 大模型最终回答 ======");
    console.log(response.content);
}