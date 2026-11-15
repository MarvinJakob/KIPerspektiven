package statisticskey

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestKeyPersistsAndIsNotSilentlyReplaced(t *testing.T) {
	path := filepath.Join(t.TempDir(), "secret", "statistics-ip.key")
	first, err := LoadOrCreate(path)
	if err != nil {
		t.Fatal(err)
	}
	second, err := LoadOrCreate(path)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 32 || !bytes.Equal(first, second) {
		t.Fatal("Neustart aendert Schluessel")
	}
	if err := os.WriteFile(path, []byte("defekt"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadOrCreate(path); err == nil {
		t.Fatal("defekten Schluessel stillschweigend ersetzt")
	}
}
