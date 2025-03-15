export interface LLM{
    name: string;
    apiUrl: string;
    apiKey: string;
    supportsImage?: boolean;
}

export type AnswerChoice = {
    letter?: string;
    text: string;
    isCorrect: boolean;
}

export enum AnswerType {
    CORRECT = "CORRECT",
    INCORRECT = "INCORRECT",
    UNDETERMINED = "UNDETERMINED"
}

//Represents an individual question in a set
export interface Question {
    question: string;
    answers: AnswerChoice[];
    givenFullAnswer?: string;
    givenParsedAnswer?: string;
    givenReasoning?: string;
    grade?: AnswerType;
}

//Represents a set of questions relating to a map image and world description.
export interface QuestionSet {
    imageName: string;
    worldDescription: string;
    questions: Question[];
}