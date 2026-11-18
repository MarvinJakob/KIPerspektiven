package httpserver

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"ki-web/backend/internal/api"
	"ki-web/backend/internal/service"
	"ki-web/backend/internal/store"
)

// Fidelity-Test zu REQ-90-AC2 und REQ-90-AC4 (Ticket #90) über den API-Handler mit Testdatenbank: Die
// Einzellöschung entfernt genau eine Nachricht und protokolliert nur deren ID, keine personenbezogenen Angaben.

func TestREQ90AC4EinzelloeschungProtokolliertNurID(t *testing.T) {
	ctx := context.Background()
	db, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if err := store.Migrate(ctx, db, false, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	contact := service.NewContact(db)
	for _, name := range []string{"Ada Lovelace", "Grace Hopper"} {
		in := service.ContactInput{Name: name, Company: "Firma X", Email: strings.ReplaceAll(strings.ToLower(name), " ", ".") + "@example.org",
			Message: "Geheimer Inhalt", Lang: service.DE}
		if err := contact.Send(ctx, in); err != nil {
			t.Fatal(err)
		}
	}
	msgs, _ := contact.List(ctx)
	var id int64
	for _, m := range msgs {
		if m.Name == "Ada Lovelace" {
			id = m.ID
		}
	}
	var buf bytes.Buffer
	srv := &apiServer{contact: contact, log: slog.New(slog.NewJSONHandler(&buf, nil))}

	res, err := srv.AdminDeleteContactMessage(ctx, api.AdminDeleteContactMessageRequestObject{Id: id})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := res.(api.AdminDeleteContactMessage204Response); !ok {
		t.Fatalf("Antwort %T, erwartet 204", res)
	}
	rest, _ := contact.List(ctx)
	if len(rest) != 1 || rest[0].Name != "Grace Hopper" {
		t.Errorf("nach dem Löschen verbleibend %+v, erwartet nur Grace Hopper", rest)
	}
	logs := buf.String()
	if !strings.Contains(logs, `"id":`+strconv.FormatInt(id, 10)) {
		t.Errorf("Protokoll ohne ID %d: %s", id, logs)
	}
	for _, secret := range []string{"Ada", "Lovelace", "@example.org", "Geheimer", "Firma"} {
		if strings.Contains(logs, secret) {
			t.Errorf("Protokoll enthält %q: %s", secret, logs)
		}
	}

	res, err = srv.AdminDeleteContactMessage(ctx, api.AdminDeleteContactMessageRequestObject{Id: id})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := res.(api.AdminDeleteContactMessage404JSONResponse); !ok {
		t.Errorf("zweites Löschen: Antwort %T, erwartet 404", res)
	}
}
