BrewMatic CRM — Ready for deployment
Deadline: June 15, 2026 12 PM

FRONTEND — COMPLETE ✅
- Chat UI with markdown rendering (react-markdown)
- Order ticket action cards (SENT/VOID stamps)
- Session sidebar with full history
- New Campaign button
- Dashboard with customer stats bar
- Campaign list with status badges  
- Live polling for running campaigns (4s interval)
- AI insights on demand button
- Full demo tested and working end to end

BACKEND — COMPLETE ✅
- Full AI agent loop (Gemini 2.0 Flash)
- Real CRM-grounded predictions
- Zero-reach protection
- Dispatch failure handling
- Async callback loop with retry

NEXT: DEPLOYMENT
1. Create GitHub repo brewmatic-crm
2. Push code (verify .env not tracked)
3. Deploy backend → Railway
4. Deploy channel-service → Railway (separate service)
5. Set env vars on Railway:
   - DATABASE_URL, GEMINI_API_KEY
   - CHANNEL_SERVICE_URL (Railway URL of channel service)
   - CRM_CALLBACK_URL (Railway URL of backend)
   - NODE_ENV=production
6. Deploy frontend → Vercel
   - Set VITE_API_URL to Railway backend URL
7. Update CORS on backend for Vercel domain
8. Test full flow on live URLs
9. Record walkthrough video

Ports locally:
- Backend: 3000
- Channel service: 3001  
- Frontend: 5173