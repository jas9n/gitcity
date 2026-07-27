"use client";

import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import {
  Environment,
  Grid,
  OrbitControls,
  Sparkles,
  Stars,
} from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  Color,
  FogExp2,
  Group,
  MathUtils,
  Mesh,
} from "three";
import type { CityBuilding } from "@/lib/city-model";
import { hashString } from "@/lib/city-model";

type CitySceneProps = {
  buildings: CityBuilding[];
  selectedId: CityBuilding["id"] | null;
  onSelect: (building: CityBuilding) => void;
  onHover: (building: CityBuilding | null) => void;
  reduceMotion: boolean;
};

type WindowSlot = {
  key: string;
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number, number];
  lit: boolean;
};

function createWindowSlots(building: CityBuilding): WindowSlot[] {
  const rows = Math.max(2, Math.min(12, Math.round(building.height / 1.25)));
  const columns = building.width > 2.65 ? 4 : 3;
  const slots: WindowSlot[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y =
      rows === 1
        ? building.height / 2
        : 0.6 + (row / (rows - 1)) * Math.max(0.4, building.height - 1.2);
    for (let column = 0; column < columns; column += 1) {
      const x =
        ((column + 1) / (columns + 1) - 0.5) * (building.width - 0.38);
      const random =
        (hashString(`${building.fullName}-${row}-${column}`) % 1000) / 1000;
      const lit = random < building.brightness;
      slots.push({
        key: `front-${row}-${column}`,
        position: [x, y, building.depth / 2 + 0.016],
        rotation: [0, 0, 0],
        size: [Math.min(0.34, building.width / 7), 0.17, 0.025],
        lit,
      });
      slots.push({
        key: `back-${row}-${column}`,
        position: [x, y, -building.depth / 2 - 0.016],
        rotation: [0, 0, 0],
        size: [Math.min(0.34, building.width / 7), 0.17, 0.025],
        lit: lit && column % 2 === 0,
      });
    }

    const sideColumns = Math.max(2, Math.round(building.depth / 0.9));
    for (let side = 0; side < sideColumns; side += 1) {
      const z =
        ((side + 1) / (sideColumns + 1) - 0.5) * (building.depth - 0.35);
      const lit =
        (hashString(`${building.name}-side-${row}-${side}`) % 1000) / 1000 <
        building.brightness * 0.82;
      slots.push({
        key: `side-${row}-${side}`,
        position: [building.width / 2 + 0.016, y, z],
        rotation: [0, Math.PI / 2, 0],
        size: [Math.min(0.32, building.depth / 6), 0.17, 0.025],
        lit,
      });
    }
  }
  return slots;
}

function Building({
  building,
  selected,
  onSelect,
  onHover,
}: {
  building: CityBuilding;
  selected: boolean;
  onSelect: (building: CityBuilding) => void;
  onHover: (building: CityBuilding | null) => void;
}) {
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const windows = useMemo(() => createWindowSlots(building), [building]);
  const isLandmark = building.tier === "landmark";

  useFrame((_, delta) => {
    if (!group.current) return;
    const target = hovered || selected ? 1.035 : 1;
    group.current.scale.x = MathUtils.damp(group.current.scale.x, target, 7, delta);
    group.current.scale.z = MathUtils.damp(group.current.scale.z, target, 7, delta);
  });

  const handlePointerEnter = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
    onHover(building);
    document.body.style.cursor = "pointer";
  };

  const handlePointerLeave = () => {
    setHovered(false);
    onHover(null);
    document.body.style.cursor = "default";
  };

  return (
    <group
      ref={group}
      position={building.position}
      rotation={[0, building.rotation, 0]}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(building);
      }}
    >
      <mesh position={[0, building.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[building.width, building.height, building.depth]} />
        <meshStandardMaterial
          color={selected ? "#15283c" : "#09141f"}
          emissive={building.accent}
          emissiveIntensity={selected || hovered ? 0.12 : 0.025}
          metalness={0.82}
          roughness={0.3}
        />
      </mesh>

      {building.tier !== "low-rise" && (
        <mesh
          position={[0, building.height - 0.55, 0]}
          castShadow
        >
          <boxGeometry
            args={[
              building.width * 0.78,
              1.1,
              building.depth * 0.78,
            ]}
          />
          <meshStandardMaterial
            color="#0b1825"
            emissive={building.accent}
            emissiveIntensity={0.05}
            metalness={0.85}
            roughness={0.26}
          />
        </mesh>
      )}

      {windows.map((slot) => (
        <mesh
          key={slot.key}
          position={slot.position}
          rotation={slot.rotation}
        >
          <boxGeometry args={slot.size} />
          <meshBasicMaterial
            color={
              slot.lit
                ? building.archived
                  ? "#20364c"
                  : selected
                    ? "#ffffff"
                    : "#ffc968"
                : "#07101a"
            }
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh position={[0, building.height + 0.035, 0]}>
        <boxGeometry
          args={[building.width * 0.9, 0.07, building.depth * 0.9]}
        />
        <meshBasicMaterial
          color={building.accent}
          transparent
          opacity={selected || hovered ? 0.95 : 0.48}
          toneMapped={false}
        />
      </mesh>

      {isLandmark && (
        <>
          <mesh position={[0, building.height + 0.75, 0]}>
            <cylinderGeometry args={[0.055, 0.13, 1.45, 8]} />
            <meshBasicMaterial color={building.accent} toneMapped={false} />
          </mesh>
          <pointLight
            position={[0, building.height + 1.4, 0]}
            color={building.accent}
            intensity={selected ? 18 : 7}
            distance={7}
          />
        </>
      )}

      <mesh position={[0, 0.08, 0]}>
        <boxGeometry
          args={[building.width + 0.34, 0.16, building.depth + 0.34]}
        />
        <meshStandardMaterial
          color="#0a121a"
          emissive={building.accent}
          emissiveIntensity={selected ? 0.28 : 0.045}
          metalness={0.7}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

function TrafficLines({ reduceMotion }: { reduceMotion: boolean }) {
  const eastWest = useRef<Mesh>(null);
  const northSouth = useRef<Mesh>(null);

  useFrame((state) => {
    if (reduceMotion) return;
    const time = state.clock.elapsedTime;
    if (eastWest.current) eastWest.current.position.x = ((time * 3.8 + 28) % 56) - 28;
    if (northSouth.current)
      northSouth.current.position.z = ((time * 3.1 + 24) % 48) - 24;
  });

  return (
    <>
      <mesh ref={eastWest} position={[-25, 0.12, 7.9]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial
          color="#ff5fd1"
          toneMapped={false}
          blending={AdditiveBlending}
        />
        <pointLight color="#ff5fd1" intensity={6} distance={2.2} />
      </mesh>
      <mesh ref={northSouth} position={[-7.9, 0.12, -22]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial
          color="#53e5ff"
          toneMapped={false}
          blending={AdditiveBlending}
        />
        <pointLight color="#53e5ff" intensity={6} distance={2.2} />
      </mesh>
    </>
  );
}

function Scene({
  buildings,
  selectedId,
  onSelect,
  onHover,
  reduceMotion,
}: CitySceneProps) {
  return (
    <>
      <color attach="background" args={["#02060c"]} />
      <fogExp2 attach="fog" args={["#02060c", 0.027]} />
      <ambientLight intensity={0.42} color="#7394b8" />
      <hemisphereLight args={["#659cff", "#02040a", 0.7]} />
      <directionalLight
        position={[15, 24, 12]}
        intensity={1.4}
        color="#b9d8ff"
        castShadow
      />
      <pointLight position={[-18, 8, 6]} intensity={38} distance={36} color="#2adfff" />
      <pointLight position={[16, 5, -12]} intensity={30} distance={32} color="#e24cff" />

      <Stars
        radius={90}
        depth={42}
        count={1100}
        factor={2}
        saturation={0.4}
        fade
        speed={reduceMotion ? 0 : 0.15}
      />
      <Sparkles
        count={70}
        scale={[58, 18, 50]}
        size={1.1}
        speed={reduceMotion ? 0 : 0.16}
        opacity={0.2}
        color="#6edfff"
        position={[0, 8, 0]}
      />

      <group
        onClick={() => {
          onHover(null);
        }}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[88, 72]} />
          <meshStandardMaterial
            color="#040a10"
            metalness={0.7}
            roughness={0.5}
          />
        </mesh>
        <Grid
          position={[0, 0.035, 0]}
          args={[88, 72]}
          cellSize={1}
          cellThickness={0.2}
          cellColor="#173147"
          sectionSize={8}
          sectionThickness={1.1}
          sectionColor="#1f6682"
          fadeDistance={62}
          fadeStrength={1.7}
          infiniteGrid={false}
        />
        {buildings.map((building) => (
          <Building
            key={building.id}
            building={building}
            selected={building.id === selectedId}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
        <TrafficLines reduceMotion={reduceMotion} />
      </group>

      <OrbitControls
        makeDefault
        target={[0, 4.8, 0]}
        minDistance={15}
        maxDistance={58}
        minPolarAngle={0.55}
        maxPolarAngle={1.38}
        enablePan={false}
        enableDamping
        dampingFactor={0.055}
        autoRotate={!reduceMotion && selectedId === null}
        autoRotateSpeed={0.24}
      />
      <Environment preset="city" environmentIntensity={0.22} />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.05}
          luminanceThreshold={0.55}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.18} darkness={0.72} />
      </EffectComposer>
    </>
  );
}

export function CityScene(props: CitySceneProps) {
  return (
    <Canvas
      dpr={[1, 1.7]}
      camera={{ position: [26, 22, 31], fov: 43, near: 0.1, far: 180 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows
      onCreated={({ scene }) => {
        scene.fog = new FogExp2(new Color("#02060c"), 0.027);
      }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}
