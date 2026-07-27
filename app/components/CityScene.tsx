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
  MeshBasicMaterial,
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

type SurfaceTone = "default" | "hovered" | "selected";
type ActivityDotKind = "commits" | "pullRequests" | "issues";

type ActivityDotSlot = {
  building: CityBuilding;
  dotIndex: number;
  dotCount: number;
  side: number;
};

const ACTIVITY_DOT_COLORS: Record<ActivityDotKind, string> = {
  commits: "#67e8f9",
  pullRequests: "#c084fc",
  issues: "#fb7185",
};

function activityDotKind(
  building: CityBuilding,
  dotIndex: number,
  dotCount: number,
): ActivityDotKind {
  const commitWeight = building.commits30d;
  const pullRequestWeight = building.mergedPullRequests30d * 3;
  const issueWeight =
    building.closedIssues30d * 2 + building.openedIssues30d;
  const totalWeight = commitWeight + pullRequestWeight + issueWeight;
  const sample = ((dotIndex + 0.5) / dotCount) * totalWeight;

  if (sample < commitWeight) return "commits";
  if (sample < commitWeight + pullRequestWeight) return "pullRequests";
  return "issues";
}

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

function BuildingSurfaceBatch({
  buildings,
  color,
  tone,
}: {
  buildings: CityBuilding[];
  color: string;
  tone: SurfaceTone;
}) {
  const surfaces = useRef<InstancedMesh>(null);
  const roofs = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const displayColor = useMemo(
    () => {
      const languageColor = new Color(color);
      if (tone === "selected") {
        return languageColor.lerp(new Color("#e4f5ff"), 0.12);
      }
      return languageColor.lerp(
        new Color("#05080b"),
        tone === "hovered" ? 0.46 : 0.24,
      );
    },
    [color, tone],
  );

  useLayoutEffect(() => {
    if (!surfaces.current || !roofs.current) return;
    buildings.forEach((building, index) => {
      const emphasis = 1.002;
      dummy.position.set(
        building.position[0],
        building.height / 2,
        building.position[2],
      );
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(
        building.width * emphasis,
        building.height * 1.001,
        building.depth * emphasis,
      );
      dummy.updateMatrix();
      surfaces.current!.setMatrixAt(index, dummy.matrix);

      dummy.position.set(
        building.position[0],
        building.height + 0.035,
        building.position[2],
      );
      dummy.scale.set(
        building.width * 0.9 * emphasis,
        0.07,
        building.depth * 0.9 * emphasis,
      );
      dummy.updateMatrix();
      roofs.current!.setMatrixAt(index, dummy.matrix);
    });
    surfaces.current.instanceMatrix.needsUpdate = true;
    roofs.current.instanceMatrix.needsUpdate = true;
    surfaces.current.computeBoundingSphere();
    roofs.current.computeBoundingSphere();
  }, [buildings, dummy]);

  return (
    <>
      <instancedMesh
        ref={surfaces}
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
      <instancedMesh
        ref={roofs}
        args={[undefined, undefined, buildings.length]}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={displayColor} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function RooftopBeaconBatch({
  buildings,
  color,
  reduceMotion,
}: {
  buildings: CityBuilding[];
  color: string;
  reduceMotion: boolean;
}) {
  const beacons = useRef<InstancedMesh>(null);
  const beaconMaterial = useRef<MeshBasicMaterial>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    if (!beacons.current) return;
    buildings.forEach((building, index) => {
      const scale = 0.72 + building.recentActivity * 0.55;
      dummy.position.set(
        building.position[0],
        building.height + 0.2,
        building.position[2],
      );
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      beacons.current!.setMatrixAt(index, dummy.matrix);
    });
    beacons.current.instanceMatrix.needsUpdate = true;
    beacons.current.computeBoundingSphere();
  }, [buildings, dummy]);

  useFrame((state) => {
    if (!beaconMaterial.current) return;
    beaconMaterial.current.opacity = reduceMotion
      ? 0.72
      : 0.58 + Math.sin(state.clock.elapsedTime * 2.2) * 0.18;
  });

  return (
    <instancedMesh
      ref={beacons}
      args={[undefined, undefined, buildings.length]}
      raycast={() => null}
    >
      <cylinderGeometry args={[0.055, 0.1, 0.3, 8]} />
      <meshBasicMaterial
        ref={beaconMaterial}
        color={color}
        transparent
        opacity={0.72}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function RooftopBeacons({
  buildings,
  reduceMotion,
}: {
  buildings: CityBuilding[];
  reduceMotion: boolean;
}) {
  const batches = useMemo(() => {
    const grouped = new Map<string, CityBuilding[]>();
    buildings.forEach((building) => {
      if (building.archived || building.recentActivity <= 0.04) return;
      const batch = grouped.get(building.accent) ?? [];
      batch.push(building);
      grouped.set(building.accent, batch);
    });
    return [...grouped.entries()];
  }, [buildings]);

  return batches.map(([color, batch]) => (
    <RooftopBeaconBatch
      key={color}
      buildings={batch}
      color={color}
      reduceMotion={reduceMotion}
    />
  ));
}

function ActivityDotBatch({
  slots,
  color,
}: {
  slots: ActivityDotSlot[];
  color: string;
}) {
  const dots = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    if (!dots.current) return;

    slots.forEach(({ building, dotCount, dotIndex, side }, index) => {
      const facadeWidth = side < 2 ? building.width : building.depth;
      const seed = hashString(`${building.fullName}:${side}`);
      const phaseX = (seed % 997) / 997;
      const phaseY = ((seed >>> 10) % 991) / 991;
      const horizontal =
        ((phaseX + (dotIndex + 1) * 0.61803398875) % 1) - 0.5;
      const vertical =
        (phaseY + (dotIndex + 1) * 0.41421356237) % 1;
      const lateral = horizontal * facadeWidth * 0.68;
      const y =
        0.48 + vertical * Math.max(0.18, building.height - 0.88);
      const localX =
        side < 2
          ? lateral
          : (side === 2 ? 1 : -1) * (building.width / 2 + 0.028);
      const localZ =
        side < 2
          ? (side === 0 ? 1 : -1) * (building.depth / 2 + 0.028)
          : lateral;
      const cosine = Math.cos(building.rotation);
      const sine = Math.sin(building.rotation);
      const offsetX = cosine * localX + sine * localZ;
      const offsetZ = -sine * localX + cosine * localZ;
      const size =
        0.045 +
        (((hashString(`${building.fullName}:${side}:${dotIndex}`) >>> 18) %
          100) /
          100) *
          0.025;

      dummy.position.set(
        building.position[0] + offsetX,
        y,
        building.position[2] + offsetZ,
      );
      dummy.rotation.set(
        0,
        side === 0
          ? building.rotation
          : side === 1
            ? building.rotation + Math.PI
            : side === 2
              ? building.rotation + Math.PI / 2
              : building.rotation - Math.PI / 2,
        0,
      );
      dummy.scale.setScalar(size * (0.92 + dotCount / 225));
      dummy.updateMatrix();
      dots.current!.setMatrixAt(index, dummy.matrix);
    });

    dots.current.instanceMatrix.needsUpdate = true;
    dots.current.computeBoundingSphere();
  }, [dummy, slots]);

  return (
    <instancedMesh
      ref={dots}
      args={[undefined, undefined, slots.length]}
      raycast={() => null}
    >
      <circleGeometry args={[1, 10]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.88}
        depthWrite={false}
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
  reduceMotion,
}: CitySceneProps) {
  const bodies = useRef<InstancedMesh>(null);
  const bases = useRef<InstancedMesh>(null);
  const [hoveredInstance, setHoveredInstance] = useState<number | null>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const activityDotBatches = useMemo(() => {
    const batches = new Map<ActivityDotKind, ActivityDotSlot[]>([
      ["commits", []],
      ["pullRequests", []],
      ["issues", []],
    ]);

    buildings.forEach((building) => {
      if (building.archived || building.activityDotCount === 0) return;
      const dotCount =
        buildings.length > 500
          ? Math.min(10, building.activityDotCount)
          : buildings.length > 120
            ? Math.min(14, building.activityDotCount)
            : building.activityDotCount;

      for (let side = 0; side < 4; side += 1) {
        for (let dotIndex = 0; dotIndex < dotCount; dotIndex += 1) {
          const kind = activityDotKind(building, dotIndex, dotCount);
          batches.get(kind)!.push({
            building,
            dotIndex,
            dotCount,
            side,
          });
        }
      }
    });

    return [...batches.entries()].filter(([, slots]) => slots.length > 0);
  }, [buildings]);
  const hoveredId =
    hoveredInstance === null ? null : buildings[hoveredInstance]?.id ?? null;
  const languageBatches = useMemo(() => {
    const batches = new Map<
      string,
      { color: string; tone: SurfaceTone; buildings: CityBuilding[] }
    >();
    buildings.forEach((building) => {
      const color = building.archived ? "#252b30" : building.accent;
      const tone: SurfaceTone =
        building.id === selectedId
          ? "selected"
          : building.id === hoveredId
            ? "hovered"
            : "default";
      const key = `${color}:${tone}`;
      const batch = batches.get(key) ?? { color, tone, buildings: [] };
      batch.buildings.push(building);
      batches.set(key, batch);
    });
    return [...batches.values()];
  }, [buildings, hoveredId, selectedId]);

  useLayoutEffect(() => {
    if (!bodies.current || !bases.current) return;

    bodies.current.instanceMatrix.setUsage(DynamicDrawUsage);
    bases.current.instanceMatrix.setUsage(DynamicDrawUsage);

    buildings.forEach((building, index) => {
      dummy.position.set(
        building.position[0],
        building.height / 2,
        building.position[2],
      );
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(building.width, building.height, building.depth);
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
    });

    bodies.current.instanceMatrix.needsUpdate = true;
    bases.current.instanceMatrix.needsUpdate = true;
    if (!Array.isArray(bodies.current.material)) {
      bodies.current.material.needsUpdate = true;
    }
    if (!Array.isArray(bases.current.material)) {
      bases.current.material.needsUpdate = true;
    }
    bodies.current.computeBoundingSphere();
  }, [buildings, dummy]);

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
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      {languageBatches.map((batch) => (
        <BuildingSurfaceBatch
          key={`${batch.color}:${batch.tone}`}
          buildings={batch.buildings}
          color={batch.color}
          tone={batch.tone}
        />
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

      <RooftopBeacons buildings={buildings} reduceMotion={reduceMotion} />

      {activityDotBatches.map(([kind, slots]) => (
        <ActivityDotBatch
          key={kind}
          slots={slots}
          color={ACTIVITY_DOT_COLORS[kind]}
        />
      ))}
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
          reduceMotion={reduceMotion}
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
