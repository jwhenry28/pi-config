// run-workflow.go - Run Pi workflows from cronjobs via RPC mode
//
// Usage:
//   go run scripts/run-workflow.go <workflow-name> <prompt>
//
// Example:
//   go run scripts/run-workflow.go daily-report "Generate a summary of yesterday's commits"
//
// Environment variables (can be set in .env file at repo root):
//   - ANTHROPIC_API_KEY, OPENAI_API_KEY, etc. (for model authentication)

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// RPCCommand represents a command sent to Pi
type RPCCommand struct {
	Type string `json:"type"`
	ID   string `json:"id,omitempty"`

	// For prompt command
	Message string `json:"message,omitempty"`
}

// RPCResponse represents a response from Pi
type RPCResponse struct {
	Type    string `json:"type"`
	Command string `json:"command,omitempty"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
	ID      string `json:"id,omitempty"`
}

// AgentEvent represents events streamed from Pi
type AgentEvent struct {
	Type string `json:"type"`

	// For message_update events
	AssistantMessageEvent *AssistantMessageEvent `json:"assistantMessageEvent,omitempty"`

	// For tool_execution events
	ToolName string `json:"toolName,omitempty"`
	Args     map[string]interface{} `json:"args,omitempty"`

	// For agent_end
	Messages []json.RawMessage `json:"messages,omitempty"`
}

// AssistantMessageEvent represents streaming message updates
type AssistantMessageEvent struct {
	Type         string `json:"type"`
	Delta        string `json:"delta,omitempty"`
	ContentIndex int    `json:"contentIndex,omitempty"`
}

// ExtensionUIRequest represents UI requests from extensions
type ExtensionUIRequest struct {
	ID      string `json:"id"`
	Method  string `json:"method"`
	Message string `json:"message,omitempty"`
	Title   string `json:"title,omitempty"`
}

// findRepoRoot finds the repository root by walking up from the script directory
func findRepoRoot() (string, error) {
	execPath, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("failed to get executable path: %w", err)
	}

	startDir := filepath.Dir(execPath)

	for dir := startDir; dir != "/"; dir = filepath.Dir(dir) {
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			return dir, nil
		}

		if _, err := os.Stat(filepath.Join(dir, ".pi")); err == nil {
			if strings.HasSuffix(dir, "pi-config") {
				return dir, nil
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
	}

	return "", fmt.Errorf("could not find repository root")
}

// loadEnvFile loads environment variables from .env file at repo root
func loadEnvFile(repoRoot string) error {
	envPath := filepath.Join(repoRoot, ".env")
	data, err := os.ReadFile(envPath)
	if err != nil {
		return nil
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		if (strings.HasPrefix(value, "\"") && strings.HasSuffix(value, "\"")) ||
			(strings.HasPrefix(value, "'") && strings.HasSuffix(value, "'")) {
			value = value[1 : len(value)-1]
		}

		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}

	fmt.Fprintf(os.Stderr, "[Workflow] Loaded .env from %s\n", envPath)
	return nil
}

// RPCClient manages the connection to Pi in RPC mode
type RPCClient struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout io.ReadCloser
	stderr io.ReadCloser
	reader *bufio.Reader
}

// NewRPCClient creates a new RPC client connected to Pi
func NewRPCClient(repoRoot string) (*RPCClient, error) {
	cmd := exec.Command("pi", "--mode", "rpc", "--no-session")
	cmd.Dir = repoRoot
	cmd.Env = os.Environ()

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start pi: %w", err)
	}

	go io.Copy(os.Stderr, stderr)

	return &RPCClient{
		cmd:    cmd,
		stdin:  stdin,
		stdout: stdout,
		reader: bufio.NewReader(stdout),
	}, nil
}

// Send sends a command to Pi
func (c *RPCClient) Send(cmd RPCCommand) error {
	data, err := json.Marshal(cmd)
	if err != nil {
		return fmt.Errorf("failed to marshal command: %w", err)
	}

	data = append(data, '\n')
	if _, err := c.stdin.Write(data); err != nil {
		return fmt.Errorf("failed to write command: %w", err)
	}

	return nil
}

// ReadEvent reads the next event from Pi
func (c *RPCClient) ReadEvent() (*AgentEvent, error) {
	line, err := c.reader.ReadString('\n')
	if err != nil {
		return nil, err
	}

	var event AgentEvent
	if err := json.Unmarshal([]byte(line), &event); err != nil {
		return nil, fmt.Errorf("failed to unmarshal event: %w", err)
	}

	return &event, nil
}

// ReadEventTimeout reads the next event with a timeout
func (c *RPCClient) ReadEventTimeout(timeout time.Duration) (*AgentEvent, error) {
	type result struct {
		event *AgentEvent
		err   error
	}

	done := make(chan result, 1)
	go func() {
		event, err := c.ReadEvent()
		done <- result{event, err}
	}()

	select {
	case r := <-done:
		return r.event, r.err
	case <-time.After(timeout):
		return nil, fmt.Errorf("timeout")
	}
}

// Close closes the RPC connection
func (c *RPCClient) Close() error {
	c.stdin.Close()
	return c.cmd.Wait()
}

// WorkflowRunner manages running a workflow via RPC
type WorkflowRunner struct {
	client       *RPCClient
	workflowName string
	userPrompt   string
	done         bool
	errorMsg     string
	lastActivity time.Time
	stepActive   bool
}

// NewWorkflowRunner creates a new workflow runner
func NewWorkflowRunner(client *RPCClient, workflowName, userPrompt string) *WorkflowRunner {
	return &WorkflowRunner{
		client:       client,
		workflowName: workflowName,
		userPrompt:   userPrompt,
		done:         false,
		lastActivity: time.Now(),
		stepActive:   false,
	}
}

// Run executes the workflow and waits for completion
func (r *WorkflowRunner) Run() error {
	cmd := RPCCommand{
		Type:    "prompt",
		ID:      "workflow-start",
		Message: fmt.Sprintf("/workflow %s %s", r.workflowName, r.userPrompt),
	}

	if err := r.client.Send(cmd); err != nil {
		return fmt.Errorf("failed to send workflow command: %w", err)
	}

	// Process events until workflow completes
	for !r.done {
		// Use a timeout to detect stalled workflows
		// After agent_end, if no new activity for 15 seconds, assume done
		timeout := 30 * time.Second
		if r.stepActive {
			// Longer timeout while step is actively running
			timeout = 5 * time.Minute
		}

		event, err := r.client.ReadEventTimeout(timeout)
		if err != nil {
			if err.Error() == "timeout" {
				// Check if we should exit
				if !r.stepActive {
					// No active step and no events for 30s - workflow is likely done
					fmt.Fprintf(os.Stderr, "\n[Workflow] No activity detected, assuming completion\n")
					return nil
				}
				// Step was active but timed out - this is an error
				return fmt.Errorf("timeout waiting for step completion")
			}
			if err == io.EOF {
				break
			}
			return fmt.Errorf("failed to read event: %w", err)
		}

		r.lastActivity = time.Now()
		if err := r.handleEvent(event); err != nil {
			return err
		}
	}

	if r.errorMsg != "" {
		return fmt.Errorf("workflow failed: %s", r.errorMsg)
	}

	return nil
}

// handleEvent processes a single event from Pi
func (r *WorkflowRunner) handleEvent(event *AgentEvent) error {
	switch event.Type {
	case "response":
		var resp RPCResponse
		data, _ := json.Marshal(event)
		json.Unmarshal(data, &resp)

		if resp.Type == "response" && resp.ID == "workflow-start" {
			if !resp.Success {
				r.errorMsg = resp.Error
				r.done = true
			}
		}

	case "agent_start":
		r.stepActive = true
		fmt.Fprintf(os.Stderr, "[Workflow] Agent started\n")

	case "agent_end":
		r.stepActive = false
		fmt.Fprintf(os.Stderr, "[Workflow] Step completed\n")

	case "message_update":
		if event.AssistantMessageEvent != nil {
			switch event.AssistantMessageEvent.Type {
			case "text_delta":
				fmt.Print(event.AssistantMessageEvent.Delta)
			case "thinking_delta":
				// Suppress thinking output in cron mode
			case "toolcall_start":
				fmt.Fprintf(os.Stderr, "\n[Tool] ")
			}
		}

	case "tool_execution_start":
		fmt.Fprintf(os.Stderr, "\n[Tool] %s\n", event.ToolName)

	case "auto_compaction_start":
		fmt.Fprintf(os.Stderr, "[Workflow] Compacting context...\n")

	case "auto_retry_start":
		fmt.Fprintf(os.Stderr, "[Workflow] Retrying after error...\n")

	case "extension_ui_request":
		if err := r.handleExtensionUIRequest(event); err != nil {
			return err
		}
	}

	return nil
}

// handleExtensionUIRequest handles UI requests from extensions
func (r *WorkflowRunner) handleExtensionUIRequest(event *AgentEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}

	var uiReq ExtensionUIRequest
	if err := json.Unmarshal(data, &uiReq); err != nil {
		return err
	}

	// Check for workflow completion notification
	if uiReq.Method == "notify" {
		msg := uiReq.Message
		// Workflow completion message looks like: "✅ Workflow "name" complete!"
		if strings.Contains(msg, "Workflow") && strings.Contains(msg, "complete") {
			fmt.Fprintf(os.Stderr, "[Workflow] %s\n", msg)
			r.done = true
			return nil
		}
	}

	// Auto-respond to UI requests
	var response map[string]interface{}

	switch uiReq.Method {
	case "select", "input", "editor":
		response = map[string]interface{}{
			"type":      "extension_ui_response",
			"id":        uiReq.ID,
			"cancelled": true,
		}
	case "confirm":
		response = map[string]interface{}{
			"type":      "extension_ui_response",
			"id":        uiReq.ID,
			"confirmed": false,
		}
	case "notify", "setStatus", "setWidget", "setTitle", "set_editor_text":
		// Fire-and-forget, no response needed
		return nil
	default:
		response = map[string]interface{}{
			"type":      "extension_ui_response",
			"id":        uiReq.ID,
			"cancelled": true,
		}
	}

	respData, err := json.Marshal(response)
	if err != nil {
		return err
	}

	respData = append(respData, '\n')
	_, err = r.client.stdin.Write(respData)
	return err
}

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "Usage: run-workflow.go <workflow-name> <prompt>")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Example:")
		fmt.Fprintln(os.Stderr, `  go run scripts/run-workflow.go cron-example "Generate yesterday's summary"`)
		os.Exit(1)
	}

	workflowName := os.Args[1]
	userPrompt := strings.Join(os.Args[2:], " ")

	repoRoot, err := findRepoRoot()
	if err != nil {
		cwd, _ := os.Getwd()
		for dir := cwd; dir != "/"; dir = filepath.Dir(dir) {
			if _, err := os.Stat(filepath.Join(dir, ".pi")); err == nil {
				repoRoot = dir
				break
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
		}
	}

	if repoRoot == "" {
		fmt.Fprintf(os.Stderr, "Error: could not find repository root\n")
		os.Exit(1)
	}

	fmt.Fprintf(os.Stderr, "[Workflow] Running in: %s\n", repoRoot)
	loadEnvFile(repoRoot)

	hasKey := false
	for _, key := range []string{"ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY", "AZURE_OPENAI_API_KEY"} {
		if os.Getenv(key) != "" {
			hasKey = true
			break
		}
	}

	if !hasKey {
		fmt.Fprintln(os.Stderr, "Error: No API key found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or other provider API key.")
		os.Exit(1)
	}

	client, err := NewRPCClient(repoRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	fmt.Fprintf(os.Stderr, "[Workflow] Starting \"%s\"\n", workflowName)
	fmt.Fprintf(os.Stderr, "[Workflow] Prompt: %s\n", userPrompt)
	fmt.Fprintln(os.Stderr, "")

	runner := NewWorkflowRunner(client, workflowName, userPrompt)

	done := make(chan error, 1)
	go func() {
		done <- runner.Run()
	}()

	select {
	case err := <-done:
		if err != nil {
			fmt.Fprintf(os.Stderr, "\n[Workflow] Error: %v\n", err)
			os.Exit(1)
		}
	case <-time.After(30 * time.Minute):
		fmt.Fprintln(os.Stderr, "\n[Workflow] Timeout after 30 minutes")
		os.Exit(1)
	}

	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintf(os.Stderr, "[Workflow] \"%s\" completed successfully!\n", workflowName)
}
