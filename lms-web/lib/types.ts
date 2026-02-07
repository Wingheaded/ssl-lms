// Firestore collection types for SSL LMS MVP

export interface User {
    name: string;
    email: string;
    createdAt: Date;
}

export interface Brand {
    id: string;
    name: string;
    description?: string;
    order: number;
}

export interface MediaFile {
    id: string;
    type: "video" | "audio" | "pdf" | "youtube";
    url: string;
    fileName: string;
    title?: string;
    storagePath?: string; // Explicit path for robust deletion
    uploadedAt: Date;
}

export interface Training {
    id: string;
    brandId: string;
    title: string;
    description: string;
    mediaFiles?: MediaFile[];        // Multiple files supported
    mediaType?: "video" | "audio" | "pdf";  // Legacy: primary type
    mediaUrl?: string;               // Legacy: single file URL
    mediaDriveUrl?: string;          // Legacy: Google Drive URL
    thumbnailUrl?: string;
    isActive: boolean;
    createdAt: Date;
    transcript?: string;
}

export interface Quiz {
    id: string;
    trainingId: string;
    passingScore: number;
}

export interface QuizQuestion {
    id: string;
    quizId: string;
    question: string;
    type: "multiple_choice" | "true_false";
}

export interface QuizAnswer {
    id: string;
    questionId: string;
    answerText: string;
    // isCorrect is never sent to client - server-side only
}

export interface Progress {
    id: string;
    userId: string;
    trainingId: string;
    watched: boolean;
    score: number | null;
    passed: boolean;
    completedAt: Date | null;
}

// Status derived from Progress for UI
export type TrainingStatus = "not_started" | "in_progress" | "failed" | "passed";

export function getTrainingStatus(progress?: Progress): TrainingStatus {
    if (!progress) return "not_started";
    if (!progress.watched) return "in_progress";
    if (progress.score === null) return "in_progress";
    return progress.passed ? "passed" : "failed";
}
