# 블렌더에서 .glb를 실제로 임포트해 무엇이 살아남았는지 검사한다.
# 사용: blender --background --python tools/blender-check.py -- [--render] <파일...>
import bpy
import sys
import os
import json
import math
import mathutils

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
DO_RENDER = '--render' in argv

# --out <dir> 로 렌더 출력 위치를 지정한다 (없으면 cwd/shots/blender)
OUT_DIR = os.path.join(os.getcwd(), 'shots', 'blender')
if '--out' in argv:
    i = argv.index('--out')
    OUT_DIR = argv[i + 1]
    argv = argv[:i] + argv[i + 2:]

files = [a for a in argv if not a.startswith('--')]
os.makedirs(OUT_DIR, exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# 블렌더 glTF 임포터는 아마추어를 만들 때 본 표시용 Icosphere를
# 'glTF_not_exported' 컬렉션에 넣어둔다. 에셋이 아니므로 집계에서 뺀다
# (안 빼면 정점 456 -> 498, 바운딩 1.78m -> 5.32m 로 왜곡된다).
EXCLUDED_COLLECTIONS = {'glTF_not_exported'}


def is_asset(o):
    return not any(c.name in EXCLUDED_COLLECTIONS for c in o.users_collection)


# Blender 4.4+/5.x는 슬롯 액션 구조로 바뀌어 Action.fcurves가 사라졌다.
# 레거시(평면 fcurves)와 신규(layers>strips>channelbags) 양쪽을 다 지원한다.
def action_curve_count(a):
    fc = getattr(a, 'fcurves', None)
    if fc is not None:
        return len(fc)
    n = 0
    for layer in getattr(a, 'layers', []):
        for strip in getattr(layer, 'strips', []):
            for cb in getattr(strip, 'channelbags', []):
                n += len(cb.fcurves)
    return n


def tri_count(mesh):
    # calc_loop_triangles는 버전마다 흔들리니 폴리곤에서 직접 센다
    return sum(max(0, len(p.vertices) - 2) for p in mesh.polygons)


def world_bbox(objs):
    lo = mathutils.Vector((1e18, 1e18, 1e18))
    hi = mathutils.Vector((-1e18, -1e18, -1e18))
    found = False
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ mathutils.Vector(c)
            lo = mathutils.Vector((min(lo[i], p[i]) for i in range(3)))
            hi = mathutils.Vector((max(hi[i], p[i]) for i in range(3)))
            found = True
    if not found:
        return None, None
    return lo, hi


def setup_render(objs, out_png, color_type='TEXTURE'):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = 900
    scene.render.resolution_y = 560
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.filepath = out_png

    shading = scene.display.shading
    shading.light = 'STUDIO'
    shading.color_type = color_type
    shading.show_shadows = True
    shading.show_cavity = True

    lo, hi = world_bbox(objs)
    if lo is None:
        return False
    center = (lo + hi) * 0.5
    size = hi - lo
    # 세로로 긴 대상(캐릭터)이 잘리지 않도록 최대 변과 화면비를 같이 고려한다
    aspect = scene.render.resolution_x / scene.render.resolution_y
    radius = max(max(size.x, size.y), size.z * aspect, 0.5) * 0.5

    cam_data = bpy.data.cameras.new('chk_cam')
    cam = bpy.data.objects.new('chk_cam', cam_data)
    scene.collection.objects.link(cam)
    d = mathutils.Vector((0.85, -1.0, 0.5)).normalized()
    fov = cam_data.angle  # 기본 39.6도
    cam.location = center + d * (radius / math.tan(fov * 0.5) * 1.45)
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = cam
    return True


results = []

for f in files:
    rec = {'file': os.path.basename(f)}
    clear_scene()

    try:
        bpy.ops.import_scene.gltf(filepath=f)
        rec['import'] = 'ok'
    except Exception as e:
        rec['import'] = 'FAILED'
        rec['error'] = f'{type(e).__name__}: {e}'
        results.append(rec)
        continue

    objs = [o for o in bpy.data.objects if is_asset(o)]
    meshes = [o for o in objs if o.type == 'MESH']

    rec['objects'] = len(objs)
    rec['mesh_objects'] = len(meshes)
    rec['tris'] = sum(tri_count(o.data) for o in meshes)
    rec['verts'] = sum(len(o.data.vertices) for o in meshes)
    rec['materials'] = len(bpy.data.materials)
    rec['images'] = len(bpy.data.images)
    rec['image_sizes'] = sorted({f'{i.size[0]}x{i.size[1]}' for i in bpy.data.images})

    # 머티리얼 노드 연결 상태 — 무엇이 살아남았는지의 핵심
    base_linked = rough_linked = normal_linked = 0
    for mat in bpy.data.materials:
        if not mat.use_nodes or mat.node_tree is None:
            continue
        for n in mat.node_tree.nodes:
            if n.type != 'BSDF_PRINCIPLED':
                continue
            if n.inputs['Base Color'].is_linked:
                base_linked += 1
            if n.inputs['Roughness'].is_linked:
                rough_linked += 1
            if n.inputs['Normal'].is_linked:
                normal_linked += 1
    rec['mats_basecolor_tex'] = base_linked
    rec['mats_roughness_tex'] = rough_linked
    rec['mats_normal_tex'] = normal_linked

    # 정점 컬러
    vcols = set()
    for o in meshes:
        for a in o.data.color_attributes:
            vcols.add(a.name)
    rec['color_attributes'] = sorted(vcols)

    # 스켈레탈: 아마추어 / 본 / 스킨 웨이트 / 액션
    armatures = [o for o in objs if o.type == 'ARMATURE']
    rec['armatures'] = len(armatures)
    if armatures:
        arm = armatures[0]
        rec['bones'] = len(arm.data.bones)
        rec['bone_names'] = [b.name for b in arm.data.bones]
    skinned = [o for o in meshes if any(m.type == 'ARMATURE' for m in o.modifiers)]
    rec['skinned_meshes'] = len(skinned)
    rec['vertex_groups'] = sorted({g.name for o in meshes for g in o.vertex_groups})
    rec['actions'] = [
        {
            'name': a.name,
            'frame_range': [round(a.frame_range[0], 2), round(a.frame_range[1], 2)],
            'curves': action_curve_count(a),
        }
        for a in bpy.data.actions
    ]

    # 크기 (스케일이 미터로 맞게 왔는지)
    lo, hi = world_bbox(meshes)
    if lo is not None:
        rec['size_m'] = [round(hi[i] - lo[i], 3) for i in range(3)]

    rec['sample_names'] = [o.name for o in objs[:8]]

    if DO_RENDER:
        png = os.path.join(OUT_DIR, os.path.splitext(os.path.basename(f))[0] + '.png')
        # 텍스처가 없고 정점 컬러만 있으면 VERTEX 모드로 봐야 색이 보인다
        ctype = 'VERTEX' if (rec['color_attributes'] and not bpy.data.images) else 'TEXTURE'
        if setup_render(meshes, png, ctype):
            bpy.ops.render.render(write_still=True)
            rec['render'] = png

    results.append(rec)

print('RESULT_JSON_BEGIN')
print(json.dumps(results, ensure_ascii=False, indent=1))
print('RESULT_JSON_END')
