# =========================================================================
# AUTO-GENERATED - do not edit by hand.
#   source : pipeline/contract.json
#   regen  : node tools/gen-contract.mjs
# =========================================================================

"""블렌더 FBX 익스포트 규약. pipeline/contract.json 에서 생성됨."""

VERSION = 1

# bpy.ops.export_scene.fbx 에 그대로 넘기는 옵션
FBX_OPTIONS = {
    'use_selection': False,
    'apply_unit_scale': True,
    'global_scale': 1,
    'apply_scale_options': 'FBX_SCALE_NONE',
    'bake_space_transform': False,
    'axis_forward': '-Z',
    'axis_up': 'Y',
    'mesh_smooth_type': 'FACE',
    'colors_type': 'SRGB',
    'add_leaf_bones': False,
    'armature_nodetype': 'NULL',
    'bake_anim': True,
    'bake_anim_use_all_actions': True,
    'bake_anim_use_nla_strips': False,
    'bake_anim_step': 1,
    'bake_anim_simplify_factor': 0,
    'path_mode': 'RELATIVE',
    'embed_textures': False,
    'object_types': {'MESH', 'ARMATURE', 'EMPTY'},
}

# 익스포트 전에 지워야 하는 컬렉션
PURGE_COLLECTIONS = ['glTF_not_exported']
