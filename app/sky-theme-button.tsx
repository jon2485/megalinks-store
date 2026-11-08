'use client';
import React from 'react';
import {Moon,Sun} from 'lucide-react';
import {useAdminTheme} from './admin-theme';

// Light/dark switch for admin screens whose heading lives inside the screen itself (08.11.2026).
export default function SkyThemeButton(){
 const [theme,toggleTheme]=useAdminTheme();
 return <button type="button" className="orders-sky-theme" aria-pressed={theme==='light'} aria-label={theme==='light'?'מעבר למצב כהה':'מעבר למצב בהיר'} title={theme==='light'?'מצב כהה':'מצב בהיר'} onClick={toggleTheme}>{theme==='light'?<Moon size={18} aria-hidden="true"/>:<Sun size={18} aria-hidden="true"/>}</button>;
}
