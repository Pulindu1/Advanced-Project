package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// FlagSet holds the three per-user flags.
type FlagSet struct {
	Flag1 string `json:"flag1"`
	Flag2 string `json:"flag2"`
	Flag3 string `json:"flag3"`
}

// FlagStore is an in-memory cache of per-user flags loaded from flags.json.
// It also knows where to write the per-user flag3 files used by the command
// injection payload.
type FlagStore struct {
	mu       sync.RWMutex
	byUser   map[string]FlagSet
	flagsDir string
}

// NewFlagStore loads flags.json from dataDir and (re)writes the flag3 files
// into runtimeFlagsDir. Both operations must succeed for the store to return.
func NewFlagStore(dataDir, runtimeFlagsDir string) (*FlagStore, error) {
	raw, err := os.ReadFile(filepath.Join(dataDir, "flags.json"))
	if err != nil {
		return nil, fmt.Errorf("read flags.json: %w", err)
	}
	m := map[string]FlagSet{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, fmt.Errorf("parse flags.json: %w", err)
	}

	if err := os.MkdirAll(runtimeFlagsDir, 0o755); err != nil {
		return nil, fmt.Errorf("mkdir flags runtime dir: %w", err)
	}

	// Copy per-user flag3 files from the source flag-files directory into the
	// runtime flags dir. The command injection payload reads them from the
	// runtime path (for example, /app/flags/flag3-abcd12.txt).
	srcDir := filepath.Join(dataDir, "flag-files")
	entries, err := os.ReadDir(srcDir)
	if err != nil {
		return nil, fmt.Errorf("read flag-files dir: %w", err)
	}
	count := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		// Only sync per-user flag files; sibling narrative files (memo.txt
		// and similar flavour artefacts) are not part of the exploit path.
		if !strings.HasPrefix(name, "flag3-") || !strings.HasSuffix(name, ".txt") {
			continue
		}
		src := filepath.Join(srcDir, name)
		dst := filepath.Join(runtimeFlagsDir, name)
		body, err := os.ReadFile(src)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", src, err)
		}
		if err := os.WriteFile(dst, body, 0o644); err != nil {
			return nil, fmt.Errorf("write %s: %w", dst, err)
		}
		count++
	}
	log.Printf("flagsync: loaded %d users, wrote %d flag3 files to %s", len(m), count, runtimeFlagsDir)

	return &FlagStore{byUser: m, flagsDir: runtimeFlagsDir}, nil
}

// Get returns the flag set for a username. Ok is false if the user has no
// flags generated (for example, a staff account).
func (s *FlagStore) Get(username string) (FlagSet, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	f, ok := s.byUser[username]
	return f, ok
}

// AllUsernames returns the list of usernames with generated flags. Used by
// tests and potentially by administrative tooling.
func (s *FlagStore) AllUsernames() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.byUser))
	for u := range s.byUser {
		out = append(out, u)
	}
	return out
}

// FlagsDir exposes the runtime directory holding the flag3 files. The command
// injection payload targets paths beneath this directory.
func (s *FlagStore) FlagsDir() string { return s.flagsDir }
