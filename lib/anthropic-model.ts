// Shared by the admin form and server; this never receives or handles API keys.
// Owner 27.11.2026: Claude is an AI provider and the default for a new AI connection.
export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5-5';
export const ANTHROPIC_MODELS: Record<string, string> = { 'claude-opus-5-5': 'Claude Opus 5.5 (ברירת מחדל)', 'claude-sonnet-5-5': 'Claude Sonnet 5.5', 'claude-haiku-5-5': 'Claude Haiku 5.5' };
// Models that take the server-side refusal fallback. Haiku does not.
export const ANTHROPIC_FALLBACK_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'];
export const ANTHROPIC_MODEL_FORMAT_ERROR = 'מזהה מודל Claude אינו תקין. לדוגמה: claude-opus-5-5';
// Providers saved through the shared connection form (Gemini has its own form and route).
export const AI_PROVIDERS = ['anthropic', 'openai', 'groq', 'grok'];
export function normalizeAnthropicModel(value: unknown): string {
    return typeof value === 'string' ? value.normalize('NFKC').replace(/[​-‏‪-‮⁠⁦-⁩﻿]/g, '').trim().toLowerCase() : '';
}
export function validAnthropicModel(model: string): boolean {
    return /^claude-[a-z0-9][a-z0-9.-]{0,80}$/.test(model);
}
// A connection saved before Claude existed may have no provider field: those were OpenAI
// (the old default) and must stay OpenAI. Only a never-configured connection defaults to Claude.
export function aiProvider(config: Record<string, any> | null | undefined): string {
    const c = config || {};
    if (c.provider) return String(c.provider);
    return c.secret || c.secret_storage || c.enabled || c.model ? 'openai' : 'anthropic';
}
