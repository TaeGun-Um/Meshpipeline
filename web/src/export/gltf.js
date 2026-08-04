// 브라우저에서 만든 지오메트리를 glTF(.glb)로 뽑아 서버에 저장한다.
// 정적 메시는 인스턴스를 굽고, 동적 메시는 스킨 + 애니메이션 클립을 함께 내보낸다.
// 병합/굽기 로직은 core/meshkit.js 로 옮겼다 (정적·동적이 공유).
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { bakeInstancedDescendants } from '../core/meshkit.js';

export { bakeInstances, bakeInstancedDescendants } from '../core/meshkit.js';

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  const CHUNK = 0x8000; // btoa에 한 번에 다 넣으면 스택이 터진다
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

export async function exportGLB(object, name, { animations = [] } = {}) {
  // 그룹 안에 InstancedMesh가 있으면 구워서 내보낸다. 그대로 두면
  // EXT_mesh_gpu_instancing으로 나가면서 개체별 색(instanceColor)이 유실되고,
  // 임포트 측에서는 머티리얼 기본색으로 렌더된다 (잡석 300개가 흰색이 됐던 원인).
  const restore = object.isInstancedMesh ? null : bakeInstancedDescendants(object);

  // 루트의 트랜스폼은 "지금 씬에 놓여 있는 위치"다. 캐릭터는 물리가 매 프레임
  // position을 갱신하므로, 그대로 내보내면 그 좌표가 glTF 노드 translation으로
  // 박혀서 임포트 측에서 캐릭터가 공중에 뜬다 (실측: y=1.1479 만큼).
  // 에셋은 원점 기준이어야 하므로 임시로 초기화한다.
  // 정적 조각들은 이미 원점에 있으니 이 처리가 무해하다.
  const keep = {
    p: object.position.clone(),
    q: object.quaternion.clone(),
    s: object.scale.clone(),
  };
  object.position.set(0, 0, 0);
  object.quaternion.identity();
  object.scale.set(1, 1, 1);
  object.updateMatrixWorld(true);

  try {
    const exporter = new GLTFExporter();
    const buffer = await exporter.parseAsync(object, {
      binary: true,
      onlyVisible: true,
      truncateDrawRange: false,
      animations,
    });
    const res = await fetch(`/export?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: toBase64(buffer),
    });
    return { file: await res.text(), bytes: buffer.byteLength, clips: animations.length };
  } finally {
    object.position.copy(keep.p);
    object.quaternion.copy(keep.q);
    object.scale.copy(keep.s);
    object.updateMatrixWorld(true);
    if (restore) restore();
  }
}
