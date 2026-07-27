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

function LanguageSurface({
  buildings,
  color,
}: {
  buildings: CityBuilding[];
  color: string;
}) {
  const surface = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const displayColor = useMemo(
    () => new Color(color).lerp(new Color("#05080b"), 0.24),
    [color],
  );

  useLayoutEffect(() => {
    if (!surface.current) return;
    buildings.forEach((building, index) => {
      dummy.position.set(
        building.position[0],
        building.height / 2,
        building.position[2],
      );
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(
        building.width * 1.002,
        building.height * 1.001,
        building.depth * 1.002,
      );
      dummy.updateMatrix();
      surface.current!.setMatrixAt(index, dummy.matrix);
    });
    surface.current.instanceMatrix.needsUpdate = true;
    surface.current.computeBoundingSphere();
  }, [buildings, dummy]);

  return (
    <instancedMesh
      ref={surface}
      args={[undefined, undefined, buildings.length]}
      raycast={() => null}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color={displayColor}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
        toneMapped={false}
      />
    </instancedMesh>
  );
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
  const litWindows = useRef<InstancedMesh>(null);
  const darkWindows = useRef<InstancedMesh>(null);
  const [hoveredInstance, setHoveredInstance] = useState<number | null>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const windowPlan = useMemo(
    () =>
      buildings.flatMap((building) => {
        const rows =
          buildings.length > 500
            ? 1
            : buildings.length > 120
              ? 2
              : Math.max(2, Math.min(6, Math.round(building.windowCount / 4)));
        return Array.from({ length: rows }, (_, row) =>
          Array.from({ length: 4 }, (_, side) => ({
            building,
            row,
            rows,
            side,
            lit:
              !building.archived &&
              (hashString(`${building.fullName}:${row}:${side}`) % 1000) /
                1000 <
                building.brightness,
          })),
        ).flat();
      }),
    [buildings],
  );
  const languageBatches = useMemo(() => {
    const batches = new Map<string, CityBuilding[]>();
    buildings.forEach((building) => {
      const color = building.archived ? "#252b30" : building.accent;
      const batch = batches.get(color) ?? [];
      batch.push(building);
      batches.set(color, batch);
    });
    return [...batches.entries()];
  }, [buildings]);
  const litWindowCount = windowPlan.filter((slot) => slot.lit).length;
  const darkWindowCount = windowPlan.length - litWindowCount;

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
    });

    bodies.current.instanceMatrix.needsUpdate = true;
    bases.current.instanceMatrix.needsUpdate = true;
    caps.current.instanceMatrix.needsUpdate = true;
    if (!Array.isArray(bodies.current.material)) {
      bodies.current.material.needsUpdate = true;
    }
    if (!Array.isArray(bases.current.material)) {
      bases.current.material.needsUpdate = true;
    }
    if (!Array.isArray(caps.current.material)) {
      caps.current.material.needsUpdate = true;
    }
    bodies.current.computeBoundingSphere();
  }, [buildings, dummy, hoveredInstance, selectedId]);

  useLayoutEffect(() => {
    if (
      (litWindowCount > 0 && !litWindows.current) ||
      (darkWindowCount > 0 && !darkWindows.current)
    ) {
      return;
    }
    let litInstance = 0;
    let darkInstance = 0;

    windowPlan.forEach(({ building, lit, row, rows, side }) => {
      const y =
        0.75 +
        ((row + 1) / (rows + 1)) *
          Math.max(0.4, building.height - 1.2);
      const frontX =
        Math.sin(building.rotation) * (building.depth / 2 + 0.02);
      const frontZ =
        Math.cos(building.rotation) * (building.depth / 2 + 0.02);
      const sideX =
        Math.cos(building.rotation) * (building.width / 2 + 0.02);
      const sideZ =
        -Math.sin(building.rotation) * (building.width / 2 + 0.02);
      const bands = [
        {
          x: frontX,
          z: frontZ,
          rotation: building.rotation,
          width: building.width * 0.68,
        },
        {
          x: -frontX,
          z: -frontZ,
          rotation: building.rotation,
          width: building.width * 0.68,
        },
        {
          x: sideX,
          z: sideZ,
          rotation: building.rotation + Math.PI / 2,
          width: building.depth * 0.68,
        },
        {
          x: -sideX,
          z: -sideZ,
          rotation: building.rotation + Math.PI / 2,
          width: building.depth * 0.68,
        },
      ];

      const band = bands[side];
      dummy.position.set(
        building.position[0] + band.x,
        y,
        building.position[2] + band.z,
      );
      dummy.rotation.set(0, band.rotation, 0);
      dummy.scale.set(band.width, lit ? 0.14 : 0.1, 0.025);
      dummy.updateMatrix();

      if (lit) {
        litWindows.current!.setMatrixAt(litInstance, dummy.matrix);
        litInstance += 1;
      } else {
        darkWindows.current!.setMatrixAt(darkInstance, dummy.matrix);
        darkInstance += 1;
      }
    });

    if (litWindows.current) {
      litWindows.current.instanceMatrix.needsUpdate = true;
      litWindows.current.computeBoundingSphere();
    }
    if (darkWindows.current) {
      darkWindows.current.instanceMatrix.needsUpdate = true;
      darkWindows.current.computeBoundingSphere();
    }
  }, [
    darkWindowCount,
    dummy,
    litWindowCount,
    windowPlan,
  ]);

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
        <meshBasicMaterial color="#071018" toneMapped={false} />
      </instancedMesh>

      {languageBatches.map(([color, batch]) => (
        <LanguageSurface key={color} buildings={batch} color={color} />
      ))}

      <instancedMesh
        ref={bases}
        args={[undefined, undefined, buildings.length]}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#17445c"
          emissive="#0e3043"
          emissiveIntensity={0.7}
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
        <meshBasicMaterial color="#5be9ff" toneMapped={false} />
      </instancedMesh>

      {litWindowCount > 0 && (
        <instancedMesh
          ref={litWindows}
          args={[undefined, undefined, litWindowCount]}
          raycast={() => null}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#ffd477" toneMapped={false} />
        </instancedMesh>
      )}
      {darkWindowCount > 0 && (
        <instancedMesh
          ref={darkWindows}
          args={[undefined, undefined, darkWindowCount]}
          raycast={() => null}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#182a33" toneMapped={false} />
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
      <ambientLight intensity={0.72} color="#83b5d8" />
      <hemisphereLight args={["#75baff", "#06101a", 1.05]} />
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
