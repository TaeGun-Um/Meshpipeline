// 브라우저 web/src/controls.js 의 플레이어 로직을 Unity로 옮긴 것.
// 상수는 전부 그쪽 값을 그대로 쓴다 — Animator 블렌드 트리의 임계값(3.3 / 6.4)이
// 같은 숫자를 기준으로 잡혀 있어서, 여기서 값이 어긋나면 케이던스가 틀어진다.
//
// 지형 충돌은 브라우저처럼 절차적 높이 함수를 쓰지 않고 Unity 물리(CharacterController)에
// 맡긴다. 엔진에 넣는 게 목적이므로 엔진의 방식을 쓰는 편이 맞다.
using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class PlayerController : MonoBehaviour
{
    [Header("이동 (controls.js 와 동일)")]
    public float walkSpeed = 3.3f;      // WALK
    public float sprintSpeed = 6.4f;    // SPRINT
    public float accel = 22f;           // ACCEL
    public float friction = 14f;        // FRICTION
    public float gravity = 23f;         // GRAVITY
    public float jumpVelocity = 7.4f;   // JUMP_V

    [Header("카메라 (스프링암)")]
    public Transform cameraTarget;
    public float camDistance = 4.4f;
    public float camMinDistance = 1.8f;
    public float camMaxDistance = 11f;
    public float camHeight = 1.5f;
    public float lookHeight = 1.38f;
    public float mouseSensitivity = 0.14f;

    [Header("Animator")]
    public Animator animator;

    [Header("메시 정면 보정")]
    // 임포트된 메시의 시각적 정면이 로컬 -Z다. 블렌더 glTF 임포트(Y-up→Z-up)와
    // FBX 익스포트(axis_forward='-Z')가 겹쳐 180° 돌아간다.
    // transform.forward를 이동 방향에 그대로 맞추면 등을 보이며 걷는다.
    //
    // 정점으로 자동 판정하려 했지만 그건 틀린 접근이었다 — sharedMesh.vertices는
    // 바인드 포즈가 적용되기 전의 원본이라, 회전이 바인드 행렬에 들어가 있으면
    // 정점 좌표만 봐서는 알 수 없다. 그래서 값으로 고정한다.
    // 반대로 보이면 0으로 바꾸면 된다.
    public float modelYaw = 180f;

    CharacterController _cc;
    Vector3 _velocity;
    float _yaw;
    float _pitch = 12.6f;   // controls.js 초기 pitch 0.22rad
    bool _cursorLocked;

    void Awake()
    {
        _cc = GetComponent<CharacterController>();
        if (animator == null) animator = GetComponent<Animator>();
        _yaw = 0f;
        // 브라우저는 yaw 0에서 카메라가 +Z 뒤쪽에 서고 캐릭터가 -Z를 본다
        transform.rotation = FaceDir(Vector3.back);
        Debug.Log($"[PlayerController] modelYaw={modelYaw}");
        AlignFeet();
    }

    // 캡슐 바닥은 루트(y=0)에 있고, 접지하면 루트가 지면에 놓인다.
    // 시각적 발바닥이 루트와 어긋나면 캐릭터가 떠 보이거나 파묻힌다.
    //
    // 원래 원인은 익스포트 쪽이었다 — 브라우저의 런타임 위치가 glTF 루트 노드
    // translation으로 박혀 나갔다(y=1.1479). export/gltf.js 에서 루트 트랜스폼을
    // 초기화하도록 고쳤으므로 이 검사는 이제 0이어야 한다.
    //
    // 여기서 자동 보정하지 않고 경고만 한다. 보정하면 원인을 덮어버려서
    // 다음에 파이프라인이 틀어졌을 때 조용히 넘어가게 된다.
    void AlignFeet()
    {
        var smr = GetComponentInChildren<SkinnedMeshRenderer>();
        if (smr == null) return;

        var gap = smr.bounds.min.y - transform.position.y;
        if (Mathf.Abs(gap) < 0.02f) return;   // skinWidth 정도는 정상

        Debug.LogWarning(
            $"[PlayerController] 발바닥이 루트와 {gap:0.###} 어긋남 " +
            $"(메시 최저 y={smr.bounds.min.y:0.###}, 루트 y={transform.position.y:0.###}). " +
            "익스포트 파이프라인에서 루트 트랜스폼이 박혔는지 확인하세요.");
    }

    // 메시의 시각적 정면이 dir을 향하도록 하는 회전
    Quaternion FaceDir(Vector3 dir)
    {
        return Quaternion.LookRotation(dir) * Quaternion.Euler(0f, modelYaw, 0f);
    }

    void Update()
    {
        HandleCursor();
        HandleLook();
        HandleMove();
        DriveAnimator();
    }

    void LateUpdate()
    {
        UpdateCamera();
    }

    void HandleCursor()
    {
        if (Input.GetMouseButtonDown(0) && !_cursorLocked)
        {
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
            _cursorLocked = true;
        }
        if (Input.GetKeyDown(KeyCode.Escape) && _cursorLocked)
        {
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;
            _cursorLocked = false;
        }
    }

    void HandleLook()
    {
        if (_cursorLocked)
        {
            // 부호가 브라우저와 반대다.
            //  - yaw: 왼손 좌표계라 회전 방향이 뒤집힌다
            //  - pitch: Unity "Mouse Y"는 위로 밀 때 +, 브라우저 movementY는 아래로 +
            // 카메라 높이가 sin(pitch)에 비례하므로 위를 보려면 pitch가 줄어야 한다.
            _yaw += Input.GetAxisRaw("Mouse X") * mouseSensitivity * 8f;
            _pitch = Mathf.Clamp(
                _pitch - Input.GetAxisRaw("Mouse Y") * mouseSensitivity * 8f,
                -28f, 66f);
        }
        var wheel = Input.GetAxisRaw("Mouse ScrollWheel");
        if (Mathf.Abs(wheel) > 0.001f)
            camDistance = Mathf.Clamp(camDistance - wheel * 6f, camMinDistance, camMaxDistance);
    }

    void HandleMove()
    {
        // 카메라 yaw 기준 이동 방향.
        // 브라우저(three.js)는 오른손 좌표계라 right = fwd × up 이지만,
        // Unity는 왼손이라 순서가 뒤집힌다. -Z를 볼 때 오른쪽은 -X다.
        //   Cross(fwd, up) = Cross((0,0,-1),(0,1,0)) = (+1,0,0)  ← 왼쪽
        //   Cross(up, fwd) = Cross((0,1,0),(0,0,-1)) = (-1,0,0)  ← 오른쪽 (정답)
        var fwd = new Vector3(-Mathf.Sin(_yaw * Mathf.Deg2Rad), 0f, -Mathf.Cos(_yaw * Mathf.Deg2Rad));
        var right = Vector3.Cross(Vector3.up, fwd).normalized;

        var wish = Vector3.zero;
        if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) wish += fwd;
        if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) wish -= fwd;
        if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) wish += right;
        if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) wish -= right;

        bool sprinting = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);
        float maxSpeed = sprinting ? sprintSpeed : walkSpeed;

        var dt = Time.deltaTime;
        if (wish.sqrMagnitude > 0f)
        {
            wish = wish.normalized * maxSpeed;
            _velocity.x += (wish.x - _velocity.x) * Mathf.Min(1f, accel * dt);
            _velocity.z += (wish.z - _velocity.z) * Mathf.Min(1f, accel * dt);
            // 이동 방향을 바라보게 회전 (메시 정면 보정 포함)
            var target = FaceDir(new Vector3(wish.x, 0f, wish.z).normalized);
            transform.rotation = Quaternion.Slerp(
                transform.rotation, target, Mathf.Min(1f, 14f * dt));
        }
        else
        {
            var damp = Mathf.Min(1f, friction * dt);
            _velocity.x -= _velocity.x * damp;
            _velocity.z -= _velocity.z * damp;
        }

        if (_cc.isGrounded)
        {
            if (_velocity.y < 0f) _velocity.y = -2f;   // 접지 유지용 하향 압력
            if (Input.GetKey(KeyCode.Space)) _velocity.y = jumpVelocity;
        }
        _velocity.y -= gravity * dt;

        _cc.Move(_velocity * dt);
    }

    void DriveAnimator()
    {
        if (animator == null) return;
        var horizontal = new Vector2(_velocity.x, _velocity.z).magnitude;
        animator.SetFloat("Speed", horizontal);
        animator.SetBool("Airborne", !_cc.isGrounded);
    }

    void UpdateCamera()
    {
        if (cameraTarget == null) return;

        var pitchRad = _pitch * Mathf.Deg2Rad;
        var yawRad = _yaw * Mathf.Deg2Rad;
        var cp = Mathf.Cos(pitchRad);
        var pos = transform.position + new Vector3(
            Mathf.Sin(yawRad) * cp * camDistance,
            camHeight + Mathf.Sin(pitchRad) * camDistance,
            Mathf.Cos(yawRad) * cp * camDistance);

        cameraTarget.position = Vector3.Lerp(
            cameraTarget.position, pos, 1f - Mathf.Exp(-16f * Time.deltaTime));
        cameraTarget.LookAt(transform.position + Vector3.up * lookHeight);
    }
}
