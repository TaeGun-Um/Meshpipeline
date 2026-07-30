// =========================================================================
// AUTO-GENERATED - do not edit by hand.
//   source : pipeline/contract.json
//   regen  : node tools/gen-contract.mjs
// =========================================================================

using System.Collections.Generic;

/// <summary>파이프라인 규약 상수. pipeline/contract.json 에서 생성됨.</summary>
public static class PipelineContract
{
    public const int Version = 1;

    // ── 좌표계 변환 ──
    public const string GltfToUnityAxisFlip = "X";
    public const float BlenderFbxExtraYawDegrees = 180;
    public const string ModelFrontLocalAfterFbx = "-Z";

    // ── 임포트 설정 ──
    public const bool UseFileScale = true;
    public const string CharacterAnimationType = "Human";
    public const float ModelYawDegrees = 180;
    public const string PreferredRoute = "fbx";
    public static readonly string[] LoopClips = { "Walk", "Run", "Idle" };

    // ── 검사 기준값 ──
    public struct Tol { public float Expected; public float Tolerance;
        public Tol(float e, float t) { Expected = e; Tolerance = t; }
        public bool Ok(float v) => System.Math.Abs(v - Expected) <= Tolerance;
        public override string ToString() => $"{Expected}±{Tolerance}"; }

    public static readonly Tol CharacterHeight = new Tol(1.775f, 0.06f);
    public static readonly Tol FootToRoot = new Tol(0f, 0.02f);
    public static readonly Tol RootTranslation = new Tol(0f, 0.001f);
    public const int CharacterBoneCount = 17;
    public const int CharacterTriangles = 228;
    public const int CharacterSubmeshes = 6;
    public const string CharacterRootBone = "Hips";
    public const bool CharacterAvatarIsHuman = true;

    public static readonly Dictionary<string, Tol> ClipSeconds = new Dictionary<string, Tol>
    {
        { "Walk", new Tol(0.958f, 0.03f) },
        { "Run", new Tol(0.585f, 0.03f) },
        { "Idle", new Tol(4.363f, 0.05f) },
        { "Air", new Tol(0.5f, 0.02f) },
    };

    public static readonly Dictionary<string, Tol> WalkPoseDegrees = new Dictionary<string, Tol>
    {
        { "LeftUpperArm", new Tol(-24.72f, 1.5f) },
        { "LeftUpperLeg", new Tol(29.08f, 1.5f) },
        { "RightUpperLeg", new Tol(-29.08f, 1.5f) },
    };

    public static readonly Dictionary<string, int> StaticPieceTriangles = new Dictionary<string, int>
    {
        { "ground", 96800 },
        { "houses", 2600 },
        { "props", 5604 },
        { "weeds_baked", 72000 },
        { "walls", 120 },
        { "road", 36 },
        { "poles", 3568 },
    };

    public static readonly Dictionary<string, int> VertexColorMeshes = new Dictionary<string, int>
    {
        { "weeds_baked", 1 },
        { "props", 1 },
    };
}
