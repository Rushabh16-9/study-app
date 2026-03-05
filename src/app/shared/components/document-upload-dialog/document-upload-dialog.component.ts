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
    imagePreviewUrl: string | ArrayBuffer | null = null;
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
            if (this.selectedFile.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => this.imagePreviewUrl = reader.result;
                reader.readAsDataURL(this.selectedFile);
            }
            this.extractData();
        }
    }

    onFileSelected(event: any): void {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            this.selectedFile = file;
            this.extractionError = '';
            this.verificationFailed = false;

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = e => this.imagePreviewUrl = reader.result;
                reader.readAsDataURL(file);
            } else {
                this.imagePreviewUrl = null;
            }

            // Auto-start extraction and verification
            this.extractData();
        }
    }

    extractData(): void {
        if (!this.selectedFile) return;

        this.isExtracting = true;
        this.isVerifying = true;
        this.verificationMessage = 'Verifying and extracting data...';
        this.extractionError = '';

        this.extractionService.extractMarksheetData(this.selectedFile, this.data.document_name).subscribe({
            next: (response) => {
                this.isExtracting = false;
                this.isVerifying = false;

                if (response.success && response.data) {
                    this.verificationMessage = `✓ Verified as ${this.data.document_name}`;
                    this.extractedData = response.data;
                    console.log('Extracted data:', this.extractedData);
                } else {
                    this.verificationFailed = true;
                    this.verificationMessage = '✗ Verification failed';
                    this.extractionError = response.error || 'Failed to extract data from document.';
                }
            },
            error: (error) => {
                this.isExtracting = false;
                this.isVerifying = false;
                this.verificationFailed = true;
                this.verificationMessage = '✗ Invalid Document';
                // The error message comes straight from the backend (Gemini's invalidReason)
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
            this.extractData();
        }
    }
}
