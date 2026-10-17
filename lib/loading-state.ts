// Count overlapping foreground requests; each completion releases only its own request.
let pending = 0;
const listeners = new Set<() => void>();
export const getPendingRequests = () => pending;
export const getServerPendingRequests = () => 0;
export function subscribePendingRequests(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
export function beginPendingRequest() {
    pending++;
    listeners.forEach(listener => listener());
    let finished = false;
    return () => {
        if (finished) return;
        finished = true;
        pending--;
        listeners.forEach(listener => listener());
    };
}
