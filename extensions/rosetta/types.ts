export interface RosettaToolConfig {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  argv: string[];
}

export interface RosettaCommandSubcommandConfig {
  name: string;
  description?: string;
  argv: string[];
  input_schema: Record<string, unknown>;
  usage?: string;
}

export interface RosettaCommandConfig {
  name: string;
  description: string;
  subcommands: RosettaCommandSubcommandConfig[];
}

export interface RosettaConfig {
  name: string;
  module: string;
  executor: "python3";
  entrypoint: string;
  tools: RosettaToolConfig[];
  commands?: RosettaCommandConfig[];
}

export interface RosettaLoadedExtension {
  name: string;
  module: string;
  directory: string;
  entrypoint: string;
  tools: RosettaToolConfig[];
  commands: RosettaCommandConfig[];
}
