import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ExtractionResponse, VerificationResponse } from '../models/document-extraction.model';

@Injectable({
    providedIn: 'root'
})
export class DocumentExtractionService {

    private readonly API_URL = 'http://localhost:3000/api';

    constructor(private http: HttpClient) { }

    /**
     * Extract data from HSC marksheet image
     */
    extractMarksheetData(file: File): Observable<ExtractionResponse> {
        const formData = new FormData();
        formData.append('document', file);

        return this.http.post<ExtractionResponse>(`${this.API_URL}/extract-marksheet`, formData)
            .pipe(
                catchError(error => {
                    console.error('Extraction error:', error);
                    return throwError(() => new Error(error.error?.error || 'Failed to extract data from document'));
                })
            );
    }

    /**
     * Verify if uploaded document is of expected type
     */
    verifyDocument(file: File, expectedType: string = 'HSC Marksheet'): Observable<VerificationResponse> {
        const formData = new FormData();
        formData.append('document', file);
        formData.append('expectedType', expectedType);

        return this.http.post<VerificationResponse>(`${this.API_URL}/verify-document`, formData)
            .pipe(
                catchError(error => {
                    console.error('Verification error:', error);
                    return throwError(() => new Error(error.error?.error || 'Failed to verify document'));
                })
            );
    }

    /**
     * Check backend health and Ollama connection
     */
    checkHealth(): Observable<any> {
        return this.http.get(`${this.API_URL}/health`)
            .pipe(
                catchError(error => {
                    console.error('Health check error:', error);
                    return throwError(() => new Error('Backend service is not available'));
                })
            );
    }
}
