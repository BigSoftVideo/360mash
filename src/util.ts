
export function secsToTimeString(secs: number): string {
    if (!isFinite(secs)) {
        return secs.toString();
    }

    let h = Math.floor(secs / 3600);
    let m = Math.floor(secs / 60) % 60;
    let s = Math.floor(secs) % 60;

    let hStr = h.toString().padStart(2, "0");
    let mStr = m.toString().padStart(2, "0");
    let sStr = s.toString().padStart(2, "0");
    return hStr + ":" + mStr + ":" + sStr;
}
