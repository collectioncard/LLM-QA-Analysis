import { AnswerChoice, AnswerType } from "./DataTypes";
    
    function normalizeAnswer(answer: string): string {
        return answer.trim().toLowerCase();
    }
    
    export function classifyResponse(response: string, answers: AnswerChoice[]): AnswerType {
        const normalizedResponse = normalizeAnswer(response);
        const words = new Set(normalizedResponse.split(/\W+/));
        
        const correctAnswers = new Set(
            answers.filter(a => a.isCorrect).flatMap(a => [a.letter ? normalizeAnswer(a.letter) : '', normalizeAnswer(a.text)])
        );
        const incorrectAnswers = new Set(
            answers.filter(a => !a.isCorrect).flatMap(a => [a.letter ? normalizeAnswer(a.letter) : '', normalizeAnswer(a.text)])
        );
        
        const detectedAnswers = [...words].filter(word => correctAnswers.has(word) || incorrectAnswers.has(word));
    
        if (detectedAnswers.length > 0) {
            if (detectedAnswers.some(ans => incorrectAnswers.has(ans))) {
                return AnswerType.INCORRECT;
            }
            return AnswerType.CORRECT;
        }
        
        return AnswerType.UNDETERMINED;
    }