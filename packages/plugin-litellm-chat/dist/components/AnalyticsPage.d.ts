import React from 'react';
/**
 * Admin analytics page — see AGENTS.md: this repo has no permission-policy
 * plumbing of its own (identity/auth is all inherited from govai), so
 * restricting this route to admins is a host-Backstage-app concern, same as
 * the sidebar nav entry and route registration done there for /ai-chat.
 * Until that's wired up, this page is reachable by anyone who can reach
 * /ai-chat/analytics — the data it shows is aggregate counts only (no
 * message content, no per-user breakdown), so the exposure is low, but it
 * is not actually admin-gated yet.
 */
export declare const AnalyticsPage: React.FC;
