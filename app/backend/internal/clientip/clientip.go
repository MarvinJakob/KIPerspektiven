// Package clientip bestimmt eine kanonische Client-IP mit expliziter Proxy-Vertrauensgrenze.
package clientip

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"strings"
)

type contextKey struct{}

// ParseProxies akzeptiert kommagetrennte IPs oder CIDRs. Leer vertraut keinem Proxy.
func ParseProxies(value string) ([]netip.Prefix, error) {
	var out []netip.Prefix
	if strings.TrimSpace(value) == "" {
		return out, nil
	}
	for _, part := range strings.Split(value, ",") {
		part = strings.TrimSpace(part)
		prefix, err := netip.ParsePrefix(part)
		if err != nil {
			addr, addrErr := netip.ParseAddr(part)
			if addrErr != nil {
				return nil, fmt.Errorf("ungueltiger Eintrag in TRUSTED_PROXIES: %q", part)
			}
			addr = addr.Unmap()
			prefix = netip.PrefixFrom(addr, addr.BitLen())
		}
		out = append(out, prefix.Masked())
	}
	return out, nil
}

func trusted(addr netip.Addr, proxies []netip.Prefix) bool {
	for _, prefix := range proxies {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}

// Resolve prueft X-Forwarded-For von rechts nach links. Unvertraute Peers koennen Header nicht faelschen.
// Bei einem vertrauten Proxy ohne gueltige Client-IP bleibt die Adresse unbekannt (leerer String).
func Resolve(r *http.Request, proxies []netip.Prefix) string {
	peer := r.RemoteAddr
	if host, _, err := net.SplitHostPort(peer); err == nil {
		peer = host
	}
	addr, err := netip.ParseAddr(peer)
	if err != nil || addr.Zone() != "" {
		return ""
	}
	addr = addr.Unmap()
	if !trusted(addr, proxies) {
		return addr.String()
	}
	chain := strings.Split(strings.Join(r.Header.Values("X-Forwarded-For"), ","), ",")
	for i := len(chain) - 1; i >= 0; i-- {
		addr, err = netip.ParseAddr(strings.TrimSpace(chain[i]))
		if err != nil || addr.Zone() != "" {
			return ""
		}
		addr = addr.Unmap()
		if !trusted(addr, proxies) {
			return addr.String()
		}
	}
	return addr.String()
}

// WithAddress legt die bereits gepruefte IP im Request-Kontext ab.
func WithAddress(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, contextKey{}, ip)
}
func FromContext(ctx context.Context) string { ip, _ := ctx.Value(contextKey{}).(string); return ip }

func Middleware(next http.Handler, proxies []netip.Prefix) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r.WithContext(WithAddress(r.Context(), Resolve(r, proxies))))
	})
}
