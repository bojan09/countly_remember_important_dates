// Original, authored SVG scene art (no third-party assets). Every scene is a static,
// fully-rendered illustration; CSS adds optional ambient motion via the sc-* classes.
// All values below are constants: no user text is ever interpolated into the markup.

let counter = 0;

const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('');
const lin = (id, list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
const rad = (id, list, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;

function balloon(u, x, y, rx, ry, grad, cls = 'sc-float') {
  return `<g class="${cls}"><path d="M${x} ${y + ry} q-3 30 4 52" stroke="#fff" stroke-opacity=".7" stroke-width="1.4" fill="none"/>
  <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${u}${grad})"/>
  <path d="M${x - 4} ${y + ry - 1} l4 7 l4 -7z" fill="${grad === 'b2' ? '#f2a05a' : '#e2478f'}"/>
  <ellipse cx="${x - rx * 0.35}" cy="${y - ry * 0.4}" rx="${rx * 0.22}" ry="${ry * 0.34}" fill="#fff" fill-opacity=".55" transform="rotate(-24 ${x - rx * 0.35} ${y - ry * 0.4})"/></g>`;
}

function palm(u, x, baseY, h, lean = 1, scale = 1) {
  const topX = x + lean * h * 0.28;
  const topY = baseY - h;
  const leaf = (a, l) =>
    `<path d="M0 0 C${l * 0.3} ${-l * 0.34} ${l * 0.75} ${-l * 0.3} ${l} ${l * 0.06} C${l * 0.72} ${-l * 0.08} ${l * 0.32} ${-l * 0.04} 0 0Z" transform="rotate(${a})" fill="url(#${u}pg)"/>`;
  return `<g class="sc-sway" transform="translate(0 0)">
  <path d="M${x} ${baseY} C${x + lean * h * 0.05} ${baseY - h * 0.45} ${topX - lean * h * 0.18} ${baseY - h * 0.8} ${topX} ${topY}" stroke="#8a5530" stroke-width="${7 * scale}" stroke-linecap="round" fill="none"/>
  <path d="M${x} ${baseY} C${x + lean * h * 0.05} ${baseY - h * 0.45} ${topX - lean * h * 0.18} ${baseY - h * 0.8} ${topX} ${topY}" stroke="#b9794a" stroke-opacity=".55" stroke-width="${2.4 * scale}" stroke-linecap="round" fill="none" stroke-dasharray="3 7"/>
  <g transform="translate(${topX} ${topY}) scale(${scale})">${[-160, -125, -90, -55, -20, 15, 50, 195].map((a, i) => leaf(a, 70 + (i % 3) * 8)).join('')}
  <circle cx="-4" cy="6" r="5" fill="#6b4226"/><circle cx="5" cy="8" r="5" fill="#7a4d2c"/></g></g>`;
}

const palmDefs = (u) => `<linearGradient id="${u}pg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1c7f3f"/><stop offset="1" stop-color="#52c26b"/></linearGradient>`;

function confetti(W, H, seed = 1) {
  const colors = ['#ff6fa9', '#ffd166', '#7c5cff', '#4dd4c6', '#ff9f43'];
  let out = '';
  for (let i = 0; i < 16; i++) {
    const x = ((i * 97 + seed * 41) % W) | 0;
    const y = ((i * 53 + seed * 29) % (H - 30)) | 0;
    out += `<rect class="sc-twinkle" style="animation-delay:${(i % 6) * 0.35}s" x="${x}" y="${y}" width="${4 + (i % 3)}" height="${7 + (i % 4)}" rx="1.5" fill="${colors[i % 5]}" opacity=".85" transform="rotate(${(i * 37) % 180} ${x} ${y})"/>`;
  }
  return out;
}

function birthday(u, W, H, hero) {
  const wide = H < 200;
  const cx = hero ? 200 : wide ? 312 : 322;
  const cy = hero ? 224 : wide ? 108 : 150;
  const s = hero ? 1.5 : wide ? 0.78 : 1.08;
  const candle = (x, i) => `<rect x="${x - 3}" y="-52" width="6" height="26" rx="3" fill="${['#fff3b0', '#ffd6e6', '#fff3b0', '#d6ecff', '#ffd6e6'][i]}"/>
    <rect x="${x - 3}" y="-44" width="6" height="3" fill="#ff8fb7" opacity=".8"/><rect x="${x - 3}" y="-36" width="6" height="3" fill="#ff8fb7" opacity=".8"/>
    <g class="sc-flame"><ellipse cx="${x}" cy="-60" rx="5" ry="9" fill="#ffb347"/><ellipse cx="${x}" cy="-58" rx="2.6" ry="5.5" fill="#fff6c8"/></g>`;
  const drip = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="#fff4f8"/>`;
  const gift = (x, c1, c2) => `<g transform="translate(${x} 22)"><rect x="-26" y="0" width="52" height="42" rx="5" fill="${c1}"/><rect x="-4" y="0" width="8" height="42" fill="${c2}"/><rect x="-26" y="14" width="52" height="7" fill="${c2}" opacity=".9"/>
    <path d="M0 0 c-14 -16 -26 -4 -14 2z M0 0 c14 -16 26 -4 14 2z" fill="${c2}"/></g>`;
  return `<defs>${lin(u + 'bg', [[0, '#ffd0e4'], [1, '#ff8fbe']])}${rad(u + 'gl', [[0, '#fff', 0.85], [1, '#fff', 0]])}
  ${rad(u + 'b1', [[0, '#ffe3ef'], [0.55, '#ff84b4'], [1, '#e0458c']], 0.35, 0.28, 0.85)}${rad(u + 'b2', [[0, '#fff0dc'], [0.55, '#ffb68a'], [1, '#f0804f']], 0.35, 0.28, 0.85)}
  ${lin(u + 'pl', [[0, '#ffe6a3'], [1, '#d9a441']])}${lin(u + 'ck', [[0, '#ffc9de'], [1, '#ff9cc2']])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}bg)"/>
  <circle cx="${cx}" cy="${cy - 20}" r="${hero ? 210 : 150}" fill="url(#${u}gl)"/>
  <circle cx="${W * 0.2}" cy="${H * 0.78}" r="26" fill="#fff" opacity=".18"/><circle cx="${W * 0.55}" cy="${H * 0.12}" r="18" fill="#fff" opacity=".2"/><circle cx="${W * 0.94}" cy="${H * 0.5}" r="30" fill="#fff" opacity=".16"/>
  ${balloon(u, hero ? 62 : 30, hero ? 96 : wide ? 52 : 70, hero ? 30 : 22, hero ? 37 : 28, 'b1')}${balloon(u, hero ? 128 : 58, hero ? 54 : wide ? 120 : 180, hero ? 20 : 14, hero ? 25 : 18, 'b2', 'sc-float sc-slow')}
  ${balloon(u, hero ? 340 : 380, hero ? 112 : wide ? 70 : 110, hero ? 30 : 24, hero ? 37 : 30, 'b1', 'sc-float sc-slow')}${balloon(u, hero ? 292 : 262, hero ? 52 : 34, 18, 22, 'b2')}
  ${confetti(W, H)}
  <g transform="translate(${cx} ${cy}) scale(${s})">
    ${hero ? gift(-100, '#ff7eb0', '#ffe0a8') + gift(100, '#ff9ec7', '#fff1c9') : ''}
    <ellipse cx="0" cy="46" rx="72" ry="11" fill="url(#${u}pl)"/><ellipse cx="0" cy="42" rx="68" ry="9" fill="#ffefb8" opacity=".6"/>
    <rect x="-54" y="4" width="108" height="42" rx="9" fill="url(#${u}ck)"/>
    <rect x="-54" y="4" width="108" height="15" rx="7.5" fill="#fff4f8"/>${[-46, -30, -14, 4, 22, 38].map((x, i) => drip(x, 12, 10, 12 + (i % 3) * 4)).join('')}
    <rect x="-38" y="-26" width="76" height="34" rx="9" fill="url(#${u}ck)"/>
    <rect x="-38" y="-26" width="76" height="14" rx="7" fill="#fff4f8"/>${[-30, -12, 8, 24].map((x, i) => drip(x, -18, 9, 10 + (i % 2) * 5)).join('')}
    ${[-34, -18, 0, 18, 34].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 36 : 30}" r="3.4" fill="${['#ffd166', '#7c5cff', '#4dd4c6', '#ff6fa9', '#ffd166'][i]}"/>`).join('')}
    ${[-24, -12, 0, 12, 24].map((x, i) => candle(x, i)).join('')}
  </g>`;
}

function beach(u, W, H, hero, mood) {
  const day = mood === 'day';
  const hz = Math.round(H * 0.5);
  const k = H / 240;
  const wide = H < 200;
  const sky = day ? [[0, '#4aa8ff'], [0.65, '#9fd8ff'], [1, '#d8f1ff']] : [[0, '#6f63d8'], [0.45, '#e58bb4'], [0.8, '#ffb778'], [1, '#ffd89a']];
  const sea = day ? [[0, '#46c7d8'], [1, '#1a6fb8']] : [[0, '#ffa27a'], [0.5, '#8f6fd0'], [1, '#2d4a9c']];
  const sand = day ? [[0, '#ffe2a8'], [1, '#f6b878']] : [[0, '#ffc08f'], [1, '#e98a74']];
  const sunX = hero ? W * 0.5 : W * 0.62;
  return `<defs>${lin(u + 'sk', sky)}${lin(u + 'se', sea)}${lin(u + 'sa', sand)}${palmDefs(u)}${rad(u + 'sun', [[0, '#fff6d0', 1], [0.35, '#ffd27a', 0.7], [1, '#ffb347', 0]])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}sk)"/>
  <circle cx="${sunX}" cy="${hz - 14}" r="${day ? 46 : 76}" fill="url(#${u}sun)"/>
  <g class="sc-drift" opacity="${day ? 0.95 : 0.55}"><ellipse cx="${W * 0.7}" cy="${H * 0.16}" rx="34" ry="10" fill="#fff"/><ellipse cx="${W * 0.7 + 18}" cy="${H * 0.16 - 8}" rx="22" ry="11" fill="#fff"/><ellipse cx="${W * 0.18}" cy="${H * 0.3}" rx="26" ry="8" fill="#fff"/></g>
  <path d="M${W * 0.52} ${hz} L${W * 0.66} ${hz - 34} L${W * 0.74} ${hz - 20} L${W * 0.86} ${hz - 52} L${W} ${hz - 30} L${W} ${hz}Z" fill="${day ? '#8aa7d8' : '#9c6fb5'}" opacity=".85"/>
  <rect y="${hz}" width="${W}" height="${H - hz}" fill="url(#${u}se)"/>
  ${[0.1, 0.22, 0.34].map((k, i) => `<path class="sc-wave" style="animation-delay:${i * 0.8}s" d="M${W * 0.15} ${hz + (H - hz) * k} q${W * 0.1} -6 ${W * 0.2} 0 t${W * 0.2} 0 t${W * 0.2} 0" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none"/>`).join('')}
  <path d="M0 ${H * 0.82} Q${W * 0.3} ${H * 0.7} ${W * 0.62} ${H * 0.8} T${W} ${H * 0.76} V${H} H0Z" fill="url(#${u}sa)"/>
  ${hero || !day ? `<g transform="translate(${W * 0.6} ${hz - 6})"><rect x="0" y="-26" width="34" height="30" fill="#fff6ec"/><rect x="34" y="-14" width="28" height="18" fill="#ffe7d2"/><path d="M4 -26 a13 13 0 0 1 26 0z" fill="#3d7bd9"/><rect x="12" y="-14" width="10" height="18" rx="5" fill="#3a4a7c"/><rect x="40" y="-8" width="8" height="12" rx="4" fill="#ffd27a"/></g>` : ''}
  ${palm(u, hero ? W * 0.1 : W * 0.05, H * 0.98, H * 0.62, 1, (hero ? 1.15 : 0.95) * (wide ? 0.8 : 1))}
  ${hero ? palm(u, W * 0.92, H * 0.98, H * 0.52, -1, 1) : palm(u, W * 0.93, H * 0.92, H * 0.46, -1, 0.85 * (wide ? 0.8 : 1))}
  <g class="sc-fly" transform="translate(${hero ? W * 0.14 : wide ? W * 0.1 : W * 0.34} ${hero ? H * 0.12 : wide ? H * 0.16 : H * 0.15}) rotate(-12)"><ellipse cx="0" cy="0" rx="22" ry="5" fill="#fff"/><path d="M-4 0 l-12 -14 l8 0 l14 12z M-4 0 l-12 14 l8 0 l14 -12z" fill="#e8eefc"/><path d="M-20 -2 l-5 -9 l6 1 l4 7z" fill="#dfe6f8"/><ellipse cx="14" cy="-1" rx="5" ry="2" fill="#6aa7ff" opacity=".7"/></g>`;
}

function coast(u, W, H) {
  const hz = Math.round(H * 0.55);
  const houses = [[0, 0, 24, 18], [26, 3, 22, 16], [50, -2, 26, 20], [78, 4, 22, 16], [102, 0, 26, 19]]
    .map(([x, y, w, h], i) => `<g transform="translate(${x} ${y})"><rect y="${-h}" width="${w}" height="${h}" fill="${['#fff1dc', '#ffe0c0', '#fff8ea', '#ffd9b5', '#fff1dc'][i]}"/><path d="M-2 ${-h} l${w / 2 + 2} -11 l${w / 2 + 2} 11z" fill="${['#e2623e', '#d2512f', '#e87a4d', '#cf4b2c', '#e2623e'][i]}"/><rect x="${w / 2 - 3}" y="${-h + 6}" width="6" height="9" fill="#5a4a6a" opacity=".7"/></g>`)
    .join('');
  return `<defs>${lin(u + 'sk', [[0, '#3a9bff'], [1, '#bfe6ff']])}${lin(u + 'se', [[0, '#3fc4dc'], [1, '#1b73c4']])}${lin(u + 'hl', [[0, '#7dc46a'], [1, '#2f8a4a']])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}sk)"/>
  <g class="sc-drift"><ellipse cx="${W * 0.55}" cy="${H * 0.16}" rx="38" ry="10" fill="#fff"/><ellipse cx="${W * 0.55 + 20}" cy="${H * 0.16 - 8}" rx="24" ry="11" fill="#fff"/><ellipse cx="${W * 0.2}" cy="${H * 0.28}" rx="28" ry="8" fill="#fff" opacity=".9"/></g>
  <g class="sc-glide"><g transform="translate(${W * 0.4} ${H * 0.34})"><path class="sc-flap" d="M0 0 q6 -7 12 0 q6 -7 12 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></g></g>
  <g class="sc-glide" style="animation-delay:-3s"><g transform="translate(${W * 0.5} ${H * 0.28})"><path class="sc-flap" style="animation-delay:-.2s" d="M0 0 q6 -7 12 0 q6 -7 12 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></g></g>
  <rect y="${hz}" width="${W}" height="${H - hz}" fill="url(#${u}se)"/>
  <g class="sc-sail"><g transform="translate(${W * 0.22} ${hz + 14})"><g class="sc-float"><path d="M-14 0 h28 l-5 8 h-18z" fill="#fff4e4"/><path d="M0 -2 V-30 L16 -4z" fill="#fff"/><path d="M-2 -2 V-22 L-14 -4z" fill="#ffd9b5"/></g></g></g>
  ${[0.12, 0.3, 0.5].map((k, i) => `<path class="sc-wave" style="animation-delay:${i * 0.7}s" d="M0 ${hz + (H - hz) * k} q${W * 0.1} -5 ${W * 0.2} 0 t${W * 0.2} 0 t${W * 0.2} 0 t${W * 0.2} 0 t${W * 0.2} 0" stroke="#fff" stroke-opacity=".4" stroke-width="2" fill="none"/>`).join('')}
  <path d="M${W * 0.28} ${H} Q${W * 0.4} ${hz - 4} ${W * 0.62} ${hz - 30} Q${W * 0.86} ${hz - 54} ${W} ${hz - 60} V${H}Z" fill="url(#${u}hl)"/>
  <g transform="translate(${W * 0.4} ${hz + 18}) scale(1.1)">${houses}<g transform="translate(130 0)"><rect y="-40" width="14" height="40" fill="#fff4e4"/><path d="M-2 -40 l9 -16 l9 16z" fill="#d94a2b"/><rect x="4" y="-30" width="6" height="9" rx="3" fill="#5a4a6a" opacity=".7"/></g></g>
  <g transform="translate(${W * 0.34} ${hz + 38})">${houses}</g>
  ${[[0.3, 8], [0.78, 20], [0.9, 4]].map(([x, y]) => `<g transform="translate(${W * x} ${hz + y})"><rect x="-2" y="-8" width="4" height="12" fill="#7a4d2c"/><circle cy="-16" r="11" fill="#2f9a4d"/><circle cx="6" cy="-12" r="8" fill="#3fb25f"/></g>`).join('')}
  <path d="M0 ${H * 0.9} Q${W * 0.2} ${H * 0.8} ${W * 0.42} ${H * 0.88} L${W * 0.5} ${H} H0Z" fill="#f4d9a8"/>`;
}

function tooth(u, W, H, hero, mood, align = 'left') {
  const cx = align === 'left' ? W * 0.24 : W * 0.74;
  return `<defs>${lin(u + 'bg', [[0, '#7fe3d6'], [1, '#41b9c4']], 0, 0, 1, 1)}${lin(u + 'th', [[0, '#ffffff'], [1, '#dff1f3']])}${rad(u + 'gl', [[0, '#fff', 0.7], [1, '#fff', 0]])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}bg)"/>
  <circle cx="${cx}" cy="${H * 0.46}" r="${H * 0.62}" fill="url(#${u}gl)"/>
  <g opacity=".5"><rect x="${W * 0.72}" y="${H * 0.18}" width="${W * 0.22}" height="${H * 0.62}" rx="6" fill="#d8f6f3"/><rect x="${W * 0.76}" y="${H * 0.26}" width="${W * 0.06}" height="${H * 0.16}" rx="3" fill="#8edad3"/><rect x="${W * 0.85}" y="${H * 0.26}" width="${W * 0.06}" height="${H * 0.16}" rx="3" fill="#8edad3"/></g>
  <g class="sc-twinkle"><path d="M${W * 0.4} ${H * 0.2} l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" fill="#fff"/></g>
  <g class="sc-twinkle" style="animation-delay:.7s"><path d="M${W * 0.12} ${H * 0.18} l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" fill="#fff"/></g>
  ${[[0.1, 0.78, 0], [0.2, 0.9, 1.3], [0.34, 0.84, 2.2], [0.46, 0.92, 0.7]].map(([x, y, d]) => `<circle class="sc-rise" style="animation-delay:${d}s" cx="${W * x}" cy="${H * y}" r="${4 + d * 1.5}" fill="#fff" fill-opacity=".55"/>`).join('')}
  <g transform="translate(${cx} ${H * 0.5}) scale(${H / 190})"><g class="sc-bounce">
    <path d="M-34 -48 C-56 -56 -68 -26 -60 0 C-56 22 -42 32 -38 56 C-35 70 -22 68 -20 52 C-17 34 -8 28 0 28 C8 28 17 34 20 52 C22 68 35 70 38 56 C42 32 56 22 60 0 C68 -26 56 -56 34 -48 C22 -43 12 -39 0 -39 C-12 -39 -22 -43 -34 -48Z" fill="url(#${u}th)" stroke="#bfe3e6" stroke-width="2"/>
    <path d="M-44 -30 C-52 -22 -50 -8 -48 0" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".9"/>
    <g class="sc-blink"><ellipse cx="-17" cy="-6" rx="4" ry="5" fill="#4a3a58"/><ellipse cx="17" cy="-6" rx="4" ry="5" fill="#4a3a58"/><circle cx="-15.5" cy="-8" r="1.4" fill="#fff"/><circle cx="18.5" cy="-8" r="1.4" fill="#fff"/></g>
    <ellipse cx="-33" cy="8" rx="10" ry="7" fill="#ff9db8" opacity=".75"/><ellipse cx="33" cy="8" rx="10" ry="7" fill="#ff9db8" opacity=".75"/>
    <path d="M-10 6 Q0 18 10 6" stroke="#4a3a58" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g></g>`;
}

function car(u, W, H, hero, mood, align = 'right') {
  const cx = align === 'left' ? W * 0.3 : W * 0.62;
  const gy = H * 0.82;
  return `<defs>${lin(u + 'bg', [[0, '#3c2f48'], [1, '#8c5a5a']])}${lin(u + 'bd', [[0, '#5a5f78'], [1, '#34374a']])}${rad(u + 'wn', [[0, '#ffd9a0'], [1, '#ff9f6a']])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}bg)"/>
  <rect x="${W * 0.66}" y="${H * 0.08}" width="${W * 0.28}" height="${H * 0.52}" rx="6" fill="url(#${u}wn)"/><path d="M${W * 0.8} ${H * 0.08} v${H * 0.52} M${W * 0.66} ${H * 0.34} h${W * 0.28}" stroke="#4a3550" stroke-width="3"/>
  <rect y="${gy}" width="${W}" height="${H - gy}" fill="#2a2433"/>
  <g class="sc-glow"><rect x="${W * 0.66}" y="${H * 0.08}" width="${W * 0.28}" height="${H * 0.52}" rx="6" fill="#fff" fill-opacity=".25"/></g>
  ${[0, 1, 2].map((i) => `<rect class="sc-dash" style="animation-delay:${i * 0.5}s" x="${cx - 150 - i * 10}" y="${gy - 34 + i * 14}" width="${26 + i * 8}" height="3" rx="1.5" fill="#fff" fill-opacity=".6"/>`).join('')}
  <g transform="translate(${cx} ${gy - 20}) scale(${H / 150})"><ellipse cx="0" cy="26" rx="84" ry="7" fill="#000" opacity=".35"/>
    <g class="sc-bob">
    <path d="M-76 20 L-66 0 Q-60 -8 -46 -10 L-28 -30 Q-22 -36 -10 -36 L26 -36 Q40 -36 48 -26 L62 -10 Q78 -6 80 8 L82 20Z" fill="url(#${u}bd)"/>
    <path d="M-24 -28 L-14 -32 L8 -32 L8 -12 L-36 -12Z" fill="#aeb6d4" opacity=".85"/><path d="M14 -32 L28 -32 Q36 -30 42 -22 L50 -12 L14 -12Z" fill="#aeb6d4" opacity=".85"/>
    <path class="sc-glow" d="M80 -2 L132 -14 L132 18 L80 6Z" fill="#ffe28a" fill-opacity=".35"/>
    <rect x="70" y="-4" width="10" height="6" rx="3" fill="#ffe28a"/>
    ${[-46, 50].map((x) => `<g transform="translate(${x} 22)"><circle r="15" fill="#14141b"/><g class="sc-spin"><circle r="10" fill="#a8adc4"/><path d="M-10 0H10M0 -10V10M-7 -7L7 7M7 -7L-7 7" stroke="#53576d" stroke-width="2"/><circle r="3" fill="#53576d"/></g></g>`).join('')}
    </g>
  </g>`;
}

function laptop(u, W, H, hero, mood, align = 'right') {
  const cx = align === 'left' ? W * 0.3 : W * 0.7;
  return `<defs>${lin(u + 'bg', [[0, '#8a5cff'], [0.6, '#b46cf0'], [1, '#ff7fc4']], 0, 0, 1, 1)}${lin(u + 'sc', [[0, '#2a2f8f'], [0.55, '#6a45e0'], [1, '#ff6fb5']], 0, 0, 1, 1)}${lin(u + 'bs', [[0, '#d9d4f4'], [1, '#9a95c4']])}${rad(u + 'gl', [[0, '#fff', 0.55], [1, '#fff', 0]])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}bg)"/>
  <circle cx="${cx}" cy="${H * 0.45}" r="${H * 0.7}" fill="url(#${u}gl)"/>
  <circle cx="${W * 0.1}" cy="${H * 0.2}" r="22" fill="#fff" opacity=".14"/><circle cx="${W * 0.9}" cy="${H * 0.85}" r="28" fill="#fff" opacity=".12"/>
  ${[[0.06, 0.8, 0], [0.16, 0.9, 1.1], [0.88, 0.75, 2], [0.78, 0.9, 0.6], [0.5, 0.95, 1.7]].map(([x, y, d]) => `<path class="sc-rise" style="animation-delay:${d}s" d="M${W * x} ${H * y} l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="#fff" fill-opacity=".75"/>`).join('')}
  <g transform="translate(${cx} ${H * 0.52}) scale(${H / 170})"><g class="sc-float">
    <polygon points="-72,-62 62,-74 70,8 -64,20" fill="#1d1c4a"/><polygon points="-66,-56 57,-67 63,2 -59,13" fill="url(#${u}sc)"/>
    <g class="sc-glow"><polygon points="-66,-56 57,-67 63,2 -59,13" fill="#fff" fill-opacity=".22"/></g>
    <rect class="sc-type" x="-52" y="-44" width="52" height="5" rx="2.5" fill="#fff" fill-opacity=".8"/>
    <rect class="sc-type" style="animation-delay:.5s" x="-52" y="-32" width="74" height="5" rx="2.5" fill="#ffd6f0" fill-opacity=".8"/>
    <rect class="sc-type" style="animation-delay:1s" x="-52" y="-20" width="40" height="5" rx="2.5" fill="#d6f0ff" fill-opacity=".8"/>
    <rect class="sc-glow" x="-8" y="-21" width="4" height="7" fill="#fff"/>
    <polygon points="-80,24 76,10 98,34 -58,50" fill="url(#${u}bs)"/><polygon points="-34,32 24,27 30,33 -28,38" fill="#7e79ad" opacity=".8"/>
  </g></g>`;
}

function mountain(u, W, H) {
  const hz = H * 0.62;
  const pine = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="0" width="4" height="9" fill="#5a3a22"/><g class="sc-sway"><path d="M0 -34 l12 18 h-7 l10 14 h-30 l10 -14 h-7z" fill="#1f7a45"/></g></g>`;
  const bird = (x, y, d) => `<g class="sc-glide" style="animation-delay:${d}s"><g transform="translate(${x} ${y})"><path class="sc-flap" style="animation-delay:${d}s" d="M0 0 q6 -7 12 0 q6 -7 12 0" stroke="#4a3550" stroke-width="2" fill="none" stroke-linecap="round"/></g></g>`;
  return `<defs>${lin(u + 'sk', [[0, '#6fb8ff'], [0.7, '#ffcfa0'], [1, '#ffe3c0']])}${lin(u + 'm1', [[0, '#7a6fd0'], [1, '#4a4aa0']])}${lin(u + 'gr', [[0, '#7fd26a'], [1, '#2f9a55']])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}sk)"/>
  <circle class="sc-pulse" cx="${W * 0.82}" cy="${H * 0.2}" r="22" fill="#fff4c2" fill-opacity=".85"/>
  ${bird(W * 0.3, H * 0.3, 0)}${bird(W * 0.4, H * 0.24, -2)}${bird(W * 0.2, H * 0.36, -4)}
  <g class="sc-drift"><ellipse cx="${W * 0.25}" cy="${H * 0.18}" rx="36" ry="9" fill="#fff" opacity=".9"/><ellipse cx="${W * 0.78}" cy="${H * 0.1}" rx="28" ry="8" fill="#fff" opacity=".85"/></g>
  <path d="M0 ${hz} L${W * 0.22} ${H * 0.28} L${W * 0.4} ${hz - 20} L${W * 0.62} ${H * 0.2} L${W * 0.86} ${hz - 30} L${W} ${H * 0.4} V${H}H0Z" fill="url(#${u}m1)"/>
  <path d="M${W * 0.22} ${H * 0.28} l-18 26 l10 -6 l8 10 l8 -10 l10 6z M${W * 0.62} ${H * 0.2} l-24 32 l12 -7 l12 12 l12 -12 l14 8z" fill="#fff" opacity=".92"/>
  <path class="sc-twinkle" d="M${W * 0.22} ${H * 0.28} l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" fill="#fff"/><path class="sc-twinkle" style="animation-delay:1.2s" d="M${W * 0.62} ${H * 0.2} l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" fill="#fff"/>
  <path d="M0 ${hz + 14} Q${W * 0.3} ${hz - 6} ${W * 0.6} ${hz + 12} T${W} ${hz + 6} V${H}H0Z" fill="url(#${u}gr)"/>
  ${pine(W * 0.12, hz + 34, 1.3)}${pine(W * 0.2, hz + 44, 1)}${pine(W * 0.84, hz + 30, 1.4)}${pine(W * 0.92, hz + 42, 1)}${pine(W * 0.76, hz + 46, 0.9)}
  <path d="M${W * 0.42} ${H} Q${W * 0.5} ${hz + 20} ${W * 0.58} ${H}Z" fill="#f2d6a0"/>`;
}

const star = (x, y, r, d = 0, c = '#fff') =>
  `<path class="sc-twinkle" style="animation-delay:${d}s" d="M${x} ${y - r} l${r * 0.28} ${r * 0.72} l${r * 0.72} ${r * 0.28} l${-r * 0.72} ${r * 0.28} l${-r * 0.28} ${r * 0.72} l${-r * 0.28} ${-r * 0.72} l${-r * 0.72} ${-r * 0.28} l${r * 0.72} ${-r * 0.28}z" fill="${c}"/>`;

function concert(u, W, H, hero) {
  const cx = hero ? W / 2 : W * 0.72;
  const k = H / 240;
  const beam = (x, c, d) => `<polygon class="sc-beam" style="animation-delay:${d}s" points="${x - 8},0 ${x + 8},0 ${x + 70},${H * 0.82} ${x - 70},${H * 0.82}" fill="${c}" fill-opacity=".26"/>`;
  const crowd = [0.08, 0.2, 0.34, 0.5, 0.64, 0.8, 0.92].map((x, i) => `<g class="sc-bob" style="animation-delay:${-i * 0.17}s"><circle cx="${W * x}" cy="${H * 0.9}" r="${11 * k}" fill="#0c0824"/><rect x="${W * x - 3}" y="${H * 0.74}" width="6" height="${H * 0.1}" rx="3" fill="#0c0824"/></g>`).join('');
  const note = (x, d) => `<g class="sc-note" style="animation-delay:${d}s"><g transform="translate(${x} ${H * 0.6})"><circle cx="0" cy="0" r="5" fill="#ffd166"/><path d="M5 0 V-20 l9 4" stroke="#ffd166" stroke-width="3" fill="none"/></g></g>`;
  return `<defs>${lin(u + 'bg', [[0, '#1d1450'], [1, '#8a2fa8']])}${rad(u + 'gl', [[0, '#ffe28a', 0.9], [1, '#ffe28a', 0]])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}bg)"/>
  ${beam(W * 0.42, '#7fd0ff', 0)}${beam(W * 0.68, '#ff9fd0', -1.6)}${beam(W * 0.92, '#ffd166', -3.2)}
  ${star(W * 0.12, H * 0.2, 7, 0)}${star(W * 0.3, H * 0.1, 5, 1)}${star(W * 0.55, H * 0.16, 6, 2)}
  <circle class="sc-pulse" cx="${cx}" cy="${H * 0.46}" r="${70 * k}" fill="url(#${u}gl)"/>
  ${note(cx - 60 * k, 0)}${note(cx + 50 * k, -1.3)}${note(cx + 10 * k, -2.6)}
  <g transform="translate(${cx} ${H * 0.82}) scale(${k})"><rect x="-2" y="-70" width="4" height="70" fill="#cfcfe8"/><ellipse cx="0" cy="-78" rx="10" ry="13" fill="#e8e8f8"/><path d="M-10 -78 h20" stroke="#8a8aa8" stroke-width="2"/><ellipse cx="0" cy="0" rx="24" ry="4" fill="#cfcfe8"/></g>
  <rect y="${H * 0.82}" width="${W}" height="${H * 0.18}" fill="#14102e"/>${crowd}`;
}

function house(u, W, H, hero) {
  const cx = hero ? W / 2 : W * 0.7;
  const k = H / 240;
  return `<defs>${lin(u + 'sk', [[0, '#5bb6ff'], [1, '#dff3ff']])}${lin(u + 'gr', [[0, '#8ad66f'], [1, '#2f9a55']])}${rad(u + 'sun', [[0, '#fff6d0', 1], [1, '#ffd27a', 0]])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}sk)"/>
  <circle class="sc-pulse" cx="${W * 0.9}" cy="${H * 0.14}" r="34" fill="url(#${u}sun)"/>
  <g class="sc-drift"><ellipse cx="${W * 0.3}" cy="${H * 0.2}" rx="34" ry="9" fill="#fff"/><ellipse cx="${W * 0.62}" cy="${H * 0.12}" rx="26" ry="8" fill="#fff" opacity=".9"/></g>
  <path d="M0 ${H * 0.74} Q${W * 0.4} ${H * 0.66} ${W} ${H * 0.74} V${H} H0Z" fill="url(#${u}gr)"/>
  <g transform="translate(${cx} ${H * 0.78}) scale(${k * 1.05})">
    <rect x="-52" y="-62" width="104" height="62" fill="#fff1dc"/><path d="M-62 -60 L0 -112 L62 -60Z" fill="#e2623e"/><rect x="26" y="-100" width="14" height="30" fill="#c9503a"/>
    ${[0, 1, 2].map((i) => `<circle class="sc-smoke" style="animation-delay:${-i * 1.2}s" cx="33" cy="-108" r="${5 + i * 2}" fill="#fff" fill-opacity=".8"/>`).join('')}
    <rect x="-12" y="-38" width="24" height="38" rx="3" fill="#7a4d2c"/><circle cx="6" cy="-18" r="2" fill="#ffd166"/>
    <rect x="-44" y="-50" width="22" height="20" rx="3" fill="#8fd3ff"/><rect x="22" y="-50" width="22" height="20" rx="3" fill="#8fd3ff"/>
    <g class="sc-glow"><rect x="-44" y="-50" width="22" height="20" rx="3" fill="#ffe9a8"/></g>
    <g class="sc-bounce"><rect x="58" y="-24" width="28" height="24" rx="2" fill="#d9a066"/><path d="M58 -14 h28" stroke="#a8703a" stroke-width="3"/></g>
  </g>
  <g class="sc-sway"><g transform="translate(${W * 0.1} ${H * 0.74})"><rect x="-3" y="-30" width="6" height="30" fill="#7a4d2c"/><circle cy="-42" r="22" fill="#2f9a4d"/><circle cx="12" cy="-34" r="14" fill="#3fb25f"/></g></g>`;
}

function runner(u, W, H, hero) {
  const cx = hero ? W / 2 : W * 0.72;
  const k = H / 240;
  const leg = (cls, d) => `<g class="${cls}" style="animation-delay:${d}s"><path d="M0 0 L8 20 L0 38" stroke="#2b2f6b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"/></g>`;
  return `<defs>${lin(u + 'sk', [[0, '#7fb6ff'], [1, '#ffe7c4']])}${lin(u + 'gr', [[0, '#9be07a'], [1, '#3da160']])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}sk)"/>
  <g class="sc-drift"><ellipse cx="${W * 0.25}" cy="${H * 0.2}" rx="32" ry="9" fill="#fff"/><ellipse cx="${W * 0.55}" cy="${H * 0.1}" rx="24" ry="7" fill="#fff" opacity=".9"/></g>
  <path d="M0 ${H * 0.5} L${W * 0.2} ${H * 0.34} L${W * 0.42} ${H * 0.5}Z M${W * 0.3} ${H * 0.5} L${W * 0.55} ${H * 0.3} L${W * 0.8} ${H * 0.5}Z" fill="#8a8fd8" opacity=".7"/>
  <path d="M0 ${H * 0.5} H${W} V${H} H0Z" fill="url(#${u}gr)"/><path d="M0 ${H * 0.76} H${W} V${H} H0Z" fill="#6a6f8f"/><path d="M0 ${H * 0.84} H${W}" stroke="#fff" stroke-width="3" stroke-dasharray="16 14" opacity=".8"/>
  ${[0, 1, 2].map((i) => `<rect class="sc-dash" style="animation-delay:${i * 0.45}s" x="${cx - 70 * k}" y="${H * 0.62 + i * 12}" width="${24 + i * 6}" height="3" rx="1.5" fill="#fff" fill-opacity=".7"/>`).join('')}
  <g transform="translate(${cx} ${H * 0.62}) scale(${k * 1.1})"><g class="sc-bob">
    ${leg('sc-swing', 0)}${leg('sc-swing', -0.35)}
    <path d="M-2 0 L4 -34" stroke="#ff6f61" stroke-width="12" stroke-linecap="round"/><circle cx="6" cy="-48" r="9" fill="#ffd1a8"/><path d="M-3 -52 q8 -12 18 -2" stroke="#3a2a22" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path class="sc-swing" d="M2 -28 L-14 -14" stroke="#ffd1a8" stroke-width="5" stroke-linecap="round"/>
  </g></g>
  <g transform="translate(${W * 0.08} ${H * 0.5})"><rect x="0" y="-60" width="4" height="60" fill="#e8e8f0"/><g class="sc-sway"><path d="M4 -60 h44 v22 h-44z" fill="#ffd166"/><path d="M4 -60 h11 v11 h-11z M26 -60 h11 v11 h-11z M15 -49 h11 v11 h-11z M37 -49 h11 v11 h-11z" fill="#2a2f6b"/></g></g>`;
}

function graduation(u, W, H, hero) {
  const cx = hero ? W / 2 : W * 0.72;
  const k = H / 240;
  const colors = ['#ffd166', '#ff6fa9', '#4dd4c6', '#fff', '#b79bff'];
  const pieces = Array.from({ length: 18 }, (_, i) => `<rect class="sc-fall" style="animation-delay:${-(i % 9) * 0.55}s;animation-duration:${4 + (i % 4)}s" x="${(i * 61) % W}" y="${-10 + (i % 5) * 6}" width="6" height="10" rx="1.5" fill="${colors[i % 5]}"/>`).join('');
  return `<defs>${lin(u + 'bg', [[0, '#27337a'], [1, '#6a4fc4']])}${rad(u + 'gl', [[0, '#ffe28a', 0.8], [1, '#ffe28a', 0]])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}bg)"/>
  <circle class="sc-pulse" cx="${cx}" cy="${H * 0.5}" r="${90 * k}" fill="url(#${u}gl)"/>
  ${star(W * 0.1, H * 0.2, 8, 0, '#ffe28a')}${star(W * 0.3, H * 0.12, 5, 1, '#fff')}${star(W * 0.52, H * 0.82, 6, 2, '#ffe28a')}
  <g transform="translate(${cx} ${H * 0.56}) scale(${k * 1.1})">
    <g class="sc-toss"><path d="M-70 -6 L0 -36 L70 -6 L0 24Z" fill="#1c1c3a"/><path d="M-40 6 v22 q40 22 80 0 v-22 L0 22Z" fill="#2c2c58"/><path d="M0 -6 L56 -2 v32" stroke="#ffd166" stroke-width="3" fill="none"/><circle cx="56" cy="32" r="5" fill="#ffd166"/></g>
    <g transform="translate(-10 64)"><rect x="-44" y="0" width="88" height="14" rx="7" fill="#f6ecd2"/><rect x="-6" y="0" width="12" height="14" fill="#e2478f"/></g>
  </g>
  ${pieces}`;
}

function rocket(u, W, H, hero) {
  const cx = hero ? W / 2 : W * 0.74;
  const k = H / 240;
  return `<defs>${lin(u + 'bg', [[0, '#0e1240'], [1, '#6a3fa8']])}${lin(u + 'rk', [[0, '#ffffff'], [1, '#c9d4f2']])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}bg)"/>
  ${[[0.1, 0.2], [0.3, 0.1], [0.45, 0.35], [0.62, 0.12], [0.9, 0.3], [0.2, 0.6], [0.4, 0.8]].map(([x, y], i) => star(W * x, H * y, 4 + (i % 3), i * 0.5)).join('')}
  <circle cx="${W * 0.14}" cy="${H * 0.74}" r="${28 * k}" fill="#ff9f7a"/><circle cx="${W * 0.14 - 8}" cy="${H * 0.74 - 6}" r="${5 * k}" fill="#e8805c"/>
  ${[0, 1, 2].map((i) => `<circle class="sc-smoke" style="animation-delay:${-i * 0.9}s" cx="${cx + (i - 1) * 10}" cy="${H * 0.9}" r="${10 + i * 3}" fill="#fff" fill-opacity=".7"/>`).join('')}
  <g transform="translate(${cx} ${H * 0.5}) scale(${k * 1.1})"><g class="sc-shake">
    <g class="sc-flame"><path d="M-12 40 Q0 96 12 40Z" fill="#ffb347"/><path d="M-6 40 Q0 70 6 40Z" fill="#fff3b0"/></g>
    <path d="M0 -62 Q26 -30 20 40 H-20 Q-26 -30 0 -62Z" fill="url(#${u}rk)"/><circle cy="-14" r="11" fill="#5bb6ff" stroke="#8a93b8" stroke-width="3"/>
    <path d="M-20 18 L-38 44 L-20 38Z M20 18 L38 44 L20 38Z" fill="#e2478f"/><path d="M0 -62 Q10 -50 12 -42 H-12 Q-10 -50 0 -62Z" fill="#e2478f"/>
  </g></g>`;
}

function wedding(u, W, H, hero) {
  const cx = hero ? W / 2 : W * 0.72;
  const k = H / 240;
  const heart = (x, d, s) => `<g class="sc-heart" style="animation-delay:${d}s"><path transform="translate(${x} ${H * 0.8}) scale(${s})" d="M0 6 C-14 -6 -8 -16 0 -8 C8 -16 14 -6 0 6Z" fill="#ff5f95"/></g>`;
  return `<defs>${lin(u + 'bg', [[0, '#ffe3f1'], [1, '#c7a8ff']])}${rad(u + 'gl', [[0, '#fff', 0.9], [1, '#fff', 0]])}${lin(u + 'au', [[0, '#fff1b0'], [1, '#d9a441']])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}bg)"/>
  <circle class="sc-pulse" cx="${cx}" cy="${H * 0.48}" r="${100 * k}" fill="url(#${u}gl)"/>
  <circle cx="${W * 0.15}" cy="${H * 0.25}" r="26" fill="#fff" opacity=".25"/><circle cx="${W * 0.5}" cy="${H * 0.85}" r="20" fill="#fff" opacity=".22"/><circle cx="${W * 0.95}" cy="${H * 0.15}" r="30" fill="#fff" opacity=".2"/>
  ${heart(cx - 70 * k, 0, 1.4)}${heart(cx + 60 * k, -1.4, 1.1)}${heart(cx - 10 * k, -2.8, 1.7)}${heart(W * 0.1, -2, 1)}
  ${star(cx - 60 * k, H * 0.25, 8, 0, '#fff')}${star(cx + 70 * k, H * 0.3, 6, 1.1, '#fff')}${star(cx + 10 * k, H * 0.12, 5, 2, '#fff')}
  <g transform="translate(${cx} ${H * 0.5}) scale(${k * 1.1})"><g class="sc-float">
    <g class="sc-spin-slow"><circle cx="-18" cy="0" r="34" fill="none" stroke="url(#${u}au)" stroke-width="9"/><circle cx="18" cy="0" r="34" fill="none" stroke="#f3e3a0" stroke-width="9" opacity=".95"/></g>
    <path d="M0 -50 l8 -10 l8 10 l-8 8z" fill="#bfeaff" stroke="#fff" stroke-width="2"/><g class="sc-twinkle"><circle cx="8" cy="-60" r="3" fill="#fff"/></g>
  </g></g>`;
}

function fireworks(u, W, H, hero) {
  const cx = hero ? W / 2 : W * 0.7;
  const burst = (x, y, r, c, d) => {
    const rays = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return `<path d="M${x + Math.cos(a) * r * 0.35} ${y + Math.sin(a) * r * 0.35} L${x + Math.cos(a) * r} ${y + Math.sin(a) * r}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;
    }).join('');
    return `<g class="sc-burst" style="animation-delay:${d}s">${rays}<circle cx="${x}" cy="${y}" r="3" fill="#fff"/></g>`;
  };
  const bld = [0.0, 0.08, 0.17, 0.3, 0.42, 0.56, 0.7, 0.8, 0.9].map((x, i) => `<rect x="${W * x}" y="${H * (0.74 - (i % 4) * 0.05)}" width="${W * 0.09}" height="${H}" fill="#0b0a24"/>`).join('');
  return `<defs>${lin(u + 'bg', [[0, '#080a2e'], [1, '#3b2a78']])}</defs>
  <rect width="${W}" height="${H}" fill="url(#${u}bg)"/>
  ${[[0.1, 0.1], [0.4, 0.06], [0.58, 0.3], [0.95, 0.08], [0.25, 0.4]].map(([x, y], i) => star(W * x, H * y, 4, i * 0.6)).join('')}
  <circle cx="${W * 0.08}" cy="${H * 0.2}" r="14" fill="#fff4c2" opacity=".9"/>
  ${burst(cx, H * 0.36, 52, '#ffd166', 0)}${burst(cx - W * 0.2, H * 0.52, 36, '#ff6fa9', -1.3)}${burst(cx + W * 0.16, H * 0.2, 30, '#4dd4c6', -2.6)}
  ${bld}
  ${[0.12, 0.34, 0.62, 0.84].map((x, i) => `<rect class="sc-glow" style="animation-delay:${i * 0.4}s" x="${W * x}" y="${H * 0.82}" width="5" height="6" fill="#ffd166"/>`).join('')}`;
}

const SCENES = { birthday, beach, coast, tooth, car, laptop, mountain, concert, house, runner, graduation, rocket, wedding, fireworks };

export const SCENE_KINDS = Object.keys(SCENES);

/**
 * Returns an <svg> string. opts: { variant: 'card' | 'hero', mood: 'day' | 'sunset', align: 'left' | 'right', label }
 * 'hero' uses a taller viewBox for full-bleed headers and share images; 'wide' a short banner (desktop hero).
 */
export function sceneSvg(kind, opts = {}) {
  const fn = SCENES[kind] || mountain;
  const hero = opts.variant === 'hero';
  const W = 400;
  const H = hero ? 360 : opts.variant === 'wide' ? 170 : 240;
  const u = `s${++counter}`;
  const inner = fn(u, W, H, hero, opts.mood || 'sunset', opts.align);
  const a11y = opts.label ? `role="img" aria-label="${opts.label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="scene-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="${opts.fit || 'xMidYMid slice'}" ${a11y} focusable="false">${inner}</svg>`;
}
