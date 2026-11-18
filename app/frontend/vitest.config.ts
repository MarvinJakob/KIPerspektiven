import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Unit-Tests (AGENTS.md, Abschnitt 2). CSS wird verarbeitet, damit Tests Gestaltungsregeln per `?raw` lesen können.
export default mergeConfig(viteConfig, defineConfig({ test: { environment: 'node', css: { include: /.+/ } } }));
