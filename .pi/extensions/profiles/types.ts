export interface WorkflowModels {
  smart?: string;
  general?: string;
  fast?: string;
  [key: string]: unknown;
}

export interface Profile {
  name: string;
  description?: string;
  workflow_models?: WorkflowModels;
  [key: string]: unknown;
}

export interface ProfileFile {
  basename: string;
  filename: string;
  path: string;
}

export interface ParsedProfile {
  profile: Profile;
  warnings: string[];
}

export interface ApplyResult {
  updatedKeys: string[];
  warnings: string[];
}
