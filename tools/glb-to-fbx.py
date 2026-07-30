# glb -> fbx 변환. Unity는 FBX를 네이티브로 읽으므로 glTFast 없이도 들어간다.
# 사용: blender --background --python tools/glb-to-fbx.py -- --out <dir> <glb...>
import bpy
import sys
import os
import json

# FBX 익스포트 옵션은 pipeline/contract.json 이 단일 출처다.
# tools/gen-contract.mjs 가 contract_gen.py 를 생성하고 여기서 읽어 쓴다.
# 옵션을 이 파일에 직접 적으면 규약이 또 흩어진다 — 좌표계 혼선의 원인이었다.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from contract_gen import FBX_OPTIONS, PURGE_COLLECTIONS  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

out_dir = os.getcwd()
if '--out' in argv:
    i = argv.index('--out')
    out_dir = argv[i + 1]
    argv = argv[:i] + argv[i + 2:]
os.makedirs(out_dir, exist_ok=True)

# embed: 텍스처를 FBX 안에 박는다 (Unity가 자동 추출하지 않음)
# loose: 텍스처를 FBX 옆에 개별 파일로 뽑는다 (Unity가 경로로 찾아 연결)
mode = 'embed'
if '--mode' in argv:
    i = argv.index('--mode')
    mode = argv[i + 1]
    argv = argv[:i] + argv[i + 2:]

files = [a for a in argv if not a.startswith('--')]
results = []

for f in files:
    rec = {'src': os.path.basename(f)}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=f)
    except Exception as e:
        rec['error'] = f'import: {e}'
        results.append(rec)
        continue

    # 블렌더 glTF 임포터가 본 표시용으로 만든 Icosphere는 'glTF_not_exported'
    # 컬렉션에 들어간다. 이 규약은 glTF 익스포터만 알기 때문에, FBX로 내보내면
    # 그대로 따라 나가서 Unity에 정체불명 메시(80삼각형)로 들어온다. 먼저 지운다.
    purged = []
    for coll in list(bpy.data.collections):
        if coll.name not in PURGE_COLLECTIONS:
            continue
        for o in list(coll.objects):
            purged.append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(coll)
    if purged:
        rec['purged'] = purged

    rec['objects'] = len(bpy.data.objects)
    rec['images'] = len(bpy.data.images)

    out = os.path.join(out_dir, os.path.splitext(os.path.basename(f))[0] + '.fbx')

    # loose 모드에서는 GLB에 박혀 있던 이미지를 실제 파일로 풀어놔야
    # 익스포터가 상대 경로를 쓸 수 있다
    if mode == 'loose' and bpy.data.images:
        tex_dir = os.path.join(out_dir, 'textures')
        os.makedirs(tex_dir, exist_ok=True)
        stem = os.path.splitext(os.path.basename(f))[0]
        for n, img in enumerate(bpy.data.images):
            if img.size[0] == 0:
                continue
            img.filepath_raw = os.path.join(tex_dir, f'{stem}_{n:02d}.png')
            img.file_format = 'PNG'
            try:
                img.save()
                img.unpack(method='REMOVE') if img.packed_file else None
            except Exception:
                pass
        rec['textures_written'] = len(os.listdir(tex_dir))

    # 옵션 본체는 규약에서 온다. 여기서 덮어쓰는 건 이 호출에만 해당하는 것뿐이다.
    #   embed 모드는 텍스처를 FBX 안에 박는 대조군 — 유니티가 자동 추출하지 않아
    #   전부 유실되는 것을 확인했으므로 실사용은 loose 다 (규약 기본값).
    opts = dict(FBX_OPTIONS)
    opts['filepath'] = out
    if mode == 'embed':
        opts['path_mode'] = 'COPY'
        opts['embed_textures'] = True

    try:
        bpy.ops.export_scene.fbx(**opts)
        rec['mode'] = mode
        rec['actions'] = len(bpy.data.actions)
        rec['armatures'] = len([o for o in bpy.data.objects if o.type == 'ARMATURE'])
        rec['fbx'] = out
        rec['bytes'] = os.path.getsize(out)
    except Exception as e:
        rec['error'] = f'export: {e}'

    results.append(rec)

print('FBX_JSON_BEGIN')
print(json.dumps(results, ensure_ascii=False, indent=1))
print('FBX_JSON_END')
