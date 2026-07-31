// 메시 조립 부모 클래스.
//
// ── 무엇을 없애는가 ────────────────────────────────────────────────────────
// 씬 모듈마다 아래가 그대로 반복됐다 (8개 모듈에서 똑같이).
//
//   const parts = [];
//   parts.push({ geometry, material });      // 수십 번
//   const { geometry, materials } = mergeParts(parts);
//   const mesh = new THREE.Mesh(geometry, materials);
//   mesh.name = '...';
//   mesh.castShadow = true;
//   mesh.receiveShadow = true;
//   const group = new THREE.Group();
//   group.name = '...';
//   group.add(mesh);
//   scene.add(group);
//   return group;
//
// 이 클래스가 그 전부를 맡는다. 씬 모듈은 "무엇을 어디에 놓을지"만 쓴다.
//
// ── 왜 Group 으로 감싸는가 ─────────────────────────────────────────────────
// 익스포트 하네스(__export)와 파이프라인이 씬의 조각을 이름으로 찾는다.
// Group 으로 감싸면 나중에 같은 이름 아래 메시를 더 붙여도 (LOD·투명 분리 등)
// 밖에서 보는 이름과 구조가 안 바뀐다.
import * as THREE from 'three';
import { mergeParts, boxGeometry, metricBox } from './meshkit.js';
import { sphereSegments } from './profile.js';
import { beginItem, growItem, endItem, takeItem, ledgerOpen } from './placement.js';

export class MeshBuilder {
  // name        Group·Mesh 이름. 블렌더·유니티에서 이 이름이 그대로 보인다.
  // castShadow / receiveShadow  기본은 둘 다 **켬**.
  //             맨 `new THREE.Mesh` 는 둘 다 꺼져 있으므로, 기존 코드를 이 클래스로
  //             옮길 때 그림자 동작이 조용히 바뀐다. 실제로 차선 페인트가 달 그림자를
  //             받게 되어 노면보다 1/3 어두워진 적이 있다. 옮길 때 반드시 확인할 것.
  // renderOrder 가산합성처럼 나중에 그려야 하는 것에 쓴다
  // attributes  정점 속성 추가 정의. [{ name, itemSize, from }]
  //             from 은 add(…, data) 의 data 에서 값을 읽어올 키다.
  //             예: 빛 웅덩이는 웅덩이마다 색이 달라야 드로우콜을 하나로 유지한다.
  constructor(name, opts = {}) {
    this.name = name;
    this.castShadow = opts.castShadow !== false;
    this.receiveShadow = opts.receiveShadow !== false;
    this.renderOrder = opts.renderOrder || 0;
    this.frustumCulled = opts.frustumCulled !== false;
    this.attributes = opts.attributes || [];
    this.parts = [];
  }

  // ── 배치 기록 ────────────────────────────────────────────────────────────
  //
  // 여기부터 다음 mark() 까지 들어오는 조각을 **한 덩어리로** 묶어 배치 검사에
  // 넘긴다 (core/placement.js). 건물 한 채가 조각 수백 개인데 검사가 알고 싶은
  // 것은 "그 건물이 실제로 차지한 범위" 하나이기 때문이다.
  //
  // 굳이 이렇게 하는 이유: 모듈이 "여기 이만한 것을 놓았다" 고 **신고**하게
  // 만들면 그 신고가 실제로 그린 것과 어긋날 수 있다. 슬럼 골조가 옆 건물을
  // 관통한 버그가 정확히 그것이었다 — 회전 후 크기를 계산해 놓고 안 썼다.
  // 그려진 지오메트리에서 직접 읽으면 어긋날 여지가 없다.
  mark(kind, label, meta = null) {
    beginItem(kind, label, meta);
    return this;
  }

  endMark() {
    endItem();
    return this;
  }

  // 표시를 닫고 **방금 그린 것의 실제 경계**를 돌려준다.
  // 필지가 아니라 그려진 것을 기준으로 무언가를 붙여야 할 때 쓴다.
  takeMark() {
    return takeItem();
  }

  // 조각 하나. data 는 attributes 의 from 이 읽는다.
  add(geometry, material, data = null) {
    if (!geometry) throw new Error(`${this.name}: geometry 가 없다`);
    if (!material) throw new Error(`${this.name}: material 이 없다`);
    // 열린 기록이 있을 때만 경계를 잰다. 표시하지 않은 빌더는 비용이 0 이다.
    if (ledgerOpen()) growItem(geometry);
    this.parts.push(data ? { geometry, material, ...data } : { geometry, material });
    return this;
  }

  // 축에 정렬된 박스. at 은 중심 좌표.
  // tile 을 주면 텍스처가 tile 미터마다 반복되도록 UV를 늘린다 (metricBox).
  box(w, h, d, at, material, tile = 0) {
    const g = tile > 0 ? metricBox(w, h, d, at, tile) : boxGeometry(w, h, d, at);
    return this.add(g, material);
  }

  // 기둥. 세로가 기본이다.
  cylinder(rTop, rBottom, h, at, material, segments = 8) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1);
    g.translate(at[0], at[1], at[2]);
    return this.add(g, material);
  }

  // 가로·세로 분할을 따로 받는다. 세로를 가로에서 유도하면(예: seg-2) 호출부가
  // 의도한 분할과 어긋나 삼각형 수가 조용히 바뀐다 — 실제로 원경 항공장애등이
  // (6,5)에서 (6,4)로 줄어 스카이라인 삼각형이 수백 개 사라진 적이 있다.
  // 분할 수를 생략하면 반지름에 맞춰 자동으로 고른다 (profile.sphereSegments).
  // 10cm 전구에 8x6(80삼각형)을 쓰던 것을 5x3(20삼각형)으로 줄인다.
  sphere(r, at, material, widthSeg = 0, heightSeg = 0) {
    const [ws, hs] = widthSeg ? [widthSeg, heightSeg || 6] : sphereSegments(r);
    const g = new THREE.SphereGeometry(r, ws, hs);
    g.translate(at[0], at[1], at[2]);
    return this.add(g, material);
  }

  get count() {
    return this.parts.length;
  }

  get empty() {
    return this.parts.length === 0;
  }

  // 병합해서 Group 을 만든다. scene 을 주면 붙여 준다.
  build(scene = null) {
    // 마지막 mark() 를 닫는다. 호출부가 잊어도 다음 빌더의 조각이 앞 빌더의
    // 기록으로 새어 들어가지 않는다.
    endItem();

    const group = new THREE.Group();
    group.name = this.name;

    if (this.empty) {
      // 조건에 따라 아무것도 안 나올 수 있다 (예: 간판이 하나도 없는 씬).
      // 빈 Group 을 돌려주면 호출부가 분기하지 않아도 된다.
      if (scene) scene.add(group);
      return group;
    }

    const extras = this.attributes.map((a) => ({
      name: a.name,
      itemSize: a.itemSize,
      valueFor: (part) => {
        const v = part[a.from];
        if (v === undefined) {
          throw new Error(`${this.name}: 조각에 '${a.from}' 이 없다 (속성 ${a.name})`);
        }
        return v;
      },
    }));

    const { geometry, materials } = mergeParts(this.parts, { extras });
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.name = this.name;
    mesh.castShadow = this.castShadow;
    mesh.receiveShadow = this.receiveShadow;
    mesh.frustumCulled = this.frustumCulled;
    if (this.renderOrder) mesh.renderOrder = this.renderOrder;

    group.add(mesh);
    if (scene) scene.add(group);

    this.built = { group, mesh, materials };
    return group;
  }

  // 조립 결과 요약 — 통계·검증용
  get stats() {
    const b = this.built;
    if (!b) return { parts: this.parts.length, built: false };
    return {
      parts: this.parts.length,
      materials: b.materials.length,
      triangles: b.mesh.geometry.index.count / 3,
      built: true,
    };
  }
}
