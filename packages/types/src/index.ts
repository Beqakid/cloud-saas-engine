/**
 * @cloud-saas-engine/types
 *
 * Shared type definitions for the entire platform.
 * This package is the single source of truth for data shapes.
 */

// Environment / bindings
export type { Env } from "./env";

// Import pipeline domain
export type {
  ImportJob,
  ImportRow,
  ImportJobStatus,
  ImportRowStatus,
  CreateImportJob,
  CreateImportRow,
} from "./import";

// Queue / event messages
export type { ImportQueueMessage } from "./events";

// Church domain
export type {
  Donor,
  CreateDonor,
  UpdateDonor,
  Fund,
  CreateFund,
  UpdateFund,
  Donation,
  CreateDonation,
  UpdateDonation,
  DonationMethod,
} from "./church";

// API response shapes
export type {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  PaginatedList,
} from "./api";
