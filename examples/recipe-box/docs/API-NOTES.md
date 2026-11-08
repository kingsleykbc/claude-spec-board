# API notes

All routes are under `/api` and return JSON.

## Recipes
- `GET /api/recipes` lists recipes, newest first
- `POST /api/recipes` creates one

## Planner
- `GET /api/planned-meals?week=2026-W45`
- `PUT /api/planned-meals/:day/:slot`
