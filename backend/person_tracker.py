"""
Person Tracker for Multiplayer Gesture-Flow DJ
Uses YOLOv8 for person detection/tracking + MediaPipe for hand landmarks
"""

import cv2
import numpy as np
import mediapipe as mp
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
import math
import time

# Try to import YOLO
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("[WARN] ultralytics not installed. Person tracking disabled.")


@dataclass
class HandData:
    """Data for a single detected hand"""
    position: Dict[str, float]  # x, y, z (normalized 0-1)
    is_pinching: bool = False
    is_fist: bool = False
    landmarks: List[Dict[str, float]] = field(default_factory=list)


@dataclass
class PlayerData:
    """Data for a single tracked player"""
    id: str
    color: str
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    hands: List[HandData] = field(default_factory=list)
    confidence: float = 0.0
    last_seen: float = 0.0


# Player colors
PLAYER_COLORS = [
    "#ff6b35",  # Orange
    "#00aaff",  # Blue
    "#00ff88",  # Green
    "#ff00aa",  # Pink
    "#ffaa00",  # Yellow
    "#aa00ff",  # Purple
]


class PersonTracker:
    """
    Tracks multiple people using YOLOv8 with ByteTrack,
    then detects hands for each person using MediaPipe
    """
    
    def __init__(self, max_players: int = 4):
        self.max_players = max_players
        self.players: Dict[str, PlayerData] = {}
        self.frame_count = 0
        
        # YOLO model (person detection with tracking)
        self.yolo_model = None
        if YOLO_AVAILABLE:
            try:
                # Use nano model for speed
                self.yolo_model = YOLO('yolov8n.pt')
                print("[OK] YOLOv8 model loaded")
            except Exception as e:
                print(f"[ERROR] Failed to load YOLO model: {e}")
        
        # MediaPipe Hands
        self.mp_hands = mp.solutions.hands
        self.hands_detector = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=max_players * 2,  # 2 hands per player
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        print("[OK] MediaPipe Hands initialized")
        
        # Constants for gesture detection
        self.PINCH_THRESHOLD = 0.08
        self.DEPTH_MIN_SIZE = 0.10
        self.DEPTH_MAX_SIZE = 0.40
    
    def _distance_2d(self, p1: Dict, p2: Dict) -> float:
        """Calculate 2D distance between two points"""
        return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2)
    
    def _distance_3d(self, p1: Dict, p2: Dict) -> float:
        """Calculate 3D distance between two points"""
        return math.sqrt(
            (p1['x'] - p2['x'])**2 + 
            (p1['y'] - p2['y'])**2 + 
            (p1.get('z', 0) - p2.get('z', 0))**2
        )
    
    def _check_pinch(self, landmarks: List[Dict]) -> bool:
        """Check if hand is making a pinch gesture"""
        if len(landmarks) < 21:
            return False
        
        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        
        distance = self._distance_3d(thumb_tip, index_tip)
        return distance < self.PINCH_THRESHOLD
    
    def _check_fist(self, landmarks: List[Dict]) -> bool:
        """Check if hand is making a fist gesture"""
        if len(landmarks) < 21:
            return False
        
        # Finger tips and PIPs
        index_tip = landmarks[8]
        middle_tip = landmarks[12]
        ring_tip = landmarks[16]
        pinky_tip = landmarks[20]
        
        index_pip = landmarks[6]
        middle_pip = landmarks[10]
        ring_pip = landmarks[14]
        pinky_pip = landmarks[18]
        
        # Check if fingertips are below PIPs (curled)
        index_curled = index_tip['y'] > index_pip['y'] - 0.02
        middle_curled = middle_tip['y'] > middle_pip['y'] - 0.02
        ring_curled = ring_tip['y'] > ring_pip['y'] - 0.02
        pinky_curled = pinky_tip['y'] > pinky_pip['y'] - 0.02
        
        curled_count = sum([index_curled, middle_curled, ring_curled, pinky_curled])
        
        # Also check if tips are close together
        tips_spread = self._distance_2d(index_tip, pinky_tip)
        tips_compact = tips_spread < 0.15
        
        return curled_count >= 3 and tips_compact
    
    def _calculate_hand_depth(self, landmarks: List[Dict]) -> float:
        """
        Calculate depth based on apparent hand size
        Larger hand = closer to camera = lower depth value (0)
        Smaller hand = farther = higher depth value (1)
        """
        if len(landmarks) < 21:
            return 0.5
        
        wrist = landmarks[0]
        middle_tip = landmarks[12]
        index_mcp = landmarks[5]
        pinky_mcp = landmarks[17]
        
        # Hand length
        hand_length = self._distance_2d(wrist, middle_tip)
        
        # Palm width
        palm_width = self._distance_2d(index_mcp, pinky_mcp)
        
        # Combined size
        combined_size = (palm_width * 2.5 + hand_length * 0.8) / 2
        
        # Normalize to 0-1 (inverted: big = close = 0)
        normalized = (combined_size - self.DEPTH_MIN_SIZE) / (self.DEPTH_MAX_SIZE - self.DEPTH_MIN_SIZE)
        depth = 1 - max(0, min(1, normalized))
        
        return depth
    
    def _process_hand_landmarks(self, hand_landmarks, frame_width: int, frame_height: int) -> HandData:
        """Process MediaPipe hand landmarks into HandData"""
        landmarks = []
        
        for lm in hand_landmarks.landmark:
            landmarks.append({
                'x': lm.x,
                'y': lm.y,
                'z': lm.z
            })
        
        # Calculate gestures
        is_fist = self._check_fist(landmarks)
        is_pinching = not is_fist and self._check_pinch(landmarks)
        
        # Calculate position (use palm center or pinch point)
        if is_pinching:
            thumb_tip = landmarks[4]
            index_tip = landmarks[8]
            position = {
                'x': 1 - (thumb_tip['x'] + index_tip['x']) / 2,  # Mirror X
                'y': 1 - (thumb_tip['y'] + index_tip['y']) / 2,  # Invert Y
                'z': self._calculate_hand_depth(landmarks)
            }
        else:
            palm_center = landmarks[9]  # Middle finger MCP
            position = {
                'x': 1 - palm_center['x'],  # Mirror X
                'y': 1 - palm_center['y'],  # Invert Y
                'z': self._calculate_hand_depth(landmarks)
            }
        
        return HandData(
            position=position,
            is_pinching=is_pinching,
            is_fist=is_fist,
            landmarks=landmarks
        )
    
    def _assign_hands_to_players(
        self, 
        hands: List[HandData], 
        players: Dict[str, PlayerData],
        frame_width: int,
        frame_height: int
    ) -> Dict[str, PlayerData]:
        """Assign detected hands to tracked players based on position"""
        
        for player_id, player in players.items():
            player.hands = []
            
            # Player bbox in normalized coordinates
            px1 = player.bbox[0] / frame_width
            py1 = player.bbox[1] / frame_height
            px2 = player.bbox[2] / frame_width
            py2 = player.bbox[3] / frame_height
            
            # Find hands within this player's bbox (with some margin)
            margin = 0.1
            for hand in hands:
                # Hand position is already normalized and mirrored
                # We need to un-mirror for comparison with bbox
                hx = 1 - hand.position['x']
                hy = 1 - hand.position['y']
                
                if (px1 - margin <= hx <= px2 + margin and 
                    py1 - margin <= hy <= py2 + margin):
                    player.hands.append(hand)
        
        return players
    
    def process_frame(self, frame: np.ndarray) -> List[Dict]:
        """
        Process a video frame and return player data
        
        Args:
            frame: BGR image from OpenCV
            
        Returns:
            List of player dictionaries with hand data
        """
        self.frame_count += 1
        current_time = time.time()
        
        frame_height, frame_width = frame.shape[:2]
        
        # Convert BGR to RGB for processing
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Step 1: Detect and track people with YOLO (every 3 frames for performance)
        if self.yolo_model and self.frame_count % 3 == 0:
            try:
                results = self.yolo_model.track(
                    frame,
                    persist=True,
                    classes=[0],  # class 0 = person
                    conf=0.5,
                    verbose=False
                )
                
                # Update player tracking
                seen_ids = set()
                
                if results[0].boxes is not None:
                    for box in results[0].boxes:
                        if box.id is not None:
                            track_id = int(box.id)
                            player_id = f"player_{track_id}"
                            seen_ids.add(player_id)
                            
                            bbox = box.xyxy[0].cpu().numpy().astype(int)
                            confidence = float(box.conf)
                            
                            if player_id not in self.players:
                                # New player
                                color_idx = len(self.players) % len(PLAYER_COLORS)
                                self.players[player_id] = PlayerData(
                                    id=player_id,
                                    color=PLAYER_COLORS[color_idx],
                                    bbox=tuple(bbox),
                                    confidence=confidence,
                                    last_seen=current_time
                                )
                                print(f"[TRACK] New player: {player_id} with color {PLAYER_COLORS[color_idx]}")
                            else:
                                # Update existing player
                                self.players[player_id].bbox = tuple(bbox)
                                self.players[player_id].confidence = confidence
                                self.players[player_id].last_seen = current_time
                
                # Remove players not seen for a while
                timeout = 2.0  # seconds
                to_remove = [
                    pid for pid, p in self.players.items()
                    if current_time - p.last_seen > timeout
                ]
                for pid in to_remove:
                    print(f"[TRACK] Player left: {pid}")
                    del self.players[pid]
                    
            except Exception as e:
                print(f"[ERROR] YOLO tracking error: {e}")
        
        # Step 2: Detect hands with MediaPipe
        hands_result = self.hands_detector.process(frame_rgb)
        
        detected_hands: List[HandData] = []
        if hands_result.multi_hand_landmarks:
            for hand_landmarks in hands_result.multi_hand_landmarks:
                hand_data = self._process_hand_landmarks(
                    hand_landmarks, 
                    frame_width, 
                    frame_height
                )
                detected_hands.append(hand_data)
        
        # Step 3: Assign hands to players
        if self.players:
            self.players = self._assign_hands_to_players(
                detected_hands,
                self.players,
                frame_width,
                frame_height
            )
        else:
            # No YOLO tracking - fallback to simple hand detection
            # Assign hands to virtual players based on screen position
            for i, hand in enumerate(detected_hands[:self.max_players * 2]):
                player_id = f"player_{i // 2}"
                
                if player_id not in self.players:
                    color_idx = (i // 2) % len(PLAYER_COLORS)
                    self.players[player_id] = PlayerData(
                        id=player_id,
                        color=PLAYER_COLORS[color_idx],
                        bbox=(0, 0, frame_width, frame_height),
                        last_seen=current_time
                    )
                
                self.players[player_id].hands.append(hand)
        
        # Convert to output format
        output = []
        for player in self.players.values():
            player_dict = {
                'id': player.id,
                'color': player.color,
                'hands': []
            }
            
            for hand in player.hands:
                player_dict['hands'].append({
                    'position': hand.position,
                    'isPinching': hand.is_pinching,
                    'isFist': hand.is_fist
                })
            
            output.append(player_dict)
        
        return output
    
    def cleanup(self):
        """Release resources"""
        if self.hands_detector:
            self.hands_detector.close()


# Singleton instance
_tracker_instance: Optional[PersonTracker] = None


def get_tracker(max_players: int = 4) -> PersonTracker:
    """Get or create the singleton PersonTracker instance"""
    global _tracker_instance
    if _tracker_instance is None:
        _tracker_instance = PersonTracker(max_players)
    return _tracker_instance
