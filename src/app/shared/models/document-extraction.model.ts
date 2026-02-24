export interface ExtractedMarksheetData {
    personalInfo: {
        firstName: string;
        middleName: string;
        lastName: string;
        mothersName: string;
        gender: 'Male' | 'Female' | '';
    };
    academicInfo: {
        board: string;
        passingYear: number;
        subjects: Array<{
            name: string;
            marks: number;
        }>;
        totalMarks: number;
        percentage: number;
    };
}

export interface DocumentVerification {
    isValid: boolean;
    confidence: number;
    documentType: string;
    reason: string;
}

export interface ExtractionResponse {
    success: boolean;
    data?: ExtractedMarksheetData;
    error?: string;
    rawResponse?: string;
}

export interface VerificationResponse {
    success: boolean;
    verification?: DocumentVerification;
    error?: string;
}
