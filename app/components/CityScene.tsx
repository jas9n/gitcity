"use client";

import {
  Canvas,
  type ThreeEvent,
  useFrame,
} from "@react-three/fiber";
import {
  Environment,
  Grid,
  OrbitControls,
  Sparkles,
  Stars,
} from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import {
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  FogExp2,
  InstancedMesh,
  Mesh,
  Object3D,
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

type CityBounds = {
  center: [number, number, number];
  width: number;
  depth: number;
  radius: number;
};

function calculateBounds(buildings: CityBuilding[]): CityBounds {
  if (buildings.length === 0) {
    return { center: [0, 0, 0], width: 88, depth: 72, radius: 44 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  buildings.forEach((building) => {
    minX = Math.min(minX, building.position[0] - building.width / 2);
    maxX = Math.max(maxX, building.position[0] + building.width / 2);
    minZ = Math.min(minZ, building.position[2] - building.depth / 2);
    maxZ = Math.max(maxZ, building.position[2] + building.depth / 2);
  });

  const width = Math.max(88, maxX - minX + 28);
  const depth = Math.max(72, maxZ - minZ + 28);
  return {
    center: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2],
    width,
    depth,
    radius: Math.max(width, depth) / 2,
  };
}

function instanceColor(
  building: CityBuilding,
  selected: boolean,
  hovered: boolean,
) {
  const base = new Color("#07111b");
  const accent = new Color(building.accent);
  return base.lerp(accent, selected ? 0.34 : hovered ? 0.24 : 0.11);
}

function BuildingInstances({
  buildings,
  selectedId,
  onSelect,
  onHover,
}: Omit<CitySceneProps, "reduceMotion">) {
  const bodies = useRef<InstancedMesh>(null);
  const bases = useRef<InstancedMesh>(null);
  const caps = useRef<InstancedMesh>(null);
  const windows = useRef<InstancedMesh>(null);
  const [hoveredInstance, setHoveredInstance] = useState<number | null>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const detailedWindows = buildings.length <= 360;
  const windowRows = buildings.length <= 120 ? 4 : 2;
  const windowCount = detailedWindows ? buildings.length * windowRows : 0;

  useLayoutEffect(() => {
    if (!bodies.current || !bases.current || !caps.current) return;

    bodies.current.instanceMatrix.setUsage(DynamicDrawUsage);
    bases.current.instanceMatrix.setUsage(DynamicDrawUsage);
    caps.current.instanceMatrix.setUsage(DynamicDrawUsage);

    buildings.forEach((building, index) => {
      const selected = building.id === selectedId;
      const hovered = index === hoveredInstance;
      const emphasis = selected || hovered ? 1.035 : 1;

      dummy.position.set(
        building.position[0],
        building.height / 2,
        building.position[2],
      );
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(
        building.width * emphasis,
        building.height,
        building.depth * emphasis,
      );
      dummy.updateMatrix();
      bodies.current!.setMatrixAt(index, dummy.matrix);
      bodies.current!.setColorAt(
        index,
        instanceColor(building, selected, hovered),
      );

      dummy.position.set(
        building.position[0],
        0.08,
        building.position[2],
      );
      dummy.scale.set(
        building.width + 0.34,
        0.16,
        building.depth + 0.34,
      );
      dummy.updateMatrix();
      bases.current!.setMatrixAt(index, dummy.matrix);
      bases.current!.setColorAt(
        index,
        new Color(building.accent).multiplyScalar(selected ? 0.44 : 0.2),
      );

      dummy.position.set(
        building.position[0],
        building.height + 0.035,
        building.position[2],
      );
      dummy.scale.set(
        building.width * 0.9,
        selected || hovered ? 0.11 : 0.07,
        building.depth * 0.9,
      );
      dummy.updateMatrix();
      caps.current!.setMatrixAt(index, dummy.matrix);
      caps.current!.setColorAt(index, new Color(building.accent));
    });

    bodies.current.instanceMatrix.needsUpdate = true;
    bases.current.instanceMatrix.needsUpdate = true;
    caps.current.instanceMatrix.needsUpdate = true;
    if (bodies.current.instanceColor) bodies.current.instanceColor.needsUpdate = true;
    if (bases.current.instanceColor) bases.current.instanceColor.needsUpdate = true;
    if (caps.current.instanceColor) caps.current.instanceColor.needsUpdate = true;
    bodies.current.computeBoundingSphere();
  }, [buildings, dummy, hoveredInstance, selectedId]);

  useLayoutEffect(() => {
    if (!windows.current || !detailedWindows) return;
    let instance = 0;

    buildings.forEach((building) => {
      for (let row = 0; row < windowRows; row += 1) {
        const y = 0.75 + ((row + 1) / (windowRows + 1)) * Math.max(0.4, building.height - 1.2);
        const offsetX = Math.sin(building.rotation) * (building.depth / 2 + 0.02);
        const offsetZ = Math.cos(building.rotation) * (building.depth / 2 + 0.02);
        dummy.position.set(
          building.position[0] + offsetX,
          y,
          building.position[2] + offsetZ,
        );
        dummy.rotation.set(0, building.rotation, 0);
        dummy.scale.set(building.width * 0.68, 0.12, 0.025);
        dummy.updateMatrix();
        windows.current!.setMatrixAt(instance, dummy.matrix);

        const lit =
          (hashString(`${building.fullName}-band-${row}`) % 1000) / 1000 <
          building.brightness;
        windows.current!.setColorAt(
          instance,
          new Color(lit ? "#ffc968" : "#0b1c2a"),
        );
        instance += 1;
      }
    });

    windows.current.instanceMatrix.needsUpdate = true;
    if (windows.current.instanceColor) {
      windows.current.instanceColor.needsUpdate = true;
    }
    windows.current.computeBoundingSphere();
  }, [buildings, detailedWindows, dummy, windowRows]);

  const buildingFromEvent = (
    event: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>,
  ) =>
    event.instanceId === undefined ? null : buildings[event.instanceId] ?? null;

  if (buildings.length === 0) return null;

  return (
    <group>
      <instancedMesh
        ref={bodies}
        args={[undefined, undefined, buildings.length]}
        castShadow={buildings.length <= 450}
        receiveShadow
        onPointerMove={(event) => {
          event.stopPropagation();
          const building = buildingFromEvent(event);
          const instance = event.instanceId ?? null;
          if (!building || instance === hoveredInstance) return;
          setHoveredInstance(instance);
          onHover(building);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHoveredInstance(null);
          onHover(null);
          document.body.style.cursor = "default";
        }}
        onClick={(event) => {
          event.stopPropagation();
          const building = buildingFromEvent(event);
          if (building) onSelect(building);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          emissive="#06131e"
          emissiveIntensity={0.2}
          metalness={0.82}
          roughness={0.3}
        />
      </instancedMesh>

      <instancedMesh
        ref={bases}
        args={[undefined, undefined, buildings.length]}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          vertexColors
          emissive="#07121c"
          emissiveIntensity={0.18}
          metalness={0.7}
          roughness={0.35}
        />
      </instancedMesh>

      <instancedMesh
        ref={caps}
        args={[undefined, undefined, buildings.length]}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      {detailedWindows && (
        <instancedMesh
          ref={windows}
          args={[undefined, undefined, windowCount]}
          raycast={() => null}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial vertexColors toneMapped={false} />
        </instancedMesh>
      )}
    </group>
  );
}

function TrafficLines({
  reduceMotion,
  center,
}: {
  reduceMotion: boolean;
  center: CityBounds["center"];
}) {
  const eastWest = useRef<Mesh>(null);
  const northSouth = useRef<Mesh>(null);

  useFrame((state) => {
    if (reduceMotion) return;
    const time = state.clock.elapsedTime;
    if (eastWest.current) {
      eastWest.current.position.x = center[0] + ((time * 3.8 + 28) % 56) - 28;
    }
    if (northSouth.current) {
      northSouth.current.position.z = center[2] + ((time * 3.1 + 24) % 48) - 24;
    }
  });

  return (
    <>
      <mesh ref={eastWest} position={[center[0] - 25, 0.12, center[2] + 7.9]}>
        <sphereGeometry args={[0.055, 8, 8]} />
        <meshBasicMaterial
          color="#ff5fd1"
          toneMapped={false}
          blending={AdditiveBlending}
        />
        <pointLight color="#ff5fd1" intensity={6} distance={2.2} />
      </mesh>
      <mesh ref={northSouth} position={[center[0] - 7.9, 0.12, center[2] - 22]}>
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
  const bounds = useMemo(() => calculateBounds(buildings), [buildings]);
  const maxDistance = Math.max(58, bounds.radius * 1.6);

  return (
    <>
      <color attach="background" args={["#02060c"]} />
      <fogExp2
        attach="fog"
        args={["#02060c", Math.max(0.006, 0.027 * (44 / bounds.radius))]}
      />
      <ambientLight intensity={0.42} color="#7394b8" />
      <hemisphereLight args={["#659cff", "#02040a", 0.7]} />
      <directionalLight
        position={[15, 24, 12]}
        intensity={1.4}
        color="#b9d8ff"
        castShadow={buildings.length <= 450}
      />
      <pointLight position={[-18, 8, 6]} intensity={38} distance={36} color="#2adfff" />
      <pointLight position={[16, 5, -12]} intensity={30} distance={32} color="#e24cff" />

      <Stars
        radius={Math.max(90, bounds.radius * 1.8)}
        depth={42}
        count={1100}
        factor={2}
        saturation={0.4}
        fade
        speed={reduceMotion ? 0 : 0.15}
      />
      <Sparkles
        count={Math.min(180, 70 + Math.floor(buildings.length / 12))}
        scale={[bounds.width * 0.72, 18, bounds.depth * 0.72]}
        size={1.1}
        speed={reduceMotion ? 0 : 0.16}
        opacity={0.2}
        color="#6edfff"
        position={[bounds.center[0], 8, bounds.center[2]]}
      />

      <group onClick={() => onHover(null)}>
        <mesh
          position={bounds.center}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[bounds.width, bounds.depth]} />
          <meshStandardMaterial
            color="#040a10"
            metalness={0.7}
            roughness={0.5}
          />
        </mesh>
        <Grid
          position={[bounds.center[0], 0.035, bounds.center[2]]}
          args={[bounds.width, bounds.depth]}
          cellSize={1}
          cellThickness={0.2}
          cellColor="#173147"
          sectionSize={8}
          sectionThickness={1.1}
          sectionColor="#1f6682"
          fadeDistance={Math.max(62, bounds.radius * 1.25)}
          fadeStrength={1.7}
          infiniteGrid={false}
        />
        <BuildingInstances
          buildings={buildings}
          selectedId={selectedId}
          onSelect={onSelect}
          onHover={onHover}
        />
        <TrafficLines reduceMotion={reduceMotion} center={bounds.center} />
      </group>

      <OrbitControls
        makeDefault
        target={[bounds.center[0], 4.8, bounds.center[2]]}
        minDistance={15}
        maxDistance={maxDistance}
        minPolarAngle={0.55}
        maxPolarAngle={1.38}
        enablePan={bounds.radius > 52}
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
      camera={{ position: [26, 22, 31], fov: 43, near: 0.1, far: 2000 }}
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
