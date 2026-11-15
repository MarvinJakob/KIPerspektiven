package clientip

import (
	"net/http/httptest"
	"testing"
)

func TestTrustedProxyBoundaryAndCanonicalAddresses(t *testing.T) {
	proxies, err := ParseProxies("127.0.0.1/32, 10.0.0.2, ::1/128")
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct{ name, peer, header, want string }{
		{"direkt", "192.0.2.1:5000", "198.51.100.1", "192.0.2.1"},
		{"IPv6", "[2001:0db8:0:0:0:0:0:1]:5000", "", "2001:db8::1"},
		{"mapped", "[::ffff:192.0.2.1]:5000", "", "192.0.2.1"},
		{"Caddy", "127.0.0.1:5000", "192.0.2.1", "192.0.2.1"},
		{"gefaelschter Praefix", "127.0.0.1:5000", "198.51.100.1, 192.0.2.1", "192.0.2.1"},
		{"Proxykette", "127.0.0.1:5000", "2001:0db8::1, 10.0.0.2", "2001:db8::1"},
		{"kaputter Header", "127.0.0.1:5000", "keine-IP", ""},
		{"fehlender Header", "127.0.0.1:5000", "", ""},
		{"Zone", "127.0.0.1:5000", "fe80::1%eth0", ""},
		{"kaputter Peer", "ungueltig", "192.0.2.1", ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = c.peer
			r.Header.Set("X-Forwarded-For", c.header)
			if got := Resolve(r, proxies); got != c.want {
				t.Fatalf("%q statt %q", got, c.want)
			}
		})
	}
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "127.0.0.1:5000"
	r.Header.Set("X-Forwarded-For", "192.0.2.1")
	if got := Resolve(r, nil); got != "127.0.0.1" {
		t.Fatalf("ohne Konfiguration darf kein Header gelten: %q", got)
	}
	if _, err := ParseProxies("127.0.0.1,defekt"); err == nil {
		t.Fatal("falsche Konfiguration akzeptiert")
	}
}
