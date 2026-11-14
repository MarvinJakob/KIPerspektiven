package httpserver_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"runtime"
	"runtime/debug"
	"runtime/metrics"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"ki-web/backend/internal/api"
	httpserver "ki-web/backend/internal/http"
	"ki-web/backend/internal/service"
)

// TestLoginLoad ist der kontrollierte lokale Lasttest zu Ticket #138. Er steigert die Zahl gleichzeitiger
// Anmeldeversuche stufenweise und misst Antworten, Speicher, Prozessorzeit und die Erreichbarkeit des
// Healthchecks. Jeder Versuch kommt von einer neuen IP-Adresse, damit nur die globale Grenze greift und jeder
// zugelassene Versuch eine echte Argon2-Prüfung auslöst. Ablauf und Ergebnisse: docs/login-begrenzung.md.
//
// Der Test braucht viel Speicher und Rechenzeit und läuft deshalb nur auf Anforderung, nie im Produktivsystem:
//
//	LOGIN_LASTTEST=1 go test -run TestLoginLoad -v ./internal/http/
//
// LOGIN_LASTTEST_STUFEN legt die Parallelität je Stufe fest (Standard 10,20,40,80), LOGIN_LASTTEST_DAUER die
// Dauer je Stufe (Standard 3s). Überschreitet der Speicher LOGIN_LASTTEST_BUDGET_MIB (Standard 1024), entfallen
// die weiteren Stufen.
//
// Im Testprozess teilt sich der Server die Prozessoren mit dem Lastgenerator. Für eine Messung wie auf einem
// Server mit einem Kern startet scripts/login-lasttest.ps1 den Server als eigenen Prozess (GOMAXPROCS=1,
// DEV_SEED=true, TRUST_PROXY=true) und setzt LOGIN_LASTTEST_URL. Speicher und Prozessorzeit misst dann das
// Skript am Serverprozess; der Test meldet nur Antworten und Healthcheck.
func TestLoginLoad(t *testing.T) {
	if os.Getenv("LOGIN_LASTTEST") != "1" {
		t.Skip("Lasttest nur mit LOGIN_LASTTEST=1 (docs/login-begrenzung.md)")
	}
	stages := envInts(t, "LOGIN_LASTTEST_STUFEN", "10,20,40,80")
	duration, err := time.ParseDuration(envOr("LOGIN_LASTTEST_DAUER", "3s"))
	if err != nil {
		t.Fatal(err)
	}
	budget := envInts(t, "LOGIN_LASTTEST_BUDGET_MIB", "1024")[0]

	base, account, where := os.Getenv("LOGIN_LASTTEST_URL"), "redaktion@example.test", "extern" // Testkonto aus DEV_SEED
	inProcess := base == ""
	if inProcess {
		srv, db := newServer(t, false, func(c *httpserver.Config) { c.TrustProxy = true })
		createUser(t, db, editorEmail, service.RoleEditor)
		base, account, where = srv.URL, editorEmail, "im Testprozess"
	}
	client := &http.Client{
		Transport: &http.Transport{MaxIdleConnsPerHost: 1000},
		Timeout:   30 * time.Second,
	}
	t.Logf("Server %s (%s), Testprozess mit GOMAXPROCS=%d, GOOS=%s, Go %s, Dauer je Stufe %s",
		where, base, runtime.GOMAXPROCS(0), runtime.GOOS, runtime.Version(), duration)
	t.Logf("| Parallel | Anfragen | 401 | 503 | sonstige | Argon2/s | Login p50/max | Speicher max | CPU | Health ok/gesamt | Health max |")
	var ip atomic.Int64
	for _, parallel := range stages {
		r := runLoginLoad(client, base, account, parallel, duration, &ip)
		memory, cpu := "extern", "extern"
		if inProcess {
			memory = fmt.Sprintf("%d MiB", r.peakMiB)
			cpu = fmt.Sprintf("%.2f s (%.0f %%)", r.cpu.Seconds(), 100*r.cpu.Seconds()/r.wall.Seconds()/float64(runtime.GOMAXPROCS(0)))
		}
		t.Logf("| %d | %d | %d | %d | %d | %.1f | %s / %s | %s | %s | %d/%d | %s |",
			parallel, r.requests, r.status[401], r.status[503], r.others(), float64(r.status[401])/duration.Seconds(),
			r.loginP50.Round(time.Millisecond), r.loginMax.Round(time.Millisecond), memory, cpu,
			r.healthOK, r.healthTotal, r.healthMax.Round(time.Millisecond))
		if r.others() > 0 {
			t.Errorf("Parallelität %d: unerwartete Antworten %v", parallel, r.status)
		}
		if r.missingRetryAfter > 0 {
			t.Errorf("Parallelität %d: %d Antworten 503 ohne Retry-After", parallel, r.missingRetryAfter)
		}
		if r.healthOK != r.healthTotal || r.healthTotal == 0 {
			t.Errorf("Parallelität %d: Healthcheck %d von %d erfolgreich", parallel, r.healthOK, r.healthTotal)
		}
		if inProcess && r.peakMiB > budget {
			t.Errorf("Parallelität %d: %d MiB Speicher, Budget %d MiB. Weitere Stufen entfallen.", parallel, r.peakMiB, budget)
			break
		}
	}
}

type loadResult struct {
	requests          int
	status            map[int]int
	missingRetryAfter int
	loginP50          time.Duration
	loginMax          time.Duration
	peakMiB           int
	cpu, wall         time.Duration
	healthOK          int
	healthTotal       int
	healthMax         time.Duration
}

func (r loadResult) others() int { return r.requests - r.status[401] - r.status[503] }

// runLoginLoad hält parallel Anmeldeversuche für die angegebene Dauer gleichzeitig am Laufen.
// Abwechselnd mit falschem Passwort für account und für ein unbekanntes Konto; beides löst Argon2 aus.
func runLoginLoad(client *http.Client, base, account string, parallel int, d time.Duration, ip *atomic.Int64) loadResult {
	runtime.GC()
	debug.FreeOSMemory()
	r := loadResult{status: map[int]int{}}
	var (
		mu        sync.Mutex
		latencies []time.Duration
		wg        sync.WaitGroup
	)
	stop := make(chan struct{})
	peak := samplePeakMemory(stop)
	health := sampleHealth(client, base, stop)

	cpuBefore, start := processCPU(), time.Now()
	deadline := start.Add(d)
	for w := range parallel {
		wg.Go(func() {
			for time.Now().Before(deadline) {
				n := ip.Add(1)
				email := account // falsches Passwort
				if w%2 == 1 {
					email = "niemand@example.test" // unbekanntes Konto
				}
				status, retryAfter, took := postLogin(client, base, fmt.Sprintf("10.%d.%d.%d", n>>16&255, n>>8&255, n&255), email)
				mu.Lock()
				r.requests++
				r.status[status]++
				if status == http.StatusServiceUnavailable && retryAfter == "" {
					r.missingRetryAfter++
				}
				latencies = append(latencies, took)
				mu.Unlock()
			}
		})
	}
	wg.Wait()
	r.cpu, r.wall = processCPU()-cpuBefore, time.Since(start)
	close(stop)
	r.peakMiB = <-peak
	h := <-health
	r.healthOK, r.healthTotal, r.healthMax = h.ok, h.total, h.max
	slices.Sort(latencies)
	if len(latencies) > 0 {
		r.loginP50, r.loginMax = latencies[len(latencies)/2], latencies[len(latencies)-1]
	}
	return r
}

func postLogin(client *http.Client, base, ip, email string) (status int, retryAfter string, took time.Duration) {
	body, _ := json.Marshal(api.LoginRequest{Email: email, Password: "falsches-passwort"})
	req, _ := http.NewRequest(http.MethodPost, base+"/api/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", ip)
	start := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return 0, "", time.Since(start)
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	return resp.StatusCode, resp.Header.Get("Retry-After"), time.Since(start)
}

// samplePeakMemory misst jede Millisekunde den vom Go-Laufzeitsystem belegten und nicht an das
// Betriebssystem zurückgegebenen Speicher und liefert nach stop den Höchstwert in MiB.
func samplePeakMemory(stop <-chan struct{}) <-chan int {
	out := make(chan int, 1)
	go func() {
		samples := []metrics.Sample{{Name: "/memory/classes/total:bytes"}, {Name: "/memory/classes/heap/released:bytes"}}
		var peak uint64
		tick := time.NewTicker(time.Millisecond)
		defer tick.Stop()
		for {
			metrics.Read(samples)
			if used := samples[0].Value.Uint64() - samples[1].Value.Uint64(); used > peak {
				peak = used
			}
			select {
			case <-stop:
				out <- int(peak >> 20)
				return
			case <-tick.C:
			}
		}
	}()
	return out
}

type healthResult struct {
	ok, total int
	max       time.Duration
}

// sampleHealth ruft alle 25 ms den Healthcheck auf, bis stop geschlossen wird.
func sampleHealth(client *http.Client, base string, stop <-chan struct{}) <-chan healthResult {
	out := make(chan healthResult, 1)
	go func() {
		var h healthResult
		tick := time.NewTicker(25 * time.Millisecond)
		defer tick.Stop()
		for {
			select {
			case <-stop:
				out <- h
				return
			case <-tick.C:
			}
			start := time.Now()
			resp, err := client.Get(base + "/api/health")
			took := time.Since(start)
			h.total++
			h.max = max(h.max, took)
			if err == nil {
				_, _ = io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					h.ok++
				}
			}
		}
	}()
	return out
}

func envOr(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

func envInts(t *testing.T, name, fallback string) []int {
	t.Helper()
	var out []int
	for _, f := range strings.Split(envOr(name, fallback), ",") {
		n, err := strconv.Atoi(strings.TrimSpace(f))
		if err != nil || n <= 0 {
			t.Fatalf("%s: ungültiger Wert %q", name, f)
		}
		out = append(out, n)
	}
	return out
}
