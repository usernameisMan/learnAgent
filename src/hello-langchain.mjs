import { ChatOpenAI } from '@langchain/openai';
import dotenv from 'dotenv';

// 默认是node调用的位置查找 .env 这个方法内部是运行的 process.cwd() 
dotenv.config();

const model = new ChatOpenAI({
    modelName: "qwen-coder-turbo",
    apiKey: process.env.ALIYUN_API_KEY,
    configuration: {
        baseURL: process.env.ALIYUN_BASE_URL,
    },
});

const response = await model.invoke("介绍下自己");
console.log(response.content);