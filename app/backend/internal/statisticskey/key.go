// Package statisticskey verwaltet den geheimen HMAC-Schluessel getrennt von der Datenbank.
package statisticskey

import (
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// LoadOrCreate behaelt den Schluessel ueber Neustarts bei. Bestehende defekte Dateien werden nie ersetzt.
func LoadOrCreate(path string) ([]byte, error) {
	key, err := os.ReadFile(path)
	if err == nil {
		if len(key) != 32 {
			return nil, fmt.Errorf("Statistikschluessel muss genau 32 Bytes enthalten")
		}
		return key, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}
	key = make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return nil, err
	}
	n, writeErr := file.Write(key)
	closeErr := file.Close()
	if writeErr != nil {
		return nil, writeErr
	}
	if closeErr != nil {
		return nil, closeErr
	}
	if n != len(key) {
		return nil, io.ErrShortWrite
	}
	return key, nil
}
