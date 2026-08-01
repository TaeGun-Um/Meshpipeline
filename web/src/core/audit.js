// 씬 감사 — 지금까지 실제로 버그를 잡아낸 점검들만 모았다.
//
// ── 왜 이 파일이 있는가 ────────────────────────────────────────────────────
// 작업하면서 오류를 여러 방식으로 잡았는데, 방식마다 실효성이 크게 달랐다.
// 효과가 있었던 것만 골라 코드로 굳혀 둔다. 다음에 또 손으로 재현하지 않도록.
//
//   실효 있었음
//     · 베이스라인 스크린샷 + **픽셀** 비교   버그 5건 이상 검출
//     · 생성 시점의 인자 검증 (재질 없음, 파라미터 오타)  즉시·정확한 위치
//     · 최적화 전 실측 (무엇이 비싼지 세어보기)   45% 를 차지한 범인 발견
//     · 규약 실측 (v축 방향, glTF→유니티 축)   추측이 두 번 다 틀렸다
//
//   실효 없었음 — 쓰지 말 것
//     · SHA256 파일 해시 비교
//       파일 쓰기 경합 때문에 **거짓 실패**를 냈다. RGB·알파가 바이트 단위로
//       같은데도 해시가 달랐다. 이미지는 이미지로 비교해야 한다 (tools/compare-shots.mjs).
//     · 셸에서 명령 두 개를 비교하는 식의 점검
//       cwd 가 바뀌어 두 '에러 문자열' 을 비교하고 통과로 읽은 적이 있다.
//       비교 전에 대상이 존재하는지를 먼저 단언해야 한다.
//
// ── 이 감사가 잡는 것 ──────────────────────────────────────────────────────
// 스크린샷 비교는 "달라졌다" 는 알려주지만 "왜" 는 모른다. 반대로 이 감사는
// 화면을 안 보고도 **예산 초과·설정 실수**를 숫자로 잡는다. 둘은 보완재다.
//
//   브라우저 콘솔에서:  __audit()

// 화면에 없는 비용을 세는 기준값. 넘으면 경고하지만 실패는 아니다 —
// 예산은 "여기서부터는 의식하고 넘겨라" 는 선이지 금지선이 아니다.
const BUDGET = {
  // ── 실측으로 정한 값 ─────────────────────────────────────────────────────
  // 1.2M -> 2.2M -> 4.0M. 앞의 둘은 **감으로 쓴 숫자**였다. 셋째만 근거가 있다.
  //
  // 측정 (12x12 도시, 1345x1270, 픽셀비 1):
  //   프레임 p50 6.1ms / p95 6.3ms = 164fps
  //   드로우콜 469 · 한 프레임 4.5M 삼각형(그림자 패스 포함)
  //   씬 지오메트리 2.33M
  //
  // 60fps(16.7ms) 기준으로 예산의 37% 만 쓰고 있고 p95 가 p50 보다 0.2ms 높을
  // 뿐이라 튀는 프레임도 없다. 여유가 2.7배다.
  //
  // 그래서 4.0M 으로 잡는다 — 지금의 1.7배. 그 위로는 60fps 여유가
  // 얇아지므로 그때는 실제로 줄여야 한다.
  //
  // 주의: 이 기기·이 해상도 기준이다. 유니티 쪽 성능은 따로 재야 한다.
  // 다만 삼각형 수는 그대로 넘어가므로 상한의 근거로는 쓸 수 있다.
  triangles: 4_000_000,
  textureMB: 220,
  drawGroups: 900,   // 실측 469
  programs: 60,
  // 빌드 시간은 **설계 단계에서 문제가 아니다.**
  //
  // 브라우저에서 한 번 굽고 나면 그 뒤로는 렌더만 한다. 유니티로 넘어갈 때도
  // 굽는 것은 한 번뿐이고, 게임에 들어가는 것은 구워진 결과물이다.
  // 즉 이 숫자는 **작업자가 기다리는 시간**이지 사용자가 겪는 비용이 아니다.
  //
  // 그래서 넉넉히 둔다. 이걸 아끼려고 도시를 성기게 만들면 본말이 전도된다.
  // 1분을 넘기면 그때는 무언가 잘못된 것이므로 그 선만 지킨다.
  buildMs: 60_000,
};

// 있어야 할 것의 최소 개수.
//
// 상한이 아니라 **하한**이다. 예산은 "너무 많다" 를 잡고 이건 "사라졌다" 를 잡는다.
// 둘 다 필요하다 — 지금까지는 상한만 있었고, 그래서 간판이 통째로 죽은 것을
// 놓쳤다.
//
// 숫자는 넉넉히 잡는다. 정확한 값을 박으면 의도한 변경마다 경고가 떠서
// 아무도 안 보게 된다. "이보다 적으면 무언가 고장난 것" 수준이면 된다.
//
// ── 하한을 내릴 때의 규칙 ──────────────────────────────────────────────────
// 경고가 떴다고 하한을 내리면 이 표는 아무것도 안 지킨다. 내려도 되는 경우는
// **의도한 변경이 개수를 바꿨고, 아래 비율(RATIOS)이 전부 정상일 때**뿐이다.
// 비율이 같이 깨져 있으면 그건 의도가 아니라 사고다.
//
// 건물 300 -> 200: 사용자가 "원래 건물들도 좀 크기 키우던지" 와 "도로가 너무
// 많다" 를 지시해서 필지를 키우고 대지를 3x3 까지 병합했다. 건물 316 -> 242.
// 채당 크기가 커진 것이므로 비율 넷은 전부 정상 범위였다 (그 사실을 확인하고
// 내린 것이다). 골목은 사용자 지시로 폐기해서 항목 자체를 뺐다 (layout.js).
const EXPECT = {
  간판: { min: 200 },
  건물: { min: 200 },
  사람: { min: 1000 },
  가로시설: { min: 100 },
};

// ── 비율 ───────────────────────────────────────────────────────────────────
//
// 하한(EXPECT)만으로는 **절반이 죽은 것**을 못 잡는다.
//
// 간판이 1,602개에서 9개로 죽었을 때는 하한 200 이 잡아줬을 것이다. 그런데
// 1,602 -> 900 이면 하한을 한참 넘으므로 아무 말도 안 한다. 그리고 다음
// 작업(대지 병합)은 건물 수 자체를 바꾸므로, **절대 개수로는 "도시가 커졌다"
// 와 "결합이 깨졌다" 를 구분할 수 없다.**
//
// 그래서 비(比)를 본다. 도시가 커지든 작아지든 건물 한 채가 다는 간판 수는
// 크게 안 변해야 한다. 변했다면 그건 규모가 아니라 **관계**가 깨진 것이다.
//
// 대역은 **실측값의 0.75~1.6배**를 기준으로 잡는다. 25% 넘게 빠지면 잡히고,
// 의도한 조정에는 안 울리는 폭이다. 좁게 박으면 변경마다 경고가 떠서 아무도
// 안 보게 된다 (EXPECT 를 넉넉히 잡은 것과 같은 이유).
//
// 실측 (건물 449 · 간판 1,242 · 시설물 715 · 사람 5,913):
//   길에 면한 면 0.52 · 건물당 간판 2.77 · 시설물 1.59 · 사람 13.2
const RATIOS = [
  // streetFaces 건강 지표. 이 함수가 인도 폭을 잘못 봐서 "어느 면도 길에
  // 안 면함" 이 되는 순간 간판과 점포가 통째로 사라진다 — 그 사고의
  // **직접 계측**이다. 개수가 줄기 전에 이 비율이 먼저 떨어진다.
  //
  // 여기만 하한을 규칙(0.39)보다 낮은 0.30 으로 둔다. 대지 병합(슈퍼블록)이
  // 들어오면 **안쪽 필지는 길에 안 면하는 것이 정상**이라 이 비율이 자연히
  // 내려가기 때문이다. 0.30 아래로 가면 그건 병합이 아니라 고장이다.
  { name: '길에 면한 면', a: '면한면', b: '필지면', min: 0.30, max: 0.85 },
  // ── 다시 쟀다 (대지 병합 이후) ──────────────────────────────────────────
  // 처음 대역 2.1~4.4 는 **건물 449 · 간판 1,242 (2.77)** 시절 값이다.
  // 대지 병합이 들어오면서 도시가 "건물이 적고 크고 간판이 많은" 구조로
  // 바뀌었다 — 지금 실측은 **건물 252 · 간판 1,187 (4.71)** 이다.
  //
  // 그래서 이 경보는 정상 상태에서 **항상 켜져 있었다.** 늘 켜진 경보는
  // 아무도 안 보게 되고, 그러면 지표가 있으나 마나다 (2.2 가 경고한 그것).
  // 규칙대로 실측의 0.75~1.6 배로 다시 잡는다.
  { name: '건물당 간판', a: '간판', b: '건물', min: 3.5, max: 7.5 },
  { name: '건물당 가로시설', a: '가로시설', b: '건물', min: 1.2, max: 2.6 },
  { name: '건물당 사람', a: '사람', b: '건물', min: 9.9, max: 22 },
];

// 텍스처 한 장의 VRAM. 밉맵이 원본의 1/3 을 더한다.
function texBytes(t) {
  const img = t.image;
  if (!img || !img.width) return 0;
  return img.width * img.height * 4 * (t.generateMipmaps === false ? 1 : 4 / 3);
}

export function auditScene({ scene, renderer, stats = {} }) {
  const notes = [];
  const warn = (msg) => notes.push(`⚠ ${msg}`);

  let triangles = 0;
  let meshes = 0;
  const materials = new Map();
  const textures = new Map();
  const bySize = new Map();

  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    const n = (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
    triangles += n * (o.isInstancedMesh ? o.count : 1);

    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      materials.set(m.uuid, m);
      for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap', 'aoMap']) {
        const t = m[k];
        if (!t || textures.has(t.uuid)) continue;
        textures.set(t.uuid, texBytes(t));
        const key = t.image ? `${t.image.width}x${t.image.height}` : '?';
        bySize.set(key, (bySize.get(key) ?? 0) + texBytes(t));
      }
    }
  });

  let texBytesTotal = 0;
  for (const v of textures.values()) texBytesTotal += v;
  const textureMB = +(texBytesTotal / 1048576).toFixed(1);
  triangles = Math.round(triangles);

  // ── 예산 ─────────────────────────────────────────────────────────────────
  const drawGroups = countGroups(scene);
  // renderer.info.programs 는 **누적 캐시**다. 스크린샷을 찍거나 렌더 타깃을
  // 바꾸면 그림자·깊이 변형이 쌓여 늘어난다 (빌드 직후 23 → __lock() 후 43).
  // 그래서 예산을 넉넉히 잡는다. 정확한 값을 보려면 빌드 직후에 부를 것.
  const programs = renderer.info.programs?.length ?? 0;
  if (triangles > BUDGET.triangles) warn(`삼각형 ${fmt(triangles)} > 예산 ${fmt(BUDGET.triangles)}`);
  if (textureMB > BUDGET.textureMB) warn(`텍스처 ${textureMB}MB > 예산 ${BUDGET.textureMB}MB`);
  if (drawGroups > BUDGET.drawGroups) warn(`드로우 그룹 ${drawGroups} > 예산 ${BUDGET.drawGroups}`);
  if (programs > BUDGET.programs) warn(`셰이더 프로그램 ${programs} > 예산 ${BUDGET.programs}`);
  if (stats.buildMs > BUDGET.buildMs) warn(`빌드 ${fmt(stats.buildMs)}ms > 예산 ${fmt(BUDGET.buildMs)}ms`);

  // ── 파이프라인 위험 ──────────────────────────────────────────────────────
  //
  // 아래 넷은 브라우저에서는 멀쩡히 보이는데 glTF 로 내보내면 깨지거나 조용히
  // 버려지는 것들이다. 파이프라인의 1순위가 "브라우저와 엔진이 같아 보일 것"
  // 이므로, 화면이 멀쩡하다는 이유로 넘어가면 안 된다.
  for (const m of materials.values()) {
    // (1) emissiveIntensity 가 **1이 아니면** KHR_materials_emissive_strength 확장이
    //     붙는다. 1보다 작아도 붙는다 — 0.22 로 실측했다. 처음에는 '>1' 로 적었다가
    //     buildings.glb 에서 확장을 발견하고 고쳤다.
    //     발광 세기는 emissive 색에 곱해 넣고 세기는 1로 둘 것 (core/material.js).
    if (m.emissive && m.emissiveIntensity !== 1)
      warn(`${m.name || '이름없음'}: emissiveIntensity=${m.emissiveIntensity} (1이 아니면 glTF 확장이 붙는다)`);

    // (2) texture.repeat != 1 은 KHR_texture_transform 을 만든다. UV 를 지오메트리에
    //     구워야 한다 (meshkit.scaleUV / metricBox).
    for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) {
      const t = m[k];
      if (t && (t.repeat.x !== 1 || t.repeat.y !== 1) && !t.__uvBaked) {
        warn(`${m.name || '이름없음'}.${k}: repeat=${t.repeat.x},${t.repeat.y} (KHR_texture_transform 위험)`);
        break;
      }
    }
  }

  // (3) 정점 색을 쓰는데 재질이 vertexColors 를 안 켰다 — 색이 통째로 무시된다.
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.color) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (ms.some((m) => m && !m.vertexColors)) warn(`${o.name || '이름없음'}: color 속성이 있는데 vertexColors 가 꺼져 있다`);
  });

  // (4) 크기 0 이거나 NaN 이 섞인 지오메트리. 화면에서는 안 보이지만 익스포터가 죽는다.
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    if (!p || p.count === 0) { warn(`${o.name || '이름없음'}: 빈 지오메트리`); return; }
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if ([bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].some(Number.isNaN))
      warn(`${o.name || '이름없음'}: 좌표에 NaN`);
  });

  // ── 개수 점검 (실측으로 넣음) ────────────────────────────────────────────
  //
  // 스크린샷 비교는 "달라졌다" 는 알려주지만 **"무엇이 사라졌다" 는 못 알려준다.**
  //
  // 실제로 도시 전체 간판이 1,602개에서 9개로 죽은 적이 있다. 인도 폭 상수
  // 하나가 어긋나 모든 건물의 '길에 면한 면' 판정이 거짓이 된 것인데,
  // 빌드는 성공했고 감사 경고도 0건이었고 기준선은 "달라졌다" 고만 했다.
  // 도시가 심심해 보인다는 지적을 받고서야 알았다.
  //
  // 그래서 **있어야 할 것이 있는지**를 숫자로 본다. 화면을 안 봐도 잡힌다.
  const counts = stats.counts || {};
  for (const [name, { min }] of Object.entries(EXPECT)) {
    const got = counts[name];
    if (got === undefined) continue;
    if (got < min) warn(`${name} ${fmt(got)}개 — 최소 ${fmt(min)}개는 있어야 한다 (사라진 것 아닌가)`);
  }

  // 비율 — "절반이 죽은 것" 은 하한이 아니라 여기서 잡힌다
  const ratios = {};
  for (const r of RATIOS) {
    const a = counts[r.a];
    const b = counts[r.b];
    if (a === undefined || !b) continue;
    const v = a / b;
    ratios[r.name] = Math.round(v * 100) / 100;
    if (v < r.min) warn(`${r.name} ${v.toFixed(2)} < ${r.min} — 관계가 깨졌다 (${r.a} ${fmt(a)} / ${r.b} ${fmt(b)})`);
    if (v > r.max) warn(`${r.name} ${v.toFixed(2)} > ${r.max} — 관계가 깨졌다 (${r.a} ${fmt(a)} / ${r.b} ${fmt(b)})`);
  }

  // ── 배치 (core/placement.js) ─────────────────────────────────────────────
  //
  // 위의 검사들이 못 보는 것을 본다 — **허공에 뜬 것과 관통**. 여기까지가
  // 화면을 안 보고 잡을 수 있는 범위다.
  //
  // 씬이 배치 검사를 돌렸을 때만 값이 있다. 안 돌린 씬은 조용히 넘어간다.
  const place = stats.placement;
  if (place) {
    for (const f of place.faults) warn(`배치 — ${f.msg}`);
  }

  // ── 어디에 돈이 들었나 ───────────────────────────────────────────────────
  //
  // "최적화 전에 먼저 센다" 는 규칙이 이 목록이다. 추측으로 줄이면 엉뚱한
  // 곳을 건드린다 — 실제로 파사드 시트 10장이 텍스처 전체의 61% 였다.
  const texTop = [...bySize.entries()]
    .map(([size, b]) => [size, +(b / 1048576).toFixed(1)])
    .sort((a, b) => b[1] - a[1]);

  return {
    scene: stats.scene,
    triangles,
    meshes,
    materials: materials.size,
    textures: textures.size,
    textureMB,
    drawGroups,
    programs,
    buildMs: stats.buildMs,
    ratios,
    textureBySize: Object.fromEntries(texTop),
    ok: notes.length === 0,
    notes,
  };
}

// 드로우 콜의 하한. 메시 하나가 material 배열을 쓰면 그룹 수만큼 그린다.
function countGroups(scene) {
  let n = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    n += Array.isArray(o.material) ? Math.max(1, o.geometry.groups.length) : 1;
  });
  return n;
}

function fmt(n) {
  return Number(n).toLocaleString('en-US');
}
