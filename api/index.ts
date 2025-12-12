/**
 * Unified API Entry Point for Vercel Serverless Functions
 * 
 * This single serverless function exports an Express app that handles
 * all API routes, staying within Vercel's Hobby plan limit of 12 functions.
 * 
 * Route Pattern: /api/* -> handled by Express router in backend/app.ts
 */

import app from '../backend/app.js'

// Vercel automatically adapts Express apps to serverless functions
export default app
