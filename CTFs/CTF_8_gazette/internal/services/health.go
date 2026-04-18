package services

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// PingResult is the shape returned to the admin API.
type PingResult struct {
	Host   string `json:"host"`
	Output string `json:"output"`
	Error  string `json:"error,omitempty"`
}

// blockedChars is the DELIBERATELY INCOMPLETE blocklist. It stops the obvious
// command chainers (; | & newline) but leaves $(...) and `...` command
// substitution completely untouched. This is the intended Flag 3 vulnerability.
var blockedChars = []string{";", "|", "&", "\n", "\r"}

// PingHost runs a single-packet ping against the supplied host. The user
// input is interpolated directly into a shell command on purpose: the
// exercise is about recognising which characters the blocklist forgot.
func PingHost(host string) PingResult {
	for _, b := range blockedChars {
		if strings.Contains(host, b) {
			return PingResult{Host: host, Error: "Invalid host: forbidden characters detected"}
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	// DELIBERATELY VULNERABLE: the blocklist above does not cover $() or
	// backtick substitution, so an attacker-controlled host value can
	// execute arbitrary commands inside this subshell.
	cmd := exec.CommandContext(ctx, "sh", "-c", fmt.Sprintf("ping -c 1 -W 2 %s", host))
	output, err := cmd.CombinedOutput()
	res := PingResult{Host: host, Output: string(output)}
	if err != nil {
		res.Error = err.Error()
	}
	return res
}
