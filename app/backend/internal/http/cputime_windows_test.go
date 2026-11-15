//go:build windows

package httpserver_test

import (
	"syscall"
	"time"
)

// processCPU liefert die bisher verbrauchte Prozessorzeit des Testprozesses (Benutzer- und Systemzeit) für den
// Lasttest TestLoginLoad.
func processCPU() time.Duration {
	h, err := syscall.GetCurrentProcess()
	if err != nil {
		return 0
	}
	var creation, exit, kernel, user syscall.Filetime
	if err := syscall.GetProcessTimes(h, &creation, &exit, &kernel, &user); err != nil {
		return 0
	}
	return filetimeDuration(kernel) + filetimeDuration(user)
}

// filetimeDuration rechnet eine Zeitspanne in 100-ns-Schritten um. Filetime.Nanoseconds passt nicht, weil es
// einen Zeitpunkt seit 1601 auf 1970 umrechnet.
func filetimeDuration(ft syscall.Filetime) time.Duration {
	return time.Duration((int64(ft.HighDateTime)<<32 | int64(ft.LowDateTime)) * 100)
}
