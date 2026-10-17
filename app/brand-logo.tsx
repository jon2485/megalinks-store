'use client';
import {useId} from 'react';

/** Render the supplied logo without changing its source pixels or brand symbol. */
export default function BrandLogo({light=false,className=''}:{light?:boolean;className?:string}){
 const id='brand-ink-'+useId().replace(/[^a-zA-Z0-9_-]/g,'');
 return <span className={'brand-logo '+className}>{!light&&<svg width="0" height="0" aria-hidden="true" focusable="false" className="brand-logo-filter"><defs><filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  20 20 20 0 -59" result="whitePixels"/><feComposite in="whitePixels" in2="SourceAlpha" operator="in" result="letterMask"/><feFlood floodColor="#071f4b" result="navyInk"/><feComposite in="navyInk" in2="letterMask" operator="in" result="darkLetters"/><feComposite in="SourceGraphic" in2="whitePixels" operator="out" result="brandColors"/><feMerge><feMergeNode in="brandColors"/><feMergeNode in="darkLetters"/></feMerge></filter></defs></svg>}<img src="/brand/megalinks-logo.png" alt="MegaLinks — בניית קישורים חיצוניים, כתיבת תוכן וכתבות יח״צ" width="2048" height="449" style={light?undefined:{filter:`url(#${id})`}}/></span>;
}
