// 마스터 머티리얼 · 인스턴스 · 공유 캐시.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────────
// 씬이 늘어나면 같은 값의 머티리얼을 여러 모듈이 각자 new 로 만든다. 값이 같아도
// 객체가 다르면 GPU 입장에서는 다른 머티리얼이고, 그만큼 드로우콜이 늘고
// glTF 로 나갈 때도 중복 머티리얼로 기록된다. 실제로 이 프로젝트에서 필지마다
// glowMaterial() 을 불러 머티리얼이 수십 개로 불어난 적이 있다.
//
// ── 언리얼의 마스터/인스턴스와 같은 구조 ────────────────────────────────────
//   마스터   셰이딩 모델과 **파라미터 슬롯**을 정의한다. 직접 쓰이지 않는다.
//   파생     마스터의 기본값 일부를 바꾼 새 마스터. 상속이다.
//   인스턴스 파라미터를 확정한 실제 머티리얼. 값이 같으면 **같은 객체**를 돌려준다.
//
//   const Neon = Glow.derive('Neon', { intensity: 1, tint: 0.06 });
//   const a = Neon.instance({ color: 0x2ff2ff });
//   const b = Neon.instance({ color: 0x2ff2ff });
//   a === b   // true — 공유된다
//
// ── 오타를 잡는다 ──────────────────────────────────────────────────────────
// 파라미터 이름이 슬롯에 없으면 즉시 던진다. three 의 머티리얼 생성자는 모르는
// 키를 조용히 무시하므로, roughness 를 rougness 로 쓰면 아무 일도 일어나지 않고
// 렌더 결과만 미묘하게 달라진다. 이 프로젝트에서 실제로 겪은 종류의 버그다.
import * as THREE from 'three';

// ── 캐시 키 ────────────────────────────────────────────────────────────────

// 텍스처처럼 값 비교가 불가능한 객체는 동일성(identity)으로 식별한다.
let serial = 0;
const ids = new WeakMap();
function idOf(o) {
  let id = ids.get(o);
  if (id === undefined) {
    id = ++serial;
    ids.set(o, id);
  }
  return id;
}

function keyOf(v) {
  if (v === null || v === undefined) return 'null';
  const t = typeof v;
  if (t === 'number' || t === 'boolean' || t === 'string') return String(v);
  if (Array.isArray(v)) return `[${v.map(keyOf).join(',')}]`;
  if (v.isColor) return `#${v.getHexString()}`;
  return `@${idOf(v)}`;
}

// ── 통계 ───────────────────────────────────────────────────────────────────

// 공유가 실제로 일어나는지 눈으로 확인할 수 있어야 한다.
// created 는 만들어진 머티리얼 수, shared 는 캐시에 걸려 재사용된 횟수다.
const materialStats = { created: 0, shared: 0, byMaster: {} };

export function materialReport() {
  const rows = Object.entries(materialStats.byMaster)
    .sort((a, b) => b[1].created - a[1].created)
    .map(([n, s]) => `${n}: ${s.created}개 생성 / ${s.shared}회 공유`);
  return {
    created: materialStats.created,
    shared: materialStats.shared,
    detail: rows,
  };
}

// ── 마스터 ─────────────────────────────────────────────────────────────────

export class MasterMaterial {
  // name    머티리얼 이름의 접두사. 블렌더·유니티에서 이 이름이 그대로 보인다.
  // params  파라미터 슬롯과 기본값. 여기 없는 이름은 거부된다.
  // create  파라미터를 받아 THREE.Material 을 만든다.
  constructor(name, { params, create, parent = null }) {
    this.name = name;
    this.params = Object.freeze({ ...params });
    this.create = create;
    this.parent = parent;
    this.cache = new Map();
    if (!materialStats.byMaster[name]) {
      materialStats.byMaster[name] = { created: 0, shared: 0 };
    }
  }

  #validate(overrides) {
    for (const k of Object.keys(overrides)) {
      if (!(k in this.params)) {
        throw new Error(
          `마스터 '${this.name}' 에 없는 파라미터 '${k}'. ` +
            `사용 가능: ${Object.keys(this.params).join(', ')}`
        );
      }
    }
  }

  // 기본값 일부를 바꾼 새 마스터. 상속.
  derive(name, overrides = {}) {
    this.#validate(overrides);
    return new MasterMaterial(name, {
      params: { ...this.params, ...overrides },
      create: this.create,
      parent: this,
    });
  }

  // 파라미터를 확정한 머티리얼. 값이 같으면 같은 객체를 돌려준다.
  instance(overrides = {}, label = null) {
    this.#validate(overrides);
    const p = { ...this.params, ...overrides };

    const key = Object.keys(p)
      .sort()
      .map((k) => `${k}=${keyOf(p[k])}`)
      .join('|');

    const hit = this.cache.get(key);
    if (hit) {
      materialStats.shared++;
      materialStats.byMaster[this.name].shared++;
      return hit;
    }

    const m = this.create(p);
    // 이름은 결정론적이어야 한다 — 파이프라인이 머티리얼 이름으로 검증한다.
    // 빌드 순서가 결정론적이므로 캐시 크기도 결정론적이다.
    m.name = label || (this.cache.size === 0 ? this.name : `${this.name}_${this.cache.size}`);
    this.cache.set(key, m);
    materialStats.created++;
    materialStats.byMaster[this.name].created++;
    return m;
  }

}

// ── 공통 도우미 ────────────────────────────────────────────────────────────

// 색 입력을 THREE.Color 로. 숫자·문자열은 **sRGB** 로 해석된다 (three 의 색 관리가
// 켜져 있으면 new Color(0xrrggbb) 가 sRGB→선형 변환을 한다).
//
// 이게 맞는 해석이다. 팔레트 숫자(예: SURFACE.metal = [66,69,78])는 텍스처를
// 구울 때 sRGB 캔버스 값으로 쓰이므로, 단색 머티리얼에서도 sRGB 여야 같은 색이 된다.
// 예전 코드는 new Color(r/255, g/255, b/255) 로 **선형** 취급해서, 같은 팔레트
// 값인데 단색 부품만 텍스처보다 4배 이상 밝았다.
const color = (v) => (v && v.isColor ? v.clone() : new THREE.Color(v));

// 텍스처 세트를 복제하고 반복 수를 준다.
// 복제하는 이유: 같은 세트를 여러 머티리얼이 다른 반복 수로 쓸 수 있다.
//
// 요청한 반복이 **원본 텍스처의 현재 반복과 같을 때만** 복제를 건너뛴다.
// 처음에는 "요청이 1,1 이면 건너뛴다"로 썼는데, bake() 가 텍스처에 기본 반복값을
// 이미 심어 두기 때문에(예: rustTextures 는 2,2) 1,1 을 요청해도 2,2 가 남았다.
// 공터 씬의 기준 스크린샷이 이걸 잡았다.
function bindSet(set, rx, ry) {
  const out = {};
  for (const [k, t] of Object.entries(set)) {
    if (!t || !t.isTexture) continue;
    if (t.repeat.x === rx && t.repeat.y === ry) {
      out[k] = t;
      continue;
    }
    const c = t.clone();
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    out[k] = c;
  }
  return out;
}

// ── 마스터 라이브러리 ──────────────────────────────────────────────────────

// 텍스처 세트(색·거칠기·노말[·발광])를 입히는 표면.
// core/textures.js 의 bake() 가 돌려주는 세트를 그대로 받는다.
export const TexturedSurface = new MasterMaterial('TexturedSurface', {
  params: {
    set: null, // 필수
    repeatX: 1,
    repeatY: 1,
    normalScale: 1,
    metalness: 0,
    roughness: null, // null 이면 roughnessMap 을 그대로 쓴다
    side: null,
    transparent: false,
    opacity: 1,
    envMapIntensity: null,
    // emissiveMap 의 세기. 같은 텍스처를 밝게/어둡게 쓸 때. 1을 넘기면
    // glTF 에 KHR_materials_emissive_strength 확장이 붙으므로 1 이하로 둔다.
    emissiveIntensity: 1,
    // 정점 컬러를 알베도에 곱한다. 실내 씬이 조명을 정점에 구워 쓴다
    // (office-sector/bake.js). glTF 의 COLOR_0 이라 확장 없이 그대로 나간다.
    //
    // **켜면 지오메트리에 color 속성이 반드시 있어야 한다.** 없으면 셰이더가
    // 쓰레기값을 읽어 검게 나온다 — 굽는 쪽에서 빠진 메시를 세어 던진다.
    vertexColors: false,
  },
  create(p) {
    if (!p.set) throw new Error('TexturedSurface 는 set 이 필요하다');
    const bound = bindSet(p.set, p.repeatX, p.repeatY);
    const opts = {
      map: bound.map,
      roughnessMap: bound.roughnessMap,
      normalMap: bound.normalMap,
      normalScale: new THREE.Vector2(p.normalScale, p.normalScale),
      metalness: p.metalness,
      vertexColors: p.vertexColors,
    };
    if (bound.emissiveMap) {
      opts.emissiveMap = bound.emissiveMap;
      // 발광 텍스처가 색을 들고 있으므로 emissive 는 흰색이어야 한다.
      // 색을 넣으면 텍스처가 창마다 정해 둔 색온도가 전부 그 색으로 물든다.
      //
      // ── 세기는 색에 곱해 넣는다 (실측으로 고침) ─────────────────────────
      // 원래는 "emissiveIntensity > 1 이면 예외" 로 막았다. 전제가 틀렸다.
      // three 의 GLTFExporter 는 emissiveIntensity 가 **1이 아니기만 하면**
      // KHR_materials_emissive_strength 를 붙인다 — 0.22 처럼 1보다 작아도
      // 붙는다. 실제로 buildings.glb 를 열어 확인했다.
      //
      // 그 확장을 못 읽는 엔진에서는 세기가 통째로 1로 읽혀 발광이 4배 밝게
      // 터진다. 브라우저와 엔진이 같아 보여야 한다는 것이 이 파이프라인의
      // 1순위이므로, 확장이 붙을 여지 자체를 없앤다.
      //
      // three 의 셰이더에서 발광은 emissive * emissiveIntensity 라, 색에 미리
      // 곱해 두고 세기를 1로 두면 **화면은 완전히 동일하고** 확장은 안 붙는다.
      const k = p.emissiveIntensity;
      if (!(k >= 0 && k <= 1)) throw new Error(`emissiveIntensity=${k} — 0..1 이어야 한다`);
      opts.emissive = new THREE.Color(k, k, k);
      opts.emissiveIntensity = 1;
    }
    if (p.roughness !== null) opts.roughness = p.roughness;
    if (p.side !== null) opts.side = p.side;
    if (p.envMapIntensity !== null) opts.envMapIntensity = p.envMapIntensity;
    if (p.transparent) {
      opts.transparent = true;
      opts.opacity = p.opacity;
    }
    return new THREE.MeshStandardMaterial(opts);
  },
});

// 단색 표면. 텍스처가 필요 없는 작은 부품(금속·프레임·덕트·유리)용.
export const SolidSurface = new MasterMaterial('SolidSurface', {
  params: {
    color: 0x808080,
    roughness: 0.8,
    metalness: 0,
    side: null,
    // 반사가 주인공인 표면(유리)은 환경맵 기여를 따로 올린다
    envMapIntensity: null,
    // 실제로 **비쳐 보이는** 유리. 도시의 유리는 밤이라 불투명해도 됐지만,
    // 실내에서는 칸막이 너머가 보여야 공간이 이어져 보인다.
    // 슬롯이 없어서 씬이 raw THREE 를 쓰기 시작하면 마스터를 둔 뜻이 없다.
    transparent: false,
    opacity: 1,
    // TexturedSurface 의 같은 슬롯 참고
    vertexColors: false,
  },
  create(p) {
    const opts = {
      color: color(p.color),
      roughness: p.roughness,
      metalness: p.metalness,
      vertexColors: p.vertexColors,
    };
    if (p.side !== null) opts.side = p.side;
    if (p.envMapIntensity !== null) opts.envMapIntensity = p.envMapIntensity;
    if (p.transparent) {
      opts.transparent = true;
      opts.opacity = p.opacity;
      // 투명면끼리 겹치면 그리는 순서에 따라 깜빡인다. 깊이 기록을 끄면
      // 유리 너머의 것이 항상 보인다 — 창 한 겹짜리에는 이쪽이 맞다.
      opts.depthWrite = false;
    }
    return new THREE.MeshStandardMaterial(opts);
  },
});

// 발광 표면. 네온관·간판 글자·점포 실내처럼 "빛나는 면".
//
// tint 는 알베도에 곱하는 계수다. 알베도를 밝게 두면 광원이 닿는 낮 씬처럼 보여
// 발광인지 흰 페인트인지 구분이 안 된다. 그래서 기본값이 아주 낮다.
//
// intensity 를 1보다 크게 주면 three 가 glTF 에 KHR_materials_emissive_strength
// 확장을 쓴다. 규약상 확장은 피하므로 1 이하로 두고, 세기는 블룸 임계값으로 만든다.
export const Glow = new MasterMaterial('Glow', {
  params: {
    color: 0xffffff,
    intensity: 1,
    tint: 0.06,
    roughness: 0.4,
    // 발광 자체는 정점 컬러에 안 곱해진다 (three 는 알베도에만 곱한다).
    // 그래도 슬롯이 필요하다 — 같은 메시에 섞여 있으면 color 속성이 붙으므로
    // 켜 두지 않으면 발광판만 셰이더가 갈려 드로우콜이 쪼개진다.
    vertexColors: false,
  },
  create(p) {
    const col = color(p.color);
    if (!(p.intensity >= 0 && p.intensity <= 1)) {
      throw new Error(`Glow.intensity=${p.intensity} — 0..1 이어야 한다. 더 밝게는 블룸으로.`);
    }
    return new THREE.MeshStandardMaterial({
      color: col.clone().multiplyScalar(p.tint),
      // 세기를 emissiveIntensity 로 주면 안 된다 — 1이 아닌 모든 값이 glTF 에
      // KHR_materials_emissive_strength 를 만든다. 색에 곱하면 화면은 같고
      // 확장은 안 붙는다. 자세한 사정은 TexturedSurface 의 같은 대목 참고.
      emissive: col.clone().multiplyScalar(p.intensity),
      emissiveIntensity: 1,
      roughness: p.roughness,
      metalness: 0,
      vertexColors: p.vertexColors,
    });
  },
});

// 가산합성 언릿. 조명 계산 없이 밝기를 더한다.
// 발광 표면이 주변을 밝히지 못하는 문제를 지오메트리로 푸는 데 쓴다
// (shared/lightpool.js 주석 참고).
export const Additive = new MasterMaterial('Additive', {
  params: {
    map: null,
    color: 0xffffff,
    opacity: 1,
    vertexColors: false,
    fog: true,
  },
  create(p) {
    return new THREE.MeshBasicMaterial({
      map: p.map,
      color: color(p.color),
      opacity: p.opacity,
      vertexColors: p.vertexColors,
      blending: THREE.AdditiveBlending,
      transparent: true,
      // 가산합성 면끼리 서로를 가리면 사각형 경계가 드러난다
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: p.fog,
    });
  },
});

// 조명을 받지 않는 표면. 하늘돔처럼 "배경 그 자체"인 것.
export const Unlit = new MasterMaterial('Unlit', {
  params: {
    map: null,
    color: 0xffffff,
    side: THREE.FrontSide,
    // 하늘돔에 fog 를 켜면 안개가 하늘까지 덮어 하늘이 통짜 회색이 된다
    fog: false,
    depthWrite: true,
  },
  create(p) {
    return new THREE.MeshBasicMaterial({
      map: p.map,
      color: color(p.color),
      side: p.side,
      fog: p.fog,
      depthWrite: p.depthWrite,
    });
  },
});
