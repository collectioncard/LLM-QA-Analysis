import dotenv from "dotenv";
import {AnswerType, LLM, Question, QuestionSet} from "./DataTypes";
import {select, confirm} from '@inquirer/prompts';
import {getQAData} from "./DataParser";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import {getLLMCompletion} from "./ModelCommunicator";
import {classifyResponse} from "./AnswerValidator";
import cliProgress from "cli-progress";

dotenv.config();

const supportedModels: LLM[] = [
    { name: 'gpt-4o-mini', apiUrl: process.env.OPENAI_URL!, apiKey: process.env.OPENAI_API_KEY!, supportsImage : true },
    { name: "llama3.2:1b", apiUrl: process.env.LOCAL_URL!, apiKey: process.env.LOCAL_KEY! },
];

function formatQuestion(worldFacts: string, question: Question): string {
    
    const formattedQuestion: string = "Here is the map description: \n" 
        + worldFacts 
        + "\n\n" 
        + "Answer this question: "
        + question.question
        + "\n"
        + `${question.answers.map((answer, index) => `${String.fromCharCode(65 + index)}) ${answer.text}`).join("\n")}`
        + "\n";
    
    return formattedQuestion;
}

function img2base64(imgPath: string): string {
    const imageBuffer = fs.readFileSync(imgPath);
    return imageBuffer.toString('base64');
}

async function selectOptions() {
    
    //MODEL SELECTION
    const choices: string[] = supportedModels.map(model => model.name);
    const selection: string = await select({
        message: 'Select a model to test:',
        choices
    })
    const model: LLM | undefined = supportedModels.find(model => model.name === selection);
    
    if (!model || !model.apiUrl || !model.apiKey) {
        console.error("Sorry, that model is incorrectly configured. Please check your .env file.\n");
        return selectOptions();
    }
    
    //if that model has a run json, ask to continue where it left off
    let continueRun: boolean = false;
    if (fs.existsSync(`results_${model.name.replace(/\//g, '_')}.json`)) {
        continueRun = await confirm({
            message: 'A results file exists for this model. Continue where you left off?',
        });
        if (!continueRun) {
            const confirmDel = await confirm({
                message: 'This will delete the existing results file. Are you sure you want to continue?',
            });
            if (confirmDel) {
                fs.unlinkSync(`results_${model.name.replace(/\//g, '_')}.json`);
            }else {
                return selectOptions();
            }
        }
    }
    
    //if the model supports images, ask if they want to use them
    let useImages: boolean = false;
    if (model.supportsImage) {
        useImages = await confirm({
            message: 'This model supports images. Would you like to use them?',
        });
    }
    
    return {model, continueRun, useImages};
}

async function main() {
    // Select model and other options
    const {model, continueRun, useImages} = await selectOptions();
    
    // Load questions
    let QA_Set: QuestionSet[];
    console.log("\n");
    if (continueRun && fs.existsSync(`results_${model.name.replace(/\//g, '_')}.json`)) {
        console.log("Loading existing results file...");
        QA_Set = JSON.parse(fs.readFileSync(`results_${model.name.replace(/\//g, '_')}.json`, 'utf8'));
    } else {
        console.log("Loading new question sets...");
        QA_Set = await getQAData();
    }
    const numQuestions: number = QA_Set.reduce((acc, set) => acc + set.questions.length, 0);
    console.log("[DataParser]: Successfully loaded", QA_Set.length, "question sets with a total of", numQuestions, "questions.\n");

    const apiClient = new OpenAI({
        baseURL: model.apiUrl,
        apiKey: model.apiKey
    });
    
    //Test it!
    let numCorrect: number = 0;
    let numTested: number = 0;
    let numFlagged: number = 0;
    
    const progressBar = new cliProgress.SingleBar({
        format: 'Answering Questions |' + '{bar}' + '| {percentage}% || {value}/{total} Questions || ETA: {eta} seconds',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);
    progressBar.start(numQuestions, 0);
    
    for (const qSet of QA_Set) {
        let imageBase64: string | undefined;
        if (useImages) {
            imageBase64 = fs.existsSync(path.join('data', qSet.imageName)) ? img2base64(path.join('data', qSet.imageName)) : undefined;  
        }
        
        for (const q of qSet.questions) {
            //skip questions that have already been answered
            if (q.givenAnswer && q.grade) {
                numTested++;
                if (q.grade == AnswerType.CORRECT){
                    numCorrect++;
                } else if (q.grade == AnswerType.UNDETERMINED){
                    numFlagged++;
                }
                progressBar.update(numTested);
                continue;
            }
            
            let formattedQuestion = formatQuestion(qSet.worldDescription, q);
            let llmResponse = await getLLMCompletion(apiClient, model, formattedQuestion, imageBase64);
            
            q.givenAnswer = llmResponse;
            q.grade = classifyResponse(llmResponse, q.answers);
            
            if (q.grade == AnswerType.CORRECT){
                numCorrect++;
            } else if (q.grade == AnswerType.UNDETERMINED){
                numFlagged ++;
            }
            
            numTested++;
            progressBar.update(numTested);
            
            fs.writeFileSync(`results_${model.name.replace(/\//g, '_')}.json`, JSON.stringify(QA_Set, null, 2));
        }
    }
    progressBar.stop();
    
    console.log("\n\n____============Finished answering questions============____");
    console.log(`${numCorrect} out of ${numTested} questions answered correctly.`);
    console.log(`${numFlagged} questions flagged for review.`);
    console.log(`Results saved to results_${model.name.replace(/\//g, '_')}.json`)
}

main();
