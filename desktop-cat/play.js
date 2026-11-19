const ACTIONS = ['sniff', 'tap', 'bow', 'chase', 'roll'];
/** 서로 다른 동작 두 가지를 골라요 (순서도 섞여서 조합이 20가지예요) */
function pickActions() {
    const a = [...ACTIONS];
    const first = a.splice(Math.floor(Math.random() * a.length), 1)[0];
    return [first, a[Math.floor(Math.random() * a.length)]];
}
const FPS = { walkR: 150, walkL: 150, sneak: 130, sniff: 140, bow: 110, tap: 130, roll: 150, dash: 80 };
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
const ease = (p) => p * p * (3 - 2 * p);
/**
 * @param acts  마주친 뒤 할 동작 (보통 두 가지): sniff(코 인사) | tap(앞발 톡톡) | bow(장난 걸기) | chase(쫓고 쫓기) | roll(뒹굴기)
 * @param xL,xR 장면이 시작될 때 왼쪽·오른쪽 고양이 자리
 * @param u     걷기 그림 속 고양이 한 마리의 가로 크기(화면 px)
 * @param lo,hi 고양이가 설 수 있는 가로 범위
 */
function buildScene(acts, xL, xR, u, lo, hi, speed) {
    // 이미 가까이 있으면 뒤로 물러나지 않고 그 자리에서 마주 봐요 (서로에게 다가가기만 해요)
    const gap = Math.max(Math.min(0.9 * u, xR - xL), 0.35 * u);
    const m = clamp((xL + xR) / 2, lo + gap / 2, hi - gap / 2);
    let pL = m - gap / 2, pR = m + gap / 2; // 지금 두 고양이 자리 (구간이 끝날 때마다 갱신)
    const segs = [];
    const frame = (g, t, loops = 12) => Math.floor(t / FPS[g]) % loops;
    const still = (x, g, flip, f = 0) => ({ g, f, x, flip });
    // 1) 걷던 모습 그대로 서로에게 다가가다가, 가까워지면 살금살금 걸어요 (갑자기 자세가 바뀌지 않게 걷는 그림부터 이어 써요)
    {
        const fromL = xL, fromR = xR, toL = pL, toR = pR;
        const dist = Math.max(Math.abs(toL - fromL), Math.abs(toR - fromR));
        const dur = Math.max(500, (dist / speed) * 1000);
        segs.push({
            dur,
            at: (t) => {
                const p = Math.min(1, t / dur);
                const side = (a, b, face) => {
                    if (Math.abs(b - a) < 2)
                        return still(a, 'sneak', face, 0);
                    const x = a + (b - a) * p, left = b < a, near = Math.abs(b - x) < 0.2 * u;
                    return near ? { g: 'sneak', f: frame('sneak', t), x, flip: left } : { g: left ? 'walkL' : 'walkR', f: frame('walkR', t), x, flip: false };
                };
                return { L: side(fromL, toL, false), R: side(fromR, toR, true) };
            },
        });
    }
    // 구간을 만들 때의 자리를 그대로 기억해요 (뒤 구간에서 자리가 바뀌어도 앞 구간은 그대로)
    const both = (g, ms, loops = 1) => {
        const xl = pL, xr = pR, dur = FPS[g] * 12 * loops;
        segs.push({ dur: ms > 0 ? ms : dur, at: (t) => ({ L: still(xl, g, false, frame(g, t)), R: still(xr, g, true, frame(g, t)) }) });
    };
    const oneTap = (leftTaps) => {
        const xl = pL, xr = pR, dur = FPS.tap * 12;
        segs.push({ dur, at: (t) => ({ L: still(xl, 'tap', false, leftTaps ? frame('tap', t) : 0), R: still(xr, 'tap', true, leftTaps ? 0 : frame('tap', t)) }) });
    };
    // 2) 고른 동작을 차례로 해요
    for (const act of acts) {
        if (act === 'sniff')
            both('sniff', 0);
        else if (act === 'bow')
            both('bow', 0);
        else if (act === 'roll')
            both('roll', 0, 1);
        else if (act === 'tap') {
            const lf = Math.random() < 0.5;
            oneTap(lf);
            oneTap(!lf);
        }
        else {
            // 쫓고 쫓기: 한 마리가 도망치고 한 마리가 쫓아가요
            const roomR = hi - pR, roomL = pL - lo;
            const dir = roomR >= roomL ? 1 : -1; // 자리가 더 넓은 쪽으로 달려요
            const d = Math.min(2.2 * u, Math.max(roomR, roomL));
            if (d <= 1.1 * u) {
                both('bow', 0);
                continue;
            }
            const fleeIsR = dir > 0; // 오른쪽으로 달리면 오른쪽 고양이가 도망쳐요
            const f0 = fleeIsR ? pR : pL, c0 = fleeIsR ? pL : pR;
            const f1 = f0 + dir * d, c1 = f1 - dir * gap;
            const dur = 2000, delay = 260;
            segs.push({
                dur,
                at: (t) => {
                    const pf = ease(Math.min(1, t / dur)), pc = ease(Math.min(1, Math.max(0, t - delay) / (dur - delay)));
                    const fl = { g: 'dash', f: frame('dash', t), x: f0 + (f1 - f0) * pf, flip: dir < 0 };
                    const ch = t < delay ? still(c0, 'bow', dir < 0, 0) : { g: 'dash', f: frame('dash', t), x: c0 + (c1 - c0) * pc, flip: dir < 0 };
                    return fleeIsR ? { L: ch, R: fl } : { L: fl, R: ch };
                },
            });
            pL = fleeIsR ? c1 : f1;
            pR = fleeIsR ? f1 : c1;
            if (pL > pR) {
                const q = pL;
                pL = pR;
                pR = q;
            }
        }
    }
    // 3) 마무리: 같이 앉아서 숨을 골라요
    const el = pL, er = pR;
    segs.push({ dur: 1400, at: () => ({ L: still(el, 'tap', false, 0), R: still(er, 'tap', true, 0) }) });
    const dur = segs.reduce((s, c) => s + c.dur, 0);
    const endL = pL, endR = pR;
    return {
        dur,
        at: (t) => {
            let rest = t;
            for (const s of segs) {
                if (rest < s.dur)
                    return s.at(rest);
                rest -= s.dur;
            }
            const last = segs[segs.length - 1];
            return last.at(last.dur);
        },
        end: { L: endL, R: endR },
    };
}
/** 그림 이름을 만들어요 (pre: '' 루비 / 'wh_' 크리스탈) */
function playKey(pre, s) {
    return `${pre}${s.g}${s.f}`;
}
