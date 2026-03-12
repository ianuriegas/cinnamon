# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.0.0] - TBD

Initial pre-release.

- Job orchestration (BullMQ, Postgres, Hono)
- Shell jobs (Python, Bash, Node, any command)
- CLI (`cinnamon trigger`, `cinnamon status`, etc.)
- HTTP API (trigger, list runs, definitions, schedules)
- Dashboard (runs, live log stream, cancel, retry)
- Notifications (Discord, Slack, generic webhook)
- Zombie cleanup on worker shutdown/timeout/cancel
- Worker self-healing (marks orphaned processing rows as interrupted)
- Cancel and retry for queued/processing/failed jobs
- Multi-tenant teams and API keys
- Optional Google OAuth for dashboard access
