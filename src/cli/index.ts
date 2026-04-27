#!/usr/bin/env node
import { runCli } from './CaptureCli';

runCli(process.argv.slice(2)).then(exitCode => {
  process.exitCode = exitCode;
});
