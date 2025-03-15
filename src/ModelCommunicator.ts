import OpenAI from "openai";
import {LLM} from "./DataTypes";

const modelPrompt: string =  `
You are an expert in tile-based game worlds. The user will provide a detailed description of a tile-based world and a multiple-choice question about it. Your task is to analyze the question and available answers, then select the most correct option.

- If a field has a specified width or height, its coordinates represent the top-left corner.
- Respond ONLY with the letter of the correct answer.
- If reasoning is necessary, enclose it in <think></think> tags. Otherwise, output ONLY the answer letter.
- Each incorrect answer results in a $100 fine.
`.trim();

export async function getLLMCompletion(Client: OpenAI, LLMInfo: LLM, question: string, imageBase64?: string): Promise<{
    parsedResponse: string;
    response: string
    reasoningContent?: string;
}> {
    const messages: any[] = [
        {
            role: "system",
            content: modelPrompt, 
        },
        {
            role: "user",
            content: [{ type: "text", text: question }],
        }
    ];

    // Add the context image if it exists
    if (imageBase64) {
        (messages[1].content as any[]).push({
            type: "image_url",
            image_url: { url: `data:image/png;base64,${imageBase64}` },
        });
    }

    // Call out to the LLM
    const completion = await Client.chat.completions.create({
        model: LLMInfo.name,
        messages: messages,
        store: false
    });
    
    let response = completion.choices[0].message.content;
    if (!response) {
        response = "No Answer Provided";
    }
    
    let reasoningContent: string | undefined;
    //TODO: Refine this
    if (completion.choices[0].message.reasoning_content) {
        reasoningContent = completion.choices[0].message.reasoning_content;
    }
    
    
    //strip out any data between <think> tags
    let parsedResponse = response.replace(/<think>.*?<\/think>/g, '');
    
    return {parsedResponse, response, reasoningContent};
}
