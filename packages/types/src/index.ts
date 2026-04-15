/** Standard health check response */
export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: string;
}

/** Import job status */
export type JobStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';

/** Import job record */
export interface ImportJob {
  id: string;
  fileId: string;
  fileName: string;
  status: JobStatus;
  totalRows?: number;
  processedRows?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
