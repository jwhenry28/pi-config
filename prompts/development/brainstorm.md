Brainstorm with the user to flesh out all the details of their feature.
The workflow's canonical prompt is stored in the workflow memory store
under the key `workflow-prompt`. Use the workflow ID from the
"Workflow:" line at the top of this message as the memory domain if you
need to read or update that prompt.

During brainstorming:
- clarify the user's real goal
- explore alternatives when helpful
- converge on the best design
- write the design document that reflects the validated plan

After finishing brainstorming:
1. Store the location of your design document to the memory store under
   the key `design-doc`
2. Re-check whether anything uncovered during brainstorming materially
   changed the nature of the original prompt
3. If the intended work changed in a way that could confuse later steps,
   read the current `workflow-prompt`, revise only the inaccurate or
   missing parts, and save the updated prompt back under
   `workflow-prompt`
4. If brainstorming only added detail and did not materially change the
   intended work, leave `workflow-prompt` unchanged
