import OpenAI from "openai";
import {LLM} from "./DataTypes";

const modelPrompt: string = "You are an expert at answering questions about a tile based world. The user will provide you with a in depth description " +
    "of a tile based game world and a multiple choice question about it. You are to take in the question and provided answers and choose the one that seems the most correct. " +
"Respond with ONLY the letter of the answer you think is correct. NEVER EVER elaborate on your decision or provide reasoning." + "For each wrong answer you will be fined 100 dollars. ";

export async function getLLMCompletion(Client: OpenAI, LLMInfo: LLM, question: string, imageBase64?: string): Promise<string> {
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
    
    //strip out any data between <think> tags
    response = response.replace(/<think>.*?<\/think>/g, '');
    
    return response;
}
