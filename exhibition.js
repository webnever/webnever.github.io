import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat@0.11.2';

// Import media array from art.html
let media = [];

// Fetch and parse media from art.html
async function loadMediaFromArtHTML() {
    try {
        const response = await fetch('/art.html');
        const htmlText = await response.text();
        
        // Extract the media array from the JavaScript in art.html
        const scriptMatch = htmlText.match(/const media = \[([\s\S]*?)\];/);
        if (scriptMatch) {
            // Parse the media array content
            const mediaArrayContent = scriptMatch[1];
            const mediaStrings = mediaArrayContent.match(/{\s*type:\s*'image',\s*path:\s*'[^']*'\s*}/g);
            
            if (mediaStrings) {
                media = mediaStrings.map(mediaString => {
                    const pathMatch = mediaString.match(/path:\s*'([^']*)'/);
                    return {
                        type: 'image',
                        path: pathMatch ? pathMatch[1] : ''
                    };
                });
            }
        }
    } catch (error) {
        console.error('Error loading media from art.html:', error);
        // Fallback to empty array if loading fails
        media = [];
    }
}
const GRAVITY = -9.81;
const CAMERA_FOV = 75;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 1000;
const INITIAL_CAMERA_Y = 5;
const INITIAL_CAMERA_Z = 10;
const EYE_HEIGHT_OFFSET = 1.6;

// Gallery dimensions
const HALLWAY_WIDTH = 20;
const WALL_HEIGHT = 12;
const ART_SPACING = 6;
const ART_HEIGHT = 6;
const ART_WIDTH = 4;
const WALL_DISTANCE = 8;
const FRAME_BORDER = 0.5;
const ART_OFFSET = 0.1;

// Physics constants
const FLOOR_THICKNESS = 0.1;
const WALL_THICKNESS = 0.1;
const PLAYER_HEIGHT = 0.8;
const PLAYER_RADIUS = 0.4;
const PLAYER_RESTITUTION = 0.0;
const PLAYER_FRICTION = 1.0;
const PLAYER_MASS = 70.0;
const JUMP_FORCE = 8;
const MOVEMENT_FORCE = 50;
const DECELERATION_FORCE = 15;
const MAX_HORIZONTAL_SPEED = 10;
const LINEAR_DAMPING = 0.5;
const ANGULAR_DAMPING = 0.9;
const GROUND_VELOCITY_THRESHOLD = 0.5;
const GROUND_HEIGHT_THRESHOLD = 6;

// Lighting constants
const AMBIENT_LIGHT_COLOR = 0x404040;
const AMBIENT_LIGHT_INTENSITY = 0.8;
const POINT_LIGHT_COLOR = 0xffffff;
const POINT_LIGHT_INTENSITY = 0.5;
const POINT_LIGHT_DISTANCE = 30;
const CEILING_LIGHT_HEIGHT = 10;
const CEILING_LIGHT_SPACING = 3;
const SPOTLIGHT_INTENSITY = 0.8;
const SPOTLIGHT_DISTANCE = 15;
const SPOTLIGHT_ANGLE = Math.PI / 8;
const SPOTLIGHT_PENUMBRA = 0.2;
const SPOTLIGHT_HEIGHT_OFFSET = 1;
const SPOTLIGHT_SIDE_OFFSET = 1.5;

// Control constants
const MOUSE_SENSITIVITY = 0.002;
const MAX_LOOK_UP = Math.PI / 2;
const MAX_LOOK_DOWN = -Math.PI / 2;

// Material colors
const FLOOR_COLOR = 0x111111;
const FLOOR_OPACITY = 0.8;
const WALL_COLOR = 0x0a0a0a;
const WALL_OPACITY = 0.9;
const FRAME_COLOR = 0x333333;
const PLACEHOLDER_COLOR = 0x333333;
const PLACEHOLDER_OPACITY = 0.5;

// Fog settings
const FOG_COLOR = 0x000000;
const FOG_NEAR = 50;
const FOG_FAR = 200;

// Global variables
let scene, camera, renderer, world, playerBody, playerController;
let clock = new THREE.Clock();
let keys = {};

// Player movement variables
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();

// Mouse look variables
let isPointerLocked = false;
let euler = new THREE.Euler(0, 0, 0, 'YXZ');

// Initialize the 3D scene
async function init() {
    // Load media array from art.html first
    await loadMediaFromArtHTML();
    
    // Initialize Rapier physics
    await RAPIER.init();
    world = new RAPIER.World(new RAPIER.Vector3(0.0, GRAVITY, 0.0));
    
    // Scene setup
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
    
    // Camera setup
    camera = new THREE.PerspectiveCamera(CAMERA_FOV, window.innerWidth / window.innerHeight, CAMERA_NEAR, CAMERA_FAR);
    camera.position.set(0, INITIAL_CAMERA_Y, INITIAL_CAMERA_Z);
    
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(FOG_COLOR);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(AMBIENT_LIGHT_COLOR, AMBIENT_LIGHT_INTENSITY);
    scene.add(ambientLight);
    
    // Main hall lighting - multiple ceiling lights
    for (let i = -media.length/2; i < media.length/2; i += CEILING_LIGHT_SPACING) {
        const ceilingLight = new THREE.PointLight(POINT_LIGHT_COLOR, POINT_LIGHT_INTENSITY, POINT_LIGHT_DISTANCE);
        ceilingLight.position.set(0, CEILING_LIGHT_HEIGHT, i * ART_SPACING);
        scene.add(ceilingLight);
    }
    
    // Create gallery structure and physics
    createGallery();
    
    // Create player physics body
    createPlayer();
    
    // Setup controls
    setupControls();
    
    // Start animation loop
    animate();
}

function createGallery() {
    // Gallery dimensions
    const hallwayLength = media.length * ART_SPACING;
    
    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(HALLWAY_WIDTH, hallwayLength);
    const floorMaterial = new THREE.MeshLambertMaterial({ 
        color: FLOOR_COLOR,
        transparent: true,
        opacity: FLOOR_OPACITY
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Create floor physics body
    const floorShape = RAPIER.ColliderDesc.cuboid(HALLWAY_WIDTH/2, FLOOR_THICKNESS, hallwayLength/2);
    world.createCollider(floorShape.setTranslation(0, -FLOOR_THICKNESS, 0));
    
    // Create ceiling
    const ceiling = new THREE.Mesh(floorGeometry, floorMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_HEIGHT;
    scene.add(ceiling);
    
    // Create walls
    const wallGeometry = new THREE.PlaneGeometry(hallwayLength, WALL_HEIGHT);
    const wallMaterial = new THREE.MeshLambertMaterial({ 
        color: WALL_COLOR,
        transparent: true,
        opacity: WALL_OPACITY
    });
    
    // Left wall
    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -HALLWAY_WIDTH / 2;
    leftWall.position.y = WALL_HEIGHT / 2;
    scene.add(leftWall);
    
    // Left wall physics
    const leftWallShape = RAPIER.ColliderDesc.cuboid(WALL_THICKNESS, WALL_HEIGHT/2, hallwayLength/2);
    world.createCollider(leftWallShape.setTranslation(-HALLWAY_WIDTH/2, WALL_HEIGHT/2, 0));
    
    // Right wall
    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.x = HALLWAY_WIDTH / 2;
    rightWall.position.y = WALL_HEIGHT / 2;
    scene.add(rightWall);
    
    // Right wall physics
    const rightWallShape = RAPIER.ColliderDesc.cuboid(WALL_THICKNESS, WALL_HEIGHT/2, hallwayLength/2);
    world.createCollider(rightWallShape.setTranslation(HALLWAY_WIDTH/2, WALL_HEIGHT/2, 0));
    
    // Add artworks
    addArtworks();
}

function addArtworks() {
    media.forEach((artwork, index) => {
        // Alternate between left and right walls
        const isLeftWall = index % 2 === 0;
        const zPosition = (index * ART_SPACING) - (media.length * ART_SPACING / 2);
        
        // Create artwork frame
        const frameGeometry = new THREE.PlaneGeometry(ART_WIDTH + FRAME_BORDER, ART_HEIGHT + FRAME_BORDER);
        const frameMaterial = new THREE.MeshLambertMaterial({ color: FRAME_COLOR });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        
        // Position frame
        frame.position.x = isLeftWall ? -WALL_DISTANCE : WALL_DISTANCE;
        frame.position.y = ART_HEIGHT / 2;
        frame.position.z = zPosition;
        frame.rotation.y = isLeftWall ? Math.PI / 2 : -Math.PI / 2;
        
        scene.add(frame);
        
        // Load and add artwork
        const loader = new THREE.TextureLoader();
        loader.load(
            artwork.path,
            (texture) => {
                // Calculate aspect ratio and resize
                const aspectRatio = texture.image.width / texture.image.height;
                let finalWidth = ART_WIDTH;
                let finalHeight = ART_HEIGHT;
                
                if (aspectRatio > 1) {
                    finalHeight = ART_WIDTH / aspectRatio;
                } else {
                    finalWidth = ART_HEIGHT * aspectRatio;
                }
                
                const artGeometry = new THREE.PlaneGeometry(finalWidth, finalHeight);
                const artMaterial = new THREE.MeshLambertMaterial({ 
                    map: texture,
                    transparent: true
                });
                const art = new THREE.Mesh(artGeometry, artMaterial);
                
                // Position artwork (slightly in front of frame)
                art.position.x = isLeftWall ? -WALL_DISTANCE + ART_OFFSET : WALL_DISTANCE - ART_OFFSET;
                art.position.y = ART_HEIGHT / 2;
                art.position.z = zPosition;
                art.rotation.y = isLeftWall ? Math.PI / 2 : -Math.PI / 2;
                art.castShadow = true;
                
                scene.add(art);
                
                // Add focused lighting above each artwork
                const artLight = new THREE.SpotLight(POINT_LIGHT_COLOR, SPOTLIGHT_INTENSITY, SPOTLIGHT_DISTANCE, SPOTLIGHT_ANGLE, SPOTLIGHT_PENUMBRA);
                artLight.position.set(
                    art.position.x + (isLeftWall ? SPOTLIGHT_SIDE_OFFSET : -SPOTLIGHT_SIDE_OFFSET),
                    ART_HEIGHT + SPOTLIGHT_HEIGHT_OFFSET,
                    art.position.z
                );
                artLight.target.position.copy(art.position);
                scene.add(artLight);
                scene.add(artLight.target);
            },
            undefined,
            (error) => {
                console.log('Error loading texture:', artwork.path);
                // Create placeholder for missing images
                const placeholderMaterial = new THREE.MeshLambertMaterial({ 
                    color: PLACEHOLDER_COLOR,
                    transparent: true,
                    opacity: PLACEHOLDER_OPACITY
                });
                const placeholder = new THREE.Mesh(new THREE.PlaneGeometry(ART_WIDTH, ART_HEIGHT), placeholderMaterial);
                placeholder.position.x = isLeftWall ? -WALL_DISTANCE + ART_OFFSET : WALL_DISTANCE - ART_OFFSET;
                placeholder.position.y = ART_HEIGHT / 2;
                placeholder.position.z = zPosition;
                placeholder.rotation.y = isLeftWall ? Math.PI / 2 : -Math.PI / 2;
                scene.add(placeholder);
            }
        );
    });
}

function createPlayer() {
    // Create player physics body (capsule for smooth movement)
    const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, INITIAL_CAMERA_Y, INITIAL_CAMERA_Z)
        .lockRotations() // Prevent player from tipping over
        .setLinearDamping(LINEAR_DAMPING)
        .setAngularDamping(ANGULAR_DAMPING);
    
    playerBody = world.createRigidBody(playerBodyDesc);
    
    // Set mass for more stable movement
    playerBody.setAdditionalMass(PLAYER_MASS, true);
    
    // Create capsule collider for player
    const playerShape = RAPIER.ColliderDesc.capsule(PLAYER_HEIGHT, PLAYER_RADIUS)
        .setRestitution(PLAYER_RESTITUTION)
        .setFriction(PLAYER_FRICTION);
    
    world.createCollider(playerShape, playerBody);
}

function setupControls() {
    // Pointer lock
    const element = document.body;
    
    element.addEventListener('click', () => {
        element.requestPointerLock();
    });
    
    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === element;
    });
    
    // Mouse look
    document.addEventListener('mousemove', (event) => {
        if (!isPointerLocked) return;
        
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;
        
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= movementX * MOUSE_SENSITIVITY;
        euler.x -= movementY * MOUSE_SENSITIVITY;
        euler.x = Math.max(MAX_LOOK_DOWN, Math.min(MAX_LOOK_UP, euler.x));
        
        camera.quaternion.setFromEuler(euler);
    });
    
    // Keyboard controls
    const onKeyDown = (event) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'Space':
                if (canJump) {
                    const impulse = new RAPIER.Vector3(0, JUMP_FORCE, 0);
                    playerBody.applyImpulse(impulse, true);
                    canJump = false;
                }
                event.preventDefault();
                break;
        }
    };
    
    const onKeyUp = (event) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };
    
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    // Update physics
    world.step();
    
    // Get player position from physics body
    const playerPosition = playerBody.translation();
    const playerVelocity = playerBody.linvel();
    
    // Check if player can jump (touching ground)
    canJump = Math.abs(playerVelocity.y) < GROUND_VELOCITY_THRESHOLD && playerPosition.y < GROUND_HEIGHT_THRESHOLD;
    
    // Calculate movement direction based on camera orientation
    direction.set(0, 0, 0);
    
    if (moveForward) direction.z -= 1;
    if (moveBackward) direction.z += 1;
    if (moveLeft) direction.x -= 1;
    if (moveRight) direction.x += 1;
    
    direction.normalize();
    
    // Apply camera rotation to movement direction
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    
    // Calculate final movement
    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(forward, direction.z);
    moveVector.addScaledVector(right, direction.x);
    
    const currentVel = playerBody.linvel();
    
    // Apply movement force to player body
    if (moveVector.length() > 0) {
        // Player is trying to move
        moveVector.normalize();
        const force = new RAPIER.Vector3(
            moveVector.x * MOVEMENT_FORCE, 
            0, 
            moveVector.z * MOVEMENT_FORCE
        );
        playerBody.addForce(force, true);
    } else {
        // No input - apply deceleration force to stop the player
        const horizontalVel = new THREE.Vector3(currentVel.x, 0, currentVel.z);
        if (horizontalVel.length() > 0.1) { // Only decelerate if moving fast enough
            horizontalVel.normalize();
            const decelerationForce = new RAPIER.Vector3(
                -horizontalVel.x * DECELERATION_FORCE,
                0,
                -horizontalVel.z * DECELERATION_FORCE
            );
            playerBody.addForce(decelerationForce, true);
        }
    }
    
    // Clamp horizontal velocity to prevent excessive speed
    const horizontalSpeed = Math.sqrt(currentVel.x * currentVel.x + currentVel.z * currentVel.z);
    if (horizontalSpeed > MAX_HORIZONTAL_SPEED) {
        const scale = MAX_HORIZONTAL_SPEED / horizontalSpeed;
        playerBody.setLinvel(
            new RAPIER.Vector3(
                currentVel.x * scale,
                currentVel.y, // Keep vertical velocity unchanged
                currentVel.z * scale
            ),
            true
        );
    }
    
    // Update camera position to follow player
    camera.position.set(playerPosition.x, playerPosition.y + EYE_HEIGHT_OFFSET, playerPosition.z);
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize when page loads
init();