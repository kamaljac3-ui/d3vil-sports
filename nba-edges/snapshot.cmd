@echo off
rem Daily: pull stats.nba.com data on this PC and push it for the GitHub Action (runners can't reach nba.com).
cd /d "%~dp0.."
git pull --rebase --autostash -q || exit /b 1
set MODE=snapshot
node nba-edges\run.js || exit /b 1
git add nba-edges/data/nba-stats.json
git diff --cached --quiet && exit /b 0
git commit -q -m "NBA Edges: daily stats snapshot" -- nba-edges/data/nba-stats.json
git push -q origin main
