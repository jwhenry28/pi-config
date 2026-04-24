export interface RosettaToolConfig {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface RosettaConfig {
  name: string;
  executor: "python3";
  entrypoint: string;
  tools: RosettaToolConfig[];
}

export interface RosettaLoadedExtension {
  name: string;
  directory: string;
  entrypoint: string;
  tools: RosettaToolConfig[];
}
