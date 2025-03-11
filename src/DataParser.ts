import * as fs from "node:fs";
import path from "node:path";
import {AnswerChoice, Question, QuestionSet} from "./DataTypes";
import csvParser from "csv-parser";

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function warn(fileName: string, message: string) {
    console.warn(`Warning in file "${fileName}": ${message}`);
}

export async function getQAData(): Promise<QuestionSet[]> {
    let questionData: QuestionSet[] = [];

    const workingDir = './QA_Data';
    const files: string[] = fs.readdirSync(workingDir);

    const processingPromises: Promise<void>[] = [];

    files.forEach(file => {
        const ext: string = path.extname(file);
        const base = path.basename(file, ext);

        if (ext === '.txt'){
            const filePath = path.join(workingDir, file);
            const worldDescription = fs.readFileSync(filePath, 'utf8');
            const imageName = `${base}.png`;
            const csvFilePath = path.join(workingDir, `${base}.csv`);

            if (fs.existsSync(csvFilePath)) {
                const promise = new Promise<void>((resolve) => {
                    const questions: Question[] = [];
                    fs.createReadStream(csvFilePath)
                        .pipe(csvParser())
                        .on('data', (row) => {
                            let distractors: string[] = row.Distractors.split('; ');
                            let answers: AnswerChoice[] = distractors.map((distractor, index) => {
                                return {
                                    text: distractor,
                                    isCorrect: row.Answer === distractor
                                };
                            });

                            answers.push({
                                text: row.Answer,
                                isCorrect: true
                            });

                            if (answers.length !== 4) {
                                warn(file, `Question "${row.Question}" does not have exactly 4 answers.`);
                            }

                            const answerTexts = answers.map(answer => answer.text.toLowerCase());
                            const uniqueAnswerTexts = new Set(answerTexts);
                            if (uniqueAnswerTexts.size !== answerTexts.length) {
                                warn(file, `Question "${row.Question}" has repeated answers.`);
                            }

                            answers = shuffleArray(answers);
                            answers.forEach((answer, index) => {
                                answer.letter = String.fromCharCode(65 + index);
                            });

                            questions.push({
                                question: row.Question,
                                answers: answers,
                            });
                        })
                        .on('end', () => {
                            questionData.push({
                                imageName,
                                questions,
                                worldDescription
                            });
                            resolve();
                        });
                });
                processingPromises.push(promise);
            }
        }
    });

    await Promise.all(processingPromises);

    questionData.sort((a, b) => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare(a.imageName, b.imageName));
    return questionData;
}