---
id: T-106
title: "User accounts"
status: todo
urgency: urgent
categories:
  - Backend
  - Auth
depends_on: []
draft: false
milestone: Planning
current_subtask: null
created: 2026-11-01
updated: 2026-11-08
---

## Spec

Sign up, sign in and sessions so recipes and plans belong to a person. Email and password first, OAuth later.

## Features

- Passwords hashed with `argon2`
- HTTP-only session cookie, 30-day expiry
- All `/api` routes require a session except auth

## Open questions

- [x] Q1 (text): Which OAuth providers should come later?
  > answer: Google and GitHub

## Subtasks

- [ ] 1. Users table
- [ ] 2. Sign up
- [ ] 3. Sign in
- [ ] 4. Sessions
- [ ] 5. Protect API routes
- [ ] 6. Sign out
- [ ] 7. Password reset email
