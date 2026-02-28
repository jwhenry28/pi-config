---
name: brainstorming
description: Use when creating or developing, before writing code or implementation plans - refines rough ideas into fully-formed designs through collaborative questioning, alternative exploration, and incremental validation. Don't use during clear 'mechanical' processes
module: development
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right so far.

## The Process

**Understanding the idea:**

- Check out the current project state first (files, docs, recent commits)
- **Ask all your questions in a single message** - detailed and well-structured
  - Group related questions under clear headings or numbered sections
  - Each question should be specific enough to get a useful answer
  - Prefer multiple choice questions when possible, but open-ended is fine too
  - Let answers inform and reshape your follow-up questions
- Focus on understanding: purpose, constraints, success criteria

**Exploring approaches:**

- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**

- Once you believe you understand what you're building, present the design
- Break it into sections of 200-300 words
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

## After the Design

**Documentation:**

- Write the validated design to `plans/<topic>/design.md`
- Write clearly and concisely
- Do NOT commit the design to git

**Implementation (if continuing):**

- Ask: "Ready to set up for implementation?"
- Create a detailed implementation plan from the design

## Key Principles

- **All questions at once, well-structured** - Group and detail all questions in a single message
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense

## Structuring Questions Well

**❌ BAD - Vague, unstructured dump:**
"What about pausing? And menus? And triggers?"

**✅ GOOD - Detailed, well-organized:**
"I have a few questions about the pause system:

1. **World behavior:** When the player pauses, should the world freeze completely, or should some visual elements (particles, ambient animation) continue?
   - A) Full freeze
   - B) Cosmetic-only animation continues
   - C) Something else?

2. **Menu options:** What actions should be available from the pause menu?
   - A) Resume, Settings, Quit
   - B) Resume, Save, Settings, Quit
   - C) Other?

3. **Trigger:** How should the player open the pause menu?
   - A) Escape key only
   - B) Escape key + UI button"

**The key:** Each question should be specific, provide context, and offer options when possible.
