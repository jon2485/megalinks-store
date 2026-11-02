/** Ephemeral list state only. Never persisted to storage or sent to analytics. */
const views=new Map<string,unknown>();
export function adminViewState<T>(key:string,fallback:T):T{return (views.get(key) as T)??fallback;}
export function saveAdminViewState(key:string,value:unknown){views.set(key,value);}
/** One-time hand-off to the screen a link opens, such as a preset filter. */
export function takeAdminViewState<T>(key:string):T|undefined{const value=views.get(key) as T|undefined;views.delete(key);return value;}
