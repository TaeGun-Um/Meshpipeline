// 캐릭터 조립.
//
// 발바닥 y=0 에 서고 키 1.60m. 각 부품은 자기 파일에서 지오메트리만 만들고
// 여기서 재질을 입혀 아웃라인과 함께 붙인다 — 형태와 색을 한 파일에 섞으면
// 실루엣을 고칠 때마다 팔레트를 지나가야 한다.
import * as THREE from 'three';
import { Toon, RAMP_SKIN, RAMP_CLOTH, RAMP_HAIR, withOutline } from './toon.js';
import { faceTexture, SKIN } from './face.js';
import { headGeometry, earGeometries, neckGeometry, HEAD } from './head.js';
import { mirrorX } from './surface.js';
import * as HAIR from './hair.js';
import * as B from './body.js';
import { boneChain, skinByV, SpringChain } from './spring.js';

// 레퍼런스의 팔레트 — 흰색과 연청, 짙은 남색, 은빛 장식.
const C = {
  skin: SKIN,
  cloth: 0xf2f2f6, // 흰 상의
  clothDark: 0x2f3557, // 남색 속옷·스타킹
  accent: 0xa8b6dc, // 연청 포인트
  metal: 0xd8dbe6, // 은 장식
  boot: 0xeceef4,
  line: 0x2a2537,
  lineSoft: 0x3d3a52,
};

export function createCharacter(scene) {
  const grp = new THREE.Group();
  grp.name = 'character';

  // 림 세기는 재질마다 다르다. **얼굴에는 안 넣는다** — 가장자리가 밝아지면
  // 그려 넣은 눈매 옆이 뜨면서 인상이 흐려진다.
  const M = {
    skin: Toon.instance({ color: C.skin, steps: RAMP_SKIN, rim: 0.1 }, 'Skin'),
    face: Toon.instance({ color: 0xffffff, map: faceTexture(1024), steps: RAMP_SKIN }, 'Face'),
    hair: Toon.instance(
      { color: 0xffffff, map: HAIR.hairGradient(), steps: RAMP_HAIR, rim: 0.22 },
      'Hair'
    ),
    hairFlat: Toon.instance({ color: 0xe4e5f0, steps: RAMP_HAIR, rim: 0.2 }, 'HairFlat'),
    cloth: Toon.instance({ color: C.cloth, steps: RAMP_CLOTH, rim: 0.16 }, 'Cloth'),
    dark: Toon.instance({ color: C.clothDark, steps: RAMP_CLOTH, rim: 0.3 }, 'ClothDark'),
    accent: Toon.instance({ color: C.accent, steps: RAMP_CLOTH, rim: 0.18 }, 'Accent'),
    metal: Toon.instance(
      { color: C.metal, steps: RAMP_CLOTH, rim: 0.34, rimColor: 0xfff0d8 },
      'Metal'
    ),
    boot: Toon.instance({ color: C.boot, steps: RAMP_CLOTH, rim: 0.16 }, 'Boot'),
  };

  let tris = 0;
  // 부품 하나 = 메시 하나 + 아웃라인 하나. 아웃라인 굵기는 부품 크기를 따라야
  // 한다 — 세계 단위로 고정하면 손가락에서 선이 부품보다 굵어진다.
  const add = (geo, mat, name, t = 0.0035, lineColor = C.line) => {
    const list = Array.isArray(geo) ? geo : [geo];
    list.forEach((g, i) => {
      const m = new THREE.Mesh(g, mat);
      m.name = list.length > 1 ? `${name}${i}` : name;
      m.castShadow = true;
      m.receiveShadow = true;
      tris += g.index.count / 3;
      grp.add(t > 0 ? withOutline(m, t, lineColor) : m);
    });
  };

  // ── 머리 ─────────────────────────────────────────────────────────────────
  add(headGeometry(), M.face, 'Head', 0.0032);
  add(earGeometries(), M.skin, 'Ear', 0.0016);
  add(neckGeometry(), M.skin, 'Neck', 0.0022);

  // ── 머리카락 ─────────────────────────────────────────────────────────────
  add(HAIR.hairCap(), M.hairFlat, 'HairCap', 0.0030);
  add(HAIR.backHair(), M.hairFlat, 'BackHair', 0.0022);
  add(HAIR.bangs(), M.hairFlat, 'Bang', 0.0018);
  add(HAIR.sideLocks(), M.hair, 'SideLock', 0.0018);
  add(HAIR.tails(), M.hairFlat, 'Tail', 0.003);
  // ── 땋은 머리 (스프링) ───────────────────────────────────────────────────
  //
  // 아웃라인은 **안 씌운다.** 씌웠더니 은발이 흑발이 됐다 — 세 가닥이 서로
  // 파고든 형상이라 홈이 깊고, 뒷면만 그리는 껍질이 그 홈을 전부 메운다.
  // **선은 실루엣을 살리는 물건이지 모든 부품에 두르는 물건이 아니다.**
  //
  // 강체 부착이 아니라 본 사슬 + 스프링이다. 바닥까지 오는 머리를 머리뼈에
  // 통째로 물리면 고개를 돌릴 때 통째로 휙 돈다.
  const springs = [];
  const anchor = new THREE.Object3D();
  anchor.name = 'HeadAnchor';
  anchor.position.set(0, HEAD.bot + (HEAD.top - HEAD.bot) * 0.42, 0);
  grp.add(anchor);
  grp.updateMatrixWorld(true);

  {
    // 본이 적으면 마디가 길어 한 프레임의 복원 변위가 마디 길이에 비해 커진다
    // — 명시적 적분이라 그 순간 발산한다. 11개(마디 0.15m)에서 끝이 1.1m 를
    // 튀어나갔다. 15개(0.11m)로 늘려 안정 구간에 들어간다.
    const rig = HAIR.braidRig(15);
    for (const side of [1, -1]) {
      const pts = rig.bonePts.map((p) => new THREE.Vector3(p.x * side, p.y, p.z));
      const bones = boneChain(pts, anchor, side > 0 ? 'BraidR' : 'BraidL');
      const skel = new THREE.Skeleton(bones);
      for (const [i, g0] of rig.parts.entries()) {
        const g = skinByV((side > 0 ? g0.clone() : mirrorX(g0)), bones.length);
        const m = new THREE.SkinnedMesh(g, M.hair);
        m.name = `Braid${side > 0 ? 'R' : 'L'}${i}`;
        m.castShadow = true;
        tris += g.index.count / 3;
        grp.add(m);
        m.bind(skel);
      }
      // 고리를 해당 t 의 본에 매단다
      for (const r of HAIR.braidRingsAt()) {
        const bi = Math.round(r.t * (bones.length - 1));
        const bone = bones[bi];
        bone.updateMatrixWorld(true);
        const g = r.geo.clone();
        const p = rig.bonePts[bi];
        g.translate(p.x * side, p.y, p.z);
        g.applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert());
        const rm = new THREE.Mesh(g, M.metal);
        rm.name = `BraidRing${side > 0 ? 'R' : 'L'}${bi}`;
        rm.castShadow = true;
        tris += g.index.count / 3;
        bone.add(rm);
      }

      springs.push(
        // 처음에 stiffness 0.5 · gravity 0.42 로 뒀더니 **중력이 이겨서**
        // 땋은 머리가 원래 모양을 버리고 몸을 뚫고 수직으로 떨어졌다.
        // 쉬는 자세가 이미 '중력과 균형 잡힌 모양' 이므로, 중력은 그 위에
        // 살짝 얹는 정도여야 한다 — 복원력이 훨씬 세야 맞는다.
        // 값은 **쓸어서** 찾았다 (강성 3~24 x 감쇠 0.5~0.85, 정지 처짐과
        // 32도 회전 시 최대 이탈을 같이 잼). 손으로 짐작한 1차·2차는 둘 다 틀렸다.
        //
        //   강성  감쇠   처짐    최대이탈   최종
        //     3   0.50   31mm    506mm     126mm   중력이 이겨 몸을 뚫는다
        //     3   0.85   31mm    653mm     126mm   감쇠를 올렸는데 **더 나빠졌다**
        //     6   0.70   16mm    343mm     118mm
        //  → 12   0.70    8mm    145mm     114mm   최종 114 대비 31mm 만 넘친다
        //    24   0.70    4mm    117mm     113mm   지연이 사라져 강체와 같다
        //
        // 배운 것: **감쇠는 복원이 충분할 때만 도움이 된다.** 무른 사슬에서
        // 감쇠를 올리면 돌아오는 속도까지 죽어 오히려 더 멀리 흘러간다.
        new SpringChain(bones, { stiffness: 12, drag: 0.7, gravity: 0.05, substeps: 3 })
      );
    }
  }
  add(HAIR.ahoge(), M.hairFlat, 'Ahoge', 0.0016);
  add(HAIR.horns(), M.metal, 'Horn', 0.0022);

  // ── 몸 ───────────────────────────────────────────────────────────────────
  add(B.torso(), M.dark, 'Torso', 0);
  add(B.shoulderCap(), M.cloth, 'ShoulderCap', 0.0026);
  add(B.clavicle(), M.skin, 'Clavicle', 0);
  add(B.legs(), M.skin, 'Leg', 0.003);
  // 비대칭 — 한쪽만 스타킹. 레퍼런스의 특징이다
  add(B.stocking(0.70), M.dark, 'Stocking', 0.0026);
  add(B.boots(), M.boot, 'Boot', 0.003);

  const a = B.arms();
  add(a.upper, M.cloth, 'UpperArm', 0.0026);
  add(a.fore, M.cloth, 'ForeArm', 0.0024);
  // 손가락은 얇아서 선을 세계 단위로 고정하면 선이 손가락보다 굵어진다
  add(a.hand, M.skin, 'Hand', 0.0011);

  // ── 의상 ─────────────────────────────────────────────────────────────────
  add(B.bodice(), M.cloth, 'Bodice', 0.0032);
  add(B.collar(), M.accent, 'Collar', 0.0026);
  add(B.peplum(), M.cloth, 'Peplum', 0.0034);
  add(B.shorts(), M.dark, 'Shorts', 0.0026);
  add(B.pauldrons(), M.metal, 'Pauldron', 0.0026);
  add(B.brooch(), M.metal, 'Brooch', 0.0014);
  add(B.buckle(), M.metal, 'Buckle', 0.0016);
  add(B.bootTrim(), M.accent, 'BootTrim', 0.0016);

  // 띠 — 허리 · 소매 끝 · 맨다리 허벅지
  add(B.band(B.Y.waist - 0.022, 0.044, 0.095), M.accent, 'Belt', 0.0022);
  add(B.band(0.665, 0.03, 0.0605, 0.058), M.accent, 'ThighBand', 0.0018);
  add(B.band(B.Y.wrist + 0.01, 0.036, 0.0225, 0.179), M.accent, 'CuffR', 0.0018);
  add(B.band(B.Y.wrist + 0.01, 0.036, 0.0225, -0.179), M.accent, 'CuffL', 0.0018);

  scene.add(grp);
  grp.updateMatrixWorld(true);
  grp.userData.triangles = Math.round(tris);
  grp.userData.springs = springs;
  grp.userData.anchor = anchor;
  return grp;
}

export { HEAD };
