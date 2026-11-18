package service

import (
	"encoding/json"
	"ki-web/backend/internal/api"
	"testing"
)

func TestArticleValidation(t *testing.T) {
	for _, tc := range []struct {
		name, text string
		valid      bool
	}{
		{"REQ-67-AC2 title only", `{"title":"Nur Titel","blocks":[]}`, true},
		{"REQ-67-AC2 whitespace", `{"title":"  ","blocks":[]}`, false},
		{"REQ-67-AC6 missing alt", `{"title":"T","blocks":[{"kind":"image","src":"/media/1234567890abcdef1234567890abcdef-960.jpg","alt":"  "}]}`, false},
		{"REQ-67-AC6 local image", `{"title":"T","blocks":[{"kind":"image","src":"/media/1234567890abcdef1234567890abcdef-960.jpg","alt":"Diagramm"}]}`, true},
		{"REQ-67-AC9 optional description", `{"title":"T","blocks":[{"kind":"ordered","items":[{"title":"Eins"}]}]}`, true},
		{"REQ-67-AC9 missing list title", `{"title":"T","blocks":[{"kind":"unordered","items":[{"description":"Details"}]}]}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var content api.ArticleText
			if err := json.Unmarshal([]byte(tc.text), &content); err != nil {
				t.Fatal(err)
			}
			if err := validateArticleText(content); (err == nil) != tc.valid {
				t.Fatalf("valid=%v, error=%v", tc.valid, err)
			}
		})
	}
}
