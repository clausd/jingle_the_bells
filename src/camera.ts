import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'

// Keep in step with the installed @mediapipe/tasks-vision version.
const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm'
const modelUrl = (variant: 'lite' | 'full') =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${variant}/float16/latest/pose_landmarker_${variant}.task`

// One person's 33 MediaPipe landmarks in normalized image coordinates.
export type Pose = NormalizedLandmark[]

export interface PoseSource {
  readonly aspect: number
  // New poses when there's a new camera frame, otherwise null.
  poll(now: number): Pose[] | null
}

export async function loadLandmarker(variant: 'lite' | 'full', numPoses: number) {
  const fileset = await FilesetResolver.forVisionTasks(WASM)
  const create = (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl(variant), delegate },
      runningMode: 'VIDEO',
      numPoses,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
  try {
    return await create('GPU')
  } catch {
    return await create('CPU')
  }
}

export async function openCamera(video: HTMLVideoElement, facingMode: 'user' | 'environment') {
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
  })
  await video.play()
}

export class CameraSource implements PoseSource {
  private lastFrame = -1

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly landmarker: PoseLandmarker,
  ) {}

  get aspect() {
    return this.video.videoWidth / this.video.videoHeight || 16 / 9
  }

  poll(now: number) {
    if (this.video.readyState < 2 || this.video.currentTime === this.lastFrame) return null
    this.lastFrame = this.video.currentTime
    return this.landmarker.detectForVideo(this.video, now).landmarks
  }
}
