import { existsSync, mkdirSync, copyFileSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import { writeKey, deleteEntry } from "../memory/store.js";
import { findEntry } from "./registry.js";
import { createWrapper, validateSkillTarget, removeWrapper } from "../plugin/wrapper.js";
import { getPluginsDir } from "../shared/home.js";
import { WORKFLOWS_DIR } from "../shared/paths.js";
import type { ApplyResult, ConfigFile, ConfigExecutionContext } from "./types.js";

export function applyConfigFile(file: ConfigFile, ctx: ConfigExecutionContext): ApplyResult {
  const warnings: string[] = [];
  const updatedKeys: string[] = [];
  const skills: string[] = [];
  const workflows: string[] = [];

  if (file.configs) {
    applyConfigs(file, ctx, updatedKeys, warnings);
  }

  if (file.skills) {
    applySkills(file, ctx, skills, warnings);
  }

  if (file.workflows) {
    applyWorkflows(file, ctx, workflows, warnings);
  }

  writeKey(ctx.cwd, ctx.storeName, "active-config", file.name);

  return {
    updatedKeys,
    skills,
    workflows,
    warnings,
    needsReload: skills.length > 0 || workflows.length > 0,
  };
}

function applyConfigs(
  file: ConfigFile,
  ctx: ConfigExecutionContext,
  updatedKeys: string[],
  warnings: string[],
): void {
  for (const entry of file.configs!) {
    const registryEntry = findEntry(entry.name);
    if (!registryEntry) {
      warnings.push(`Unknown config key: ${entry.name} (skipped)`);
      continue;
    }

    if (registryEntry.validator) {
      registryEntry.validator(entry.value, ctx);
    }

    writeKey(ctx.cwd, ctx.storeName, entry.name, entry.value);
    updatedKeys.push(entry.name);
  }
}

function applySkills(
  file: ConfigFile,
  ctx: ConfigExecutionContext,
  addedSkills: string[],
  warnings: string[],
): void {
  for (const skill of file.skills!) {
    const skillName = skill.location.split("/").pop()!;
    const absolutePath = join(getPluginsDir(), skill.location);

    const validationError = validateSkillTarget(absolutePath);
    if (validationError) {
      warnings.push(`Skill "${skillName}": ${validationError}`);
      continue;
    }

    try {
      createWrapper(ctx.cwd, skillName, skill.location, skill.module);
      addedSkills.push(skillName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Skill "${skillName}": ${msg}`);
    }
  }
}

function applyWorkflows(
  file: ConfigFile,
  ctx: ConfigExecutionContext,
  addedWorkflows: string[],
  warnings: string[],
): void {
  for (const wf of file.workflows!) {
    const filename = basename(wf.location);
    const source = join(getPluginsDir(), wf.location);
    const destDir = join(ctx.cwd, WORKFLOWS_DIR);
    const dest = join(destDir, filename);

    if (!existsSync(source)) {
      warnings.push(`Workflow "${filename}": source not found at ${source}`);
      continue;
    }

    if (existsSync(dest)) {
      warnings.push(`Workflow "${filename}": already exists in ${WORKFLOWS_DIR}/`);
      continue;
    }

    mkdirSync(destDir, { recursive: true });
    copyFileSync(source, dest);
    addedWorkflows.push(filename);
  }
}

export function unapplyConfigFile(file: ConfigFile, ctx: ConfigExecutionContext): ApplyResult {
  const warnings: string[] = [];
  const updatedKeys: string[] = [];
  const skills: string[] = [];
  const workflows: string[] = [];

  if (file.configs) {
    unapplyConfigs(file, ctx, updatedKeys);
  }

  if (file.skills) {
    unapplySkills(file, ctx, skills, warnings);
  }

  if (file.workflows) {
    unapplyWorkflows(file, ctx, workflows, warnings);
  }

  deleteEntry(ctx.cwd, ctx.storeName, "active-config");

  return {
    updatedKeys,
    skills,
    workflows,
    warnings,
    needsReload: skills.length > 0 || workflows.length > 0,
  };
}

function unapplyConfigs(
  file: ConfigFile,
  ctx: ConfigExecutionContext,
  updatedKeys: string[],
): void {
  for (const entry of file.configs!) {
    deleteEntry(ctx.cwd, ctx.storeName, entry.name);
    updatedKeys.push(entry.name);
  }
}

function unapplySkills(
  file: ConfigFile,
  ctx: ConfigExecutionContext,
  removedSkills: string[],
  warnings: string[],
): void {
  for (const skill of file.skills!) {
    const skillName = skill.location.split("/").pop()!;
    try {
      removeWrapper(ctx.cwd, skillName);
      removedSkills.push(skillName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Skill "${skillName}": ${msg}`);
    }
  }
}

function unapplyWorkflows(
  file: ConfigFile,
  ctx: ConfigExecutionContext,
  removedWorkflows: string[],
  warnings: string[],
): void {
  for (const wf of file.workflows!) {
    const filename = basename(wf.location);
    const dest = join(ctx.cwd, WORKFLOWS_DIR, filename);

    if (!existsSync(dest)) {
      warnings.push(`Workflow "${filename}": not found in ${WORKFLOWS_DIR}/`);
      continue;
    }

    unlinkSync(dest);
    removedWorkflows.push(filename);
  }
}
