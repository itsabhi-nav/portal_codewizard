#!/usr/bin/env bash
#
# Stop the local PostgREST + proxy stack (the Next.js dev server is stopped
# with Ctrl+C in its own terminal).
#
echo "Stopping local PostgREST / proxy..."
pkill -f "postgrest" 2>/dev/null || true
pkill -f "local-supabase-proxy.js" 2>/dev/null || true
echo "Done. (Database data is preserved.)"
