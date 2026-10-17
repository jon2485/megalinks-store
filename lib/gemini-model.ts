// Shared by the admin form and server; this never receives or handles API keys.
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
export const GEMINI_MODEL_FORMAT_ERROR = 'מזהה מודל Gemini אינו תקין. הזינו מזהה כמו gemini-2.5-flash, ללא רווחים או כתובת מלאה.';
export function normalizeGeminiModel(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.normalize('NFKC')
        .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '')
        .replace(/[\u2010-\u2015\u2212\uFE63\uFF0D]/g, '-')
        .trim().replace(/^models\//, '');
}
export function validGeminiModel(model: string): boolean {
    return model.length <= 100 && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(model);
}
export function geminiModelFailure(status: number): string {
    if (status === 404) return 'המודל שנבחר לא נמצא או אינו זמין למפתח הזה. בדקו את הגישה למודל ב־Google AI Studio.';
    if (status === 400 || status === 401 || status === 403) return 'Google דחתה את אימות החיבור. בדקו שמפתח ה־API תקין ושיש לחשבון הרשאה למודל שנבחר.';
    if (status === 429) return 'מכסת הבקשות ל־Gemini נוצלה. בדקו את המכסה והחיוב בחשבון Google ונסו שוב מאוחר יותר.';
    if (status === 408 || status === 504) return 'Gemini לא השלים את הכתיבה בזמן. התוכן הקיים נשמר. אפשר לנסות שוב.';
    if (status >= 500) return `שירות Gemini אינו זמין כרגע (שגיאה ${status}). התוכן הקיים נשמר. אפשר לנסות שוב בעוד זמן קצר.`;
    return 'לא ניתן לאמת את החיבור ל־Gemini כרגע. נסו שוב מאוחר יותר.';
}
