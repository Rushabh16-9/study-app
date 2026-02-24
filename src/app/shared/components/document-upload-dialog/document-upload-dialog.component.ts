import { Component, Inject, OnInit } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import * as globalFunctions from 'app/global/globalFunctions';
import { DocumentExtractionService } from 'app/shared/services/document-extraction.service';
import { ExtractedMarksheetData } from 'app/shared/models/document-extraction.model';

@Component({
    selector: 'app-document-upload-dialog',
    templateUrl: './document-upload-dialog.component.html',
    styleUrls: ['./document-upload-dialog.component.css']
})
export class DocumentUploadDialogComponent implements OnInit {

    selectedFile: File | null = null;
    isExtracting: boolean = false;
    isVerifying: boolean = false;
    extractedData: ExtractedMarksheetData | null = null;
    verificationFailed: boolean = false;
    verificationMessage: string = '';
    extractionError: string = '';

    constructor(
        public dialogRef: MatDialogRef<DocumentUploadDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { document_name: string, document_id: number, file?: File },
        private extractionService: DocumentExtractionService
    ) {
        // Prevent closing by clicking outside or escape
        dialogRef.disableClose = true;
    }

    ngOnInit(): void {
        if (this.data.file) {
            this.selectedFile = this.data.file;
            this.processDocument();
        }
    }

    onFileSelected(event: any): void {
        if (event.target.files && event.target.files.length > 0) {
            this.selectedFile = event.target.files[0];
            this.extractionError = '';
            this.verificationFailed = false;

            // Auto-start extraction and verification
            this.processDocument();
        }
    }

    processDocument(): void {
        if (!this.selectedFile) return;

        // Step 1: Verify document type
        this.isVerifying = true;
        this.verificationMessage = 'Verifying document type...';

        this.extractionService.verifyDocument(this.selectedFile, this.data.document_name).subscribe({
            next: (response) => {
                this.isVerifying = false;

                if (response.success && response.verification) {
                    if (response.verification.isValid && response.verification.confidence > 60) {
                        this.verificationMessage = `✓ Verified as ${response.verification.documentType}`;
                        // Step 2: Extract data
                        this.extractData();
                    } else {
                        this.verificationFailed = true;
                        this.verificationMessage = `✗ ${response.verification.reason}`;
                        this.extractionError = `This doesn't appear to be a valid ${this.data.document_name}. Please upload the correct document.`;
                    }
                } else {
                    this.verificationFailed = true;
                    this.extractionError = 'Failed to verify document type.';
                }
            },
            error: (error) => {
                this.isVerifying = false;
                this.verificationFailed = true;
                this.extractionError = 'Verification service unavailable. Please ensure the backend is running.';
                console.error('Verification error:', error);
            }
        });
    }

    extractData(): void {
        if (!this.selectedFile) return;

        this.isExtracting = true;
        this.extractionError = '';

        this.extractionService.extractMarksheetData(this.selectedFile).subscribe({
            next: (response) => {
                this.isExtracting = false;

                if (response.success && response.data) {
                    this.extractedData = response.data;
                    console.log('Extracted data:', this.extractedData);
                } else {
                    this.extractionError = response.error || 'Failed to extract data from document.';
                }
            },
            error: (error) => {
                this.isExtracting = false;
                this.extractionError = error.message || 'Extraction service unavailable. Please ensure the backend is running.';
                console.error('Extraction error:', error);
            }
        });
    }

    submit(): void {
        if (this.selectedFile && this.extractedData) {
            this.dialogRef.close({
                success: true,
                document_id: this.data.document_id,
                file: this.selectedFile,
                extractedData: this.extractedData
            });
        }
    }

    retryExtraction(): void {
        this.extractionError = '';
        this.verificationFailed = false;
        this.extractedData = null;
        if (this.selectedFile) {
            this.processDocument();
        }
    }
}
