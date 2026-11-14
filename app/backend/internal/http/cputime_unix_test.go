//go:build unix

package httpserver_test

import (
	"syscall"
	"time"
)

// processCPU liefert die bisher verbrauchte Prozessorzeit des Testprozesses (Benutzer- und Systemzeit) für den
// Lasttest TestLoginLoad.
func processCPU() time.Duration {
	var ru syscall.Rusage
	if err := syscall.Getrusage(syscall.RUSAGE_SELF, &ru); err != nil {
		return 0
	}
	return time.Duration(ru.Utime.Nano() + ru.Stime.Nano())
}
